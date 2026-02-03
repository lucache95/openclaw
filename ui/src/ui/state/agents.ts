import { signal } from "@lit-labs/signals";

export type AgentStatus = "idle" | "thinking" | "executing" | "waiting";

export type AgentIdentity = {
  id: string;
  name: string;
  avatar: string | null;
  color: string;
};

/** 10 visually distinct colors with good WCAG contrast on dark backgrounds. */
const AGENT_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
] as const;

export const SYSTEM_IDENTITY: Readonly<AgentIdentity> = Object.freeze({
  id: "system",
  name: "System",
  avatar: null,
  color: "#6b7280",
});

// --- Signals ---

export const agentRegistry = signal<Map<string, AgentIdentity>>(new Map());
export const agentStatuses = signal<Map<string, AgentStatus>>(new Map());

// --- Pure helpers ---

/** Deterministic hash of agentId to a color from the AGENT_COLORS palette. */
export function getAgentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = (hash * 31 + agentId.charCodeAt(i)) | 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

/**
 * Returns the identity for an agent. Looks up the registry first;
 * if not found, returns a default identity derived from the agentId.
 */
export function getAgentIdentity(agentId: string): AgentIdentity {
  const existing = agentRegistry.get().get(agentId);
  if (existing) return existing;

  return {
    id: agentId,
    name: agentId,
    avatar: agentId.charAt(0).toUpperCase() || "?",
    color: getAgentColor(agentId),
  };
}

// --- Mutators ---

export function registerAgent(identity: AgentIdentity): void {
  const next = new Map(agentRegistry.get());
  next.set(identity.id, identity);
  agentRegistry.set(next);
}

export function setAgentStatus(agentId: string, status: AgentStatus): void {
  const next = new Map(agentStatuses.get());
  next.set(agentId, status);
  agentStatuses.set(next);
}

export function getAgentStatus(agentId: string): AgentStatus {
  return agentStatuses.get().get(agentId) ?? "idle";
}
