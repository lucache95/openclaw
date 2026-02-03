import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import "./agent-avatar";

@customElement("typing-indicator")
export class TypingIndicatorElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .typing-container {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      animation: fadeIn 0.2s ease-in;
    }

    .typing-text {
      font-size: 0.8rem;
      font-style: italic;
      opacity: 0.7;
      white-space: nowrap;
    }

    .typing-dots {
      display: flex;
      gap: 4px;
    }

    .typing-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      animation: typing-pulse 1.2s ease-in-out infinite;
    }

    .typing-dots span:nth-child(2) {
      animation-delay: 0.3s;
    }

    .typing-dots span:nth-child(3) {
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

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
  `;

  @property() agentId = "";
  @property() agentName = "";
  @property() agentColor = "#3b82f6";

  render() {
    return html`
      <div class="typing-container">
        <agent-avatar
          .agentId=${this.agentId}
          .color=${this.agentColor}
          .name=${this.agentName || "Agent"}
          size="sm"
          status="thinking"
        ></agent-avatar>
        <span class="typing-text">${this.agentName || "Agent"} is thinking...</span>
        <span class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
    `;
  }
}
