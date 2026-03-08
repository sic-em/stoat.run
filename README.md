# Stoat.run

Stoat.run is a localhost tunneling system:

- `packages/control-plane`: session registry and token validation
- `gateway`: WebSocket tunnel edge + HTTP proxy
- `packages/cli`: `stoat` CLI (`stoat http <port>`, `stoat status`)
- `packages/overlay`: in-browser tunnel overlay script and helpers
- `apps/web`: landing site

## Local Quickstart

```bash
pnpm install
pnpm --filter @stoat-run/control-plane build
pnpm --filter @stoat-run/overlay build
pnpm --filter stoat.run build
```

Terminal 1 (Control Plane):

```bash
env PORT=4000 \
  STOAT_EDGE_BASE=ws://localhost:8081 \
  STOAT_PUBLIC_BASE='http://{slug}.localhost:8081' \
  node packages/control-plane/dist/server.js
```

Terminal 2 (Gateway):

```bash
cd gateway
env PORT=8081 \
  BASE_DOMAIN=localhost \
  CONTROL_PLANE_URL=http://127.0.0.1:4000 \
  OVERLAY_DIR=../packages/overlay/dist \
  go run .
```

Terminal 3 (CLI):

```bash
env STOAT_CONTROL_PLANE_URL=http://127.0.0.1:4000 \
  node packages/cli/dist/bin.cjs http 3000
```

## Local E2E Test

```bash
pnpm test:e2e:local
```
