package edge

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveOverlayScriptPath(t *testing.T) {
	dir := t.TempDir()
	want := filepath.Join(dir, "overlay.global.js")
	if err := os.WriteFile(want, []byte("console.log('ok')"), 0o644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	got, err := resolveOverlayScriptPath(dir)
	if err != nil {
		t.Fatalf("expected path, got error: %v", err)
	}
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestHandleViewerCountAndStatus(t *testing.T) {
	h := NewGatewayHandler(Config{BaseDomain: "localhost"}, &SessionRegistry{})
	h.registry.Set("alpha", &TunnelConn{Slug: "alpha", ExpiresAt: "2026-12-31T00:00:00Z"})

	viewerReq := httptest.NewRequest(http.MethodGet, "/.stoat/viewers?slug=alpha", nil)
	viewerResp := httptest.NewRecorder()
	h.ServeHTTP(viewerResp, viewerReq)
	if viewerResp.Code != http.StatusOK {
		t.Fatalf("viewer status code = %d", viewerResp.Code)
	}

	statusReq := httptest.NewRequest(http.MethodGet, "/.stoat/status?slug=alpha", nil)
	statusResp := httptest.NewRecorder()
	h.ServeHTTP(statusResp, statusReq)
	if statusResp.Code != http.StatusOK {
		t.Fatalf("status code = %d", statusResp.Code)
	}
}
