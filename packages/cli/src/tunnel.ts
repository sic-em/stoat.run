import WebSocket, { type RawData } from "ws";
import {
  FrameType,
  encodeFrame,
  decodeFrame,
  encodeJsonPayload,
  decodeJsonPayload,
} from "./protocol.js";
import { HeartbeatManager } from "./heartbeat.js";
import { LocalProxy } from "./local-proxy.js";
import type {
  StreamOpenPayload,
  AuthPayload,
  AuthOkPayload,
  AuthErrPayload,
  ViewerCountPayload,
  GoAwayPayload,
} from "./types.js";
import { printRequest, printReconnecting, printReconnected, printError, updateViewerCount } from "./display.js";

const VERSION = "0.1.0";

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  throw new TypeError("Unsupported websocket message payload type");
}

interface TunnelClientOptions {
  edgeUrl: string;
  slug: string;
  token: string;
  localPort: number;
  onAuthOk?: (info: AuthOkPayload) => void;
  onDisconnect?: () => void;
  onViewerCount?: (count: number) => void;
  onGoAway?: (payload: GoAwayPayload) => void;
}

interface PendingStreamRequest {
  meta: StreamOpenPayload;
  chunks: Buffer[];
}

export class TunnelClient {
  private ws: WebSocket | null = null;
  private heartbeat: HeartbeatManager;
  private proxy: LocalProxy | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private paused = false;
  private readonly pendingStreams = new Map<number, PendingStreamRequest>();

  constructor(private readonly opts: TunnelClientOptions) {
    this.heartbeat = new HeartbeatManager({
      onDisconnect: () => {
        printReconnecting();
        void this.reconnect();
      },
      onLatency: (ms) => {
        process.stdout.write(`  Heartbeat latency: ${ms} ms\n`);
      },
    });
  }

  connect(): Promise<AuthOkPayload> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.opts.edgeUrl, {
        perMessageDeflate: false,
      });
      this.ws = ws;

      ws.on("open", () => {
        // send AUTH frame
        const authPayload: AuthPayload = {
          slug: this.opts.slug,
          token: this.opts.token,
          version: VERSION,
        };
        ws.send(encodeFrame(FrameType.AUTH, 0, encodeJsonPayload(authPayload)));
      });

      ws.on("message", (data: RawData) => {
        const buf = rawDataToBuffer(data);

        let frame;
        try {
          frame = decodeFrame(buf);
        } catch {
          return;
        }

        if (frame.type === FrameType.AUTH_OK) {
          const info = decodeJsonPayload<AuthOkPayload>(frame.payload);
          this.reconnectAttempt = 0;

          // setup proxy
          this.proxy = new LocalProxy({
            localPort: this.opts.localPort,
            ws,
            onRequest: (method, path, status, ms) => {
              printRequest(method, path, status, ms);
            },
          });

          this.heartbeat.start(ws);

          // switch to main read loop
          ws.removeAllListeners("message");
          ws.on("message", (d: RawData) => {
            void this.handleFrame(rawDataToBuffer(d));
          });

          this.opts.onAuthOk?.(info);
          resolve(info);
        } else if (frame.type === FrameType.AUTH_ERR) {
          const err = decodeJsonPayload<AuthErrPayload>(frame.payload);
          ws.close();
          reject(new Error(`Auth failed: ${err.message}`));
        }
      });

      ws.on("error", (err: Error) => {
        reject(err);
      });

      ws.on("close", () => {
        this.heartbeat.stop();
        if (!this.stopped && !this.paused) {
          printReconnecting();
          void this.reconnect();
        }
        this.opts.onDisconnect?.();
      });
    });
  }

  private async handleFrame(buf: Buffer): Promise<void> {
    let frame;
    try {
      frame = decodeFrame(buf);
    } catch {
      return;
    }

    switch (frame.type) {
      case FrameType.STREAM_OPEN: {
        const meta = decodeJsonPayload<StreamOpenPayload>(frame.payload);
        this.pendingStreams.set(frame.streamId, { meta, chunks: [] });
        break;
      }
      case FrameType.STREAM_DATA: {
        const pending = this.pendingStreams.get(frame.streamId);
        if (pending) {
          pending.chunks.push(Buffer.from(frame.payload));
        }
        break;
      }
      case FrameType.STREAM_END: {
        const pending = this.pendingStreams.get(frame.streamId);
        if (pending) {
          this.pendingStreams.delete(frame.streamId);
          const body =
            pending.chunks.length > 0 ? Buffer.concat(pending.chunks) : undefined;
          void this.proxy?.handleStream(frame.streamId, pending.meta, body);
        }
        break;
      }
      case FrameType.STREAM_RST: {
        this.pendingStreams.delete(frame.streamId);
        break;
      }
      case FrameType.PONG: {
        this.heartbeat.receivedPong(frame.payload);
        break;
      }
      case FrameType.PING: {
        this.ws?.send(encodeFrame(FrameType.PONG, 0, frame.payload));
        break;
      }
      case FrameType.VIEWER_COUNT: {
        const { count } = decodeJsonPayload<ViewerCountPayload>(frame.payload);
        updateViewerCount(count);
        this.opts.onViewerCount?.(count);
        break;
      }
      case FrameType.GO_AWAY: {
        const payload = decodeJsonPayload<GoAwayPayload>(frame.payload);
        this.opts.onGoAway?.(payload);
        if (payload.reason === "session_expired") {
          printError("Session expired. Tunnel closed.");
          this.stop();
          process.exit(0);
        }
        break;
      }
    }
  }

  async reconnect(): Promise<void> {
    if (this.stopped || this.paused) return;
    this.heartbeat.stop();
    this.ws?.terminate();

    const backoffMs = Math.min(
      1000 * Math.pow(2, this.reconnectAttempt),
      30_000
    );
    this.reconnectAttempt++;

    await new Promise<void>((res) => {
      this.reconnectTimer = setTimeout(res, backoffMs);
    });

    if (this.stopped || this.paused) return;

    try {
      await this.connect();
      printReconnected();
    } catch (err) {
      printError(`Reconnect failed: ${err instanceof Error ? err.message : String(err)}`);
      void this.reconnect();
    }
  }

  sendGoAway(reason: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        encodeFrame(FrameType.GO_AWAY, 0, encodeJsonPayload({ reason }))
      );
    }
  }

  pause(): void {
    if (this.stopped || this.paused) return;
    this.paused = true;
    this.heartbeat.stop();
    this.pendingStreams.clear();
    this.sendGoAway("user_paused");
    this.ws?.close();
  }

  resume(): void {
    if (this.stopped || !this.paused) return;
    this.paused = false;
    void this.reconnect();
  }

  stop(): void {
    this.stopped = true;
    this.heartbeat.stop();
    this.pendingStreams.clear();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
  }
}
