import { LitElement, html, css, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { sessionList, activeSessionKey, type SessionEntry } from "../state/sessions";

function formatRelativeTime(ms: number): string {
  if (ms <= 0) return "";
  const now = Date.now();
  const diff = now - ms;
  if (diff < 0) return "just now";

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(ms).toLocaleDateString();
}

const MAX_SESSIONS = 20;
const MAX_LABEL_LENGTH = 30;

@customElement("session-list")
export class SessionListElement extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .session-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #2d2d44);
    }
    .session-header h3 {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .session-count {
      font-size: 0.7rem;
      opacity: 0.5;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.1);
    }
    .session-items {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    .session-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 16px;
      cursor: pointer;
      border-left: 3px solid transparent;
      transition: background 0.15s;
    }
    .session-item:hover {
      background: rgba(255, 255, 255, 0.03);
    }
    .session-item.active {
      background: rgba(59, 130, 246, 0.1);
      border-left-color: #3b82f6;
    }
    .session-label {
      font-size: 0.85rem;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .session-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.7rem;
      opacity: 0.5;
    }
    .session-kind {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .session-kind.direct {
      background: #3b82f6;
    }
    .session-kind.group {
      background: #8b5cf6;
    }
    .session-kind.global {
      background: #10b981;
    }
    .empty {
      padding: 24px 16px;
      text-align: center;
      opacity: 0.5;
      font-size: 0.85rem;
    }
  `;

  private _handleClick(key: string) {
    this.dispatchEvent(
      new CustomEvent("session-select", {
        detail: { key },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const sessions = sessionList.get();
    const activeKey = activeSessionKey.get();

    const sorted = [...sessions]
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .slice(0, MAX_SESSIONS);

    return html`
      <div class="session-header">
        <h3>Conversations</h3>
        <span class="session-count">${sessions.length}</span>
      </div>
      <div class="session-items">
        ${sorted.length === 0
          ? html`<div class="empty">No conversations</div>`
          : sorted.map((s) => this._renderSession(s, activeKey))}
      </div>
    `;
  }

  private _renderSession(session: SessionEntry, activeKey: string) {
    const isActive = session.key === activeKey;
    const label =
      session.label.length > MAX_LABEL_LENGTH
        ? session.label.slice(0, MAX_LABEL_LENGTH) + "..."
        : session.label;
    const time = formatRelativeTime(session.lastActivityAt);

    return html`
      <div
        class="session-item ${isActive ? "active" : ""}"
        @click=${() => this._handleClick(session.key)}
      >
        <span class="session-label">${label}</span>
        <div class="session-meta">
          <span class="session-kind ${session.kind}"></span>
          ${time ? html`<span>${time}</span>` : nothing}
        </div>
      </div>
    `;
  }
}
