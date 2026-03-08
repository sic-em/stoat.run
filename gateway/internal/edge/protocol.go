package edge

import (
	"encoding/binary"
	"errors"
	"fmt"
)

const (
	FrameTypeStreamOpen   uint8 = 0x01
	FrameTypeStreamData   uint8 = 0x02
	FrameTypeStreamEnd    uint8 = 0x03
	FrameTypeStreamRST    uint8 = 0x04
	FrameTypeResponseInit uint8 = 0x05
	FrameTypePing         uint8 = 0x06
	FrameTypePong         uint8 = 0x07
	FrameTypeAuth         uint8 = 0x08
	FrameTypeAuthOK       uint8 = 0x09
	FrameTypeAuthErr      uint8 = 0x0A
	FrameTypeViewerCount  uint8 = 0x0B
	FrameTypeGoAway       uint8 = 0x0C
)

const (
	FlagCompressed uint8 = 0x01
	FlagFinal      uint8 = 0x02
)

const frameHeaderLength = 8

type Frame struct {
	Type     uint8
	Flags    uint8
	StreamID uint16
	Payload  []byte
}

func EncodeFrame(frame Frame) []byte {
	totalLen := frameHeaderLength + len(frame.Payload)
	buf := make([]byte, totalLen)
	buf[0] = frame.Type
	buf[1] = frame.Flags
	binary.BigEndian.PutUint16(buf[2:4], frame.StreamID)
	binary.BigEndian.PutUint32(buf[4:8], uint32(len(frame.Payload)))
	copy(buf[8:], frame.Payload)
	return buf
}

func DecodeFrame(buf []byte) (Frame, error) {
	if len(buf) < frameHeaderLength {
		return Frame{}, errors.New("frame too short: need at least 8 bytes")
	}

	payloadLen := binary.BigEndian.Uint32(buf[4:8])
	expected := frameHeaderLength + int(payloadLen)
	if len(buf) < expected {
		return Frame{}, fmt.Errorf("invalid frame length: expected %d bytes, got %d", expected, len(buf))
	}

	payload := make([]byte, payloadLen)
	copy(payload, buf[8:expected])

	return Frame{
		Type:     buf[0],
		Flags:    buf[1],
		StreamID: binary.BigEndian.Uint16(buf[2:4]),
		Payload:  payload,
	}, nil
}
