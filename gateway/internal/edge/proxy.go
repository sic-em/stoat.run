package edge

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const requestChunkSize = 1024 * 1024 // 1MB

type streamOpenPayload struct {
	Method     string              `json:"method"`
	URL        string              `json:"url"`
	Headers    map[string][]string `json:"headers"`
	RemoteAddr string              `json:"remoteAddr"`
}

type responseInitPayload struct {
	StatusCode int            `json:"statusCode"`
	Headers    map[string]any `json:"headers"`
}

type streamRSTPayload struct {
	Code   int    `json:"code"`
	Reason string `json:"reason"`
}

type responseMetrics struct {
	StatusCode int
	Bytes      int64
}

func (h *GatewayHandler) ProxyRequest(tunnel *TunnelConn, w http.ResponseWriter, r *http.Request) {
	if (Policy{}).Check(w, r, tunnel) {
		return
	}

	tunnel.TouchViewer(clientIPFromRequest(r), r.Header.Get("User-Agent"))
	startedAt := time.Now()
	reqBytes := int64(0)
	resBytes := int64(0)
	statusCode := http.StatusBadGateway
	var streamErr error

	defer func() {
		event := buildOverlayRequestEvent(
			h.cfg,
			tunnel.Slug,
			r,
			statusCode,
			time.Since(startedAt),
			reqBytes,
			resBytes,
			streamErr,
		)
		h.overlayEvents.Publish(tunnel.Slug, event)
	}()

	stream, err := tunnel.AllocStream()
	if err != nil {
		http.Error(w, "unable to allocate stream", http.StatusServiceUnavailable)
		return
	}
	defer tunnel.ReleaseStream(stream.ID)

	meta := streamOpenPayload{
		Method:     r.Method,
		URL:        r.URL.RequestURI(),
		Headers:    r.Header.Clone(),
		RemoteAddr: r.RemoteAddr,
	}
	if meta.Headers == nil {
		meta.Headers = make(map[string][]string)
	}
	meta.Headers["Host"] = []string{r.Host}
	metaRaw, _ := json.Marshal(meta)

	if err := tunnel.WriteFrame(Frame{
		Type:     FrameTypeStreamOpen,
		Flags:    0,
		StreamID: stream.ID,
		Payload:  metaRaw,
	}); err != nil {
		http.Error(w, "failed to open stream", http.StatusBadGateway)
		return
	}

	reqBytes, err = h.forwardRequestBody(tunnel, stream.ID, r.Body)
	if err != nil {
		streamErr = err
		http.Error(w, "failed to send request body", http.StatusBadGateway)
		return
	}

	metrics, err := h.pipeResponseStream(stream, w)
	if err != nil {
		streamErr = err
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	statusCode = metrics.StatusCode
	resBytes = metrics.Bytes
}

func clientIPFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}
	xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
	if xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			first := strings.TrimSpace(parts[0])
			if first != "" {
				return first
			}
		}
	}
	return r.RemoteAddr
}

func (h *GatewayHandler) forwardRequestBody(tunnel *TunnelConn, streamID uint16, body io.ReadCloser) (int64, error) {
	defer body.Close()

	limitReader := io.LimitReader(body, h.cfg.MaxBodySize+1)
	buf := make([]byte, requestChunkSize)
	var total int64

	for {
		n, err := limitReader.Read(buf)
		if n > 0 {
			total += int64(n)
			if total > h.cfg.MaxBodySize {
				return 0, errors.New("request body exceeds max allowed size")
			}

			payload := make([]byte, n)
			copy(payload, buf[:n])
			if err := tunnel.WriteFrame(Frame{
				Type:     FrameTypeStreamData,
				Flags:    0,
				StreamID: streamID,
				Payload:  payload,
			}); err != nil {
				return 0, err
			}
		}

		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return 0, err
		}
	}

	if err := tunnel.WriteFrame(Frame{
		Type:     FrameTypeStreamEnd,
		Flags:    FlagFinal,
		StreamID: streamID,
		Payload:  []byte{},
	}); err != nil {
		return 0, err
	}
	return total, nil
}

func (h *GatewayHandler) pipeResponseStream(stream *Stream, w http.ResponseWriter) (responseMetrics, error) {
	gotInit := false
	statusCode := http.StatusNoContent
	var bytesWritten int64
	timeout := time.NewTimer(60 * time.Second)
	defer timeout.Stop()

	for {
		select {
		case <-timeout.C:
			return responseMetrics{}, errors.New("timeout waiting for tunnel response")
		case frame, ok := <-stream.respCh:
			if !ok {
				return responseMetrics{}, errors.New("tunnel closed stream")
			}

			switch frame.Type {
			case FrameTypeResponseInit:
				var initPayload responseInitPayload
				if err := json.Unmarshal(frame.Payload, &initPayload); err != nil {
					return responseMetrics{}, errors.New("invalid response init payload")
				}

				copyResponseHeaders(w.Header(), initPayload.Headers)
				if initPayload.StatusCode <= 0 {
					initPayload.StatusCode = http.StatusOK
				}
				statusCode = initPayload.StatusCode
				w.WriteHeader(initPayload.StatusCode)
				gotInit = true
				resetTimer(timeout)
			case FrameTypeStreamData:
				if !gotInit {
					statusCode = http.StatusOK
					w.WriteHeader(http.StatusOK)
					gotInit = true
				}
				n, err := w.Write(frame.Payload)
				if err != nil {
					return responseMetrics{}, err
				}
				bytesWritten += int64(n)
				resetTimer(timeout)
			case FrameTypeStreamEnd:
				if !gotInit {
					statusCode = http.StatusNoContent
					w.WriteHeader(http.StatusNoContent)
				}
				return responseMetrics{StatusCode: statusCode, Bytes: bytesWritten}, nil
			case FrameTypeStreamRST:
				var rst streamRSTPayload
				if err := json.Unmarshal(frame.Payload, &rst); err != nil {
					return responseMetrics{}, errors.New("stream reset by tunnel")
				}
				if rst.Reason == "" {
					rst.Reason = "stream reset by tunnel"
				}
				return responseMetrics{}, errors.New(rst.Reason)
			}
		}
	}
}

func copyResponseHeaders(dst http.Header, src map[string]any) {
	for key, raw := range src {
		switch v := raw.(type) {
		case string:
			dst.Add(key, v)
		case float64:
			dst.Add(key, strconv.FormatFloat(v, 'f', -1, 64))
		case bool:
			dst.Add(key, strconv.FormatBool(v))
		case []any:
			for _, item := range v {
				dst.Add(key, stringifyHeaderValue(item))
			}
		}
	}
}

func stringifyHeaderValue(v any) string {
	switch vv := v.(type) {
	case string:
		return vv
	case float64:
		return strconv.FormatFloat(vv, 'f', -1, 64)
	case bool:
		return strconv.FormatBool(vv)
	default:
		return ""
	}
}

func resetTimer(timer *time.Timer) {
	if !timer.Stop() {
		select {
		case <-timer.C:
		default:
		}
	}
	timer.Reset(60 * time.Second)
}
