package edge

import (
	"encoding/json"
	"net/http"
	"strings"
)

type GatewayHandler struct {
	cfg           Config
	registry      *SessionRegistry
	validator     sessionValidator
	overlayEvents *overlayEventHub
}

func NewGatewayHandler(cfg Config, registry *SessionRegistry) *GatewayHandler {
	return &GatewayHandler{
		cfg:           cfg,
		registry:      registry,
		validator:     newControlPlaneClient(cfg.ControlPlaneURL),
		overlayEvents: newOverlayEventHub(),
	}
}

func (h *GatewayHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/tunnel" {
		h.HandleTunnelUpgrade(w, r)
		return
	}

	if r.URL.Path == "/healthz" {
		h.writeJSON(w, http.StatusOK, map[string]any{
			"status":   "ok",
			"sessions": h.registry.Count(),
		})
		return
	}
	if h.HandleOverlayRoutes(w, r) {
		return
	}

	host := normalizeHost(r.Host)
	slug := extractSlug(host, h.cfg.BaseDomain)
	if slug == "" {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "route not found"})
		return
	}

	tunnel, ok := h.registry.Get(slug)
	if !ok {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "session not active"})
		return
	}

	h.ProxyRequest(tunnel, w, r)
}

func normalizeHost(host string) string {
	if idx := strings.IndexByte(host, ':'); idx >= 0 {
		return host[:idx]
	}
	return host
}

func extractSlug(host, baseDomain string) string {
	host = strings.TrimSpace(strings.ToLower(host))
	baseDomain = strings.TrimSpace(strings.ToLower(baseDomain))
	if host == "" || baseDomain == "" {
		return ""
	}

	suffix := "." + baseDomain
	if !strings.HasSuffix(host, suffix) {
		return ""
	}

	slug := strings.TrimSuffix(host, suffix)
	if strings.Contains(slug, ".") || slug == "" {
		return ""
	}

	return slug
}

func (h *GatewayHandler) writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
