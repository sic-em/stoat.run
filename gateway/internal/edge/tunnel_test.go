package edge

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestControlPlaneClientValidateSession(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name       string
		statusCode int
		body       string
		wantValid  bool
		wantErr    bool
	}{
		{
			name:       "active session with basic auth",
			statusCode: http.StatusOK,
			body:       `{"expiresAt":"2026-12-31T00:00:00Z","active":true,"basicAuth":{"user":"u","pass":"p"}}`,
			wantValid:  true,
			wantErr:    false,
		},
		{
			name:       "forbidden returns invalid",
			statusCode: http.StatusForbidden,
			body:       ``,
			wantValid:  false,
			wantErr:    false,
		},
		{
			name:       "unexpected status returns error",
			statusCode: http.StatusInternalServerError,
			body:       `{"error":"boom"}`,
			wantValid:  false,
			wantErr:    true,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/sessions/alpha" {
					t.Fatalf("unexpected path: %s", r.URL.Path)
				}
				if r.URL.Query().Get("token") != "tok" {
					t.Fatalf("unexpected token: %s", r.URL.Query().Get("token"))
				}

				w.WriteHeader(tc.statusCode)
				if tc.body != "" {
					_, _ = fmt.Fprint(w, tc.body)
				}
			}))
			defer ts.Close()

			client := newControlPlaneClient(ts.URL)
			result, err := client.ValidateSession(context.Background(), "alpha", "tok")

			if tc.wantErr && err == nil {
				t.Fatalf("expected error, got nil (result=%+v)", result)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Valid != tc.wantValid {
				t.Fatalf("valid mismatch: got %v want %v", result.Valid, tc.wantValid)
			}
		})
	}
}
