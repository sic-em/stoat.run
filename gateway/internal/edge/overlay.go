package edge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (h *GatewayHandler) HandleOverlayRoutes(w http.ResponseWriter, r *http.Request) bool {
	if strings.HasPrefix(r.URL.Path, "/logo-") && strings.HasSuffix(r.URL.Path, ".webp") {
		h.serveOverlayLogo(w, r)
		return true
	}

	switch r.URL.Path {
	case "/.stoat/overlay.js":
		h.serveOverlayScript(w, r)
		return true
	case "/.stoat/viewers":
		h.handleViewerCount(w, r)
		return true
	case "/.stoat/events":
		h.handleOverlayEvents(w, r)
		return true
	case "/.stoat/status":
		h.handleOverlayStatus(w, r)
		return true
	case "/.stoat/close":
		h.handleOverlayClose(w, r)
		return true
	default:
		return false
	}
}

func (h *GatewayHandler) handleOverlayEvents(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method_not_allowed"})
		return
	}

	slug := strings.TrimSpace(r.URL.Query().Get("slug"))
	if slug == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug_required"})
		return
	}
	if _, ok := h.registry.Get(slug); !ok {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "session_not_found"})
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "stream_unsupported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	eventCh, unsubscribe := h.overlayEvents.Subscribe(slug)
	defer unsubscribe()

	_, _ = w.Write([]byte("event: ready\ndata: {\"ok\":true}\n\n"))
	flusher.Flush()

	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
			_, _ = w.Write([]byte("event: ping\ndata: {}\n\n"))
			flusher.Flush()
		case evt, ok := <-eventCh:
			if !ok {
				return
			}
			if err := writeSSEData(r.Context(), w, evt); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func writeSSEData(ctx context.Context, w http.ResponseWriter, event OverlayRequestEvent) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	_, err := w.Write(marshalOverlaySSEEvent(event))
	if err != nil {
		return fmt.Errorf("write sse event: %w", err)
	}
	return nil
}

func (h *GatewayHandler) serveOverlayScript(w http.ResponseWriter, r *http.Request) {
	path, err := resolveOverlayScriptPath(h.cfg.OverlayDir)
	if err != nil {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "overlay script not found"})
		return
	}
	w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	http.ServeFile(w, r, path)
}

func resolveOverlayScriptPath(overlayDir string) (string, error) {
	candidates := []string{
		filepath.Join(overlayDir, "overlay.global.js"),
		filepath.Join(overlayDir, "overlay.js"),
	}
	for _, c := range candidates {
		if stat, err := os.Stat(c); err == nil && !stat.IsDir() {
			return c, nil
		}
	}
	return "", errors.New("overlay script not found")
}

func (h *GatewayHandler) serveOverlayLogo(w http.ResponseWriter, r *http.Request) {
	path, err := resolveOverlayLogoPath(h.cfg.OverlayDir)
	if err != nil {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "overlay logo not found"})
		return
	}
	w.Header().Set("Content-Type", "image/webp")
	http.ServeFile(w, r, path)
}

func resolveOverlayLogoPath(overlayDir string) (string, error) {
	matches, _ := filepath.Glob(filepath.Join(overlayDir, "logo-*.webp"))
	for _, match := range matches {
		if stat, err := os.Stat(match); err == nil && !stat.IsDir() {
			return match, nil
		}
	}
	fallback := filepath.Join(overlayDir, "logo.webp")
	if stat, err := os.Stat(fallback); err == nil && !stat.IsDir() {
		return fallback, nil
	}
	return "", errors.New("overlay logo not found")
}

func (h *GatewayHandler) handleViewerCount(w http.ResponseWriter, r *http.Request) {
	slug := r.URL.Query().Get("slug")
	if slug == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug_required"})
		return
	}
	tunnel, ok := h.registry.Get(slug)
	if !ok {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "session_not_found"})
		return
	}
	h.writeJSON(w, http.StatusOK, map[string]int64{"count": tunnel.ViewerCount()})
}

func (h *GatewayHandler) handleOverlayStatus(w http.ResponseWriter, r *http.Request) {
	slug := r.URL.Query().Get("slug")
	if slug == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug_required"})
		return
	}
	tunnel, ok := h.registry.Get(slug)
	if !ok {
		h.writeJSON(w, http.StatusOK, map[string]any{"slug": slug, "active": false})
		return
	}
	h.writeJSON(w, http.StatusOK, map[string]any{
		"slug":      tunnel.Slug,
		"active":    true,
		"expiresAt": tunnel.ExpiresAt,
	})
}

func (h *GatewayHandler) handleOverlayClose(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method_not_allowed"})
		return
	}

	slug := r.URL.Query().Get("slug")
	token := r.URL.Query().Get("token")
	if slug == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug_required"})
		return
	}

	tunnel, ok := h.registry.Get(slug)
	if !ok {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "session_not_found"})
		return
	}
	if token == "" {
		token = tunnel.Token
	}
	if token == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "token_required"})
		return
	}

	sessionInfo, err := h.validator.ValidateSession(r.Context(), slug, token)
	if err != nil {
		h.writeJSON(w, http.StatusBadGateway, map[string]string{"error": "control_plane_unavailable"})
		return
	}
	if !sessionInfo.Valid {
		h.writeJSON(w, http.StatusForbidden, map[string]string{"error": "invalid_token"})
		return
	}

	payload, _ := json.Marshal(map[string]string{"reason": "closed_by_overlay"})
	_ = tunnel.WriteFrame(Frame{
		Type:     FrameTypeGoAway,
		Flags:    FlagFinal,
		StreamID: 0,
		Payload:  payload,
	})
	tunnel.Close()
	h.registry.Delete(slug)

	h.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
