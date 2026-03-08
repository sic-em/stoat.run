import type { RequestHandler } from "express";

export function stoatOverlay(slug: string): RequestHandler {
  return (_req, res, next) => {
    const originalEnd = res.end.bind(res) as (...args: unknown[]) => unknown;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (res as any).end = function (
      chunk?: unknown,
      encoding?: string,
      cb?: () => void
    ) {
      const contentType = res.getHeader("content-type");
      if (
        typeof contentType === "string" &&
        contentType.includes("text/html") &&
        chunk
      ) {
        const html = String(chunk);
        const tag = `<script defer src="/.stoat/overlay.js?slug=${encodeURIComponent(slug)}"></script>`;
        const injected = html.replace("</head>", `${tag}</head>`);
        res.setHeader("content-length", Buffer.byteLength(injected));
        return originalEnd(injected, encoding, cb);
      }
      return originalEnd(chunk, encoding, cb);
    };

    next();
  };
}
