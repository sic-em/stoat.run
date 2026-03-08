import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { PersistedSession } from "./types.js";

const FERRET_DIR = join(homedir(), ".ferret");
const STATE_FILE = join(FERRET_DIR, "p.json");

export function saveSession(session: PersistedSession): void {
  mkdirSync(FERRET_DIR, { recursive: true });
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
