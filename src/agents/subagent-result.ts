/**
 * Subagent result module for structured output parsing and formatting.
 *
 * Enables reliable parsing and aggregation of subagent results by main agent.
 * Subagents can use markers to structure their output, or this module will
 * infer structure from freeform text.
 */

export type SubagentResultStatus = "complete" | "partial" | "error" | "timeout";

export interface SubagentResult {
  status: SubagentResultStatus;

  /** One-line summary of what was accomplished */
  summary: string;

  /** Main output/findings (for research, analysis) */
  findings?: string;

  /** Files touched (for file-ops) */
  filesModified?: string[];

  /** Structured sections (keyed by section name from delegation brief) */
  sections?: Record<string, string>;

  /** Error handling */
  error?: {
    message: string;
    recoverable: boolean;
  };

  /** Metadata (auto-populated from registry) */
  metadata?: {
    taskType?: string;
    durationMs?: number;
    tokenCount?: number;
    estimatedCost?: number;
    sessionKey?: string;
    runId?: string;
  };
}

/**
 * Result markers for subagent output.
 * Subagents should wrap their structured output with these markers.
 */
export const RESULT_MARKERS = {
  start: "<!-- SUBAGENT_RESULT_START -->",
  end: "<!-- SUBAGENT_RESULT_END -->",
  sectionStart: (name: string) => `<!-- SECTION:${name} -->`,
  sectionEnd: (name: string) => `<!-- /SECTION:${name} -->`,
} as const;

/**
 * Parse structured result from subagent output.
 *
 * Extracts content between RESULT_MARKERS if present.
 * Parses structured sections from section markers.
 * Returns null if no markers found (use inferResultFromFreeform instead).
 *
 * @param rawOutput - Raw subagent output text
 * @returns Parsed SubagentResult or null if no markers found
 */
export function parseSubagentResult(rawOutput: string): SubagentResult | null {
  if (!rawOutput) {
    return null;
  }

  // Check for result markers
  const startIdx = rawOutput.indexOf(RESULT_MARKERS.start);
  const endIdx = rawOutput.indexOf(RESULT_MARKERS.end);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  // Extract content between markers
  const content = rawOutput.slice(startIdx + RESULT_MARKERS.start.length, endIdx).trim();

  if (!content) {
    return null;
  }

  // Parse sections from content
  const sections: Record<string, string> = {};
  const sectionRegex = /<!-- SECTION:(\w+) -->([\s\S]*?)<!-- \/SECTION:\1 -->/g;
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(content)) !== null) {
    const sectionName = match[1];
    const sectionContent = match[2].trim();
    sections[sectionName] = sectionContent;
  }

  // Extract summary - first non-empty line or first paragraph
  const lines = content.split("\n").filter((line) => !line.startsWith("<!--"));
  const summaryLine = lines.find((line) => line.trim().length > 0)?.trim() ?? "";

  // Extract findings - look for common section names or use remaining content
  const findings =
    sections.findings ?? sections.summary ?? sections.analysis ?? extractFindings(content);

  // Extract files modified from sections or detect file paths
  const filesModified = extractFilesModified(sections, content);

  // Detect status from content
  const status = detectStatus(content, sections);

  // Detect error if present
  const error = detectError(content, sections);

  return {
    status,
    summary: summaryLine || "Task completed",
    findings: findings || undefined,
    filesModified: filesModified.length > 0 ? filesModified : undefined,
    sections: Object.keys(sections).length > 0 ? sections : undefined,
    error,
  };
}

/**
 * Infer result structure from freeform text when no markers are present.
 *
 * Always returns a valid SubagentResult (never null).
 * Use this as a fallback when parseSubagentResult returns null.
 *
 * @param rawOutput - Raw subagent output text
 * @returns Inferred SubagentResult
 */
