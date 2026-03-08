package edge

import (
	"bytes"
	"testing"
)

func TestProtocolEncodeDecodeRoundTrip(t *testing.T) {
	input := Frame{
		Type:     FrameTypeAuth,
		Flags:    FlagCompressed | FlagFinal,
		StreamID: 42,
		Payload:  []byte("hello"),
	}

	encoded := EncodeFrame(input)
	decoded, err := DecodeFrame(encoded)
	if err != nil {
		t.Fatalf("DecodeFrame failed: %v", err)
	}

	if decoded.Type != input.Type || decoded.Flags != input.Flags || decoded.StreamID != input.StreamID {
		t.Fatalf("decoded metadata mismatch: %#v", decoded)
	}

	if !bytes.Equal(decoded.Payload, input.Payload) {
		t.Fatalf("decoded payload mismatch: got %q want %q", decoded.Payload, input.Payload)
	}
}

func TestDecodeFrameRejectsShortBuffer(t *testing.T) {
	_, err := DecodeFrame([]byte{0x01, 0x00, 0x00})
	if err == nil {
		t.Fatal("expected error for short frame, got nil")
	}
}
