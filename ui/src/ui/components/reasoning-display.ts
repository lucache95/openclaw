import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

export type ReasoningStep = {
  label: string;
  status: "active" | "complete" | "error";
  detail?: string;
  startedAt?: number;
};

@customElement("reasoning-display")
export class ReasoningDisplayElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .reasoning {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 12px;
      font-size: 0.75rem;
      opacity: 0.8;
      border-left: 2px solid var(--border-color, #3b82f6);
    }

    .step {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .step-icon {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .step-icon.active {
      animation: spin 1s linear infinite;
    }

    .step-icon.complete {
      color: #10b981;
    }

    .step-icon.error {
      color: #ef4444;
    }

    .step-label {
      flex: 1;
    }

    .step-label.active {
      font-weight: 600;
    }

    .step-label.complete {
      opacity: 0.5;
    }

    .step-detail {
      opacity: 0.5;
      font-size: 0.7rem;
    }

    .step-elapsed {
      opacity: 0.4;
      font-size: 0.65rem;
      margin-left: auto;
      white-space: nowrap;
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;

  @property({ type: Array }) steps: ReasoningStep[] = [];
  @property() agentName = "";

  @state() private _now = Date.now();

  private _timer: ReturnType<typeof setInterval> | null = null;

  connectedCallback() {
    super.connectedCallback();
    this._startTimer();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopTimer();
  }

  updated() {
    const hasActive = this.steps.some(
      (s) => s.status === "active" && s.startedAt,
    );
    if (hasActive && !this._timer) {
      this._startTimer();
    } else if (!hasActive && this._timer) {
      this._stopTimer();
    }
  }

  private _startTimer() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      this._now = Date.now();
    }, 1000);
  }

  private _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  private formatElapsed(startedAt: number): string {
    const seconds = Math.max(0, Math.floor((this._now - startedAt) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  }

  private renderIcon(status: ReasoningStep["status"]) {
    if (status === "active") {
      return html`<svg class="step-icon active" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="2" stroke-dasharray="20 10" stroke-linecap="round"/>
      </svg>`;
    }
    if (status === "complete") {
      return html`<svg class="step-icon complete" width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M3 7l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
    return html`<svg class="step-icon error" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  render() {
    if (this.steps.length === 0) return nothing;

    return html`
      <div class="reasoning">
        ${this.steps.map(
          (step) => html`
            <div class="step">
              ${this.renderIcon(step.status)}
              <span class="step-label ${step.status}">${step.label}</span>
              ${step.detail
                ? html`<span class="step-detail">${step.detail}</span>`
                : nothing}
              ${step.status === "active" && step.startedAt
                ? html`<span class="step-elapsed">${this.formatElapsed(step.startedAt)}</span>`
                : nothing}
            </div>
          `,
        )}
      </div>
    `;
  }
}
