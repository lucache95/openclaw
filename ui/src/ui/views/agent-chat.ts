import { html, nothing, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";
import type { WorkflowPhase } from "../components/workflow-indicator";
import type { ReasoningStep } from "../components/reasoning-display";

// Side-effect imports to register custom elements
import "../components/agent-avatar";
import "../components/message-stream";
import "../components/message-list";
import "../components/typing-indicator";
import "../components/agent-status-bar";
import "../components/workflow-indicator";
import "../components/reasoning-display";
import "../components/session-list";
import "../components/stop-button";

export type AgentChatProps = {
  // Connection
  connected: boolean;
  error: string | null;
  // Messages
  messages: unknown[];
  stream: string | null;
  streamStartedAt: number | null;
  activeAgentId: string | null;
  // Session
  sessionKey: string;
  // Workflow
  workflowPhases: WorkflowPhase[];
  reasoningSteps: ReasoningStep[];
  // Status
  canAbort: boolean;
  sending: boolean;
  loading: boolean;
  // Compose
  draft: string;
  // Event handlers
  onSend: () => void;
  onDraftChange: (text: string) => void;
  onSessionSelect: (key: string) => void;
  onStopExecution: () => void;
  onNewSession: () => void;
};

function adjustTextareaHeight(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function renderAgentChat(props: AgentChatProps): TemplateResult {
  const isStreaming = props.stream !== null;
  const showTyping = Boolean(props.activeAgentId && !isStreaming);

  const composePlaceholder = props.connected
    ? "Message (Enter to send, Shift+Enter for line breaks)"
    : "Connect to the gateway to start chatting...";

  return html`
    <style>
      .agent-chat {
        display: grid;
        grid-template-columns: 260px 1fr;
        grid-template-rows: auto 1fr;
        height: 100%;
        overflow: hidden;
      }
      .agent-chat-topbar {
        grid-column: 1 / -1;
      }
      .agent-chat-sidebar {
        grid-row: 2;
        overflow-y: auto;
        border-right: 1px solid var(--border-color, #2d2d44);
      }
      .agent-chat-main {
        grid-row: 2;
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
      }
      .agent-chat-messages {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
      .agent-chat-compose {
        padding: 12px 16px;
        border-top: 1px solid var(--border-color, #2d2d44);
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .compose-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      .compose-field {
        flex: 1;
      }
      .compose-field textarea {
        width: 100%;
        resize: none;
        min-height: 40px;
        max-height: 200px;
        border-radius: 8px;
        padding: 8px 12px;
        background: var(--input-bg, #1a1a2e);
        border: 1px solid var(--border-color, #2d2d44);
        color: inherit;
        font-family: inherit;
        font-size: 0.875rem;
        box-sizing: border-box;
      }
      .compose-field textarea:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .compose-actions {
        display: flex;
        gap: 6px;
      }
      .agent-chat-indicators {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 0 16px;
      }
      .agent-chat-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        opacity: 0.6;
        font-size: 0.875rem;
      }
      .agent-chat-error {
        padding: 8px 16px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        color: #ef4444;
        font-size: 0.8rem;
        margin: 8px 16px 0;
      }
    </style>

    <section class="agent-chat">
      <!-- Top bar: agent status across full width -->
      <div class="agent-chat-topbar">
        <agent-status-bar></agent-status-bar>
      </div>

      <!-- Sidebar: session list -->
      <div class="agent-chat-sidebar">
        <session-list
          @session-select=${(e: CustomEvent) =>
            props.onSessionSelect(e.detail.key)}
        ></session-list>
      </div>

      <!-- Main chat area -->
      <div class="agent-chat-main">
        <!-- Workflow progress -->
        <workflow-indicator
          .phases=${props.workflowPhases}
        ></workflow-indicator>

        ${props.error
          ? html`<div class="agent-chat-error">${props.error}</div>`
          : nothing}

        ${props.loading
          ? html`<div class="agent-chat-loading">Loading chat...</div>`
          : html`
              <!-- Message history -->
              <div class="agent-chat-messages">
                <message-list></message-list>
              </div>
            `}

        <!-- Indicators: streaming, typing, reasoning -->
        <div class="agent-chat-indicators">
          ${isStreaming
            ? html`<message-stream></message-stream>`
            : nothing}

          ${showTyping
            ? html`<typing-indicator
                .agentId=${props.activeAgentId}
              ></typing-indicator>`
            : nothing}

          ${props.reasoningSteps.length > 0
            ? html`<reasoning-display
                .steps=${props.reasoningSteps}
              ></reasoning-display>`
            : nothing}
        </div>

        <!-- Compose area -->
        <div class="agent-chat-compose">
          <div class="compose-row">
            <div class="compose-field">
              <textarea
                ${ref((el) =>
                  el && adjustTextareaHeight(el as HTMLTextAreaElement),
                )}
                .value=${props.draft}
                ?disabled=${!props.connected}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key !== "Enter") return;
                  if (e.isComposing || e.keyCode === 229) return;
                  if (e.shiftKey) return;
                  if (!props.connected) return;
                  e.preventDefault();
                  props.onSend();
                }}
                @input=${(e: Event) => {
                  const target = e.target as HTMLTextAreaElement;
                  adjustTextareaHeight(target);
                  props.onDraftChange(target.value);
                }}
                placeholder=${composePlaceholder}
              ></textarea>
            </div>
            <div class="compose-actions">
              <stop-button
                .active=${props.canAbort}
                @stop-execution=${() => props.onStopExecution()}
              ></stop-button>
              <button
                class="btn"
                ?disabled=${!props.connected}
                @click=${props.onNewSession}
              >
                New
              </button>
              <button
                class="btn primary"
                ?disabled=${!props.connected}
                @click=${props.onSend}
              >
                ${props.sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}
