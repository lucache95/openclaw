import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { getAgentColor } from "../state/agents";
import "./latency-badge";
import "./agent-avatar";

type SessionStatus = "idle" | "thinking" | "executing" | "complete" | "error";

const STATUS_COLORS: Record<SessionStatus, string> = {
  idle: "#6b7280",
  thinking: "#f59e0b",
  executing: "#3b82f6",
  complete: "#10b981",
  error: "#ef4444",
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: "Idle",
  thinking: "Thinking",
  executing: "Executing",
  complete: "Complete",
  error: "Error",
};

@customElement("agent-session-card")
export class AgentSessionCardElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: var(--bg-secondary, #1e1e2e);
      border-radius: 8px;
      padding: 12px;
      border-left: 3px solid var(--agent-color, #3b82f6);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      transition: background 0.3s ease;
    }

    .card[data-status="error"] {
      background: rgba(239, 68, 68, 0.06);
    }

    .header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .agent-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: #e2e8f0;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .body {
      margin-top: 8px;
      font-size: 0.8125rem;
      color: #94a3b8;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
    }

    .footer {
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .current-step {
      font-size: 0.75rem;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.025em;
      padding: 2px 8px;
      border-radius: 9999px;
      flex-shrink: 0;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }

    .status-badge.thinking {
      animation: pulse 1.2s ease-in-out infinite;
    }
  `;

  @property() sessionKey = "";
  @property() agentId = "";
  @property() task = "";
  @property() status: SessionStatus = "idle";
  @property() spawnedBy = "";
  @property({ type: Number }) startedAt = 0;
  @property({ type: Number }) endedAt = 0;
  @property() currentStep = "";

  private _tickInterval: ReturnType<typeof setInterval> | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this._startTick();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._stopTick();
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("status")) {
      if (this.status === "complete" || this.status === "error") {
        this._stopTick();
      } else if (!this._tickInterval) {
        this._startTick();
      }
    }
  }

  private _startTick(): void {
    if (this._tickInterval) return;
    if (this.status === "complete" || this.status === "error") return;
    this._tickInterval = setInterval(() => this.requestUpdate(), 1000);
  }

  private _stopTick(): void {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  private _getElapsedMs(): number {
    if (!this.startedAt) return 0;
    const end = this.endedAt && this.endedAt > 0 ? this.endedAt : Date.now();
    return end - this.startedAt;
  }

  render() {
    const agentColor = getAgentColor(this.agentId);
    const elapsed = this._getElapsedMs();
    const statusColor = STATUS_COLORS[this.status] ?? STATUS_COLORS.idle;
    const statusLabel = STATUS_LABELS[this.status] ?? this.status;

    return html`
      <div
        class="card"
        data-session=${this.sessionKey}
        data-status=${this.status}
        style="--agent-color: ${agentColor}"
      >
        <div class="header">
          <agent-avatar
            .agentId=${this.agentId}
            .name=${this.agentId}
            .color=${agentColor}
            size="sm"
            .status=${this.status === "thinking" || this.status === "executing"
              ? this.status
              : ""}
          ></agent-avatar>
          <span class="agent-name">${this.agentId}</span>
          <latency-badge .durationMs=${elapsed}></latency-badge>
        </div>

        ${this.task ? html`<div class="body">${this.task}</div>` : nothing}

        <div class="footer">
          ${this.currentStep
            ? html`<span class="current-step">${this.currentStep}</span>`
            : html`<span></span>`}
          <span
            class="status-badge ${this.status}"
            style="background: ${statusColor}20; color: ${statusColor}"
          >
            ${statusLabel}
          </span>
        </div>
      </div>
    `;
  }
}
