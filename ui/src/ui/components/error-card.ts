import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getAgentColor } from "../state/agents";
import "./agent-avatar";

@customElement("error-card")
export class ErrorCardElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .error-container {
      background: rgba(239, 68, 68, 0.08);
      border-left: 3px solid #ef4444;
      border-radius: 8px;
      padding: 12px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .alert-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .alert-icon svg {
      width: 100%;
      height: 100%;
    }

    .agent-name {
      font-weight: 600;
      font-size: 0.875rem;
      color: #e2e8f0;
    }

    .phase-label {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-left: auto;
    }

    .timestamp {
      font-size: 0.75rem;
      color: #6b7280;
    }

    .error-message {
      margin-top: 8px;
      font-size: 0.9375rem;
      color: #fca5a5;
      line-height: 1.5;
    }

    .toggle-btn {
      margin-top: 8px;
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 0.8125rem;
      cursor: pointer;
      padding: 0;
      font-family: inherit;
    }

    .toggle-btn:hover {
      text-decoration: underline;
      color: #d1d5db;
    }

    .details {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .detail-label {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-bottom: 2px;
    }

    pre {
      margin: 0;
      padding: 8px;
      background: var(--bg-primary, #11111b);
      border-radius: 4px;
      font-family: "Fira Code", "Cascadia Code", monospace;
      font-size: 0.75rem;
      color: #a1a1aa;
      overflow: auto;
      max-height: 200px;
      white-space: pre-wrap;
      word-break: break-all;
    }
  `;

  @property() agentId = "";
  @property() phase = "";
  @property() errorMessage = "";
  @property() stack = "";
  @property() errorContext = "";
  @property() sessionKey = "";
  @property() runId = "";
  @property({ type: Number }) timestamp = 0;

  @state() private expanded = false;

  private _formatRelativeTime(ts: number): string {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  private _toggleExpanded(): void {
    this.expanded = !this.expanded;
  }

  private get _hasDetails(): boolean {
    return !!(this.stack || this.errorContext);
  }

  render() {
    const agentColor = getAgentColor(this.agentId);
    const displayName = this.agentId || "Unknown";

    return html`
      <div class="error-container" role="alert">
        <div class="header">
          <span class="alert-icon">
            <svg viewBox="0 0 20 20" fill="#ef4444" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="10" fill="#ef4444" />
              <text
                x="10"
                y="14.5"
                text-anchor="middle"
                fill="#fff"
                font-size="13"
                font-weight="bold"
                font-family="sans-serif"
              >!</text>
            </svg>
          </span>
          <agent-avatar
            .agentId=${this.agentId}
            .name=${displayName}
            .color=${agentColor}
            size="sm"
          ></agent-avatar>
          <span class="agent-name">${displayName}</span>
          ${this.phase
            ? html`<span class="phase-label">Failed: ${this.phase}</span>`
            : nothing}
          ${this.timestamp
            ? html`<span class="timestamp">${this._formatRelativeTime(this.timestamp)}</span>`
            : nothing}
        </div>

        ${this.errorMessage
          ? html`<div class="error-message">${this.errorMessage}</div>`
          : nothing}

        ${this._hasDetails
          ? html`
              <button
                class="toggle-btn"
                @click=${this._toggleExpanded}
                aria-expanded=${this.expanded}
              >
                ${this.expanded ? "Hide details" : "Show details"}
              </button>
            `
          : nothing}

        ${this.expanded
          ? html`
              <div class="details">
                ${this.stack
                  ? html`
                      <div>
                        <div class="detail-label">Stack trace</div>
                        <pre>${this.stack}</pre>
                      </div>
                    `
                  : nothing}
                ${this.errorContext
                  ? html`
                      <div>
                        <div class="detail-label">Context</div>
                        <pre>${this.errorContext}</pre>
                      </div>
                    `
                  : nothing}
              </div>
            `
          : nothing}
      </div>
    `;
  }
}
