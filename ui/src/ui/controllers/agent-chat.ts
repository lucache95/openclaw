import {
  handleChatEvent,
  loadChatHistory,
  abortChatRun,
  type ChatState,
  type ChatEventPayload,
} from "./chat";
import { setChatStream, setChatMessages } from "../state/chat";
import { setAgentStatus } from "../state/agents";
import { setActiveSession, updateSessionFromGateway } from "../state/sessions";
import type { WorkflowPhase } from "../components/workflow-indicator";
import type { ReasoningStep } from "../components/reasoning-display";
import type { SessionsListResult } from "../types";

export type AgentChatState = ChatState & {
  workflowPhases: WorkflowPhase[];
  reasoningSteps: ReasoningStep[];
  activeAgentId: string | null;
};

export class AgentChatController {
  private state: AgentChatState;

  constructor(state: AgentChatState) {
    this.state = state;
  }

  /**
   * Handle a chat event that may include agent context.
   * Delegates to the existing handleChatEvent then syncs signals.
   */
  handleAgentChatEvent(
    payload: ChatEventPayload & { agentId?: string },
  ): string | null {
    const agentId = payload.agentId ?? null;

    if (agentId) {
      this.state.activeAgentId = agentId;

      if (payload.state === "delta") {
        setAgentStatus(agentId, "executing");
      } else if (payload.state === "final") {
        setAgentStatus(agentId, "idle");
        this.state.activeAgentId = null;
      } else if (payload.state === "aborted") {
        setAgentStatus(agentId, "idle");
        this.state.activeAgentId = null;
      }
    }

    const result = handleChatEvent(this.state, payload);

    // Sync stream signal after handling
    setChatStream(this.state.chatStream);

    return result;
  }

  /**
   * Switch to a different session and reload its chat history.
   */
  async handleSessionSwitch(newKey: string): Promise<void> {
    setActiveSession(newKey);
    this.state.sessionKey = newKey;
    await loadChatHistory(this.state);
    setChatMessages(this.state.chatMessages);
  }

  /**
   * Stop the current execution run.
   * Returns true if the abort was successfully sent.
   */
  async handleStopExecution(): Promise<boolean> {
    const result = await abortChatRun(this.state);
    if (result && this.state.activeAgentId) {
      setAgentStatus(this.state.activeAgentId, "idle");
      this.state.activeAgentId = null;
    }
    return result;
  }

  /**
   * Update the status of a specific workflow phase.
   */
  updateWorkflowPhase(
    phaseId: string,
    status: "pending" | "active" | "complete" | "error",
  ): void {
    const phases = this.state.workflowPhases;
    const idx = phases.findIndex((p) => p.id === phaseId);
    if (idx === -1) return;
    const updated = [...phases];
    updated[idx] = { ...updated[idx], status };
    this.state.workflowPhases = updated;
  }

  /**
   * Add a reasoning step for display in the reasoning panel.
   */
  addReasoningStep(step: ReasoningStep): void {
    this.state.reasoningSteps = [...this.state.reasoningSteps, step];
  }

  /**
   * Clear all reasoning steps (e.g. between runs).
   */
  clearReasoningSteps(): void {
    this.state.reasoningSteps = [];
  }

  /**
   * Bridge gateway session list results to session signals.
   */
  syncSessionsFromGateway(result: SessionsListResult): void {
    updateSessionFromGateway(result.sessions);
  }
}
