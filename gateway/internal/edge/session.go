package edge

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"

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

	viewerCount  atomic.Int64
	missedPongs  atomic.Int32
	lastPongUnix atomic.Int64
}

func (t *TunnelConn) ViewerCount() int64 {
	if t == nil {
		return 0
	}
	return t.viewerCount.Load()
}

func (t *TunnelConn) IncrementViewers() {
	if t == nil {
		return
	}
	t.viewerCount.Add(1)
}

func (t *TunnelConn) DecrementViewers() {
	if t == nil {
		return
	}
	t.viewerCount.Add(-1)
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
