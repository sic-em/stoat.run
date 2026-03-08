package edge

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

func TestPolicyCheckBasicAuth(t *testing.T) {
	p := Policy{}
	tunnel := &TunnelConn{BasicAuth: &BasicAuth{User: "user", Pass: "pass"}}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	resp := httptest.NewRecorder()
	if !p.CheckBasicAuth(resp, req, tunnel) {
		t.Fatal("expected unauthenticated request to be rejected")
	}
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}

	creds := base64.StdEncoding.EncodeToString([]byte("user:pass"))
	reqOK := httptest.NewRequest(http.MethodGet, "/", nil)
	reqOK.Header.Set("Authorization", "Basic "+creds)
	respOK := httptest.NewRecorder()
	if p.CheckBasicAuth(respOK, reqOK, tunnel) {
		t.Fatal("expected valid credentials to pass")
	}
}

func TestPolicyCheckRateLimit(t *testing.T) {
	p := Policy{}
	tunnel := &TunnelConn{limiter: rate.NewLimiter(rate.Limit(1), 1)}

	resp1 := httptest.NewRecorder()
	if p.CheckRateLimit(resp1, tunnel) {
		t.Fatal("first request should pass limiter")
	}

	resp2 := httptest.NewRecorder()
	if !p.CheckRateLimit(resp2, tunnel) {
		t.Fatal("second immediate request should be rate-limited")
	}
	if resp2.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d", resp2.Code)
	}
}

func TestPolicyCheckExpiry(t *testing.T) {
	p := Policy{}
	tunnel := &TunnelConn{ExpiresAt: time.Now().Add(-time.Minute).UTC().Format(time.RFC3339)}

	resp := httptest.NewRecorder()
	if !p.CheckExpiry(resp, tunnel) {
		t.Fatal("expected expired tunnel to be blocked")
	}
	if resp.Code != http.StatusGone {
		t.Fatalf("expected 410, got %d", resp.Code)
	}
}
