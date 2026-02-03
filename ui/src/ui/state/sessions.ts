import { signal } from "@lit-labs/signals";
import type { GatewaySessionRow } from "../types";

export type SessionEntry = {
  key: string;
  label: string;
  lastActivityAt: number;
  kind: string;
  agentId?: string;
  displayName?: string;
};

// --- Signals ---

export const sessionList = signal<SessionEntry[]>([]);
export const activeSessionKey = signal<string>("");

// --- Mutators ---

export function setSessionList(sessions: SessionEntry[]): void {
  sessionList.set(sessions);
}

export function setActiveSession(key: string): void {
  activeSessionKey.set(key);
}

export function updateSessionFromGateway(rows: GatewaySessionRow[]): void {
  const entries: SessionEntry[] = rows.map((row) => ({
    key: row.key,
    label: row.label || row.displayName || row.key,
    lastActivityAt: row.updatedAt ?? 0,
    kind: row.kind,
    displayName: row.displayName,
  }));
  sessionList.set(entries);
}
