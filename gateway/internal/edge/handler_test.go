package edge

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthzRoute(t *testing.T) {
	h := NewGatewayHandler(Config{BaseDomain: "localhost"}, &SessionRegistry{})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	resp := httptest.NewRecorder()

	h.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid JSON response: %v", err)
	}

	if body["status"] != "ok" {
		t.Fatalf("expected status=ok, got %#v", body["status"])
	}
}

func TestExtractSlug(t *testing.T) {
	tests := []struct {
		name       string
		host       string
		baseDomain string
		want       string
	}{
		{name: "normal", host: "alpha.localhost", baseDomain: "localhost", want: "alpha"},
		{name: "with port", host: normalizeHost("alpha.localhost:8080"), baseDomain: "localhost", want: "alpha"},
		{name: "no subdomain", host: "localhost", baseDomain: "localhost", want: ""},
		{name: "nested subdomain", host: "a.b.localhost", baseDomain: "localhost", want: ""},
		{name: "mismatch", host: "alpha.example.com", baseDomain: "localhost", want: ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := extractSlug(tc.host, tc.baseDomain)
			if got != tc.want {
				t.Fatalf("extractSlug(%q, %q) = %q, want %q", tc.host, tc.baseDomain, got, tc.want)
			}
		})
	}
}
