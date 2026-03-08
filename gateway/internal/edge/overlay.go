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
	case "/.stoat/status":
		h.handleOverlayStatus(w, r)
		return true
	case "/.stoat/logs":
		h.handleOverlayLogs(w, r)
		return true
	case "/.stoat/close":
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
	tunnel.AddLog("Close requested from overlay")
	if token == "" {
		token = tunnel.Token
	}
	if token == "" {
		h.writeJSON(w, http.StatusBadRequest, map[string]string{"error": "token_required"})
		return
	}

	sessionInfo, err := h.validator.ValidateSession(r.Context(), slug, token)
	if err != nil {
		tunnel.AddLog("Close failed: control plane unavailable")
		h.writeJSON(w, http.StatusBadGateway, map[string]string{"error": "control_plane_unavailable"})
		return
	}
	if !sessionInfo.Valid {
		tunnel.AddLog("Close failed: invalid token")
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
	tunnel.AddLog("Tunnel closed from overlay")

	h.writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *GatewayHandler) handleOverlayLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method_not_allowed"})
		return
	}

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

	flusher, ok := w.(http.Flusher)
	if !ok {
		h.writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "streaming_not_supported"})
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	ctx := r.Context()
	ch, history := tunnel.SubscribeLogs(ctx)

	writeEntry := func(entry LogEntry) error {
		raw, err := json.Marshal(map[string]any{
			"seq":     entry.Seq,
			"time":    entry.Time.Format(time.RFC3339),
			"message": entry.Message,
		})
		if err != nil {
			return err
		}
		if _, err := fmt.Fprintf(w, "event: log\ndata: %s\n\n", raw); err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	for _, entry := range history {
		if err := writeEntry(entry); err != nil {
			return
		}
	}

	heartbeat := time.NewTicker(20 * time.Second)
	defer heartbeat.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-tunnel.Done():
			_ = writeSSELine(ctx, w, flusher, "event: end\ndata: {\"message\":\"tunnel_closed\"}\n\n")
			return
		case entry, ok := <-ch:
			if !ok {
				return
			}
			if err := writeEntry(entry); err != nil {
				return
			}
		case <-heartbeat.C:
			if err := writeSSELine(ctx, w, flusher, ": keepalive\n\n"); err != nil {
				return
			}
		}
	}
}

func writeSSELine(ctx context.Context, w http.ResponseWriter, flusher http.Flusher, payload string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	if _, err := w.Write([]byte(payload)); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}
