import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

type Severity = "fast" | "normal" | "slow";

@customElement("latency-badge")
export class LatencyBadgeElement extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-family: monospace;
      font-size: 0.75rem;
      line-height: 1;
      border-radius: 9999px;
      padding: 2px 8px;
    }

    .badge.fast {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }

    .badge.normal {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }

    .badge.slow {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .label {
      opacity: 0.6;
    }
  `;

  @property({ type: Number }) durationMs = 0;
  @property() label = "";

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.round((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  private getSeverity(ms: number): Severity {
    if (ms < 1000) return "fast";
    if (ms <= 5000) return "normal";
    return "slow";
  }

  render() {
    const severity = this.getSeverity(this.durationMs);
    const formatted = this.formatDuration(this.durationMs);

    return html`
      <span class="badge ${severity}">
        ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
        ${formatted}
      </span>
    `;
  }
}
