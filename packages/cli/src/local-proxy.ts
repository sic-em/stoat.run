import { request } from "undici";
import { FrameType, encodeFrame, encodeJsonPayload } from "./protocol.js";
import type WebSocket from "ws";
import type { StreamOpenPayload, ResponseInitPayload, StreamRstPayload } from "./types.js";
import { Readable } from "stream";

const CHUNK_SIZE = 1024 * 1024; // 1MB

interface LocalProxyOptions {
  localPort: number;
  ws: WebSocket;
  onRequest?: (method: string, path: string, status: number, ms: number) => void;
}

export class LocalProxy {
  private readonly port: number;
  private readonly ws: WebSocket;
  private readonly onRequest?: LocalProxyOptions["onRequest"];

  constructor(opts: LocalProxyOptions) {
    this.port = opts.localPort;
    this.ws = opts.ws;
    this.onRequest = opts.onRequest;
  }

  async handleStream(
    streamId: number,
    meta: StreamOpenPayload,
    requestBody?: Buffer
  ): Promise<void> {
    const startMs = Date.now();
    const url = `http://localhost:${this.port}${meta.url}`;

    try {
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(meta.headers)) {
        headers[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : v;
      }

      const forwardedHost = headers["host"]?.split(",")[0]?.trim();
      if (forwardedHost) {
        headers["x-forwarded-host"] = forwardedHost;
      }
      headers["x-forwarded-proto"] = "https";

      const { statusCode, headers: resHeaders, body } = await request(url, {
        method: meta.method,
        headers,
        body: requestBody,
        bodyTimeout: 30_000,
        headersTimeout: 10_000,
      });

      // send RESPONSE_INIT
      const initPayload: ResponseInitPayload = {
        statusCode,
        headers: resHeaders as Record<string, string | string[]>,
      };
      this.ws.send(
        encodeFrame(FrameType.RESPONSE_INIT, streamId, encodeJsonPayload(initPayload))
      );

      // stream response body
      if (body instanceof Readable) {
        for await (const chunk of body) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as ArrayBuffer);

          for (let offset = 0; offset < buf.length; offset += CHUNK_SIZE) {
            const slice = buf.subarray(offset, offset + CHUNK_SIZE);
            this.ws.send(encodeFrame(FrameType.STREAM_DATA, streamId, slice));
          }
        }
      }

      // send STREAM_END
      this.ws.send(encodeFrame(FrameType.STREAM_END, streamId, Buffer.alloc(0)));

      const elapsedMs = Date.now() - startMs;
      this.onRequest?.(meta.method, meta.url, statusCode, elapsedMs);
    } catch (err) {
      const isConnectionRefused =
        err instanceof Error &&
        (err.message.includes("ECONNREFUSED") || err.message.includes("connect"));

      const rstPayload: StreamRstPayload = {
        code: isConnectionRefused ? 502 : 500,
        reason: isConnectionRefused
          ? "Local server not responding"
          : "Internal proxy error",
      };
      try {
        this.ws.send(
          encodeFrame(FrameType.STREAM_RST, streamId, encodeJsonPayload(rstPayload))
        );
      } catch {
        // ignore
      }

      const elapsedMs = Date.now() - startMs;
      this.onRequest?.(meta.method, meta.url, rstPayload.code, elapsedMs);
    }
  }
}
