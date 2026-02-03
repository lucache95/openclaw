import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GsdWorkflowState } from "./gsd-state.js";

// Mock dependencies before importing the module under test
vi.mock("./gsd-state.js", () => ({
  saveGsdState: vi.fn(),
  resolveGsdStatePath: vi.fn((id: string) => `/mock/gsd-state/${id}.json`),
}));

vi.mock("./active-context.js", () => ({
  writeActiveContext: vi.fn(async () => {}),
}));

import { writeActiveContext } from "./active-context.js";
import { writeGsdCheckpoint, buildPhaseQuestions } from "./gsd-checkpoint.js";
// Import mocked modules for assertion access
import { saveGsdState, resolveGsdStatePath } from "./gsd-state.js";

function makeState(overrides: Partial<GsdWorkflowState> = {}): GsdWorkflowState {
  return {
    version: 1,
    sessionId: "test-session",
    projectName: "test-project",
    createdAt: 1000,
    updatedAt: 1000,
    currentPhase: "questioning",
    checkpoint: { phase: "questioning", timestamp: 1000, description: "" },
    ...overrides,
  };
}

describe("gsd-checkpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("writeGsdCheckpoint", () => {
    it("calls saveGsdState with updated checkpoint metadata", async () => {
      const state = makeState({ currentPhase: "research" });

      await writeGsdCheckpoint({
        state,
        workspaceDir: "/tmp/workspace",
        description: "Entering research phase",
      });

      expect(saveGsdState).toHaveBeenCalledTimes(1);
      const savedState = vi.mocked(saveGsdState).mock.calls[0][0];
      expect(savedState.checkpoint.phase).toBe("research");
      expect(savedState.checkpoint.description).toBe("Entering research phase");
      expect(savedState.checkpoint.timestamp).toBeGreaterThan(0);
    });

    it("calls writeActiveContext with correct ACTIVE.md structure", async () => {
      const state = makeState({
        currentPhase: "requirements",
        sessionId: "sess-42",
        projectName: "my-app",
      });

      await writeGsdCheckpoint({
        state,
        workspaceDir: "/tmp/ws",
        description: "Requirements drafted",
      });

      expect(writeActiveContext).toHaveBeenCalledTimes(1);
      const call = vi.mocked(writeActiveContext).mock.calls[0][0];
      expect(call.workspaceDir).toBe("/tmp/ws");
      expect(call.data.currentTask).toContain("my-app");
      expect(call.data.currentTask).toContain("requirements");
    });

    it("sets updatedAt and checkpoint.timestamp to current time", async () => {
      const state = makeState({ updatedAt: 500 });
      const before = Date.now();

      await writeGsdCheckpoint({
        state,
        workspaceDir: "/tmp/ws",
        description: "Phase transition",
      });

      const after = Date.now();
      const savedState = vi.mocked(saveGsdState).mock.calls[0][0];
      expect(savedState.updatedAt).toBeGreaterThanOrEqual(before);
      expect(savedState.updatedAt).toBeLessThanOrEqual(after);
      expect(savedState.checkpoint.timestamp).toBeGreaterThanOrEqual(before);
      expect(savedState.checkpoint.timestamp).toBeLessThanOrEqual(after);
    });

    it("includes state file path in constraints for recovery", async () => {
      const state = makeState({ sessionId: "recover-me" });

      await writeGsdCheckpoint({
        state,
        workspaceDir: "/tmp/ws",
        description: "Checkpoint for recovery",
      });

      expect(resolveGsdStatePath).toHaveBeenCalledWith("recover-me");
      const call = vi.mocked(writeActiveContext).mock.calls[0][0];
      const constraints = call.data.constraints ?? [];
      expect(constraints.some((c: string) => c.includes("/mock/gsd-state/recover-me.json"))).toBe(
        true,
      );
      expect(constraints.some((c: string) => c.includes("Recovery"))).toBe(true);
    });

    it("preserves original state object without mutation", async () => {
      const state = makeState({ currentPhase: "planning" });
      const originalUpdatedAt = state.updatedAt;
      const originalCheckpoint = { ...state.checkpoint };

      await writeGsdCheckpoint({
        state,
        workspaceDir: "/tmp/ws",
        description: "No mutation",
      });

      // Original state should not be mutated (spread creates new object)
      expect(state.updatedAt).toBe(originalUpdatedAt);
      expect(state.checkpoint).toEqual(originalCheckpoint);
    });
  });

  describe("buildPhaseQuestions", () => {
    it("returns questioning phase questions", () => {
      const state = makeState({
        currentPhase: "questioning",
        questioning: {
          questions: [{ question: "Q1", answer: "A1", timestamp: 1000 }],
          complete: false,
        },
      });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Questions asked: 1");
      expect(result).toContainEqual("Waiting for Ethos responses");
    });

    it("returns research phase questions", () => {
      const state = makeState({
        currentPhase: "research",
        research: { findings: ["f1", "f2"], complete: false },
      });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Findings so far: 2");
    });

    it("returns requirements approved status", () => {
      const state = makeState({
        currentPhase: "requirements",
        requirements: { items: ["req1"], approved: true, complete: true },
      });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Requirements approved");
    });

    it("returns requirements awaiting approval status", () => {
      const state = makeState({
        currentPhase: "requirements",
        requirements: { items: ["req1"], approved: false, complete: false },
      });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Awaiting Ethos approval");
    });

    it("returns roadmap phase questions", () => {
      const state = makeState({
        currentPhase: "roadmap",
        roadmap: {
          phases: [
            { name: "p1", description: "d1" },
            { name: "p2", description: "d2" },
          ],
          complete: false,
        },
      });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Phases planned: 2");
    });

    it("returns planning phase questions", () => {
      const state = makeState({
        currentPhase: "planning",
        planning: { plans: ["plan-a", "plan-b", "plan-c"], complete: false },
      });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Plans created: 3");
    });

    it("returns execution phase questions", () => {
      const state = makeState({
        currentPhase: "execution",
        execution: { currentPlan: 3, completedPlans: [1, 2], complete: false },
      });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Completed: 2 plans");
    });

    it("returns complete phase message", () => {
      const state = makeState({ currentPhase: "complete" });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Workflow complete");
    });

    it("returns empty array for unknown phase", () => {
      const state = makeState();
      (state as { currentPhase: string }).currentPhase = "unknown" as never;
      const result = buildPhaseQuestions(state);
      expect(result).toEqual([]);
    });

    it("handles missing phase data gracefully", () => {
      // questioning phase with no questioning data
      const state = makeState({ currentPhase: "questioning" });
      const result = buildPhaseQuestions(state);
      expect(result).toContainEqual("Questions asked: 0");
    });
  });
});
