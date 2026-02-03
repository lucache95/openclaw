import type { AgentEventPayload } from "../app-tool-stream";
import {
  updateSessionFromEvent,
  resetMetrics,
  setSessionStream,
  finalizeSessionStream,
  pushA2ATurn,
  finalizeA2AConversation,
} from "../state/metrics";

/**
 * Bridges gateway agent events to the metrics signals layer.
 * Stateless -- all state machine logic lives in updateSessionFromEvent.
 */
export class AgentsController {
  /** Forward an agent event payload to the session/cost signals. */
  handleEvent(payload: AgentEventPayload | undefined): void {
    if (!payload) return;

    updateSessionFromEvent({
      sessionKey: payload.sessionKey,
      stream: payload.stream,
      data: payload.data,
      spawnedBy: payload.spawnedBy,
      usage: payload.usage,
    });

    // Capture conversation data
    const sessionKey = payload.sessionKey;
    if (!sessionKey) return;

    if (payload.stream === "assistant") {
      const text = payload.data?.text as string | undefined;
      const agentId = (payload.data?.agentId as string) ?? sessionKey;
      if (typeof text === "string") {
        setSessionStream(sessionKey, agentId, text);
      }
    } else if (payload.stream === "lifecycle") {
      const phase = payload.data?.phase as string | undefined;
      if (phase === "end" || phase === "error") {
        finalizeSessionStream(sessionKey);
      }
    } else if (payload.stream === "a2a") {
      const data = payload.data;
      const conversationId = data?.conversationId as string | undefined;
      if (!conversationId) return;

      if (data.phase === "turn") {
        pushA2ATurn({
          conversationId,
          fromAgent: (data.fromAgent as string) ?? "unknown",
          toAgent: (data.toAgent as string) ?? "unknown",
          turn: (data.turn as number) ?? 0,
          maxTurns: (data.maxTurns as number) ?? 0,
          text: (data.text as string) ?? "",
          timestamp: Date.now(),
          sessionKey,
        });
      } else if (data.phase === "complete") {
        finalizeA2AConversation(conversationId);
      }
    }
  }

  /** Clear all metrics state (used on gateway reconnect). */
  reset(): void {
    resetMetrics();
  }
}
