import { html, nothing } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { A2AConversation } from "../state/metrics";
import { toSanitizedMarkdownHtml } from "../markdown";
import { getAgentIdentity } from "../state/agents";
import {
  sessionConversations,
  sessionStreams,
  agentSessions,
  a2aConversations,
} from "../state/metrics";
// Side-effect imports to register custom elements
import "../components/agent-avatar";
import "../components/typing-indicator";
import "../components/message-stream";

/** Module-level flag: true when user has scrolled up (pauses auto-scroll). */
let userScrolledUp = false;

/** Status badge color mapping. */
function statusColor(status: "idle" | "thinking" | "executing" | "complete" | "error"): string {
  switch (status) {
    case "thinking":
      return "#f59e0b";
    case "executing":
      return "#3b82f6";
    case "complete":
      return "#10b981";
    case "error":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

/**
 * Render a full conversation view for a specific agent session.
 *
 * Pure render function -- reads signals directly (no props needed beyond keys).
 */
export function renderConversation(sessionKey: string, onBack: () => void) {
  const session = agentSessions.get().get(sessionKey);
  const messages = sessionConversations.get().get(sessionKey) ?? [];
  const activeStream = sessionStreams.get().get(sessionKey);

  if (!session) {
    return html`
      <section class="card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <button
            @click=${onBack}
            style="background:none;border:none;color:var(--text-primary,#cdd6f4);cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;"
            title="Back to sessions"
          >&larr;</button>
          <span style="color:var(--text-secondary,#a6adc8);">Session not found</span>
        </div>
        <div class="muted">
          No data available for session <code>${sessionKey}</code>.
        </div>
      </section>
    `;
  }

  const identity = getAgentIdentity(session.agentId);
  const isActive = session.status === "thinking" || session.status === "executing";

  // Scroll handler: detect user scroll-up to pause auto-scroll
  function handleScroll(e: Event) {
    const el = e.target as HTMLElement;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUp = !atBottom;
  }

  // Auto-scroll: schedule after render if not paused
  function autoScroll(el: Element | undefined) {
    if (!el) return;
    requestAnimationFrame(() => {
      if (!userScrolledUp) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }

  // Scroll-to-bottom action
  function scrollToBottom() {
    userScrolledUp = false;
    const container = document.querySelector(".conversation-messages-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  return html`
    <section class="card" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-shrink:0;">
        <button
          @click=${onBack}
          style="background:none;border:none;color:var(--text-primary,#cdd6f4);cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;"
          title="Back to sessions"
        >&larr;</button>
        <agent-avatar
          .agentId=${session.agentId}
          .color=${identity.color}
          .name=${identity.name}
          size="md"
          status=${session.status === "complete" || session.status === "error" ? "" : session.status}
        ></agent-avatar>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--text-primary,#cdd6f4);">${identity.name}</div>
          <div style="font-size:0.8rem;color:var(--text-secondary,#a6adc8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${session.task || "No task description"}
          </div>
        </div>
        <span style="
          font-size:0.7rem;
          padding:3px 8px;
          border-radius:12px;
          background:${statusColor(session.status)}22;
          color:${statusColor(session.status)};
          font-weight:600;
          text-transform:uppercase;
          letter-spacing:0.04em;
          flex-shrink:0;
        ">${session.status}</span>
      </div>

      <!-- Messages container -->
      <div
        class="conversation-messages-container"
        @scroll=${handleScroll}
        ${/* Use a callback ref to trigger auto-scroll */ ""}
        style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:8px 0;min-height:0;"
      >
        ${
          messages.length === 0 && !activeStream
            ? html`
                <div class="muted" style="text-align: center; padding: 32px 0">
                  No messages yet. Conversation will appear as the agent works.
                </div>
              `
            : nothing
        }

        ${messages.map((msg) => {
          const msgIdentity = getAgentIdentity(msg.agentId);
          const roleLabel =
            msg.role === "tool" ? "Tool" : msg.role === "system" ? "System" : msgIdentity.name;
          const roleColor =
            msg.role === "tool" ? "#8b5cf6" : msg.role === "system" ? "#6b7280" : msgIdentity.color;

          return html`
            <div style="display:flex;gap:10px;align-items:flex-start;">
              <agent-avatar
                .agentId=${msg.agentId}
                .color=${roleColor}
                .name=${roleLabel}
                size="sm"
              ></agent-avatar>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;">
                  <span style="font-weight:600;font-size:0.8rem;color:${roleColor};">${roleLabel}</span>
                  <span style="font-size:0.65rem;opacity:0.5;">
                    ${new Date(msg.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
                <div style="
                  padding:8px 12px;
                  border-radius:10px;
                  border-bottom-left-radius:3px;
                  background:var(--assistant-bubble-bg,#2d2d44);
                  line-height:1.5;
                  word-wrap:break-word;
                  overflow-wrap:break-word;
                  font-size:0.875rem;
                ">
                  ${unsafeHTML(toSanitizedMarkdownHtml(msg.text))}
                </div>
              </div>
            </div>
          `;
        })}

        ${
          activeStream
            ? html`
              <div style="display:flex;flex-direction:column;gap:4px;">
                ${
                  activeStream.text.trim()
                    ? html`
                      <message-stream
                        agentId=${activeStream.agentId}
                        .streamText=${activeStream.text}
                      ></message-stream>
                    `
                    : html`
                      <typing-indicator
                        agentId=${activeStream.agentId}
                        agentName=${getAgentIdentity(activeStream.agentId).name}
                        agentColor=${getAgentIdentity(activeStream.agentId).color}
                      ></typing-indicator>
                    `
                }
              </div>
            `
            : nothing
        }

        <!-- Invisible element at the bottom for auto-scroll targeting -->
        <div style="height:1px;flex-shrink:0;" ${/* trigger auto-scroll on each render */ ""}></div>
      </div>

      <!-- Scroll-to-bottom button (visible when scrolled up) -->
      ${
        userScrolledUp
          ? html`
            <button
              @click=${scrollToBottom}
              style="
                align-self:center;
                margin-top:8px;
                padding:6px 16px;
                border-radius:16px;
                border:1px solid rgba(255,255,255,0.1);
                background:rgba(255,255,255,0.06);
                color:var(--text-secondary,#a6adc8);
                cursor:pointer;
                font-size:0.75rem;
                flex-shrink:0;
              "
            >Scroll to bottom</button>
          `
          : nothing
      }
    </section>

    ${/* Auto-scroll side effect via hidden element */ ""}
    <div style="display:none;" .hidden=${(() => {
      autoScroll(document.querySelector(".conversation-messages-container") as Element | undefined);
      return true;
    })()}></div>
  `;
}

/**
 * Render a threaded A2A conversation view showing interleaved messages
 * from two agents in a back-and-forth chat layout.
 */
export function renderA2AConversation(conversationId: string, onBack: () => void) {
  const conversation = a2aConversations.get().get(conversationId);
  if (!conversation) {
    return html`
      <section class="card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <button
            @click=${onBack}
            style="background:none;border:none;color:var(--text-primary,#cdd6f4);cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;"
            title="Back to sessions"
          >
            &larr;
          </button>
          <span style="color:var(--text-secondary,#a6adc8);">Conversation not found</span>
        </div>
      </section>
    `;
  }

  const [requesterAgent, targetAgent] = conversation.agents;
  const requesterIdentity = getAgentIdentity(requesterAgent);
  const targetIdentity = getAgentIdentity(targetAgent);
  const isComplete = conversation.status === "complete";

  // Reuse the same scroll logic from renderConversation
  function handleScroll(e: Event) {
    const el = e.target as HTMLElement;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    userScrolledUp = !atBottom;
  }

  function scrollToBottom() {
    userScrolledUp = false;
    const container = document.querySelector(".a2a-messages-container");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  return html`
    <section class="card" style="display:flex;flex-direction:column;height:100%;overflow:hidden;">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-shrink:0;">
        <button
          @click=${onBack}
          style="background:none;border:none;color:var(--text-primary,#cdd6f4);cursor:pointer;font-size:1.2rem;padding:4px 8px;border-radius:6px;"
          title="Back to sessions"
        >
          &larr;
        </button>
        <agent-avatar
          .agentId=${requesterAgent}
          .color=${requesterIdentity.color}
          .name=${requesterIdentity.name}
          size="sm"
        ></agent-avatar>
        <span style="font-size:0.75rem;color:var(--text-secondary,#a6adc8);">&#8596;</span>
        <agent-avatar
          .agentId=${targetAgent}
          .color=${targetIdentity.color}
          .name=${targetIdentity.name}
          size="sm"
        ></agent-avatar>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;color:var(--text-primary,#cdd6f4);">
            ${requesterIdentity.name} &harr; ${targetIdentity.name}
          </div>
          <div style="font-size:0.8rem;color:var(--text-secondary,#a6adc8);">
            A2A Conversation &middot; ${conversation.turns.length}
            turn${conversation.turns.length !== 1 ? "s" : ""}
          </div>
        </div>
        <span
          style="
          font-size:0.7rem;
          padding:3px 8px;
          border-radius:12px;
          background:${isComplete ? "#10b98122" : "#f59e0b22"};
          color:${isComplete ? "#10b981" : "#f59e0b"};
          font-weight:600;
          text-transform:uppercase;
          letter-spacing:0.04em;
          flex-shrink:0;
        "
          >${isComplete ? "complete" : "active"}</span
        >
      </div>

      <!-- Messages container -->
      <div
        class="a2a-messages-container"
        @scroll=${handleScroll}
        style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding:8px 0;min-height:0;"
      >
        ${conversation.turns.map((turn) => {
          const isRequester = turn.fromAgent === requesterAgent;
          const identity = isRequester ? requesterIdentity : targetIdentity;
          const alignment = isRequester ? "flex-start" : "flex-end";
          const bubbleBg = isRequester
            ? "var(--assistant-bubble-bg,#2d2d44)"
            : "var(--user-bubble-bg,#3d3d54)";
          const borderRadius = isRequester ? "10px 10px 10px 3px" : "10px 10px 3px 10px";

          return html`
            <div style="display:flex;gap:10px;align-items:flex-start;justify-content:${alignment};">
              ${
                isRequester
                  ? html`
                    <agent-avatar
                      .agentId=${turn.fromAgent}
                      .color=${identity.color}
                      .name=${identity.name}
                      size="sm"
                    ></agent-avatar>
                  `
                  : nothing
              }
              <div style="flex:0 1 auto;max-width:80%;min-width:0;">
                <div
                  style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;${
                    isRequester ? "" : "justify-content:flex-end;"
                  }"
                >
                  <span style="font-weight:600;font-size:0.8rem;color:${identity.color};"
                    >${identity.name}</span
                  >
                  <span style="font-size:0.6rem;opacity:0.4;">turn ${turn.turn}</span>
                  <span style="font-size:0.65rem;opacity:0.5;">
                    ${new Date(turn.timestamp).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
                <div
                  style="
                  padding:8px 12px;
                  border-radius:${borderRadius};
                  background:${bubbleBg};
                  line-height:1.5;
                  word-wrap:break-word;
                  overflow-wrap:break-word;
                  font-size:0.875rem;
                "
                >
                  ${unsafeHTML(toSanitizedMarkdownHtml(turn.text))}
                </div>
              </div>
              ${
                !isRequester
                  ? html`
                    <agent-avatar
                      .agentId=${turn.fromAgent}
                      .color=${identity.color}
                      .name=${identity.name}
                      size="sm"
                    ></agent-avatar>
                  `
                  : nothing
              }
            </div>
          `;
        })}
        ${
          !isComplete
            ? html`
                <div style="text-align: center; padding: 8px 0">
                  <typing-indicator agentId="a2a" agentName="agents" agentColor="#6b7280"></typing-indicator>
                </div>
              `
            : nothing
        }

        <div style="height:1px;flex-shrink:0;"></div>
      </div>

      <!-- Scroll-to-bottom button -->
      ${
        userScrolledUp
          ? html`
            <button
              @click=${scrollToBottom}
              style="
                align-self:center;
                margin-top:8px;
                padding:6px 16px;
                border-radius:16px;
                border:1px solid rgba(255,255,255,0.1);
                background:rgba(255,255,255,0.06);
                color:var(--text-secondary,#a6adc8);
                cursor:pointer;
                font-size:0.75rem;
                flex-shrink:0;
              "
            >
              Scroll to bottom
            </button>
          `
          : nothing
      }
    </section>

    <div
      style="display:none;"
      .hidden=${(() => {
        const container = document.querySelector(".a2a-messages-container") as Element | undefined;
        if (container) {
          requestAnimationFrame(() => {
            if (!userScrolledUp) {
              container.scrollTop = container.scrollHeight;
            }
          });
        }
        return true;
      })()}
    ></div>
  `;
}
