import { TunnelClient } from "../tunnel.js";
import { saveSession, clearSession } from "../session.js";
import { printBanner, printError } from "../display.js";
import { InteractiveMode } from "../interactive.js";

const CONTROL_PLANE_URL =
  process.env["STOAT_CONTROL_PLANE_URL"] ??
  "https://cp.stoat.run";

interface HttpOptions {
  slug?: string;
  auth?: string;
  expiry?: string;
}

export async function httpCommand(
  port: string,
  options: HttpOptions
): Promise<void> {
  const localPort = parseInt(port, 10);
  if (isNaN(localPort) || localPort < 1 || localPort > 65535) {
    printError(`Invalid port: ${port}`);
    process.exit(1);
  }

  let basicAuth: { user: string; pass: string } | null = null;
  if (options.auth) {
    const parts = options.auth.split(":");
    if (parts.length < 2) {
      printError("--auth must be in format user:pass");
      process.exit(1);
    }
    basicAuth = { user: parts[0]!, pass: parts.slice(1).join(":") };
  }

  const expiresIn = options.expiry ? parseInt(options.expiry, 10) : 86400;

  // 1. create session
  let sessionResp: {
    slug: string;
    token: string;
    edgeUrl: string;
    publicUrl: string;
    expiresAt: string;
    basicAuth: { user: string; pass: string } | null;
  };

  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        localPort,
        desiredSlug: options.slug ?? null,
        basicAuth,
        expiresIn,
      }),
    });

    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      printError(`Control plane error: ${body.error ?? res.statusText}`);
      process.exit(1);
    }

    sessionResp = (await res.json()) as typeof sessionResp;
  } catch (err) {
    printError(
      `Cannot reach control plane at ${CONTROL_PLANE_URL}: ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  const { slug, token, expiresAt } = sessionResp;
  const edgeUrl = sessionResp.edgeUrl.trim();
  const publicUrl = sessionResp.publicUrl.replace(/\s+/g, "");

  // 2. save session
  saveSession({
    slug,
    token,
    localPort,
    publicUrl,
    edgeUrl,
    expiresAt,
    pid: process.pid,
    startedAt: new Date().toISOString(),
  });

  // 3. connect tunnel
  let interactive: InteractiveMode | null = null;
  const tunnel = new TunnelClient({
    edgeUrl,
    slug,
    token,
    localPort,
    onAuthOk: (info) => {
      printBanner(publicUrl, localPort, info.slug, info.expiresAt);
    },
    onGoAway: (payload) => {
      if (payload.reason === "session_expired") {
        clearSession();
      }
      if (payload.reason === "closed_by_overlay") {
        process.stdout.write("  Tunnel closed from overlay\n");
        tunnel.stop();
        clearSession();
        interactive?.stop();
        process.exit(0);
      }
    },
  });

  interactive = new InteractiveMode({
    publicUrl,
    tunnel,
    onQuit: () => {
      process.stdout.write("  🐾 Goodbye\n");
      tunnel.sendGoAway("user_quit");
      tunnel.stop();
      clearSession();
      interactive.stop();
      process.exit(0);
    },
  });

  process.on("SIGINT", () => {
    process.stdout.write("  🐾 Goodbye\n");
    tunnel.sendGoAway("user_quit");
    tunnel.stop();
    clearSession();
    interactive.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    tunnel.sendGoAway("server_shutdown");
    tunnel.stop();
    clearSession();
    process.exit(0);
  });

  process.stdout.write("  Connecting tunnel...\n");
  try {
    await tunnel.connect();
    process.stdout.write("  ✓ Tunnel connected\n");
    interactive.start();
  } catch (err) {
    process.stdout.write("  ✗ Tunnel connection failed\n");
    printError(
      `Failed to connect: ${err instanceof Error ? err.message : String(err)}`
    );
    clearSession();
    process.exit(1);
  }
}