export function inferResultFromFreeform(rawOutput: string): SubagentResult {
  if (!rawOutput || !rawOutput.trim()) {
    return {
      status: "complete",
      summary: "Task completed (no output)",
    };
  }

  const trimmed = rawOutput.trim();

  // Extract summary from first paragraph
  const paragraphs = trimmed.split(/\n\n+/);
  const firstParagraph = paragraphs[0]?.trim() ?? "";
  const summary = firstParagraph.split("\n")[0]?.trim().slice(0, 200) ?? "Task completed";

  // Detect status from common patterns
  const status = detectStatusFromFreeform(trimmed);

  // Extract findings (everything after first line/paragraph)
  const findings = paragraphs.length > 1 ? paragraphs.slice(1).join("\n\n").trim() : undefined;

  // Detect file paths mentioned
  const filesModified = extractFilePathsFromText(trimmed);

  // Detect error patterns
  const error = detectErrorFromFreeform(trimmed);

  return {
    status,
    summary,
    findings: findings || undefined,
    filesModified: filesModified.length > 0 ? filesModified : undefined,
    error,
  };
}

/**
 * Format a SubagentResult for announce to main agent.
 *
 * Creates human-readable summary including status, summary, and key findings.
 * Omits verbose metadata for cleaner output.
 *
 * @param result - SubagentResult to format
 * @returns Human-readable summary string
 */
