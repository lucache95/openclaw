import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CONTEXT_WARNING_THRESHOLDS,
  checkContextThresholds,
  createContextThresholdState,
  getCurrentWarningLevel,
  formatUsagePercent,
  resetContextThresholdState,
  type ContextThresholdState,
} from "./context-thresholds.js";

// Mock agent events
vi.mock("../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

describe("CONTEXT_WARNING_THRESHOLDS", () => {
  it("has correct threshold values", () => {
    expect(CONTEXT_WARNING_THRESHOLDS.yellow).toBe(0.7);
    expect(CONTEXT_WARNING_THRESHOLDS.orange).toBe(0.8);
    expect(CONTEXT_WARNING_THRESHOLDS.red).toBe(0.9);
  });
});

describe("checkContextThresholds", () => {
  let state: ContextThresholdState;

  beforeEach(() => {
    state = createContextThresholdState();
    vi.clearAllMocks();
  });

  it("returns empty array when under all thresholds", () => {
    const result = checkContextThresholds({
      totalTokens: 50000,
      contextWindowTokens: 100000,
      state,
    });
    expect(result).toHaveLength(0);
  });

  it("emits yellow warning at 70%", () => {
    const result = checkContextThresholds({
      totalTokens: 70000,
      contextWindowTokens: 100000,
      state,
    });
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe("yellow");
    expect(result[0].usagePercent).toBe(0.7);
  });

  it("emits multiple warnings when crossing multiple thresholds", () => {
    const result = checkContextThresholds({
      totalTokens: 95000,
      contextWindowTokens: 100000,
      state,
    });
    expect(result).toHaveLength(3); // yellow, orange, red
    expect(result.map((w) => w.level)).toEqual(["yellow", "orange", "red"]);
  });

  it("does not re-emit already triggered warnings", () => {
    // First check at 75%
    checkContextThresholds({
      totalTokens: 75000,
      contextWindowTokens: 100000,
      state,
    });
    expect(state.emittedWarnings.has("yellow")).toBe(true);

    // Second check at 85% - should only emit orange, not yellow again
    const result = checkContextThresholds({
      totalTokens: 85000,
      contextWindowTokens: 100000,
      state,
    });
    expect(result).toHaveLength(1);
    expect(result[0].level).toBe("orange");
  });

  it("handles zero/invalid inputs gracefully", () => {
    expect(checkContextThresholds({ totalTokens: 0, contextWindowTokens: 100000, state })).toEqual(
      [],
    );
    expect(checkContextThresholds({ totalTokens: 100, contextWindowTokens: 0, state })).toEqual([]);
    expect(checkContextThresholds({ totalTokens: -1, contextWindowTokens: 100000, state })).toEqual(
      [],
    );
  });
});

describe("resetContextThresholdState", () => {
  it("clears emitted warnings", () => {
    const state = createContextThresholdState();
    state.emittedWarnings.add("yellow");
    state.emittedWarnings.add("orange");

    resetContextThresholdState(state);

    expect(state.emittedWarnings.size).toBe(0);
  });
});

describe("getCurrentWarningLevel", () => {
  it("returns null when under 70%", () => {
    expect(getCurrentWarningLevel(50000, 100000)).toBeNull();
  });

  it("returns yellow at 70-79%", () => {
    expect(getCurrentWarningLevel(70000, 100000)).toBe("yellow");
    expect(getCurrentWarningLevel(79000, 100000)).toBe("yellow");
  });

  it("returns orange at 80-89%", () => {
    expect(getCurrentWarningLevel(80000, 100000)).toBe("orange");
    expect(getCurrentWarningLevel(89000, 100000)).toBe("orange");
  });

  it("returns red at 90%+", () => {
    expect(getCurrentWarningLevel(90000, 100000)).toBe("red");
    expect(getCurrentWarningLevel(100000, 100000)).toBe("red");
  });

  it("handles invalid inputs gracefully", () => {
    expect(getCurrentWarningLevel(0, 100000)).toBeNull();
    expect(getCurrentWarningLevel(100, 0)).toBeNull();
    expect(getCurrentWarningLevel(-1, 100000)).toBeNull();
  });
});

describe("formatUsagePercent", () => {
  it("formats percentage with one decimal", () => {
    expect(formatUsagePercent(75000, 100000)).toBe("75.0%");
    expect(formatUsagePercent(12345, 100000)).toBe("12.3%");
  });

  it("returns N/A for invalid input", () => {
    expect(formatUsagePercent(100, 0)).toBe("N/A");
  });
});
