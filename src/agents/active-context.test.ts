import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  formatActiveContext,
  parseActiveContext,
  loadActiveContext,
  writeActiveContext,
  type ActiveContextData,
} from "./active-context.js";

describe("formatActiveContext", () => {
  it("formats empty data with only header and footer", () => {
    const result = formatActiveContext({});
    expect(result).toContain("# Active Context");
    expect(result).toContain("Updated:");
  });

  it("formats all sections", () => {
    const data: ActiveContextData = {
      currentTask: "Building auth system",
      decisions: ["Use JWT", "Store in httpOnly cookie"],
      constraints: ["Must support SSO"],
      workingFiles: ["src/auth.ts", "src/api/login.ts"],
      openQuestions: ["Which provider?"],
      compactionCount: 3,
    };
    const result = formatActiveContext(data);

    expect(result).toContain("## Current Task");
    expect(result).toContain("Building auth system");
    expect(result).toContain("## Key Decisions");
    expect(result).toContain("- Use JWT");
    expect(result).toContain("## Constraints");
    expect(result).toContain("- Must support SSO");
    expect(result).toContain("## Working Files");
    expect(result).toContain("- src/auth.ts");
    expect(result).toContain("## Open Questions");
    expect(result).toContain("- Which provider?");
    expect(result).toContain("Compaction: 3");
  });

  it("preserves provided updatedAt timestamp", () => {
    const data: ActiveContextData = {
      updatedAt: "2026-02-01T12:00:00.000Z",
    };
    const result = formatActiveContext(data);
    expect(result).toContain("Updated: 2026-02-01T12:00:00.000Z");
  });

  it("omits empty sections", () => {
    const data: ActiveContextData = {
      currentTask: "Test task",
    };
    const result = formatActiveContext(data);
    expect(result).toContain("## Current Task");
    expect(result).not.toContain("## Key Decisions");
    expect(result).not.toContain("## Constraints");
    expect(result).not.toContain("## Working Files");
    expect(result).not.toContain("## Open Questions");
  });
});

describe("parseActiveContext", () => {
  it("parses formatted content back to data", () => {
    const original: ActiveContextData = {
      currentTask: "Test task",
      decisions: ["Decision 1", "Decision 2"],
      constraints: ["Constraint 1"],
      workingFiles: ["file1.ts"],
      openQuestions: ["Question 1"],
      compactionCount: 5,
      updatedAt: "2026-02-01T12:00:00.000Z",
    };

    const formatted = formatActiveContext(original);
    const parsed = parseActiveContext(formatted);

    expect(parsed.currentTask).toBe("Test task");
    expect(parsed.decisions).toEqual(["Decision 1", "Decision 2"]);
    expect(parsed.constraints).toEqual(["Constraint 1"]);
    expect(parsed.workingFiles).toEqual(["file1.ts"]);
    expect(parsed.openQuestions).toEqual(["Question 1"]);
    expect(parsed.compactionCount).toBe(5);
    expect(parsed.updatedAt).toBe("2026-02-01T12:00:00.000Z");
  });

  it("handles empty content", () => {
    const parsed = parseActiveContext("");
    expect(parsed).toEqual({});
  });

  it("handles content with only header", () => {
    const parsed = parseActiveContext("# Active Context\n");
    expect(parsed).toEqual({});
  });

  it("handles multiline current task", () => {
    const content = `# Active Context

## Current Task
Building the auth system
with JWT tokens

---
Updated: 2026-02-01T12:00:00.000Z
`;
    const parsed = parseActiveContext(content);
    expect(parsed.currentTask).toBe("Building the auth system with JWT tokens");
  });
});

describe("loadActiveContext and writeActiveContext", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "active-context-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("returns null when ACTIVE.md does not exist", async () => {
    const result = await loadActiveContext(tempDir);
    expect(result).toBeNull();
  });

  it("writes and loads active context", async () => {
    const data: ActiveContextData = {
      currentTask: "Integration test",
      decisions: ["Use temp dir"],
      compactionCount: 1,
    };

    await writeActiveContext({ workspaceDir: tempDir, data });
    const loaded = await loadActiveContext(tempDir);

    expect(loaded).not.toBeNull();
    expect(loaded?.currentTask).toBe("Integration test");
    expect(loaded?.decisions).toEqual(["Use temp dir"]);
    expect(loaded?.compactionCount).toBe(1);
    expect(loaded?.updatedAt).toBeDefined();
  });

  it("performs atomic write (no partial files)", async () => {
    const data: ActiveContextData = { currentTask: "Atomic test" };

    await writeActiveContext({ workspaceDir: tempDir, data });

    // Check no temp files remain
    const files = await fs.readdir(tempDir);
    expect(files).toEqual(["ACTIVE.md"]);
    expect(files.some((f) => f.includes(".tmp"))).toBe(false);
  });

  it("overwrites existing ACTIVE.md", async () => {
    const data1: ActiveContextData = {
      currentTask: "First task",
      updatedAt: "2026-02-01T10:00:00.000Z",
    };
    const data2: ActiveContextData = {
      currentTask: "Second task",
      updatedAt: "2026-02-01T11:00:00.000Z",
    };

    await writeActiveContext({ workspaceDir: tempDir, data: data1 });
    await writeActiveContext({ workspaceDir: tempDir, data: data2 });

    const loaded = await loadActiveContext(tempDir);
    expect(loaded?.currentTask).toBe("Second task");
    expect(loaded?.updatedAt).toBe("2026-02-01T11:00:00.000Z");
  });

  it("round-trips all fields correctly", async () => {
    const original: ActiveContextData = {
      currentTask: "Complex task with details",
      decisions: ["Decision A", "Decision B", "Decision C"],
      constraints: ["Must be fast", "Must be secure"],
      workingFiles: ["src/index.ts", "src/lib/utils.ts", "package.json"],
      openQuestions: ["How to handle edge case?", "Which library?"],
      compactionCount: 7,
      updatedAt: "2026-02-01T15:30:00.000Z",
    };

    await writeActiveContext({ workspaceDir: tempDir, data: original });
    const loaded = await loadActiveContext(tempDir);

    expect(loaded).toEqual(original);
  });
});
