import { signal, computed } from "@lit-labs/signals";

// --- Types ---

export interface SessionCardData {
  sessionKey: string;
  agentId: string;
  task: string;
  status: "idle" | "thinking" | "executing" | "complete" | "error";
  spawnedBy?: string;
  startedAt: number;
  endedAt?: number;
  currentStep?: string;
}

export interface UsageEntry {
  promptTokens: number;
  completionTokens: number;
  model: string;
  tier: "local" | "cheap" | "quality";
  costUsd: number;
  timestamp: number;
}

// --- Signals ---

export const agentSessions = signal<Map<string, SessionCardData>>(new Map());
export const agentCosts = signal<Map<string, UsageEntry[]>>(new Map());

// --- Computed ---

export const activeSpawnedSessions = computed(() => {
  return Array.from(agentSessions.get().values()).filter(
    (s) => s.spawnedBy && s.status !== "complete" && s.status !== "error",
  );
});

export const totalCost = computed(() => {
  let sum = 0;
  for (const entries of agentCosts.get().values()) {
    for (const e of entries) sum += e.costUsd;
  }
  return sum;
});

// --- Mutators ---

/**
 * Update session state from an agent event payload.
 * Accepts the relevant fields from an AgentEventPayload.
 */
export function updateSessionFromEvent(evt: {
  sessionKey?: string;
  stream: string;
  data: Record<string, unknown>;
  spawnedBy?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    tier: "local" | "cheap" | "quality";
    costUsd: number;
  };
}): void {
  const key = evt.sessionKey;
  if (!key) return;

  const next = new Map(agentSessions.get());
  const existing = next.get(key);

  if (evt.stream === "lifecycle") {
    const phase = evt.data?.phase as string | undefined;

    if (phase === "start") {
      next.set(key, {
        sessionKey: key,
        agentId: (evt.data?.agentId as string) ?? key,
        task: (evt.data?.task as string) ?? "",
        status: "thinking",
        spawnedBy: evt.spawnedBy,
        startedAt: Date.now(),
      });
    } else if (phase === "end" && existing) {
      next.set(key, {
        ...existing,
        status: "complete",
        endedAt: Date.now(),
      });
    } else if (phase === "error" && existing) {
      next.set(key, {
        ...existing,
        status: "error",
        endedAt: Date.now(),
      });
    }
  } else if (evt.stream === "tool" && existing) {
    next.set(key, {
      ...existing,
      status: "executing",
      currentStep: (evt.data?.tool as string) ?? existing.currentStep,
    });
  } else if (evt.stream === "error" && existing) {
    next.set(key, {
      ...existing,
      status: "error",
      endedAt: Date.now(),
    });
  }

  agentSessions.set(next);

  // Track cost if usage is present
  if (evt.usage) {
    trackAgentCost(key, evt.usage);
  }
}

/** Add a usage entry to the cost map for a session. */
export function trackAgentCost(
  sessionKey: string,
  usage: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    tier: "local" | "cheap" | "quality";
    costUsd: number;
  },
): void {
  const next = new Map(agentCosts.get());
  const entries = [...(next.get(sessionKey) ?? [])];
  entries.push({
    ...usage,
    timestamp: Date.now(),
  });
  next.set(sessionKey, entries);
  agentCosts.set(next);
}

/** Get total cost for a single session. */
export function getSessionCost(sessionKey: string): number {
  const entries = agentCosts.get().get(sessionKey);
  if (!entries) return 0;
  let sum = 0;
  for (const e of entries) sum += e.costUsd;
  return sum;
}

/** Clear all metrics state (for testing/cleanup). */
export function resetMetrics(): void {
  agentSessions.set(new Map());
  agentCosts.set(new Map());
}
