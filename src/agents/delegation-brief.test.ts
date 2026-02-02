import { describe, expect, it } from "vitest";
import {
  buildDelegationBrief,
  DelegationBrief,
  formatDelegationBriefForPrompt,
  TaskTypeTemplates,
} from "./delegation-brief.js";

describe("buildDelegationBrief", () => {
  it("throws on empty objective", () => {
    expect(() => buildDelegationBrief({ objective: "" })).toThrow(
      "Delegation brief requires a non-empty objective",
    );
  });

  it("throws on whitespace-only objective", () => {
    expect(() => buildDelegationBrief({ objective: "   " })).toThrow(
      "Delegation brief requires a non-empty objective",
    );
  });

  it("returns valid DelegationBrief structure with minimal params", () => {
    const brief = buildDelegationBrief({ objective: "Test task" });

    expect(brief).toEqual({
      objective: "Test task",
      context: {},
      constraints: {},
      outputFormat: {
        structure: "freeform",
        requiredSections: undefined,
        jsonSchema: undefined,
      },
      taskType: undefined,
    });
  });

  it("trims whitespace from objective", () => {
    const brief = buildDelegationBrief({ objective: "  Test task  " });
    expect(brief.objective).toBe("Test task");
  });

  it("includes full context when provided", () => {
    const brief = buildDelegationBrief({
      objective: "Analyze code",
      context: {
        background: "User requested analysis",
        relevantFiles: ["src/main.ts", "src/utils.ts"],
        priorDecisions: ["Use TypeScript", "Prefer functional style"],
      },
    });

    expect(brief.context).toEqual({
      background: "User requested analysis",
      relevantFiles: ["src/main.ts", "src/utils.ts"],
      priorDecisions: ["Use TypeScript", "Prefer functional style"],
    });
  });

  it("includes explicit constraints", () => {
    const brief = buildDelegationBrief({
      objective: "Review code",
      constraints: {
        scope: ["src/ directory only"],
        timeLimit: 30000,
        outputLimit: 5000,
        noExternalActions: true,
      },
    });

    expect(brief.constraints).toEqual({
      scope: ["src/ directory only"],
      timeLimit: 30000,
      outputLimit: 5000,
      noExternalActions: true,
    });
  });

  it("includes explicit output format", () => {
    const brief = buildDelegationBrief({
      objective: "Generate data",
      outputFormat: {
        structure: "json",
        jsonSchema: { type: "object", properties: { result: { type: "string" } } },
      },
    });

    expect(brief.outputFormat).toEqual({
      structure: "json",
      requiredSections: undefined,
      jsonSchema: { type: "object", properties: { result: { type: "string" } } },
    });
  });
});

describe("TaskTypeTemplates", () => {
  it("research template includes required sections", () => {
    const template = TaskTypeTemplates.research;
    expect(template.outputFormat.structure).toBe("structured");
    expect(template.outputFormat.requiredSections).toEqual(["summary", "findings", "sources"]);
    expect(template.constraints.noExternalActions).toBe(true);
  });

  it("fileOps template includes file constraints", () => {
    const template = TaskTypeTemplates.fileOps;
    expect(template.outputFormat.structure).toBe("structured");
    expect(template.outputFormat.requiredSections).toEqual(["files_modified", "changes_made"]);
    expect(template.constraints.scope).toEqual(["workspace files only"]);
  });

  it("analysis template has expected sections", () => {
    const template = TaskTypeTemplates.analysis;
    expect(template.outputFormat.requiredSections).toEqual([
      "analysis",
      "conclusions",
      "recommendations",
    ]);
    expect(template.constraints.noExternalActions).toBe(true);
  });

  it("codeReview template has expected sections", () => {
    const template = TaskTypeTemplates.codeReview;
    expect(template.outputFormat.requiredSections).toEqual([
      "issues",
      "suggestions",
      "approval_status",
    ]);
    expect(template.constraints.noExternalActions).toBe(true);
  });
});

