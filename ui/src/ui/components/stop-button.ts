import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("stop-button")
export class StopButtonElement extends LitElement {
  @property({ type: Boolean }) active = false;
  @property({ type: Boolean }) stopping = false;

  private _stopping = false;
  private _prevActive = false;

  static styles = css`
    :host {
      display: inline-flex;
    }
    .stop-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 8px;
      border: 1px solid #ef4444;
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: all 0.15s;
    }
    .stop-btn:hover {
      background: rgba(239, 68, 68, 0.2);
    }
    .stop-btn:active {
      transform: scale(0.97);
    }
    .stop-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .stop-icon {
      width: 14px;
      height: 14px;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(239, 68, 68, 0.3);
      border-top-color: #ef4444;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
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

  updated() {
    // Reset _stopping when active transitions from true to false
    if (this._prevActive && !this.active && this._stopping) {
      this._stopping = false;
    }
    this._prevActive = this.active;
  }

  private _handleClick() {
    if (this._stopping) return;
    this._stopping = true;
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent("stop-execution", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    if (!this.active && !this._stopping) return nothing;

    if (this._stopping) {
      return html`
        <button class="stop-btn" type="button" disabled aria-label="Stopping execution">
          <span class="spinner"></span>
          Stopping...
        </button>
      `;
    }

    return html`
      <button
        class="stop-btn"
        type="button"
        aria-label="Stop execution"
        @click=${this._handleClick}
      >
        <svg class="stop-icon" viewBox="0 0 16 16" fill="currentColor">
          <rect x="3" y="3" width="10" height="10" rx="1" />
        </svg>
        Stop
      </button>
    `;
  }
}
