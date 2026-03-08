import process from "node:process";

function info(message: string): void {
  process.stdout.write(`  ${message}\n`);
}

function ok(message: string): void {
  process.stdout.write(`  ✓ ${message}\n`);
}

function warn(message: string): void {
  process.stdout.write(`  ! ${message}\n`);
}

export function printBanner(
  publicUrl: string,
  localPort: number,
  slug: string,
  expiresAt: string
): void {
  const expiresDate = new Date(expiresAt);
  const nowMs = Date.now();
  const diffMs = expiresDate.getTime() - nowMs;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const expiresStr =
    diffHours > 0 ? `in ${diffHours} hours` : `in ${diffMins} minutes`;

  process.stdout.write("\n  🐾 Ferret v0.1.0\n\n");
  info(`➜ Public URL: ${publicUrl}`);
  info(`➜ Local: http://localhost:${localPort}`);
  info(`➜ Slug: ${slug}`);
  info(`➜ Expires: ${expiresStr}`);
  info("➜ Viewers: 0");
  process.stdout.write(
    "\n  Shortcuts: [L]ink  [C]opy  [P]ause  [R]econnect  [Q]uit\n\n"
  );
}

export function printRequest(
  method: string,
  path: string,
  status: number,
  ms: number
): void {
  info(`← ${method} ${path} ${status} ${ms}ms`);
}

export function updateViewerCount(count: number): void {
  info(`➜ Viewers: ${count}`);
}

export function printReconnecting(): void {
  warn("Reconnecting...");
}

export function printReconnected(): void {
  ok("Reconnected");
}

export function printError(msg: string): void {
  process.stderr.write(`  ✗ ${msg}\n`);
}
