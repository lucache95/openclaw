import { describe, expect, it } from "vitest";
import { validateFlowDirection, resolveTaskTimeout } from "./sessions-send-helpers.js";

describe("validateFlowDirection", () => {
  it("allows ethos to send to gsd", () => {
    const result = validateFlowDirection("ethos", "gsd");
    expect(result.ok).toBe(true);
  });

  it("allows ethos to send to any worker", () => {
    const result = validateFlowDirection("ethos", "coder");
    expect(result.ok).toBe(true);
  });

  it("allows gsd to send to workers", () => {
    const result = validateFlowDirection("gsd", "coder");
    expect(result.ok).toBe(true);
  });

  it("allows worker to send to another worker (same level)", () => {
    const result = validateFlowDirection("coder", "researcher");
    expect(result.ok).toBe(true);
  });

  it("forbids worker from sending to gsd", () => {
    const result = validateFlowDirection("coder", "gsd");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Reverse flow forbidden");
      expect(result.error).toContain("unidirectional");
    }
  });

  it("forbids worker from sending to ethos", () => {
    const result = validateFlowDirection("researcher", "ethos");
    expect(result.ok).toBe(false);
  });

  it("forbids gsd from sending to ethos", () => {
    const result = validateFlowDirection("gsd", "ethos");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Reverse flow forbidden");
    }
  });

  it("handles case-insensitive agent IDs", () => {
    const result = validateFlowDirection("Ethos", "GSD");
    expect(result.ok).toBe(true);
  });

  it("allows same agent to same agent", () => {
    const result = validateFlowDirection("ethos", "ethos");
    expect(result.ok).toBe(true);
  });
});

describe("resolveTaskTimeout", () => {
  it("returns 30s for simple tasks (no reasoning flag)", () => {
    expect(resolveTaskTimeout({})).toBe(30_000);
  });

  it("returns 30s when reasoning is false", () => {
    expect(resolveTaskTimeout({ reasoning: false })).toBe(30_000);
  });

  it("returns 5min for reasoning tasks", () => {
    expect(resolveTaskTimeout({ reasoning: true })).toBe(300_000);
  });

  it("explicit timeout overrides reasoning flag", () => {
    expect(resolveTaskTimeout({ reasoning: true, explicitTimeoutSeconds: 60 })).toBe(60_000);
  });

  it("explicit timeout overrides simple default", () => {
    expect(resolveTaskTimeout({ reasoning: false, explicitTimeoutSeconds: 120 })).toBe(120_000);
  });

  it("ignores zero explicit timeout (falls back to reasoning-based)", () => {
    expect(resolveTaskTimeout({ reasoning: true, explicitTimeoutSeconds: 0 })).toBe(300_000);
  });

  it("ignores negative explicit timeout", () => {
    expect(resolveTaskTimeout({ reasoning: false, explicitTimeoutSeconds: -5 })).toBe(30_000);
  });
});