describe("buildDelegationBrief with taskType templates", () => {
  it("applies research template defaults", () => {
    const brief = buildDelegationBrief({
      objective: "Research topic",
      taskType: "research",
    });

    expect(brief.taskType).toBe("research");
    expect(brief.outputFormat.structure).toBe("structured");
    expect(brief.outputFormat.requiredSections).toEqual(["summary", "findings", "sources"]);
    expect(brief.constraints.noExternalActions).toBe(true);
  });

  it("applies fileOps template defaults", () => {
    const brief = buildDelegationBrief({
      objective: "Modify files",
      taskType: "fileOps",
    });

    expect(brief.outputFormat.requiredSections).toEqual(["files_modified", "changes_made"]);
    expect(brief.constraints.scope).toEqual(["workspace files only"]);
  });

  it("explicit params override template defaults", () => {
    const brief = buildDelegationBrief({
      objective: "Custom research",
      taskType: "research",
      outputFormat: {
        structure: "json",
        jsonSchema: { type: "object" },
      },
      constraints: {
        noExternalActions: false,
        timeLimit: 60000,
      },
    });

    // Explicit overrides
    expect(brief.outputFormat.structure).toBe("json");
    expect(brief.outputFormat.jsonSchema).toEqual({ type: "object" });
    expect(brief.constraints.noExternalActions).toBe(false);
    expect(brief.constraints.timeLimit).toBe(60000);
  });

  it("merges explicit constraints with template constraints", () => {
    const brief = buildDelegationBrief({
      objective: "Review code",
      taskType: "codeReview",
      constraints: {
        timeLimit: 30000,
      },
    });

    // Template constraint preserved
    expect(brief.constraints.noExternalActions).toBe(true);
    // Explicit constraint added
    expect(brief.constraints.timeLimit).toBe(30000);
  });
});

describe("formatDelegationBriefForPrompt", () => {
  it("includes all sections for complete brief", () => {
    const brief: DelegationBrief = {
      objective: "Analyze the codebase",
      context: {
        background: "User wants to understand the architecture",
        relevantFiles: ["src/main.ts", "src/utils.ts"],
        priorDecisions: ["Use functional approach"],
      },
      constraints: {
        scope: ["src/ only"],
        timeLimit: 30000,
        outputLimit: 5000,
        noExternalActions: true,
      },
      outputFormat: {
        structure: "structured",
        requiredSections: ["analysis", "conclusions"],
      },
    };

    const output = formatDelegationBriefForPrompt(brief);

    expect(output).toContain("## Objective");
    expect(output).toContain("Analyze the codebase");

    expect(output).toContain("## Context");
    expect(output).toContain("**Background:**");
    expect(output).toContain("User wants to understand the architecture");
    expect(output).toContain("**Relevant Files:**");
    expect(output).toContain("- src/main.ts");
    expect(output).toContain("**Prior Decisions:**");
    expect(output).toContain("- Use functional approach");

    expect(output).toContain("## Constraints");
    expect(output).toContain("**Scope:**");
    expect(output).toContain("- src/ only");
    expect(output).toContain("**Time Limit:** 30 seconds");
    expect(output).toContain("**Output Limit:** 5000 characters");
    expect(output).toContain("**No External Actions:**");

    expect(output).toContain("## Output Format");
    expect(output).toContain("### analysis");
    expect(output).toContain("### conclusions");
  });

  it("omits context section when empty", () => {
    const brief: DelegationBrief = {
      objective: "Simple task",
      context: {},
      constraints: {},
      outputFormat: { structure: "freeform" },
    };

    const output = formatDelegationBriefForPrompt(brief);

    expect(output).toContain("## Objective");
    expect(output).not.toContain("## Context");
    expect(output).not.toContain("## Constraints");
    expect(output).toContain("## Output Format");
    expect(output).toContain("freeform text");
  });

  it("renders json output format with schema", () => {
    const brief: DelegationBrief = {
      objective: "Generate JSON",
      context: {},
      constraints: {},
      outputFormat: {
        structure: "json",
        jsonSchema: { type: "object", properties: { name: { type: "string" } } },
      },
    };

    const output = formatDelegationBriefForPrompt(brief);

    expect(output).toContain("## Output Format");
    expect(output).toContain("valid JSON");
    expect(output).toContain("**Schema:**");
    expect(output).toContain("```json");
    expect(output).toContain('"type": "object"');
  });

  it("renders structured output with required sections", () => {
    const brief: DelegationBrief = {
      objective: "Research",
      context: {},
      constraints: {},
      outputFormat: {
        structure: "structured",
        requiredSections: ["summary", "findings", "sources"],
      },
    };

    const output = formatDelegationBriefForPrompt(brief);

    expect(output).toContain("structured response");
    expect(output).toContain("### summary");
    expect(output).toContain("### findings");
    expect(output).toContain("### sources");
    expect(output).toContain("[Your content here]");
  });

  it("renders context with files list", () => {
    const brief: DelegationBrief = {
      objective: "Review files",
      context: {
        relevantFiles: ["file1.ts", "file2.ts", "file3.ts"],
      },
      constraints: {},
      outputFormat: { structure: "freeform" },
    };

    const output = formatDelegationBriefForPrompt(brief);

    expect(output).toContain("## Context");
    expect(output).toContain("**Relevant Files:**");
    expect(output).toContain("- file1.ts");
    expect(output).toContain("- file2.ts");
    expect(output).toContain("- file3.ts");
  });

  it("renders constraints appropriately", () => {
    const brief: DelegationBrief = {
      objective: "Constrained task",
      context: {},
      constraints: {
        scope: ["module A", "module B"],
        timeLimit: 120000,
        outputLimit: 10000,
      },
      outputFormat: { structure: "freeform" },
    };

    const output = formatDelegationBriefForPrompt(brief);

    expect(output).toContain("## Constraints");
    expect(output).toContain("- module A");
    expect(output).toContain("- module B");
    expect(output).toContain("**Time Limit:** 120 seconds");
    expect(output).toContain("**Output Limit:** 10000 characters");
    // No external actions should NOT appear since it wasn't set
    expect(output).not.toContain("**No External Actions:**");
  });
});

