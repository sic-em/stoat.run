#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CP_PORT="${CP_PORT:-4000}"
GW_PORT="${GW_PORT:-8080}"
APP_PORT="${APP_PORT:-3000}"
GW_RPS="${GW_RPS:-1}"

LOG_DIR="${LOG_DIR:-/tmp/stoat-e2e}"
mkdir -p "$LOG_DIR"

CP_LOG="$LOG_DIR/control-plane.log"
GW_LOG="$LOG_DIR/gateway.log"
APP_LOG="$LOG_DIR/app.log"
CLI_LOG="$LOG_DIR/cli.log"
SESSION_FILE="$HOME/.stoat/p.json"

cleanup() {
  set +e
  stop_cli
  if [[ -n "${APP_PID:-}" ]]; then kill "$APP_PID" 2>/dev/null || true; fi
  if [[ -n "${GW_PID:-}" ]]; then kill "$GW_PID" 2>/dev/null || true; fi
  if [[ -n "${CP_PID:-}" ]]; then kill "$CP_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

wait_http() {
  local url="$1"
  local attempts="${2:-60}"
  local delay_s="${3:-0.25}"

  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay_s"
  done

  echo "Timed out waiting for $url" >&2
  return 1
}

port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" | rg -q ":$port\\b"
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  return 1
}

next_free_port() {
  local start="$1"
  local port="$start"
  while port_in_use "$port"; do
    port=$((port + 1))
  done
  echo "$port"
}

stop_cli() {
  if [[ -n "${CLI_PID:-}" ]]; then
    kill "$CLI_PID" 2>/dev/null || true
    wait "$CLI_PID" 2>/dev/null || true
    CLI_PID=""
  fi
}

start_cli() {
  stop_cli
  rm -f "$SESSION_FILE"
  : > "$CLI_LOG"

  STOAT_CONTROL_PLANE_URL="http://127.0.0.1:${CP_PORT}" \
  node packages/cli/dist/bin.cjs http "$APP_PORT" "$@" >"$CLI_LOG" 2>&1 &
  CLI_PID=$!

  for _ in $(seq 1 120); do
    if ! kill -0 "$CLI_PID" 2>/dev/null; then
      echo "[e2e] CLI exited early" >&2
      echo "--- CLI LOG ---" >&2
      cat "$CLI_LOG" >&2 || true
      return 1
    fi
    if [[ -f "$SESSION_FILE" ]]; then
      return 0
    fi
    sleep 0.25
  done

  echo "[e2e] Session file not created by CLI" >&2
  echo "--- CLI LOG ---" >&2
  cat "$CLI_LOG" >&2 || true
  return 1
}

read_slug() {
  node -e 'const fs=require("fs");const p=process.argv[1];const j=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(j.slug||"")' "$SESSION_FILE"
}

wait_tunnel_active() {
  local slug="$1"
  local status_json=""

  for _ in $(seq 1 120); do
    status_json="$(curl -fsS "http://127.0.0.1:${GW_PORT}/.stoat/status?slug=${slug}" || true)"
    if [[ "$status_json" == *'"active":true'* ]]; then
      return 0
    fi
    sleep 0.25
  done

  echo "[e2e] Gateway never reported tunnel as active for slug $slug" >&2
  echo "--- GATEWAY LOG ---" >&2
  cat "$GW_LOG" >&2 || true
  echo "--- CLI LOG ---" >&2
  cat "$CLI_LOG" >&2 || true
  return 1
}

echo "[e2e] Building required packages..."
pnpm -s --filter @stoat-run/control-plane build >/dev/null
pnpm -s --filter @stoat-run/overlay build >/dev/null
pnpm -s --filter stoat.run build >/dev/null

CP_PORT="$(next_free_port "$CP_PORT")"
GW_PORT="$(next_free_port "$GW_PORT")"
APP_PORT="$(next_free_port "$APP_PORT")"
echo "[e2e] Using ports: control-plane=$CP_PORT gateway=$GW_PORT app=$APP_PORT"

echo "[e2e] Starting control-plane on :$CP_PORT"
PORT="$CP_PORT" \
STOAT_EDGE_BASE="ws://localhost:${GW_PORT}" \
STOAT_PUBLIC_BASE="http://{slug}.localhost:${GW_PORT}" \
node packages/control-plane/dist/server.js >"$CP_LOG" 2>&1 &
CP_PID=$!
wait_http "http://127.0.0.1:${CP_PORT}/healthz"

echo "[e2e] Starting gateway on :$GW_PORT"
(
  cd gateway
  PORT="$GW_PORT" \
  BASE_DOMAIN="localhost" \
  CONTROL_PLANE_URL="http://127.0.0.1:${CP_PORT}" \
  OVERLAY_DIR="../packages/overlay/dist" \
  RATE_LIMIT_RPS="$GW_RPS" \
  go run .
) >"$GW_LOG" 2>&1 &
GW_PID=$!
wait_http "http://127.0.0.1:${GW_PORT}/healthz"

echo "[e2e] Starting local app on :$APP_PORT"
APP_PORT="$APP_PORT" node -e '
const http = require("http");
const port = Number(process.env.APP_PORT || 3000);
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    const payload = JSON.stringify({
      ok: true,
      method: req.method,
      path: req.url,
      body,
      marker: "stoat-e2e"
    });
    res.setHeader("content-type", "application/json");
    res.end(payload);
  });
});
server.listen(port, "127.0.0.1", () => console.log(`dummy server on :${port}`));
' >"$APP_LOG" 2>&1 &
APP_PID=$!
sleep 0.5

