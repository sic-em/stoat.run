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

func (h *GatewayHandler) ProxyRequest(tunnel *TunnelConn, w http.ResponseWriter, r *http.Request) {
	if (Policy{}).Check(w, r, tunnel) {
		return
	}

	tunnel.TouchViewer(clientIPFromRequest(r), r.Header.Get("User-Agent"))

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

	if err := h.forwardRequestBody(tunnel, stream.ID, r.Body); err != nil {
		http.Error(w, "failed to send request body", http.StatusBadGateway)
		return
	}

	if err := h.pipeResponseStream(stream, w); err != nil {
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
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

func (h *GatewayHandler) forwardRequestBody(tunnel *TunnelConn, streamID uint16, body io.ReadCloser) error {
	defer body.Close()

	limitReader := io.LimitReader(body, h.cfg.MaxBodySize+1)
	buf := make([]byte, requestChunkSize)
	var total int64

	for {
		n, err := limitReader.Read(buf)
		if n > 0 {
			total += int64(n)
			if total > h.cfg.MaxBodySize {
				return errors.New("request body exceeds max allowed size")
			}

			payload := make([]byte, n)
			copy(payload, buf[:n])
			if err := tunnel.WriteFrame(Frame{
				Type:     FrameTypeStreamData,
				Flags:    0,
				StreamID: streamID,
				Payload:  payload,
			}); err != nil {
				return err
			}
		}

		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
	}

	return tunnel.WriteFrame(Frame{
		Type:     FrameTypeStreamEnd,
		Flags:    FlagFinal,
		StreamID: streamID,
		Payload:  []byte{},
	})
}

func (h *GatewayHandler) pipeResponseStream(stream *Stream, w http.ResponseWriter) error {
	gotInit := false
	timeout := time.NewTimer(60 * time.Second)
	defer timeout.Stop()

	for {
		select {
		case <-timeout.C:
			return errors.New("timeout waiting for tunnel response")
		case frame, ok := <-stream.respCh:
			if !ok {
				return errors.New("tunnel closed stream")
			}

			switch frame.Type {
			case FrameTypeResponseInit:
				var initPayload responseInitPayload
				if err := json.Unmarshal(frame.Payload, &initPayload); err != nil {
					return errors.New("invalid response init payload")
				}

				copyResponseHeaders(w.Header(), initPayload.Headers)
				if initPayload.StatusCode <= 0 {
					initPayload.StatusCode = http.StatusOK
				}
				w.WriteHeader(initPayload.StatusCode)
				gotInit = true
				resetTimer(timeout)
			case FrameTypeStreamData:
				if !gotInit {
					w.WriteHeader(http.StatusOK)
					gotInit = true
				}
				if _, err := w.Write(frame.Payload); err != nil {
					return err
				}
				resetTimer(timeout)
			case FrameTypeStreamEnd:
				if !gotInit {
					w.WriteHeader(http.StatusNoContent)
				}
				return nil
			case FrameTypeStreamRST:
				var rst streamRSTPayload
				if err := json.Unmarshal(frame.Payload, &rst); err != nil {
					return errors.New("stream reset by tunnel")
				}
				if rst.Reason == "" {
					rst.Reason = "stream reset by tunnel"
				}
				return errors.New(rst.Reason)
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
