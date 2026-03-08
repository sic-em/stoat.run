package edge

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	"golang.org/x/time/rate"
)

type AuthPayload struct {
	Slug    string `json:"slug"`
	Token   string `json:"token"`
	Version string `json:"version"`
}

type authErrPayload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type authOKPayload struct {
	Slug      string `json:"slug"`
	PublicURL string `json:"publicUrl"`
	ExpiresAt string `json:"expiresAt"`
}

var tunnelUpgrader = websocket.Upgrader{
	CheckOrigin: func(_ *http.Request) bool { return true },
}

func (h *GatewayHandler) HandleTunnelUpgrade(w http.ResponseWriter, r *http.Request) {
	conn, err := tunnelUpgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Warn().Err(err).Msg("websocket upgrade failed")
		return
	}

	_, raw, err := conn.ReadMessage()
	if err != nil {
		_ = conn.Close()
		return
	}

	firstFrame, err := DecodeFrame(raw)
	if err != nil || firstFrame.Type != FrameTypeAuth {
		sendAuthErrAndClose(conn, "invalid_auth_frame", "expected AUTH frame as first message")
		return
	}

	var auth AuthPayload
	if err := json.Unmarshal(firstFrame.Payload, &auth); err != nil {
		sendAuthErrAndClose(conn, "invalid_auth_payload", "invalid auth payload")
		return
	}

	sessionInfo, err := h.validator.ValidateSession(r.Context(), auth.Slug, auth.Token)
	if err != nil {
		sendAuthErrAndClose(conn, "control_plane_error", "control plane validation failed")
		return
	}
	if !sessionInfo.Valid {
		sendAuthErrAndClose(conn, "auth_failed", "invalid or expired session")
		return
	}

	burst := int(math.Ceil(h.cfg.RateLimitRPS * 2))
	if burst < 1 {
		burst = 1
	}
	limiter := rate.NewLimiter(rate.Limit(h.cfg.RateLimitRPS), burst)
	tunnelCtx, cancel := context.WithCancel(context.Background())

	tunnel := &TunnelConn{
		Slug:      auth.Slug,
		Token:     auth.Token,
		ExpiresAt: sessionInfo.ExpiresAt,
		BasicAuth: sessionInfo.BasicAuth,
		WSConn:    conn,
		streams:   make(map[uint16]*Stream),
		nextID:    2,
		limiter:   limiter,
		ctx:       tunnelCtx,
		cancel:    cancel,
		closed:    make(chan struct{}),
	}
	tunnel.lastPongUnix.Store(time.Now().Unix())
	h.registry.Set(auth.Slug, tunnel)

	publicURL := fmt.Sprintf("https://%s.%s", auth.Slug, h.cfg.BaseDomain)
	okPayload, _ := json.Marshal(authOKPayload{
		Slug:      auth.Slug,
		PublicURL: publicURL,
		ExpiresAt: sessionInfo.ExpiresAt,
	})

	if err := tunnel.WriteFrame(Frame{
		Type:     FrameTypeAuthOK,
		Flags:    FlagFinal,
		StreamID: 0,
		Payload:  okPayload,
	}); err != nil {
		h.registry.Delete(auth.Slug)
		_ = conn.Close()
		return
	}

	go h.readTunnelLoop(tunnel)
	go h.pingLoop(tunnel)
	go h.viewerCountLoop(tunnel)
}

func (h *GatewayHandler) readTunnelLoop(tunnel *TunnelConn) {
	defer func() {
		h.registry.Delete(tunnel.Slug)
		tunnel.Close()
	}()

	for {
		_, raw, err := tunnel.WSConn.ReadMessage()
		if err != nil {
			return
		}

		frame, err := DecodeFrame(raw)
		if err != nil {
			continue
		}

		switch frame.Type {
		case FrameTypePing:
			_ = tunnel.WriteFrame(Frame{
				Type:     FrameTypePong,
				Flags:    frame.Flags,
				StreamID: frame.StreamID,
				Payload:  frame.Payload,
			})
		case FrameTypeGoAway:
			return
		case FrameTypePong:
			tunnel.missedPongs.Store(0)
			tunnel.lastPongUnix.Store(time.Now().Unix())
		case FrameTypeResponseInit, FrameTypeStreamData, FrameTypeStreamEnd, FrameTypeStreamRST:
			_ = tunnel.DispatchToStream(frame)
		}
	}
}

func (h *GatewayHandler) pingLoop(tunnel *TunnelConn) {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-tunnel.Done():
			return
		case <-ticker.C:
		}

		if tunnel.missedPongs.Load() >= 2 {
			tunnel.Close()
			return
		}

		payload := make([]byte, 8)
		binary.BigEndian.PutUint64(payload, uint64(time.Now().UnixMilli()))
		if err := tunnel.WriteFrame(Frame{
			Type:     FrameTypePing,
			Flags:    0,
			StreamID: 0,
			Payload:  payload,
		}); err != nil {
			tunnel.Close()
			return
		}

		tunnel.missedPongs.Add(1)
	}
}

func (h *GatewayHandler) viewerCountLoop(tunnel *TunnelConn) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	last := int64(-1)
	for {
		select {
		case <-tunnel.Done():
			return
		case <-ticker.C:
		}

		current := tunnel.ViewerCount()
		if current == last {
			continue
		}
		last = current

		payload, _ := json.Marshal(map[string]int64{
			"count": current,
		})
		if err := tunnel.WriteFrame(Frame{
			Type:     FrameTypeViewerCount,
			Flags:    FlagFinal,
			StreamID: 0,
			Payload:  payload,
		}); err != nil {
			tunnel.Close()
			return
		}
	}
}

func sendAuthErrAndClose(conn *websocket.Conn, code, msg string) {
	payload, _ := json.Marshal(authErrPayload{
		Code:    code,
		Message: msg,
	})
	_ = conn.WriteMessage(websocket.BinaryMessage, EncodeFrame(Frame{
		Type:     FrameTypeAuthErr,
		Flags:    FlagFinal,
		StreamID: 0,
		Payload:  payload,
	}))
	_ = conn.Close()
}
