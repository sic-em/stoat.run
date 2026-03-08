package edge

import (
	"context"
	"errors"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"golang.org/x/time/rate"
)

type BasicAuth struct {
	User string
	Pass string
}

type TunnelConn struct {
	Slug      string
	Token     string
	ExpiresAt string
	BasicAuth *BasicAuth
	WSConn    *websocket.Conn

	writeMu sync.Mutex

	streamsMu sync.Mutex
	streams   map[uint16]*Stream
	nextID    uint16

	limiter *rate.Limiter

	ctx    context.Context
	cancel context.CancelFunc
	closed chan struct{}

	closeOnce sync.Once

	viewersMu      sync.Mutex
	viewerLastSeen map[string]time.Time
	missedPongs  atomic.Int32
	lastPongUnix atomic.Int64

	logsMu          sync.Mutex
	logSeq          uint64
	logRing         []LogEntry
	logSubs         map[chan LogEntry]struct{}
	logRingCapacity int
}

const viewerActiveWindow = 30 * time.Second
const defaultLogRingCapacity = 100

type LogEntry struct {
	Seq     uint64    `json:"seq"`
	Time    time.Time `json:"time"`
	Message string    `json:"message"`
}

func (t *TunnelConn) ViewerCount() int64 {
	if t == nil {
		return 0
	}
	return int64(t.cleanupAndCountViewers(time.Now()))
}

func (t *TunnelConn) TouchViewer(remoteAddr, userAgent string) {
	if t == nil {
		return
	}
	key := viewerKey(remoteAddr, userAgent)
	now := time.Now()

	t.viewersMu.Lock()
	if t.viewerLastSeen == nil {
		t.viewerLastSeen = make(map[string]time.Time)
	}
	t.viewerLastSeen[key] = now
	t.cleanupAndCountViewersLocked(now)
	t.viewersMu.Unlock()
}

func (t *TunnelConn) cleanupAndCountViewers(now time.Time) int {
	t.viewersMu.Lock()
	defer t.viewersMu.Unlock()
	return t.cleanupAndCountViewersLocked(now)
}

func (t *TunnelConn) cleanupAndCountViewersLocked(now time.Time) int {
	cutoff := now.Add(-viewerActiveWindow)
	for key, lastSeen := range t.viewerLastSeen {
		if lastSeen.Before(cutoff) {
			delete(t.viewerLastSeen, key)
		}
	}
	return len(t.viewerLastSeen)
}

func viewerKey(remoteAddr, userAgent string) string {
	client := extractClientIP(remoteAddr)
	if client == "" {
		client = "unknown"
	}
	ua := strings.TrimSpace(userAgent)
	if ua == "" {
		ua = "unknown"
	}
	return client + "|" + ua
}

func extractClientIP(addr string) string {
	addr = strings.TrimSpace(addr)
	if addr == "" {
		return ""
	}
	if host, _, err := net.SplitHostPort(addr); err == nil {
		return strings.TrimSpace(host)
	}
	return addr
}

func (t *TunnelConn) WriteFrame(frame Frame) error {
	if t == nil || t.WSConn == nil {
		return errors.New("tunnel connection is not available")
	}
	select {
	case <-t.closed:
		return errors.New("tunnel connection is closed")
	default:
	}

	t.writeMu.Lock()
	defer t.writeMu.Unlock()

	return t.WSConn.WriteMessage(websocket.BinaryMessage, EncodeFrame(frame))
}

func (t *TunnelConn) Done() <-chan struct{} {
	if t == nil || t.closed == nil {
		ch := make(chan struct{})
		close(ch)
		return ch
	}
	return t.closed
}

func (t *TunnelConn) Close() {
	if t == nil {
		return
	}
	t.closeOnce.Do(func() {
		if t.cancel != nil {
			t.cancel()
		}
		t.CloseAllStreams()
		if t.WSConn != nil {
			_ = t.WSConn.Close()
		}
		if t.closed != nil {
			close(t.closed)
		}
	})
}

func (t *TunnelConn) AddLog(message string) {
	if t == nil || strings.TrimSpace(message) == "" {
		return
	}
	entry := LogEntry{
		Time:    time.Now(),
		Message: message,
	}

	t.logsMu.Lock()
	t.logSeq++
	entry.Seq = t.logSeq

	capacity := t.logRingCapacity
	if capacity <= 0 {
		capacity = defaultLogRingCapacity
	}
	if len(t.logRing) >= capacity {
		copy(t.logRing, t.logRing[1:])
		t.logRing[len(t.logRing)-1] = entry
	} else {
		t.logRing = append(t.logRing, entry)
	}

	subs := make([]chan LogEntry, 0, len(t.logSubs))
	for ch := range t.logSubs {
		subs = append(subs, ch)
	}
	t.logsMu.Unlock()

	for _, ch := range subs {
		select {
		case ch <- entry:
		default:
		}
	}
}

func (t *TunnelConn) SubscribeLogs(ctx context.Context) (<-chan LogEntry, []LogEntry) {
	ch := make(chan LogEntry, 16)

	t.logsMu.Lock()
	if t.logSubs == nil {
		t.logSubs = make(map[chan LogEntry]struct{})
	}
	t.logSubs[ch] = struct{}{}
	history := make([]LogEntry, len(t.logRing))
	copy(history, t.logRing)
	t.logsMu.Unlock()

	go func() {
		<-ctx.Done()
		t.logsMu.Lock()
		delete(t.logSubs, ch)
		t.logsMu.Unlock()
		close(ch)
	}()

	return ch, history
}

type SessionRegistry struct {
	sessions sync.Map
}

func (r *SessionRegistry) Set(slug string, tunnel *TunnelConn) {
	r.sessions.Store(slug, tunnel)
}

func (r *SessionRegistry) Get(slug string) (*TunnelConn, bool) {
	v, ok := r.sessions.Load(slug)
	if !ok {
		return nil, false
	}
	tunnel, ok := v.(*TunnelConn)
	return tunnel, ok
}

func (r *SessionRegistry) Delete(slug string) {
	r.sessions.Delete(slug)
}

func (r *SessionRegistry) Count() int {
	count := 0
	r.sessions.Range(func(_, _ any) bool {
		count++
		return true
	})
	return count
}
