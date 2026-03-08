# Ferret

Ferret is a localhost tunneling system:

- `packages/control-plane`: session registry and token validation
- `gateway`: WebSocket tunnel edge + HTTP proxy
- `packages/cli`: `ferret` CLI (`ferret http <port>`, `ferret status`)
- `packages/overlay`: in-browser tunnel overlay script and helpers
- `apps/web`: landing site

## Local Quickstart

From the repo root:

```bash
pnpm install
pnpm --filter @ferret/control-plane build
pnpm --filter @ferret/overlay build
pnpm --filter ferret build
```

Terminal 1 (Control Plane):

```bash
env PORT=4000 \
  FERRET_EDGE_BASE=ws://localhost:8081 \
  FERRET_PUBLIC_BASE='http://{slug}.localhost:8081' \
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

Terminal 3 (Your app on port 3000):

```bash
pnpm dev
```

Terminal 4 (CLI):

```bash
env FERRET_CONTROL_PLANE_URL=http://127.0.0.1:4000 \
  node packages/cli/dist/bin.cjs http 3000
```

Ferret prints a URL such as `http://soft-fish-4993.localhost:8081`.

## Local E2E Test

Run the full local integration script:

```bash
pnpm test:e2e:local
```

The script validates:

- tunnel proxy GET and POST body passthrough
- overlay routes (`/.ferret/overlay.js`, `/.ferret/status`, `/.ferret/viewers`)
- basic-auth policy
- expiry policy

## CLI Commands

```bash
ferret http 3000
ferret status
```
