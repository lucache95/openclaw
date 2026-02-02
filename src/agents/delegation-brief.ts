/**
 * Delegation brief module for structured subagent task handoff.
 *
 * Provides type-safe brief construction with task-type templates
 * for common patterns (research, file-ops, analysis, code-review).
 */

export interface DelegationBrief {
  /** What the subagent must accomplish */
  objective: string;
  /** Background context for the task */
  context: {
    /** Why this task exists */
    background?: string;
    /** Files the subagent should know about */
    relevantFiles?: string[];
    /** Decisions that constrain this task */
    priorDecisions?: string[];
  };
  /** Boundaries and limits for execution */
  constraints: {
    /** What to include/exclude */
    scope?: string[];
    /** Max execution time in ms */
    timeLimit?: number;
    /** Max output tokens/chars */
    outputLimit?: number;
    /** Prevent side effects */
    noExternalActions?: boolean;
  };
  /** Expected output structure */
  outputFormat: {
    structure: "freeform" | "structured" | "json";
    /** Required sections for structured output */
    requiredSections?: string[];
    /** JSON schema if structure === 'json' */
    jsonSchema?: object;
  };
  /** Task type used for template defaults */
  taskType?: keyof typeof TaskTypeTemplates;
}

/**
 * Template configuration type (not using `as const` to allow mutable arrays).
 */
interface TaskTypeTemplate {
  outputFormat: {
    structure: "freeform" | "structured" | "json";
    requiredSections?: string[];
  };
  constraints: {
    scope?: string[];
    noExternalActions?: boolean;
  };
}

/**
 * Predefined templates for common task types.
 * Each template provides sensible defaults that can be overridden.
 */
export const TaskTypeTemplates: Record<string, TaskTypeTemplate> = {
  research: {
    outputFormat: {
      structure: "structured",
      requiredSections: ["summary", "findings", "sources"],
    },
    constraints: {
      noExternalActions: true,
    },
  },
  fileOps: {
    outputFormat: {
      structure: "structured",
      requiredSections: ["files_modified", "changes_made"],
    },
    constraints: {
      scope: ["workspace files only"],
    },
  },
  analysis: {
    outputFormat: {
      structure: "structured",
      requiredSections: ["analysis", "conclusions", "recommendations"],
    },
    constraints: {
      noExternalActions: true,
    },
  },
  codeReview: {
    outputFormat: {
      structure: "structured",
      requiredSections: ["issues", "suggestions", "approval_status"],
    },
    constraints: {
      noExternalActions: true,
    },
  },
};

export type TaskType = "research" | "fileOps" | "analysis" | "codeReview";

/**
 * Build a delegation brief with optional task-type template defaults.
 *
 * Explicit parameters take precedence over template defaults.
 * The objective is required and must be non-empty.
 *
 * @throws Error if objective is empty or whitespace-only
 */
export function buildDelegationBrief(params: {
  objective: string;
  taskType?: TaskType;
  context?: DelegationBrief["context"];
  constraints?: Partial<DelegationBrief["constraints"]>;
  outputFormat?: Partial<DelegationBrief["outputFormat"]>;
}): DelegationBrief {
  const objective = params.objective?.trim();
  if (!objective) {
    throw new Error("Delegation brief requires a non-empty objective");
  }

  // Get template defaults if task type specified
  const template = params.taskType ? TaskTypeTemplates[params.taskType] : undefined;

  // Merge constraints: explicit params override template defaults
  const constraints: DelegationBrief["constraints"] = {
    ...(template?.constraints ?? {}),
    ...(params.constraints ?? {}),
  };

  // Merge output format: explicit params override template defaults
  // Start with freeform as base, then apply template, then explicit overrides
  const templateOutputFormat = template?.outputFormat;
  const explicitOutputFormat = params.outputFormat;
  const outputFormat: DelegationBrief["outputFormat"] = {
    structure: explicitOutputFormat?.structure ?? templateOutputFormat?.structure ?? "freeform",
    requiredSections:
      explicitOutputFormat?.requiredSections ?? templateOutputFormat?.requiredSections,
    jsonSchema: explicitOutputFormat?.jsonSchema,
  };

  return {
    objective,
    context: params.context ?? {},
    constraints,
    outputFormat,
    taskType: params.taskType,
  };
}

