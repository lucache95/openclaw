/**
 * Cost Tracker Module
 *
 * Tracks LLM usage and costs across the three-tier routing system.
 * Enables measurement of cost reduction from local/cheap routing.
 */

import type { RoutingTier } from "./task-router.js";

/**
 * Cost per million tokens for each routing tier
 *
 * Pricing:
 * - local (Ollama): Free, runs locally
 * - cheap (MiniMax M2): $0.255/M input, $1.0/M output
 * - quality (Claude): $3.0/M input, $15.0/M output (approximate)
 */
export const COST_PER_MILLION = {
  local: { input: 0, output: 0 },
  cheap: { input: 0.255, output: 1.0 },
  quality: { input: 3.0, output: 15.0 },
} as const;

/**
 * A single cost tracking entry
 */
export interface CostEntry {
  /** When this request was made */
  timestamp: Date;
  /** Which tier handled the request */
  tier: RoutingTier;
  /** Model identifier */
  model: string;
  /** Number of prompt/input tokens */
  promptTokens: number;
  /** Number of completion/output tokens */
  completionTokens: number;
  /** Calculated cost in USD */
  costUsd: number;
  /** Request duration in milliseconds */
  durationMs: number;
}

/**
 * Calculate the cost for a request given tier and token counts
 *
 * @param tier - The routing tier that handled the request
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  tier: RoutingTier,
  promptTokens: number,
  completionTokens: number,
): number {
  const rates = COST_PER_MILLION[tier];
  return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
}

/**
 * Cost Tracker for monitoring LLM usage and spending
 */
export class CostTracker {
  private entries: CostEntry[] = [];
  private debug: boolean;

  constructor(options?: { debug?: boolean }) {
    this.debug = options?.debug ?? false;
  }

  /**
   * Track a completed request
   *
   * @param entry - Request details (without timestamp and costUsd which are calculated)
   * @returns The complete cost entry with calculated cost
   */
  track(entry: Omit<CostEntry, "timestamp" | "costUsd">): CostEntry {
    const costUsd = calculateCost(entry.tier, entry.promptTokens, entry.completionTokens);
    const fullEntry: CostEntry = {
      ...entry,
      timestamp: new Date(),
      costUsd,
    };
    this.entries.push(fullEntry);

    if (this.debug) {
      console.log(
        `[CostTracker] ${entry.tier}: $${costUsd.toFixed(6)} (${entry.promptTokens}/${entry.completionTokens} tokens)`,
      );
    }

    return fullEntry;
  }

  /**
   * Get a copy of all tracked entries
   */
  getEntries(): CostEntry[] {
    return [...this.entries];
  }

  /**
   * Get the total cost across all entries
   */
  getTotalCost(): number {
    return this.entries.reduce((sum, e) => sum + e.costUsd, 0);
  }

  /**
   * Get cost breakdown by tier
   */
  getCostByTier(): Record<RoutingTier, number> {
    return {
      local: this.entries.filter((e) => e.tier === "local").reduce((sum, e) => sum + e.costUsd, 0),
      cheap: this.entries.filter((e) => e.tier === "cheap").reduce((sum, e) => sum + e.costUsd, 0),
      quality: this.entries
        .filter((e) => e.tier === "quality")
        .reduce((sum, e) => sum + e.costUsd, 0),
    };
  }

  /**
   * Get request count breakdown by tier
   */
  getRequestCountByTier(): Record<RoutingTier, number> {
    return {
      local: this.entries.filter((e) => e.tier === "local").length,
      cheap: this.entries.filter((e) => e.tier === "cheap").length,
      quality: this.entries.filter((e) => e.tier === "quality").length,
    };
  }

  /**
   * Clear all tracked entries
   */
  clear(): void {
    this.entries = [];
  }
}

/**
 * Global cost tracker instance for application-wide usage tracking
 */
export const globalCostTracker = new CostTracker();
