import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { toSanitizedMarkdownHtml } from "../markdown";
import { extractTextCached } from "../chat/message-extract";
import {
  normalizeMessage,
  normalizeRoleForGrouping,
} from "../chat/message-normalizer";
import "./agent-avatar";

type InternalGroup = {
  role: string;
  messages: Array<{ message: unknown; index: number }>;
  timestamp: number;
};

/**
 * Scrollable message list with auto-scroll and scroll-lock.
 * Renders a full message history with agent avatars and markdown.
 * Auto-scrolls to bottom on new content; pauses when user scrolls up.
 */
@customElement("message-list")
export class MessageListElement extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
      flex: 1;
      min-height: 0;
    }

    .message-list {
      height: 100%;
      overflow-y: auto;
      scroll-behavior: smooth;
      padding: 16px;
    }

    .message-group {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .message-group.user {
      flex-direction: row-reverse;
    }

    .message-group .messages {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 80%;
      min-width: 0;
    }

    .message-group .bubble {
      padding: 10px 14px;
      border-radius: 12px;
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .message-group.user .bubble {
      background: var(--user-bubble-bg, #3b82f6);
      color: white;
      border-bottom-right-radius: 4px;
    }

    .message-group.assistant .bubble {
      background: var(--assistant-bubble-bg, #2d2d44);
      border-bottom-left-radius: 4px;
    }

    .message-group.other .bubble {
      background: var(--other-bubble-bg, #1e1e38);
      border-bottom-left-radius: 4px;
      opacity: 0.8;
    }

    .message-meta {
      font-size: 0.7rem;
      opacity: 0.5;
      margin-top: 4px;
    }

    .message-group.user .message-meta {
      text-align: right;
    }

    .scroll-anchor {
      height: 1px;
    }

    /* Scroll-to-bottom FAB */
    .scroll-fab {
      position: sticky;
      bottom: 12px;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }

    .scroll-fab button {
      pointer-events: auto;
      background: var(--assistant-bubble-bg, #2d2d44);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;
      border-radius: 20px;
      padding: 6px 16px;
      font-size: 0.8rem;
      cursor: pointer;
      opacity: 0.85;
      transition: opacity 0.15s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .scroll-fab button:hover {
      opacity: 1;
    }

    /* Markdown content inside bubbles */
    .bubble :first-child {
      margin-top: 0;
    }

    .bubble :last-child {
      margin-bottom: 0;
    }

    .bubble pre {
      overflow-x: auto;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.3);
      padding: 12px;
    }

    .bubble code {
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 0.875em;
    }
  `;

  @property({ type: Array }) messages: unknown[] = [];
  @property({ type: Boolean }) showReasoning = false;

  @state() private userScrolledUp = false;
  private scrollContainer: HTMLElement | null = null;
  private previousMessageCount = 0;

  private handleScroll(e: Event) {
    const container = e.currentTarget as HTMLElement;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    this.userScrolledUp = distanceFromBottom > 50;
  }

  scrollToBottom() {
    if (!this.scrollContainer) return;
    this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    this.userScrolledUp = false;
  }

  private onScrollFabClick() {
    this.userScrolledUp = false;
    if (this.scrollContainer) {
      this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    }
  }

  protected updated() {
    // Grab scroll container reference on first render
    if (!this.scrollContainer) {
      this.scrollContainer =
        this.renderRoot.querySelector(".message-list") as HTMLElement | null;
    }

    // Auto-scroll when messages change and user has not scrolled up
    const currentCount = this.messages.length;
    if (currentCount !== this.previousMessageCount) {
      this.previousMessageCount = currentCount;
      if (!this.userScrolledUp) {
        requestAnimationFrame(() => this.scrollToBottom());
      }
    }
  }

  private groupMessages(): InternalGroup[] {
    const groups: InternalGroup[] = [];
    let current: InternalGroup | null = null;

    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const normalized = normalizeMessage(msg);
      const role = normalizeRoleForGrouping(normalized.role);
      const timestamp = normalized.timestamp || Date.now();

      if (!current || current.role !== role) {
        if (current) groups.push(current);
        current = {
          role,
          messages: [{ message: msg, index: i }],
          timestamp,
        };
      } else {
        current.messages.push({ message: msg, index: i });
      }
    }

    if (current) groups.push(current);
    return groups;
  }

  render() {
    const groups = this.groupMessages();

    return html`
      <div class="message-list" @scroll=${this.handleScroll}>
        ${groups.map((group) => this.renderGroup(group))}
        <div class="scroll-anchor"></div>
        ${this.userScrolledUp
          ? html`
              <div class="scroll-fab">
                <button @click=${this.onScrollFabClick}>Scroll to bottom</button>
              </div>
            `
          : nothing}
      </div>
    `;
  }

  private renderGroup(group: InternalGroup) {
    const roleClass =
      group.role === "user"
        ? "user"
        : group.role === "assistant"
          ? "assistant"
          : "other";
    const timestamp = new Date(group.timestamp).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    return html`
      <div class="message-group ${roleClass}">
        ${roleClass !== "user"
          ? html`<agent-avatar size="md"></agent-avatar>`
          : nothing}
        <div class="messages">
          ${group.messages.map((item) => {
            const text = extractTextCached(item.message);
            if (!text?.trim()) return nothing;
            return html`
              <div class="bubble">
                ${unsafeHTML(toSanitizedMarkdownHtml(text))}
              </div>
            `;
          })}
          <div class="message-meta">${timestamp}</div>
        </div>
      </div>
    `;
  }
}
