import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getAgentColor } from "../state/agents";

@customElement("agent-avatar")
export class AgentAvatarElement extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
    }

    .avatar-wrapper {
      position: relative;
      display: inline-flex;
    }

    .avatar {
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--agent-color);
      overflow: hidden;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
    }

    .avatar.sm {
      width: 28px;
      height: 28px;
      font-size: 0.75rem;
    }

    .avatar.md {
      width: 36px;
      height: 36px;
      font-size: 0.875rem;
    }

    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 50%;
    }

    .status-dot {
      position: absolute;
      bottom: -1px;
      right: -1px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      border: 2px solid var(--bg-color, #1a1a2e);
    }

    .status-dot.idle {
      background: #6b7280;
    }

    .status-dot.thinking {
      background: #f59e0b;
      animation: pulse 1.2s ease-in-out infinite;
    }

    .status-dot.executing {
      background: #3b82f6;
      animation: pulse 1.2s ease-in-out infinite;
    }

    .status-dot.waiting {
      background: #8b5cf6;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.3;
      }
    }
  `;

  @property() agentId = "";
  @property() name = "Agent";
  @property() avatar: string | null = null;
  @property() color = "#3b82f6";
  @property() size: "sm" | "md" = "md";
  @property() status = "";

  render() {
    const resolvedColor = this.color || getAgentColor(this.agentId);
    const displayName = this.name.length > 20 ? this.name.slice(0, 20) : this.name;
    const isUrl =
      this.avatar &&
      (this.avatar.startsWith("http") ||
        this.avatar.startsWith("data:") ||
        this.avatar.startsWith("/"));

    return html`
      <div class="avatar-wrapper" title=${this.name}>
        <div class="avatar ${this.size}" style="--agent-color: ${resolvedColor}">
          ${isUrl
            ? html`<img src=${this.avatar!} alt=${displayName} />`
            : html`<span>${this.avatar || this.name.charAt(0).toUpperCase() || "?"}</span>`}
        </div>
        ${this.status
          ? html`<span class="status-dot ${this.status}"></span>`
          : nothing}
      </div>
    `;
  }
}
