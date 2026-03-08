import { spawnSync } from "child_process";
import { printError } from "./display.js";
import type { TunnelClient } from "./tunnel.js";

interface InteractiveModeOptions {
  publicUrl: string;
  tunnel: TunnelClient;
  onQuit: () => void;
}

export class InteractiveMode {
  private readonly opts: InteractiveModeOptions;
  private paused = false;

  constructor(opts: InteractiveModeOptions) {
    this.opts = opts;
  }

  start(): void {
    if (!process.stdin.isTTY) return;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    process.stdin.on("data", (key: string) => {
        const ch = key.toUpperCase();
        switch (ch) {
          case "L":
          process.stdout.write(`  ${this.opts.publicUrl}\n`);
          break;
        case "C":
          this.copyToClipboard(this.opts.publicUrl);
          break;
        case "P":
          this.togglePause();
          break;
        case "R":
          void this.opts.tunnel.reconnect();
          break;
        case "Q":
        case "\u0003": // Ctrl+C
          this.opts.onQuit();
          break;
      }
    });
  }

  stop(): void {
    if (!process.stdin.isTTY) return;
    try {
      process.stdin.setRawMode(false);
    } catch {
      // ignore
    }
    process.stdin.pause();
  }

  private copyToClipboard(text: string): void {
    const platform = process.platform;

    const run = (cmd: string, args: string[] = []): boolean => {
      const result = spawnSync(cmd, args, {
        input: text,
        stdio: ["pipe", "ignore", "ignore"],
      });
      return result.status === 0;
    };

    const commandExists = (cmd: string): boolean => {
      const result = spawnSync("sh", ["-c", `command -v ${cmd}`], {
        stdio: "ignore",
      });
      return result.status === 0;
    };

    if (platform === "darwin" && commandExists("pbcopy") && run("pbcopy")) {
      process.stdout.write("  ✓ Copied to clipboard\n");
      return;
    }

    if (platform === "linux") {
      const isWayland =
        Boolean(process.env["WAYLAND_DISPLAY"]) ||
        process.env["XDG_SESSION_TYPE"] === "wayland";

      if (isWayland && commandExists("wl-copy") && run("wl-copy")) {
        process.stdout.write("  ✓ Copied to clipboard\n");
        return;
      }
      if (commandExists("xclip") && run("xclip", ["-selection", "clipboard"])) {
        process.stdout.write("  ✓ Copied to clipboard\n");
        return;
      }
      if (commandExists("xsel") && run("xsel", ["--clipboard", "--input"])) {
        process.stdout.write("  ✓ Copied to clipboard\n");
        return;
      }
      if (commandExists("termux-clipboard-set") && run("termux-clipboard-set")) {
        process.stdout.write("  ✓ Copied to clipboard\n");
        return;
      }
    }

    if (
      platform === "win32" &&
      ((commandExists("clip.exe") && run("clip.exe")) ||
        (commandExists("powershell.exe") &&
          spawnSync(
            "powershell.exe",
            ["-NoProfile", "-Command", "Set-Clipboard -Value ([Console]::In.ReadToEnd())"],
            { input: text, stdio: ["pipe", "ignore", "ignore"] }
          ).status === 0))
    ) {
      process.stdout.write("  ✓ Copied to clipboard\n");
      return;
    }

    printError(
      "Could not copy to clipboard (install wl-clipboard, xclip, or xsel on Linux)"
    );
  }

  private togglePause(): void {
    this.paused = !this.paused;
    if (this.paused) {
      this.opts.tunnel.pause();
      process.stdout.write("  ! Tunnel paused\n");
    } else {
      this.opts.tunnel.resume();
      process.stdout.write("  ! Resuming tunnel...\n");
    }
  }
}
