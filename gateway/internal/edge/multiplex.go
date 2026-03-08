package edge

import "errors"

type Stream struct {
	ID     uint16
	respCh chan Frame
	done   chan struct{}
}

var errNoStreamAvailable = errors.New("no stream IDs available")

func (t *TunnelConn) AllocStream() (*Stream, error) {
	t.streamsMu.Lock()
	defer t.streamsMu.Unlock()

	if t.streams == nil {
		t.streams = make(map[uint16]*Stream)
	}
	if t.nextID == 0 {
		t.nextID = 2
	}

	start := t.nextID
	for {
		id := t.nextID
		if id%2 != 0 {
			id++
		}
		if id == 0 || id > 0xFFFE {
			id = 2
		}
		t.nextID = id + 2

		if _, exists := t.streams[id]; !exists {
			stream := &Stream{
				ID:     id,
				respCh: make(chan Frame, 32),
				done:   make(chan struct{}),
			}
			t.streams[id] = stream
			return stream, nil
		}

		if t.nextID == start {
			return nil, errNoStreamAvailable
		}
	}
}

func (t *TunnelConn) GetStream(id uint16) (*Stream, bool) {
	t.streamsMu.Lock()
	defer t.streamsMu.Unlock()
	stream, ok := t.streams[id]
	return stream, ok
}

func (t *TunnelConn) ReleaseStream(id uint16) {
	t.streamsMu.Lock()
	stream, ok := t.streams[id]
	if ok {
		delete(t.streams, id)
	}
	t.streamsMu.Unlock()

	if ok {
		close(stream.done)
		close(stream.respCh)
	}
}

func (t *TunnelConn) DispatchToStream(frame Frame) bool {
	stream, ok := t.GetStream(frame.StreamID)
	if !ok {
		return false
	}

	select {
	case <-stream.done:
		return false
	case stream.respCh <- frame:
		return true
	}
}

func (t *TunnelConn) CloseAllStreams() {
	t.streamsMu.Lock()
	streams := make([]*Stream, 0, len(t.streams))
	for id, stream := range t.streams {
		delete(t.streams, id)
		streams = append(streams, stream)
	}
	t.streamsMu.Unlock()

	for _, stream := range streams {
		close(stream.done)
		close(stream.respCh)
	}
}
