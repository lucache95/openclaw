import { updateSessionFromEvent, resetMetrics } from "../state/metrics";
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
  }

  /** Clear all metrics state (used on gateway reconnect). */
  reset(): void {
    resetMetrics();
  }
}
