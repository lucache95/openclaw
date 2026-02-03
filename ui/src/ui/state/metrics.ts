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

export type ConversationMessage = {
  agentId: string;
  text: string;
  timestamp: number;
  role: "assistant" | "system" | "tool";
};

// --- Signals ---

export const agentSessions = signal<Map<string, SessionCardData>>(new Map());
export const agentCosts = signal<Map<string, UsageEntry[]>>(new Map());
export const sessionConversations = signal<Map<string, ConversationMessage[]>>(new Map());
export const sessionStreams = signal<Map<string, { agentId: string; text: string }>>(new Map());

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

// --- Conversation mutators ---

const CONVERSATION_MESSAGE_CAP = 500;

/** Append a message to a session's conversation. Caps at 500 most-recent messages. */
export function pushSessionMessage(sessionKey: string, msg: ConversationMessage): void {
  const next = new Map(sessionConversations.get());
  let messages = [...(next.get(sessionKey) ?? []), msg];
  if (messages.length > CONVERSATION_MESSAGE_CAP) {
    messages = messages.slice(-CONVERSATION_MESSAGE_CAP);
  }
  next.set(sessionKey, messages);
  sessionConversations.set(next);
}

/** Set or update the active streaming text for a session. */
export function setSessionStream(sessionKey: string, agentId: string, text: string): void {
  const next = new Map(sessionStreams.get());
  next.set(sessionKey, { agentId, text });
  sessionStreams.set(next);
}

/** Remove a session's active stream entry. */
export function clearSessionStream(sessionKey: string): void {
  const next = new Map(sessionStreams.get());
  next.delete(sessionKey);
  sessionStreams.set(next);
}

/** Move a session's active stream text to a completed conversation message, then clear the stream. */
export function finalizeSessionStream(sessionKey: string): void {
  const stream = sessionStreams.get().get(sessionKey);
  if (!stream) return;
  pushSessionMessage(sessionKey, {
    agentId: stream.agentId,
    text: stream.text,
    timestamp: Date.now(),
    role: "assistant",
  });
  clearSessionStream(sessionKey);
}

/** Clear all metrics state (for testing/cleanup). */
export function resetMetrics(): void {
  agentSessions.set(new Map());
  agentCosts.set(new Map());
  sessionConversations.set(new Map());
  sessionStreams.set(new Map());
}
