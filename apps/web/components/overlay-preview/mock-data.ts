import type { OverlayRequestEvent } from '@/components/overlay-preview/types';

export const MOCK_EVENTS: OverlayRequestEvent[] = [
  {
    id: '1773060934520-867',
    ts: '2026-03-09T12:55:34.520892882Z',
    method: 'GET',
    path: '/_next/webpack-hmr',
    query: { id: 'MfNYUEsr5jvtgV-Ue3SOc' },
    status: 502,
    latencyMs: 0,
    reqBytes: 0,
    resBytes: 0,
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    traceId: null,
    error: { code: 'proxy_error', message: 'Local server not responding' },
    headers: { origin: 'http://soft-prowl-8351.localhost:8080' },
  },
  {
    id: '1773060933651-866',
    ts: '2026-03-09T12:55:33.651511786Z',
    method: 'POST',
    path: '/',
    query: {},
    status: 200,
    latencyMs: 173,
    reqBytes: 26,
    resBytes: 11630,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:148.0) Gecko/20100101 Firefox/148.0',
    traceId: null,
    error: null,
    headers: {
      accept: 'text/x-component',
      'content-type': 'text/plain;charset=UTF-8',
      origin: 'http://soft-prowl-8351.localhost:8080',
      referer: 'http://soft-prowl-8351.localhost:8080/',
    },
  },
];