describe("integration: build brief with taskType and override", () => {
  it("creates complete brief with merged values", () => {
    const brief = buildDelegationBrief({
      objective: "Comprehensive code review",
      taskType: "codeReview",
      context: {
        background: "PR needs review before merge",
        relevantFiles: ["src/feature.ts"],
        priorDecisions: ["Follow coding standards"],
      },
      constraints: {
        timeLimit: 60000,
      },
    });

    // Verify taskType is set
    expect(brief.taskType).toBe("codeReview");

    // Verify template values are present
    expect(brief.outputFormat.structure).toBe("structured");
    expect(brief.outputFormat.requiredSections).toEqual([
      "issues",
      "suggestions",
      "approval_status",
    ]);
    expect(brief.constraints.noExternalActions).toBe(true);

    // Verify explicit overrides are present
    expect(brief.constraints.timeLimit).toBe(60000);
    expect(brief.context.background).toBe("PR needs review before merge");
    expect(brief.context.relevantFiles).toEqual(["src/feature.ts"]);
  });

  it("formats merged brief correctly", () => {
    const brief = buildDelegationBrief({
      objective: "Research topic X",
      taskType: "research",
      context: {
        background: "Need deep dive into topic X",
      },
    });

    const output = formatDelegationBriefForPrompt(brief);

    // Check objective
    expect(output).toContain("## Objective");
    expect(output).toContain("Research topic X");

    // Check context from explicit params
    expect(output).toContain("## Context");
    expect(output).toContain("Need deep dive into topic X");

    // Check constraints from template
    expect(output).toContain("## Constraints");
    expect(output).toContain("No External Actions");

    // Check output format from template
    expect(output).toContain("## Output Format");
    expect(output).toContain("### summary");
    expect(output).toContain("### findings");
    expect(output).toContain("### sources");
  });
});
