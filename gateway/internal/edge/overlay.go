package edge

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
)

func (h *GatewayHandler) HandleOverlayRoutes(w http.ResponseWriter, r *http.Request) bool {
	switch r.URL.Path {
	case "/.ferret/overlay.js":
		h.serveOverlayScript(w, r)
		return true
	case "/.ferret/viewers":
		h.handleViewerCount(w, r)
		return true
	case "/.ferret/status":
		h.handleOverlayStatus(w, r)
		return true
	case "/.ferret/close":
		h.handleOverlayClose(w, r)
		return true
	default:
		return false
	}
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
	if slug == "" || token == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "slug_and_token_required"})
		return
	}

	tunnel, ok := h.registry.Get(slug)
	if !ok {
		h.writeJSON(w, http.StatusNotFound, map[string]string{"error": "session_not_found"})
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
