import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let tempStateDir: string;
const previousStateDir = process.env.OPENCLAW_STATE_DIR;

beforeEach(() => {
  tempStateDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-gsd-state-"));
  process.env.OPENCLAW_STATE_DIR = tempStateDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(tempStateDir, { recursive: true, force: true });
  if (previousStateDir === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = previousStateDir;
  }
});

/**
 * Import the module fresh after vi.resetModules() so STATE_DIR picks up
 * the test's OPENCLAW_STATE_DIR override.
 */
async function loadModule() {
  const mod = await import("./gsd-state.js");
  return mod;
}

describe("gsd-state", () => {
  describe("createInitialState", () => {
    it("returns valid state with correct defaults", async () => {
      const { createInitialState } = await loadModule();
      const before = Date.now();
      const state = createInitialState("sess-1", "my-project");
      const after = Date.now();

      expect(state.version).toBe(1);
      expect(state.sessionId).toBe("sess-1");
      expect(state.projectName).toBe("my-project");
      expect(state.currentPhase).toBe("questioning");
      expect(state.createdAt).toBeGreaterThanOrEqual(before);
      expect(state.createdAt).toBeLessThanOrEqual(after);
      expect(state.updatedAt).toBeGreaterThanOrEqual(before);
      expect(state.updatedAt).toBeLessThanOrEqual(after);
      expect(state.checkpoint.phase).toBe("questioning");
      expect(state.checkpoint.timestamp).toBe(state.createdAt);
      expect(state.checkpoint.description).toBe("");
    });
  });

  describe("resolveGsdStatePath", () => {
    it("produces correct path format", async () => {
      const { resolveGsdStatePath } = await loadModule();
      const result = resolveGsdStatePath("abc-123");
      expect(result).toBe(path.join(tempStateDir, "gsd-state", "abc-123.json"));
    });
  });

  describe("saveGsdState + loadGsdState roundtrip", () => {
    it("saves and loads state with all fields intact", async () => {
      const { createInitialState, saveGsdState, loadGsdState } = await loadModule();
      const state = createInitialState("roundtrip-1", "test-project");
      state.currentPhase = "research";
      state.questioning = {
        questions: [{ question: "What stack?", answer: "TypeScript", timestamp: 1000 }],
        complete: true,
      };
      state.research = {
        findings: ["Found vitest", "Found pnpm"],
        complete: false,
      };
      state.checkpoint = {
        phase: "research",
        timestamp: Date.now(),
        description: "Moved to research",
      };

      saveGsdState(state);

      const loaded = loadGsdState("roundtrip-1");
      expect(loaded).not.toBeNull();
      expect(loaded!.version).toBe(1);
      expect(loaded!.sessionId).toBe("roundtrip-1");
      expect(loaded!.projectName).toBe("test-project");
      expect(loaded!.currentPhase).toBe("research");
      expect(loaded!.questioning?.questions).toHaveLength(1);
      expect(loaded!.questioning?.questions[0].question).toBe("What stack?");
      expect(loaded!.questioning?.complete).toBe(true);
      expect(loaded!.research?.findings).toEqual(["Found vitest", "Found pnpm"]);
      expect(loaded!.checkpoint.phase).toBe("research");
      expect(loaded!.checkpoint.description).toBe("Moved to research");
    });
  });

  describe("loadGsdState", () => {
    it("returns null for non-existent sessionId", async () => {
      const { loadGsdState } = await loadModule();
      const result = loadGsdState("does-not-exist");
      expect(result).toBeNull();
    });

    it("returns null for corrupt/invalid JSON file", async () => {
      const { loadGsdState } = await loadModule();
      const dir = path.join(tempStateDir, "gsd-state");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "corrupt.json"), "not valid json{{{", "utf8");
      const result = loadGsdState("corrupt");
      expect(result).toBeNull();
    });

    it("returns null for valid JSON with wrong version", async () => {
      const { loadGsdState } = await loadModule();
      const dir = path.join(tempStateDir, "gsd-state");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "wrong-version.json"),
        JSON.stringify({ version: 99, sessionId: "wrong-version" }),
        "utf8",
      );
      const result = loadGsdState("wrong-version");
      expect(result).toBeNull();
    });
  });

  describe("saveGsdState", () => {
    it("updates the updatedAt timestamp on save", async () => {
      const { createInitialState, saveGsdState, loadGsdState } = await loadModule();
      const state = createInitialState("timestamp-test", "proj");
      const originalUpdatedAt = state.updatedAt;

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));

      saveGsdState(state);
      const loaded = loadGsdState("timestamp-test");
      expect(loaded).not.toBeNull();
      expect(loaded!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe("listGsdStates", () => {
    it("returns empty array when gsd-state directory does not exist", async () => {
      const { listGsdStates } = await loadModule();
      const result = listGsdStates();
      expect(result).toEqual([]);
    });

    it("returns states for multiple saved workflows", async () => {
      const { createInitialState, saveGsdState, listGsdStates } = await loadModule();

      const state1 = createInitialState("list-1", "project-a");
      saveGsdState(state1);

      const state2 = createInitialState("list-2", "project-b");
      state2.currentPhase = "research";
      saveGsdState(state2);

      const state3 = createInitialState("list-3", "project-c");
      state3.currentPhase = "complete";
      saveGsdState(state3);

      const results = listGsdStates();
      expect(results).toHaveLength(3);

      const ids = results.map((r) => r.sessionId).sort();
      expect(ids).toEqual(["list-1", "list-2", "list-3"]);

      const projB = results.find((r) => r.sessionId === "list-2");
      expect(projB?.state.projectName).toBe("project-b");
      expect(projB?.state.currentPhase).toBe("research");
    });

    it("skips corrupt files when listing", async () => {
      const { createInitialState, saveGsdState, listGsdStates } = await loadModule();

      const state = createInitialState("valid-1", "good-project");
      saveGsdState(state);

      // Write a corrupt file alongside the valid one
      const dir = path.join(tempStateDir, "gsd-state");
      fs.writeFileSync(path.join(dir, "bad.json"), "{{broken}}", "utf8");

      const results = listGsdStates();
      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe("valid-1");
    });
  });

  describe("full workflow lifecycle", () => {
    it("progresses through phases with state updates", async () => {
      const { createInitialState, saveGsdState, loadGsdState } = await loadModule();

      // Create and save initial state
      const state = createInitialState("lifecycle-1", "full-test");
      saveGsdState(state);

      // Load, update to research phase, save
      const s1 = loadGsdState("lifecycle-1")!;
      expect(s1.currentPhase).toBe("questioning");
      s1.questioning = {
        questions: [{ question: "Q1", answer: "A1", timestamp: Date.now() }],
        complete: true,
      };
      s1.currentPhase = "research";
      s1.checkpoint = {
        phase: "research",
        timestamp: Date.now(),
        description: "Starting research",
      };
      saveGsdState(s1);

      // Load again and verify progression
      const s2 = loadGsdState("lifecycle-1")!;
      expect(s2.currentPhase).toBe("research");
      expect(s2.questioning?.complete).toBe(true);
      expect(s2.checkpoint.phase).toBe("research");
    });
  });
});