/**
 * Format a delegation brief as markdown sections for system prompt injection.
 *
 * Renders the brief with clear sections:
 * - ## Objective
 * - ## Context (if background/files/decisions provided)
 * - ## Constraints (if any constraints specified)
 * - ## Output Format
 */
export function formatDelegationBriefForPrompt(brief: DelegationBrief): string {
  const lines: string[] = [];

  // Objective section
  lines.push("## Objective");
  lines.push("");
  lines.push(brief.objective);
  lines.push("");

  // Context section (only if there's content)
  const hasContext =
    brief.context.background ||
    (brief.context.relevantFiles && brief.context.relevantFiles.length > 0) ||
    (brief.context.priorDecisions && brief.context.priorDecisions.length > 0);

  if (hasContext) {
    lines.push("## Context");
    lines.push("");

    if (brief.context.background) {
      lines.push("**Background:**");
      lines.push(brief.context.background);
      lines.push("");
    }

    if (brief.context.relevantFiles && brief.context.relevantFiles.length > 0) {
      lines.push("**Relevant Files:**");
      for (const file of brief.context.relevantFiles) {
        lines.push(`- ${file}`);
      }
      lines.push("");
    }

    if (brief.context.priorDecisions && brief.context.priorDecisions.length > 0) {
      lines.push("**Prior Decisions:**");
      for (const decision of brief.context.priorDecisions) {
        lines.push(`- ${decision}`);
      }
      lines.push("");
    }
  }

  // Constraints section (only if there are constraints)
  const hasConstraints =
    (brief.constraints.scope && brief.constraints.scope.length > 0) ||
    brief.constraints.timeLimit !== undefined ||
    brief.constraints.outputLimit !== undefined ||
    brief.constraints.noExternalActions === true;

  if (hasConstraints) {
    lines.push("## Constraints");
    lines.push("");

    if (brief.constraints.scope && brief.constraints.scope.length > 0) {
      lines.push("**Scope:**");
      for (const item of brief.constraints.scope) {
        lines.push(`- ${item}`);
      }
      lines.push("");
    }

    if (brief.constraints.timeLimit !== undefined) {
      const seconds = Math.round(brief.constraints.timeLimit / 1000);
      lines.push(`**Time Limit:** ${seconds} seconds`);
      lines.push("");
    }

    if (brief.constraints.outputLimit !== undefined) {
      lines.push(`**Output Limit:** ${brief.constraints.outputLimit} characters`);
      lines.push("");
    }

    if (brief.constraints.noExternalActions === true) {
      lines.push(
        "**No External Actions:** Do not perform any side effects (no file writes, no API calls, no messages).",
      );
      lines.push("");
    }
  }

  // Output Format section
  lines.push("## Output Format");
  lines.push("");

  if (brief.outputFormat.structure === "freeform") {
    lines.push("Provide your response in freeform text.");
  } else if (brief.outputFormat.structure === "structured") {
    lines.push("Provide a structured response with the following sections:");
    lines.push("");
    if (brief.outputFormat.requiredSections && brief.outputFormat.requiredSections.length > 0) {
      for (const section of brief.outputFormat.requiredSections) {
        lines.push(`### ${section}`);
        lines.push("[Your content here]");
        lines.push("");
      }
    }
  } else if (brief.outputFormat.structure === "json") {
    lines.push("Provide your response as valid JSON.");
    if (brief.outputFormat.jsonSchema) {
      lines.push("");
      lines.push("**Schema:**");
      lines.push("```json");
      lines.push(JSON.stringify(brief.outputFormat.jsonSchema, null, 2));
      lines.push("```");
    }
    lines.push("");
  }

  return lines.join("\n");
}
