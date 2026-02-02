/**
 * Tests for Cost Tracker Module
 *
 * Tests calculateCost function and CostTracker class methods.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { calculateCost, CostTracker, COST_PER_MILLION, globalCostTracker } from "./cost-tracker.js";

describe("COST_PER_MILLION", () => {
  it("has correct rates for local tier (free)", () => {
    expect(COST_PER_MILLION.local.input).toBe(0);
    expect(COST_PER_MILLION.local.output).toBe(0);
  });

  it("has correct rates for cheap tier (MiniMax)", () => {
    expect(COST_PER_MILLION.cheap.input).toBe(0.255);
    expect(COST_PER_MILLION.cheap.output).toBe(1.0);
  });

  it("has correct rates for quality tier (Claude)", () => {
    expect(COST_PER_MILLION.quality.input).toBe(3.0);
    expect(COST_PER_MILLION.quality.output).toBe(15.0);
  });
});

describe("calculateCost", () => {
  it("returns 0 for local tier", () => {
    const cost = calculateCost("local", 1000, 500);
    expect(cost).toBe(0);
  });

  it("calculates correct cost for cheap tier", () => {
    // 1000 input tokens at $0.255/M = $0.000255
    // 500 output tokens at $1.0/M = $0.0005
    // Total = $0.000755
    const cost = calculateCost("cheap", 1000, 500);
    expect(cost).toBeCloseTo(0.000755, 8);
  });

  it("calculates correct cost for quality tier", () => {
    // 1000 input tokens at $3.0/M = $0.003
    // 500 output tokens at $15.0/M = $0.0075
    // Total = $0.0105
    const cost = calculateCost("quality", 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 8);
  });

  it("handles large token counts", () => {
    // 1M input + 1M output for quality tier
    // 1M * $3.0/M = $3.0 input
    // 1M * $15.0/M = $15.0 output
    // Total = $18.0
    const cost = calculateCost("quality", 1_000_000, 1_000_000);
    expect(cost).toBe(18.0);
  });

  it("handles zero tokens", () => {
    const cost = calculateCost("quality", 0, 0);
    expect(cost).toBe(0);
  });
});

describe("CostTracker", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  describe("track()", () => {
    it("adds entry with calculated cost", () => {
      const entry = tracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 200,
      });

      expect(entry.tier).toBe("cheap");
      expect(entry.model).toBe("minimax-m2");
      expect(entry.promptTokens).toBe(1000);
      expect(entry.completionTokens).toBe(500);
      expect(entry.durationMs).toBe(200);
      expect(entry.costUsd).toBeCloseTo(0.000755, 8);
      expect(entry.timestamp).toBeInstanceOf(Date);
    });

    it("returns zero cost for local tier", () => {
      const entry = tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 5000,
        completionTokens: 2000,
        durationMs: 300,
      });

      expect(entry.costUsd).toBe(0);
    });
  });

  describe("getEntries()", () => {
    it("returns copy of entries", () => {
      tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 100,
      });

      const entries1 = tracker.getEntries();
      const entries2 = tracker.getEntries();

      expect(entries1).toHaveLength(1);
      expect(entries1).not.toBe(entries2); // Different arrays
      expect(entries1).toEqual(entries2); // Same content
    });

    it("returns empty array when no entries", () => {
      expect(tracker.getEntries()).toEqual([]);
    });
  });

  describe("getTotalCost()", () => {
    it("sums all costs", () => {
      tracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 200,
      });
      tracker.track({
        tier: "quality",
        model: "claude-sonnet",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 1000,
      });

      // cheap: $0.000755
      // quality: $0.0105
      // Total: $0.011255
      const total = tracker.getTotalCost();
      expect(total).toBeCloseTo(0.011255, 8);
    });

    it("returns 0 when no entries", () => {
      expect(tracker.getTotalCost()).toBe(0);
    });

    it("returns 0 when only local tier entries", () => {
      tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 5000,
        completionTokens: 2000,
        durationMs: 300,
      });
      tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 3000,
        completionTokens: 1000,
        durationMs: 200,
      });

      expect(tracker.getTotalCost()).toBe(0);
    });
  });

  describe("getCostByTier()", () => {
    it("groups costs by tier", () => {
      tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 100,
      });
      tracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 200,
      });
      tracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 200,
      });
      tracker.track({
        tier: "quality",
        model: "claude-sonnet",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 1000,
      });

      const byTier = tracker.getCostByTier();

      expect(byTier.local).toBe(0);
      expect(byTier.cheap).toBeCloseTo(0.00151, 8); // 2 * 0.000755
      expect(byTier.quality).toBeCloseTo(0.0105, 8);
    });

    it("returns zeros for all tiers when empty", () => {
      const byTier = tracker.getCostByTier();

      expect(byTier.local).toBe(0);
      expect(byTier.cheap).toBe(0);
      expect(byTier.quality).toBe(0);
    });
  });

  describe("getRequestCountByTier()", () => {
    it("counts requests by tier", () => {
      tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 100,
      });
      tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 100,
      });
      tracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
      });
      tracker.track({
        tier: "quality",
        model: "claude-sonnet",
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 1000,
      });

      const counts = tracker.getRequestCountByTier();

      expect(counts.local).toBe(2);
      expect(counts.cheap).toBe(1);
      expect(counts.quality).toBe(1);
    });

    it("returns zeros for all tiers when empty", () => {
      const counts = tracker.getRequestCountByTier();

      expect(counts.local).toBe(0);
      expect(counts.cheap).toBe(0);
      expect(counts.quality).toBe(0);
    });
  });

  describe("clear()", () => {
    it("empties all entries", () => {
      tracker.track({
        tier: "local",
        model: "qwen2.5:3b",
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 100,
      });
      tracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 100,
        completionTokens: 50,
        durationMs: 200,
      });

      expect(tracker.getEntries()).toHaveLength(2);

      tracker.clear();

      expect(tracker.getEntries()).toHaveLength(0);
      expect(tracker.getTotalCost()).toBe(0);
    });
  });

  describe("debug mode", () => {
    it("logs when debug is enabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const debugTracker = new CostTracker({ debug: true });

      debugTracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 200,
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logMessage = consoleSpy.mock.calls[0]?.[0];
      expect(logMessage).toContain("[CostTracker]");
      expect(logMessage).toContain("cheap");

      consoleSpy.mockRestore();
    });

    it("does not log when debug is disabled", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const normalTracker = new CostTracker({ debug: false });

      normalTracker.track({
        tier: "cheap",
        model: "minimax-m2",
        promptTokens: 1000,
        completionTokens: 500,
        durationMs: 200,
      });

      // Should not have any CostTracker logs
      const logCalls = consoleSpy.mock.calls.filter((call) => call[0]?.includes?.("[CostTracker]"));
      expect(logCalls).toHaveLength(0);

      consoleSpy.mockRestore();
    });
  });
});

describe("globalCostTracker", () => {
  it("is a CostTracker instance", () => {
    expect(globalCostTracker).toBeInstanceOf(CostTracker);
  });

  it("can track entries", () => {
    const initialCount = globalCostTracker.getEntries().length;

    globalCostTracker.track({
      tier: "local",
      model: "test",
      promptTokens: 100,
      completionTokens: 50,
      durationMs: 100,
    });

    expect(globalCostTracker.getEntries().length).toBe(initialCount + 1);
  });
});
