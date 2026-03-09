package edge

import (
	"net/http"
	"testing"
)

func TestSanitizeQueryRedactsSensitiveKeys(t *testing.T) {
	values := map[string][]string{
		"token":      {"abc"},
		"apiKey":     {"def"},
		"search":     {"ok"},
		"multi":      {"a", "b"},
		"session_id": {"sid"},
	}

	got := sanitizeQuery(values, false)

	if got["token"] != "[REDACTED]" {
		t.Fatalf("token not redacted: %#v", got["token"])
	}
	if got["apikey"] != "[REDACTED]" {
		t.Fatalf("apikey not redacted: %#v", got["apikey"])
	}
	if got["session_id"] != "[REDACTED]" {
		t.Fatalf("session_id not redacted: %#v", got["session_id"])
	}
	if got["search"] != "ok" {
		t.Fatalf("search mismatch: %#v", got["search"])
	}
}

func TestSanitizeHeadersBlocksSensitiveAndAllowsSafe(t *testing.T) {
	headers := http.Header{}
	headers.Set("Authorization", "Bearer x")
	headers.Set("Cookie", "sid=1")
	headers.Set("Content-Type", "application/json")
	headers.Set("Accept", "*/*")
	headers.Set("X-Trace-Id", "abc")

	redacted := sanitizeHeaders(headers, false)
	if _, ok := redacted["authorization"]; ok {
		t.Fatal("authorization should be blocked")
	}
	if _, ok := redacted["cookie"]; ok {
		t.Fatal("cookie should be blocked")
	}
	if redacted["content-type"] != "application/json" {
		t.Fatalf("content-type missing: %#v", redacted)
	}
	if _, ok := redacted["x-trace-id"]; ok {
		t.Fatal("x-trace-id should be excluded in redacted mode")
	}

	raw := sanitizeHeaders(headers, true)
	if _, ok := raw["x-trace-id"]; !ok {
		t.Fatal("x-trace-id should be included in raw mode")
	}
}