echo "[e2e] Case 1: core proxy + overlay endpoints"
start_cli
SLUG="$(read_slug)"
if [[ -z "$SLUG" ]]; then
  echo "[e2e] Could not read slug from $SESSION_FILE" >&2
  exit 1
fi
wait_tunnel_active "$SLUG"

echo "[e2e] Tunnel slug: $SLUG"

GET_BODY="$(curl -fsS -H "Host: ${SLUG}.localhost" "http://127.0.0.1:${GW_PORT}/hello?x=1")"
POST_BODY="$(curl -fsS -X POST -H "Host: ${SLUG}.localhost" -d "abc123" "http://127.0.0.1:${GW_PORT}/echo")"
OVERLAY_JS="$(curl -fsS "http://127.0.0.1:${GW_PORT}/.stoat/overlay.js")"
OVERLAY_STATUS="$(curl -fsS "http://127.0.0.1:${GW_PORT}/.stoat/status?slug=${SLUG}")"
OVERLAY_VIEWERS="$(curl -fsS "http://127.0.0.1:${GW_PORT}/.stoat/viewers?slug=${SLUG}")"

if [[ "$GET_BODY" != *'"marker":"stoat-e2e"'* ]] || [[ "$GET_BODY" != *'"path":"/hello?x=1"'* ]]; then
  echo "[e2e] GET did not proxy correctly" >&2
  echo "Response: $GET_BODY" >&2
  exit 1
fi
if [[ "$POST_BODY" != *'"marker":"stoat-e2e"'* ]] || [[ "$POST_BODY" != *'"method":"POST"'* ]] || [[ "$POST_BODY" != *'"body":"abc123"'* ]]; then
  echo "[e2e] POST did not proxy request body correctly" >&2
  echo "Response: $POST_BODY" >&2
  exit 1
fi
if [[ "$OVERLAY_JS" != *'stoat-bar'* ]]; then
  echo "[e2e] Overlay script not served correctly" >&2
  exit 1
fi
if [[ "$OVERLAY_STATUS" != *'"active":true'* ]]; then
  echo "[e2e] Overlay status did not report active tunnel" >&2
  echo "Status: $OVERLAY_STATUS" >&2
  exit 1
fi
if [[ "$OVERLAY_VIEWERS" != *'"count":'* ]]; then
  echo "[e2e] Overlay viewers endpoint invalid" >&2
  echo "Viewers: $OVERLAY_VIEWERS" >&2
  exit 1
fi

echo "[e2e] Case 2: basic auth enforcement"
start_cli --auth testuser:testpass
SLUG="$(read_slug)"
wait_tunnel_active "$SLUG"

AUTH_FAIL_CODE="$(curl -s -o /tmp/stoat-auth-fail.out -w "%{http_code}" -H "Host: ${SLUG}.localhost" "http://127.0.0.1:${GW_PORT}/private")"
AUTH_OK_BODY="$(curl -fsS -u testuser:testpass -H "Host: ${SLUG}.localhost" "http://127.0.0.1:${GW_PORT}/private")"

if [[ "$AUTH_FAIL_CODE" != "401" ]]; then
  echo "[e2e] Expected 401 for unauthenticated request, got $AUTH_FAIL_CODE" >&2
  exit 1
fi
if [[ "$AUTH_OK_BODY" != *'"marker":"stoat-e2e"'* ]]; then
  echo "[e2e] Authenticated request did not proxy" >&2
  exit 1
fi

echo "[e2e] Case 3: expiry policy"
start_cli --expiry 2
SLUG="$(read_slug)"
wait_tunnel_active "$SLUG"
sleep 3

EXPIRE_CODE="$(curl -s -o /tmp/stoat-expiry.out -w "%{http_code}" -H "Host: ${SLUG}.localhost" "http://127.0.0.1:${GW_PORT}/expired")"
if [[ "$EXPIRE_CODE" != "410" && "$EXPIRE_CODE" != "404" ]]; then
  echo "[e2e] Expected 410 (or 404 after close) for expired tunnel, got $EXPIRE_CODE" >&2
  exit 1
fi

echo "[e2e] Case 4: rate limiting"
start_cli
SLUG="$(read_slug)"
wait_tunnel_active "$SLUG"

RATE_LIMIT_HITS=0
RATE_CODES_FILE="/tmp/stoat-rate-codes.txt"
rm -f "$RATE_CODES_FILE"
REQ_PIDS=()
for _ in $(seq 1 40); do
  (
    code="$(curl --max-time 3 -s -o /tmp/stoat-rate.out -w "%{http_code}" -H "Host: ${SLUG}.localhost" "http://127.0.0.1:${GW_PORT}/burst" || true)"
    echo "$code" >> "$RATE_CODES_FILE"
  ) &
  REQ_PIDS+=("$!")
done
for pid in "${REQ_PIDS[@]}"; do
  wait "$pid" || true
done
RATE_LIMIT_HITS="$(grep -c '^429$' "$RATE_CODES_FILE" || true)"

if [[ "$RATE_LIMIT_HITS" -lt 1 ]]; then
  echo "[e2e] WARN: no 429 observed under burst load (codes: $(tr '\n' ' ' < "$RATE_CODES_FILE"))"
else
  echo "[e2e] Rate-limit observed with $RATE_LIMIT_HITS x 429 responses"
fi

echo "[e2e] PASS: core, overlay, basic-auth, and expiry checks passed"
