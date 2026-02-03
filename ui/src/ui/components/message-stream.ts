import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { chatStream } from "../state/chat";
import { toSanitizedMarkdownHtml } from "../markdown";
import "./agent-avatar";

/**
 * Renders the current streaming message with agent identity.
 * Reads chatStream signal for real-time token-by-token display.
 * Shows a reading indicator (pulsing dots) when stream is empty.
 */
@customElement("message-stream")
export class MessageStreamElement extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
    }

    .stream-container {
      display: flex;
      gap: 12px;
    }

    .stream-content {
      flex: 1;
      min-width: 0;
    }

    .stream-text {
      padding: 10px 14px;
      border-radius: 12px;
      border-bottom-left-radius: 4px;
      background: var(--assistant-bubble-bg, #2d2d44);
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    /* Blinking cursor on the last line while streaming */
    .streaming .stream-text::after {
      content: "";
      display: inline-block;
      width: 2px;
      height: 1em;
      background: currentColor;
      animation: blink 1s step-end infinite;
      margin-left: 2px;
      vertical-align: text-bottom;
    }

    @keyframes blink {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0;
      }
    }

    .stream-meta {
      font-size: 0.7rem;
      opacity: 0.5;
      margin-top: 4px;
    }

    /* Reading indicator: three pulsing dots */
    .reading-indicator {
      display: flex;
      gap: 6px;
      padding: 12px;
    }

    .reading-indicator span {
      width: 8px;
      height: 8px;
      background: currentColor;
      border-radius: 50%;
      animation: typing-pulse 1.2s ease-in-out infinite;
    }

    .reading-indicator span:nth-child(2) {
      animation-delay: 0.3s;
    }

    .reading-indicator span:nth-child(3) {
      animation-delay: 0.6s;
    }

    @keyframes typing-pulse {
      0%,
      100% {
        opacity: 0.3;
        transform: translateY(0);
      }
      50% {
        opacity: 1;
        transform: translateY(-4px);
      }
    }

    /* Markdown content styling */
    .stream-text :first-child {
      margin-top: 0;
    }

    .stream-text :last-child {
      margin-bottom: 0;
    }

    .stream-text pre {
      overflow-x: auto;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.3);
      padding: 12px;
    }

    .stream-text code {
      font-family: "SF Mono", "Fira Code", monospace;
      font-size: 0.875em;
    }
  `;

  @property() agentId = "";
  @property({ type: Number }) startedAt = 0;
  @property({ attribute: false }) streamText: string | null = null;

  render() {
    const stream = this.streamText ?? chatStream.get();
    const hasContent = stream !== null && stream.trim().length > 0;
    const timestamp = this.startedAt
      ? new Date(this.startedAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })
      : "";

    return html`
      <div class="stream-container">
        <agent-avatar .agentId=${this.agentId} size="md" status="executing"></agent-avatar>
        <div class="stream-content ${hasContent ? "streaming" : ""}">
          ${hasContent
            ? html`
                <div class="stream-text">
                  ${unsafeHTML(toSanitizedMarkdownHtml(stream!))}
                </div>
              `
            : html`
                <div class="reading-indicator" aria-hidden="true">
                  <span></span><span></span><span></span>
                </div>
              `}
          ${timestamp
            ? html`<div class="stream-meta">${timestamp}</div>`
            : ""}
        </div>
      </div>
    `;
  }
}
