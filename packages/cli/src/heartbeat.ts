import { FrameType, encodeFrame } from "./protocol.js";
import type WebSocket from "ws";

const PING_INTERVAL_MS = 25_000;
const MAX_MISSED = 2;

interface HeartbeatOptions {
  onDisconnect: () => void;
  onLatency?: (ms: number) => void;
}

export class HeartbeatManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private missedPongs = 0;
  private lastPingSentAt = 0;
  private ws: WebSocket | null = null;
  private readonly opts: HeartbeatOptions;

  constructor(opts: HeartbeatOptions) {
    this.opts = opts;
  }

  start(ws: WebSocket): void {
    this.ws = ws;
    this.missedPongs = 0;
    this.timer = setInterval(() => {
      this.sendPing();
    }, PING_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.ws = null;
  }

  receivedPong(payload: Buffer): void {
    this.missedPongs = 0;
    const sentAt = Number(payload.readBigInt64BE(0));
    const latency = Date.now() - sentAt;
    this.opts.onLatency?.(latency);
    void sentAt; // suppress
    void this.lastPingSentAt;
  }

  private sendPing(): void {
    if (!this.ws) return;
    this.missedPongs += 1;
    if (this.missedPongs > MAX_MISSED) {
      this.opts.onDisconnect();
      return;
    }
    const ts = BigInt(Date.now());
    const payload = Buffer.alloc(8);
    payload.writeBigInt64BE(ts, 0);
    this.lastPingSentAt = Date.now();
    const frame = encodeFrame(FrameType.PING, 0, payload);
    try {
      this.ws.send(frame);
    } catch {
      // ignore send errors — disconnect will be detected by missed pongs
    }
  }
}