export function formatResultForAnnounce(result: SubagentResult): string {
  const lines: string[] = [];

  // Status indicator
  const statusText =
    result.status === "complete"
      ? "[Complete]"
      : result.status === "partial"
        ? "[Partial]"
        : result.status === "error"
          ? "[Error]"
          : "[Timeout]";

  lines.push(`${statusText} ${result.summary}`);

  // Include findings if present
  if (result.findings) {
    lines.push("");
    lines.push(result.findings);
  }

  // Include files modified if present
  if (result.filesModified && result.filesModified.length > 0) {
    lines.push("");
    lines.push("Files modified:");
    for (const file of result.filesModified) {
      lines.push(`  - ${file}`);
    }
  }

  // Include error if present
  if (result.error) {
    lines.push("");
    lines.push(`Error: ${result.error.message}${result.error.recoverable ? " (recoverable)" : ""}`);
  }

  // Include key sections (not all, just important ones)
  if (result.sections) {
    const importantSections = ["conclusions", "recommendations", "approval_status", "issues"];
    for (const sectionName of importantSections) {
      if (result.sections[sectionName]) {
        lines.push("");
        lines.push(`### ${sectionName}`);
        lines.push(result.sections[sectionName]);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Generate instructions for subagent system prompt.
 *
 * Explains the expected output format with markers.
 * Include these in the subagent's system prompt when structured output is needed.
 *
 * @param requiredSections - Section names that must be present in output
 * @returns Format instructions string for system prompt
 */
export function getResultFormatInstructions(requiredSections?: string[]): string {
  const lines: string[] = [
    "## Structured Output Format",
    "",
    "Wrap your final result in markers for reliable parsing:",
    "",
    "```",
    RESULT_MARKERS.start,
    "[Your summary line here]",
    "",
  ];

  if (requiredSections && requiredSections.length > 0) {
    lines.push("Include these required sections:");
    lines.push("");
    for (const section of requiredSections) {
      lines.push(RESULT_MARKERS.sectionStart(section));
      lines.push(`[${section} content here]`);
      lines.push(RESULT_MARKERS.sectionEnd(section));
      lines.push("");
    }
  } else {
    lines.push("[Your detailed findings here]");
    lines.push("");
  }

  lines.push(RESULT_MARKERS.end);
  lines.push("```");
  lines.push("");
  lines.push("The markers ensure your output can be programmatically parsed.");

  return lines.join("\n");
}

// --- Helper functions ---

function extractFindings(content: string): string | undefined {
  // Remove section markers and get remaining content
  const withoutMarkers = content.replace(/<!-- [^>]+ -->/g, "").trim();
  const lines = withoutMarkers.split("\n").filter((l) => l.trim());

  // Skip first line (summary) and return rest as findings
  if (lines.length > 1) {
    return lines.slice(1).join("\n").trim();
  }
  return undefined;
}

function extractFilesModified(sections: Record<string, string>, content: string): string[] {
  const files: string[] = [];

  // Check for files_modified section
  if (sections.files_modified) {
    const fileLines = sections.files_modified.split("\n");
    for (const line of fileLines) {
      const trimmed = line.trim();
      // Match common file list patterns: "- file.ts" or "file.ts"
      const match = trimmed.match(/^[-*]?\s*(.+\.\w+)$/);
      if (match) {
        files.push(match[1].trim());
      }
    }
  }

  // Also check for changes_made section
  if (sections.changes_made) {
    const paths = extractFilePathsFromText(sections.changes_made);
    for (const p of paths) {
      if (!files.includes(p)) {
        files.push(p);
      }
    }
  }

  // If no section found, try to detect from content
  if (files.length === 0) {
    const detected = extractFilePathsFromText(content);
    return detected;
  }

  return files;
}

function extractFilePathsFromText(text: string): string[] {
  const files: string[] = [];

  // Match common file path patterns (relative and absolute)
  const pathRegex = /(?:^|\s)((?:\.{0,2}\/)?[\w.-]+(?:\/[\w.-]+)*\.\w+)(?:\s|$|[,:])/gm;
  let match: RegExpExecArray | null;

  while ((match = pathRegex.exec(text)) !== null) {
    const path = match[1].trim();
    // Filter out common false positives
    if (
      !path.startsWith("http") &&
      !path.includes("://") &&
      path.length > 3 &&
      !files.includes(path)
    ) {
      files.push(path);
    }
  }

  return files;
}

function detectStatus(content: string, sections: Record<string, string>): SubagentResultStatus {
  const lowerContent = content.toLowerCase();

  // Check for explicit error indicators
  if (
    lowerContent.includes("error:") ||
    lowerContent.includes("failed:") ||
    sections.error ||
    lowerContent.includes("[error]")
  ) {
    return "error";
  }

  // Check for timeout indicators
  if (
    lowerContent.includes("timeout") ||
    lowerContent.includes("timed out") ||
    lowerContent.includes("[timeout]")
  ) {
    return "timeout";
  }

  // Check for partial completion indicators
  if (
    lowerContent.includes("partial") ||
    lowerContent.includes("incomplete") ||
    lowerContent.includes("[partial]")
  ) {
    return "partial";
  }

  return "complete";
}

function detectStatusFromFreeform(text: string): SubagentResultStatus {
  const lower = text.toLowerCase();

  // Error patterns
  if (
    lower.includes("error:") ||
    lower.includes("failed to") ||
    lower.includes("could not") ||
    lower.includes("exception:") ||
    lower.includes("traceback")
  ) {
    return "error";
  }

  // Timeout patterns
  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("exceeded time limit")
  ) {
    return "timeout";
  }

  // Partial patterns
  if (lower.includes("partially") || lower.includes("incomplete") || lower.includes("could only")) {
    return "partial";
  }

  return "complete";
}

function detectError(
  content: string,
  sections: Record<string, string>,
): SubagentResult["error"] | undefined {
  // Check for error section
  if (sections.error) {
    return {
      message: sections.error.trim(),
      recoverable: sections.error.toLowerCase().includes("recoverable"),
    };
  }

  // Check for error patterns in content
  const errorMatch = content.match(/error:\s*(.+?)(?:\n|$)/i);
  if (errorMatch) {
    const message = errorMatch[1].trim();
    return {
      message,
      recoverable:
        message.toLowerCase().includes("retry") ||
        message.toLowerCase().includes("try again") ||
        message.toLowerCase().includes("recoverable"),
    };
  }

  return undefined;
}

function detectErrorFromFreeform(text: string): SubagentResult["error"] | undefined {
  const lower = text.toLowerCase();

  // Common error patterns
  const patterns = [
    /error:\s*(.+?)(?:\n|$)/i,
    /failed:\s*(.+?)(?:\n|$)/i,
    /exception:\s*(.+?)(?:\n|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const message = match[1].trim();
      return {
        message,
        recoverable:
          lower.includes("retry") || lower.includes("try again") || lower.includes("recoverable"),
      };
    }
  }

  return undefined;
}
