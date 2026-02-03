import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import {
  agentStatuses,
  agentRegistry,
  getAgentIdentity,
  type AgentStatus,
} from "../state/agents";
import "./agent-avatar";

@customElement("agent-status-bar")
export class AgentStatusBarElement extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: block;
    }

    .status-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-color, #2d2d44);
    }

    .status-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 16px;
      background: var(--badge-bg, rgba(255, 255, 255, 0.05));
      font-size: 0.75rem;
    }

    .agent-name {
      font-weight: 500;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status-label {
      text-transform: capitalize;
      opacity: 0.7;
    }

    .status-badge.thinking .status-label {
      color: #f59e0b;
    }

    .status-badge.executing .status-label {
      color: #3b82f6;
    }

    .status-badge.waiting .status-label {
      color: #8b5cf6;
    }
  `;

  render() {
    const registry = agentRegistry.get();
    if (registry.size === 0) return nothing;

    const statuses = agentStatuses.get();

    return html`
      <div class="status-bar">
        ${[...registry.keys()].map((agentId) => {
          const identity = getAgentIdentity(agentId);
          const status: AgentStatus = statuses.get(agentId) ?? "idle";
          const displayName =
            identity.name.length > 15
              ? identity.name.slice(0, 15) + "..."
              : identity.name;

          return html`
            <div class="status-badge ${status}">
              <agent-avatar
                .agentId=${agentId}
                .name=${identity.name}
                .avatar=${identity.avatar}
                .color=${identity.color}
                size="sm"
                .status=${status}
              ></agent-avatar>
              <span class="agent-name">${displayName}</span>
              <span class="status-label">${status}</span>
            </div>
          `;
        })}
      </div>
    `;
  }
}
