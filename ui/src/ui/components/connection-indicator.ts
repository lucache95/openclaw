import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { connectionStatus, type ConnectionStatus } from "../state/connection";

@customElement("connection-indicator")
export class ConnectionIndicator extends SignalWatcher(LitElement) {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      line-height: 1;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot.connected {
      background: #22c55e;
    }
    .dot.reconnecting {
      background: #f59e0b;
      animation: pulse 1.2s ease-in-out infinite;
    }
    .dot.disconnected {
      background: #ef4444;
    }
    .label {
      opacity: 0.7;
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

  render() {
    const status: ConnectionStatus = connectionStatus.get();
    const label =
      status === "connected"
        ? "Connected"
        : status === "reconnecting"
          ? "Reconnecting..."
          : "Disconnected";
    return html`
      <span class="dot ${status}"></span>
      <span class="label">${label}</span>
    `;
  }
}
