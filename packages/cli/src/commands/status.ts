import { loadSession } from "../session.js";

const CONTROL_PLANE_URL =
  process.env["STOAT_CONTROL_PLANE_URL"] ??
  "https://cp.discova.us";

interface SessionStatusResponse {
  slug: string;
  expiresAt: string;
  active: boolean;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function statusCommand(): Promise<void> {
  const session = loadSession();
  if (!session) {
    process.stdout.write("No active tunnel.\n");
    return;
  }

  const localProcessAlive = isProcessAlive(session.pid);

  let controlPlaneActive = false;
  let controlPlaneError: string | null = null;
  let expiresAt = session.expiresAt;

  try {
    const url = new URL(
      `${CONTROL_PLANE_URL}/sessions/${encodeURIComponent(session.slug)}`
    );
    url.searchParams.set("token", session.token);

    const res = await fetch(url);
    if (res.ok) {
      const body = (await res.json()) as SessionStatusResponse;
      controlPlaneActive = body.active;
      expiresAt = body.expiresAt;
    } else {
      controlPlaneError = `${res.status} ${res.statusText}`;
    }
  } catch (err) {
    controlPlaneError = err instanceof Error ? err.message : String(err);
  }

  const now = Date.now();
  const expiryMs = new Date(expiresAt).getTime();
  const expired = Number.isFinite(expiryMs) ? expiryMs <= now : false;

  const overallStatus =
    localProcessAlive && controlPlaneActive && !expired ? "online" : "offline";

  process.stdout.write("Stoat.run Tunnel Status\n");
  process.stdout.write("====================\n");
  process.stdout.write(`Slug:             ${session.slug}\n`);
  process.stdout.write(`Public URL:       ${session.publicUrl}\n`);
  process.stdout.write(`Local Port:       ${session.localPort}\n`);
  process.stdout.write(`CLI PID:          ${session.pid}\n`);
  process.stdout.write(
    `CLI Process:      ${localProcessAlive ? "running" : "not running"}\n`
  );
  process.stdout.write(
    `Control Plane:    ${controlPlaneActive ? "active" : "inactive"}\n`
  );
  process.stdout.write(`Expires At:       ${expiresAt}\n`);
  process.stdout.write(`Overall Status:   ${overallStatus}\n`);
  if (controlPlaneError) {
    process.stdout.write(`Control Plane Err: ${controlPlaneError}\n`);
  }
}
