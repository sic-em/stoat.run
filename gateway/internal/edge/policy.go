package edge

import (
	"encoding/json"
	"net/http"
	"time"
)

type Policy struct{}

func (p Policy) Check(w http.ResponseWriter, r *http.Request, tunnel *TunnelConn) bool {
	if p.CheckExpiry(w, tunnel) {
		return true
	}
	if p.CheckBasicAuth(w, r, tunnel) {
		return true
	}
	if p.CheckRateLimit(w, tunnel) {
		return true
	}
	return false
}

func (p Policy) CheckExpiry(w http.ResponseWriter, tunnel *TunnelConn) bool {
	if tunnel == nil || tunnel.ExpiresAt == "" {
		return false
	}
	expiresAt, err := time.Parse(time.RFC3339, tunnel.ExpiresAt)
	if err != nil {
		return false
	}
	if time.Now().Before(expiresAt) {
		return false
	}

	payload, _ := json.Marshal(map[string]string{"reason": "session_expired"})
	_ = tunnel.WriteFrame(Frame{
		Type:     FrameTypeGoAway,
		Flags:    FlagFinal,
		StreamID: 0,
		Payload:  payload,
	})
	tunnel.Close()

	http.Error(w, "session expired", http.StatusGone)
	return true
}

func (p Policy) CheckBasicAuth(w http.ResponseWriter, r *http.Request, tunnel *TunnelConn) bool {
	if tunnel == nil || tunnel.BasicAuth == nil {
		return false
	}

	user, pass, ok := r.BasicAuth()
	if !ok || user != tunnel.BasicAuth.User || pass != tunnel.BasicAuth.Pass {
		w.Header().Set("WWW-Authenticate", `Basic realm="Ferret Tunnel"`)
		http.Error(w, "authentication required", http.StatusUnauthorized)
		return true
	}
	return false
}

func (p Policy) CheckRateLimit(w http.ResponseWriter, tunnel *TunnelConn) bool {
	if tunnel == nil || tunnel.limiter == nil {
		return false
	}
	if tunnel.limiter.Allow() {
		return false
	}
	http.Error(w, "rate limit exceeded", http.StatusTooManyRequests)
	return true
}
