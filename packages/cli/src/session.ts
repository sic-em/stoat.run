import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PersistedSession } from "./types.js";

const STOAT_DIR = join(homedir(), ".stoat");
const STATE_FILE = join(STOAT_DIR, "p.json");

export function saveSession(session: PersistedSession): void {
  mkdirSync(STOAT_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(session, null, 2));
}

export function loadSession(): PersistedSession | null {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as PersistedSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    unlinkSync(STATE_FILE);
  } catch {
    // ignore
  }
}
