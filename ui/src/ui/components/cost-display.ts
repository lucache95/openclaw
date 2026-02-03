import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { UsageEntry } from "../state/metrics.js";

type Tier = "local" | "cheap" | "quality";

interface TierSummary {
  tokens: number;
  cost: number;
  count: number;
}

/**
 * Displays token usage and cost for agent interactions.
 *
 * Modes:
 *  - inline: compact single-line for embedding in message rows
 *  - detail: expanded card with per-tier breakdown
 */
@customElement("cost-display")
export class CostDisplayElement extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
    }

    /* ---- inline mode ---- */

    .inline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.75rem;
      color: #94a3b8;
      line-height: 1;
    }

    .inline .tokens,
    .inline .cost {
      font-family: monospace;
      font-variant-numeric: tabular-nums;
    }

    .inline .sep {
      opacity: 0.4;
    }

    /* ---- detail mode ---- */

    .detail {
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 0.75rem;
      color: #cbd5e1;
      min-width: 220px;
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      font-weight: 600;
      color: #e2e8f0;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: auto 1fr 1fr 1fr;
      gap: 2px 10px;
      align-items: center;
      font-family: monospace;
      font-variant-numeric: tabular-nums;
    }

    .detail-grid .label {
      text-align: left;
    }

    .detail-grid .num {
      text-align: right;
    }

    .detail-footer {
      display: grid;
      grid-template-columns: auto 1fr 1fr 1fr;
      gap: 2px 10px;
      align-items: center;
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-family: monospace;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: #e2e8f0;
    }

    .detail-footer .num {
      text-align: right;
    }

    /* ---- tier badges ---- */

    .tier {
      display: inline-flex;
      align-items: center;
      border-radius: 9999px;
      padding: 1px 6px;
      font-size: 0.65rem;
      font-weight: 500;
      line-height: 1.4;
    }

    .tier.local {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }

    .tier.cheap {
      background: rgba(245, 158, 11, 0.15);
      color: #f59e0b;
    }

    .tier.quality {
      background: rgba(139, 92, 246, 0.15);
      color: #8b5cf6;
    }
  `;

  @property({ attribute: false }) entries: UsageEntry[] = [];
  @property() mode: "inline" | "detail" = "inline";

  /* ---- helpers ---- */

  private computeTotals(): { totalTokens: number; totalCost: number } {
    let totalTokens = 0;
    let totalCost = 0;
    for (const e of this.entries) {
      totalTokens += e.promptTokens + e.completionTokens;
      totalCost += e.costUsd;
    }
    return { totalTokens, totalCost };
  }

  private computeTierBreakdown(): Map<Tier, TierSummary> {
    const map = new Map<Tier, TierSummary>();
    for (const e of this.entries) {
      const existing = map.get(e.tier) ?? { tokens: 0, cost: 0, count: 0 };
      existing.tokens += e.promptTokens + e.completionTokens;
      existing.cost += e.costUsd;
      existing.count += 1;
      map.set(e.tier, existing);
    }
    return map;
  }

  private formatCost(usd: number): string {
    if (usd < 0.01) {
      return `$${(usd * 1000).toFixed(2)}m`;
    }
    if (usd < 1) {
      return `$${usd.toFixed(4)}`;
    }
    return `$${usd.toFixed(2)}`;
  }

  private formatTokens(n: number): string {
    return n.toLocaleString();
  }

  /* ---- render ---- */

  render() {
    if (this.entries.length === 0) return nothing;

    if (this.mode === "detail") return this.renderDetail();
    return this.renderInline();
  }

  private renderInline() {
    const { totalTokens, totalCost } = this.computeTotals();
    const tiers = this.computeTierBreakdown();

    return html`
      <span class="inline">
        <span class="tokens">${this.formatTokens(totalTokens)} tokens</span>
        <span class="sep">|</span>
        <span class="cost">${this.formatCost(totalCost)}</span>
        <span class="sep">|</span>
        ${[...tiers.keys()].map(
          (tier) => html`<span class="tier ${tier}">${tier}</span>`,
        )}
      </span>
    `;
  }

  private renderDetail() {
    const { totalTokens, totalCost } = this.computeTotals();
    const tiers = this.computeTierBreakdown();
    const tierOrder: Tier[] = ["local", "cheap", "quality"];
    const rows = tierOrder.filter((t) => tiers.has(t));

    return html`
      <div class="detail">
        <div class="detail-header">
          <span>Cost Breakdown</span>
          <span>${this.formatCost(totalCost)}</span>
        </div>
        <div class="detail-grid">
          ${rows.map((tier) => {
            const s = tiers.get(tier)!;
            return html`
              <span class="tier ${tier}">${tier}</span>
              <span class="num">${s.count}x</span>
              <span class="num">${this.formatTokens(s.tokens)}</span>
              <span class="num">${this.formatCost(s.cost)}</span>
            `;
          })}
        </div>
        <div class="detail-footer">
          <span>Total</span>
          <span class="num">${rows.reduce((n, t) => n + tiers.get(t)!.count, 0)}x</span>
          <span class="num">${this.formatTokens(totalTokens)}</span>
          <span class="num">${this.formatCost(totalCost)}</span>
        </div>
      </div>
    `;
  }
}
