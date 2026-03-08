export enum FrameType {
  STREAM_OPEN   = 0x01,
  STREAM_DATA   = 0x02,
  STREAM_END    = 0x03,
  STREAM_RST    = 0x04,
  RESPONSE_INIT = 0x05,
  PING          = 0x06,
  PONG          = 0x07,
  AUTH          = 0x08,
  AUTH_OK       = 0x09,
  AUTH_ERR      = 0x0a,
  VIEWER_COUNT  = 0x0b,
  GO_AWAY       = 0x0c,
}

export const FlagBit = {
  COMPRESSED: 0x01,
  FINAL: 0x02,
} as const;

export interface Frame {
  readonly type: FrameType;
  readonly flags: number;
  readonly streamId: number;
  readonly payload: Buffer;
}

const MIN_FRAME_SIZE = 8;

export function encodeFrame(
  type: FrameType,
  streamId: number,
  payload: Buffer,
  flags = 0
): Buffer {
  const header = Buffer.alloc(MIN_FRAME_SIZE);
  header.writeUInt8(type, 0);
  header.writeUInt8(flags, 1);
  header.writeUInt16BE(streamId, 2);
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

export function decodeFrame(buf: Buffer): Frame {
  if (buf.length < MIN_FRAME_SIZE) {
    throw new Error(`Frame too short: ${buf.length} bytes (minimum ${MIN_FRAME_SIZE})`);
  }
  const type = buf.readUInt8(0) as FrameType;
  const flags = buf.readUInt8(1);
  const streamId = buf.readUInt16BE(2);
  const payloadLength = buf.readUInt32BE(4);
  const payload = buf.subarray(MIN_FRAME_SIZE, MIN_FRAME_SIZE + payloadLength);
  return { type, flags, streamId, payload };
}

export function encodeJsonPayload(data: unknown): Buffer {
  return Buffer.from(JSON.stringify(data), "utf-8");
}

export function decodeJsonPayload<T>(payload: Buffer): T {
  return JSON.parse(payload.toString("utf-8")) as T;
}
