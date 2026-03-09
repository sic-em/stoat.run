package edge

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type OverlayEventError = struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type OverlayRequestEvent struct {
	ID           string             `json:"id"`
	TS           string             `json:"ts"`
	Slug         string             `json:"slug"`
	Method       string             `json:"method"`
	Path         string             `json:"path"`
	Query        map[string]any     `json:"query"`
	Status       int                `json:"status"`
	LatencyMS    int64              `json:"latencyMs"`
	ReqBytes     int64              `json:"reqBytes"`
	ResBytes     int64              `json:"resBytes"`
	ClientIPHash *string            `json:"clientIpHash"`
	UserAgent    *string            `json:"userAgent"`
	TraceID      *string            `json:"traceId"`
	Error        *OverlayEventError `json:"error"`
	Headers      map[string]string  `json:"headers"`
	Redacted     bool               `json:"redacted"`
}

type overlayEventHub struct {
	mu     sync.Mutex
	nextID uint64
	bySlug map[string]map[uint64]chan OverlayRequestEvent
}

func newOverlayEventHub() *overlayEventHub {
	return &overlayEventHub{bySlug: make(map[string]map[uint64]chan OverlayRequestEvent)}
}

func (h *overlayEventHub) Subscribe(slug string) (<-chan OverlayRequestEvent, func()) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.bySlug[slug] == nil {
		h.bySlug[slug] = make(map[uint64]chan OverlayRequestEvent)
	}
	id := h.nextID
	h.nextID++
	ch := make(chan OverlayRequestEvent, 64)
	h.bySlug[slug][id] = ch
	return ch, func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		subs := h.bySlug[slug]
		if subs == nil {
			return
		}
		if sub, ok := subs[id]; ok {
			delete(subs, id)
			close(sub)
		}
		if len(subs) == 0 {
			delete(h.bySlug, slug)
		}
	}
}

func (h *overlayEventHub) Publish(slug string, event OverlayRequestEvent) {
	h.mu.Lock()
	defer h.mu.Unlock()
	subs := h.bySlug[slug]
	if len(subs) == 0 {
		return
	}
	for id, ch := range subs {
		select {
		case ch <- event:
		default:
			delete(subs, id)
			close(ch)
		}
	}
	if len(subs) == 0 {
		delete(h.bySlug, slug)
	}
}

var overlayEventSequence atomic.Uint64

func makeOverlayEventID() string {
	seq := overlayEventSequence.Add(1)
	return strconv.FormatInt(time.Now().UnixMilli(), 10) + "-" + strconv.FormatUint(seq, 10)
}

var sensitiveQueryMatchers = []string{
	"token",
	"key",
	"secret",
	"password",
	"auth",
	"session",
}

var blockedHeaders = map[string]struct{}{
	"authorization":       {},
	"cookie":              {},
	"set-cookie":          {},
	"x-api-key":           {},
	"proxy-authorization": {},
}

var allowedHeaders = map[string]struct{}{
	"accept":       {},
	"content-type": {},
	"host":         {},
	"origin":       {},
	"referer":      {},
}

func sanitizeQuery(values map[string][]string, rawEnabled bool) map[string]any {
	result := make(map[string]any, len(values))
	for key, vals := range values {
		lowerKey := strings.ToLower(strings.TrimSpace(key))
		if lowerKey == "" {
			continue
		}
		if shouldRedactQueryKey(lowerKey) {
			result[lowerKey] = "[REDACTED]"
			continue
		}
		if len(vals) == 1 {
			result[lowerKey] = vals[0]
			continue
		}
		items := make([]string, len(vals))
		copy(items, vals)
		result[lowerKey] = items
	}
	if rawEnabled {
		result["_rawEnabled"] = true
	}
	return result
}

func shouldRedactQueryKey(key string) bool {
	for _, m := range sensitiveQueryMatchers {
		if strings.Contains(key, m) {
			return true
		}
	}
	return false
}

func sanitizeHeaders(headers http.Header, rawEnabled bool) map[string]string {
	result := map[string]string{}
	for key, values := range headers {
		lower := strings.ToLower(strings.TrimSpace(key))
		if lower == "" {
			continue
		}
		if _, blocked := blockedHeaders[lower]; blocked {
			continue
		}
		if !rawEnabled {
			if _, allowed := allowedHeaders[lower]; !allowed {
				continue
			}
		}
		if len(values) > 0 {
			result[lower] = values[0]
		}
	}
	return result
}

func hashClientIP(ip, salt string) *string {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return nil
	}
	sum := sha256.Sum256([]byte(salt + ":" + ip))
	hexValue := hex.EncodeToString(sum[:8])
	return &hexValue
}

func optionalString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func buildOverlayRequestEvent(cfg Config, slug string, r *http.Request, status int, latency time.Duration, reqBytes, resBytes int64, err error) OverlayRequestEvent {
	path := "/"
	query := map[string]any{}
	headers := map[string]string{}
	ipHash := (*string)(nil)
	userAgent := (*string)(nil)
	traceID := (*string)(nil)
	method := ""

	if r != nil && r.URL != nil {
		method = r.Method
		path = r.URL.Path
		query = sanitizeQuery(r.URL.Query(), cfg.OverlayDebugRaw)
		headers = sanitizeHeaders(r.Header, cfg.OverlayDebugRaw)
		ipHash = hashClientIP(clientIPFromRequest(r), cfg.OverlayEventSalt)
		userAgent = optionalString(r.UserAgent())
		traceID = optionalString(r.Header.Get("X-Request-Id"))
	}

	payload := OverlayRequestEvent{
		ID:           makeOverlayEventID(),
		TS:           time.Now().UTC().Format(time.RFC3339Nano),
		Slug:         slug,
		Method:       strings.ToUpper(strings.TrimSpace(method)),
		Path:         path,
		Query:        query,
		Status:       status,
		LatencyMS:    latency.Milliseconds(),
		ReqBytes:     reqBytes,
		ResBytes:     resBytes,
		ClientIPHash: ipHash,
		UserAgent:    userAgent,
		TraceID:      traceID,
		Headers:      headers,
		Redacted:     !cfg.OverlayDebugRaw,
	}
	if err != nil {
		payload.Error = &OverlayEventError{Code: "proxy_error", Message: err.Error()}
	}
	return payload
}

func marshalOverlaySSEEvent(event OverlayRequestEvent) []byte {
	jsonBytes, _ := json.Marshal(event)
	data := "event: request\n" +
		"id: " + event.ID + "\n" +
		"data: " + string(jsonBytes) + "\n\n"
	return []byte(data)
}
