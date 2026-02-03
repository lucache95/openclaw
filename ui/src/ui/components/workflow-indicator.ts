import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

export type WorkflowPhase = {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "error";
};

@customElement("workflow-indicator")
export class WorkflowIndicatorElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .workflow {
      display: flex;
      align-items: center;
      padding: 8px 16px;
    }

    .phase {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      position: relative;
    }

    .phase-marker {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      border: 2px solid;
      flex-shrink: 0;
    }

    .phase-marker.pending {
      border-color: #4a4a5a;
      color: #4a4a5a;
    }

    .phase-marker.active {
      background: #3b82f6;
      border-color: #3b82f6;
      color: white;
      animation: phase-pulse 2s ease-in-out infinite;
    }

    .phase-marker.complete {
      background: #10b981;
      border-color: #10b981;
      color: white;
    }

    .phase-marker.error {
      background: #ef4444;
      border-color: #ef4444;
      color: white;
    }

    .phase-label {
      font-size: 0.65rem;
      white-space: nowrap;
      opacity: 0.7;
    }

    .phase-label.active {
      opacity: 1;
      font-weight: 600;
    }

    .connector {
      flex: 1;
      height: 2px;
      min-width: 12px;
      background: #4a4a5a;
      align-self: center;
      margin-bottom: 18px;
    }

    .connector.complete {
      background: #10b981;
    }

    .connector.active {
      background: linear-gradient(to right, #10b981, #3b82f6);
    }

    /* Compact mode */
    :host([compact]) .phase-marker,
    .compact .phase-marker {
      width: 20px;
      height: 20px;
      font-size: 0.6rem;
    }

    :host([compact]) .phase-label,
    .compact .phase-label {
      display: none;
    }

    :host([compact]) .connector,
    .compact .connector {
      margin-bottom: 0;
    }

    @keyframes phase-pulse {
      0%,
      100% {
        box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.3);
      }
      50% {
        box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
      }
    }
  `;

  static get defaultPhases(): WorkflowPhase[] {
    return [
      { id: "question", label: "Questioning", status: "pending" },
      { id: "research", label: "Research", status: "pending" },
      { id: "requirements", label: "Requirements", status: "pending" },
      { id: "roadmap", label: "Roadmap", status: "pending" },
      { id: "plan", label: "Planning", status: "pending" },
      { id: "execute", label: "Execute", status: "pending" },
    ];
  }

  @property({ type: Array }) phases: WorkflowPhase[] = [];
  @property({ type: Boolean }) compact = false;

  private get resolvedPhases(): WorkflowPhase[] {
    return this.phases.length > 0
      ? this.phases
      : WorkflowIndicatorElement.defaultPhases;
  }

  private renderMarkerContent(phase: WorkflowPhase, index: number) {
    if (phase.status === "complete") {
      return html`<svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
    }
    if (phase.status === "error") {
      return html`<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
    }
    return html`${index + 1}`;
  }

  private getConnectorClass(index: number): string {
    const phases = this.resolvedPhases;
    const current = phases[index];
    const next = phases[index + 1];

    if (current?.status === "complete" && next?.status === "complete") {
      return "connector complete";
    }
    if (current?.status === "complete" && next?.status === "active") {
      return "connector active";
    }
    return "connector";
  }

  render() {
    const phases = this.resolvedPhases;

    return html`
      <div class="workflow ${this.compact ? "compact" : ""}">
        ${phases.map((phase, i) => html`
          <div class="phase">
            <div class="phase-marker ${phase.status}">
              ${this.renderMarkerContent(phase, i)}
            </div>
            <span class="phase-label ${phase.status}">${phase.label}</span>
          </div>
          ${i < phases.length - 1
            ? html`<div class="${this.getConnectorClass(i)}"></div>`
            : ""}
        `)}
      </div>
    `;
  }
}
