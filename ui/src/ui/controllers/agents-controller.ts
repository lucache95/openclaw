import {
  updateSessionFromEvent,
  resetMetrics,
  setSessionStream,
  finalizeSessionStream,
} from "../state/metrics";
import type { AgentEventPayload } from "../app-tool-stream";

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
    }
  }

  /** Clear all metrics state (used on gateway reconnect). */
  reset(): void {
    resetMetrics();
  }
}
