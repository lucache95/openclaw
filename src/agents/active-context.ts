import fs from "node:fs/promises";
import path from "node:path";
import { resolveUserPath } from "../utils.js";

export type ActiveContextData = {
  currentTask?: string;
  decisions?: string[];
  constraints?: string[];
  workingFiles?: string[];
  openQuestions?: string[];
  compactionCount?: number;
  updatedAt?: string;
};

const ACTIVE_CONTEXT_SECTIONS = {
  currentTask: "## Current Task",
  decisions: "## Key Decisions",
  constraints: "## Constraints",
  workingFiles: "## Working Files",
  openQuestions: "## Open Questions",
} as const;

export function formatActiveContext(data: ActiveContextData): string {
  const lines: string[] = ["# Active Context", ""];

  if (data.currentTask?.trim()) {
    lines.push(ACTIVE_CONTEXT_SECTIONS.currentTask);
    lines.push(data.currentTask.trim());
    lines.push("");
  }

  if (data.decisions && data.decisions.length > 0) {
    lines.push(ACTIVE_CONTEXT_SECTIONS.decisions);
    for (const decision of data.decisions) {
      lines.push(`- ${decision}`);
    }
    lines.push("");
  }

  if (data.constraints && data.constraints.length > 0) {
    lines.push(ACTIVE_CONTEXT_SECTIONS.constraints);
    for (const constraint of data.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push("");
  }

  if (data.workingFiles && data.workingFiles.length > 0) {
    lines.push(ACTIVE_CONTEXT_SECTIONS.workingFiles);
    for (const file of data.workingFiles) {
      lines.push(`- ${file}`);
    }
    lines.push("");
  }

  if (data.openQuestions && data.openQuestions.length > 0) {
    lines.push(ACTIVE_CONTEXT_SECTIONS.openQuestions);
    for (const question of data.openQuestions) {
      lines.push(`- ${question}`);
    }
    lines.push("");
  }

  // Footer
  lines.push("---");
  lines.push(`Updated: ${data.updatedAt ?? new Date().toISOString()}`);
  if (typeof data.compactionCount === "number") {
    lines.push(`Compaction: ${data.compactionCount}`);
  }
  lines.push("");

  return lines.join("\n");
}

export function parseActiveContext(content: string): ActiveContextData {
  const data: ActiveContextData = {};
  const lines = content.split("\n");

  let currentSection: keyof typeof ACTIVE_CONTEXT_SECTIONS | null = null;
  const sectionContent: Record<string, string[]> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers
    let isHeader = false;
    for (const [key, header] of Object.entries(ACTIVE_CONTEXT_SECTIONS)) {
      if (trimmed === header) {
        currentSection = key as keyof typeof ACTIVE_CONTEXT_SECTIONS;
        sectionContent[key] = [];
        isHeader = true;
        break;
      }
    }
    if (isHeader) {
      continue;
    }

    // Check for footer
    if (trimmed === "---") {
      currentSection = null;
      continue;
    }

    // Parse footer fields
    if (trimmed.startsWith("Updated:")) {
      data.updatedAt = trimmed.replace("Updated:", "").trim();
      continue;
    }
    if (trimmed.startsWith("Compaction:")) {
      const count = parseInt(trimmed.replace("Compaction:", "").trim(), 10);
      if (!isNaN(count)) {
        data.compactionCount = count;
      }
      continue;
    }

    // Collect section content
    if (currentSection && trimmed) {
      if (currentSection === "currentTask") {
        // Current task is freeform text, not a list
        sectionContent[currentSection] = sectionContent[currentSection] ?? [];
        sectionContent[currentSection].push(trimmed);
      } else if (trimmed.startsWith("- ")) {
        // List items
        sectionContent[currentSection] = sectionContent[currentSection] ?? [];
        sectionContent[currentSection].push(trimmed.slice(2));
      }
    }
  }

  // Map collected content to data
  if (sectionContent.currentTask?.length) {
    data.currentTask = sectionContent.currentTask.join(" ");
  }
  if (sectionContent.decisions?.length) {
    data.decisions = sectionContent.decisions;
  }
  if (sectionContent.constraints?.length) {
    data.constraints = sectionContent.constraints;
  }
  if (sectionContent.workingFiles?.length) {
    data.workingFiles = sectionContent.workingFiles;
  }
  if (sectionContent.openQuestions?.length) {
    data.openQuestions = sectionContent.openQuestions;
  }

  return data;
}

export async function loadActiveContext(workspaceDir: string): Promise<ActiveContextData | null> {
  const resolvedDir = resolveUserPath(workspaceDir);
  const activePath = path.join(resolvedDir, "ACTIVE.md");

  try {
    const content = await fs.readFile(activePath, "utf-8");
    return parseActiveContext(content);
  } catch (err) {
    const anyErr = err as { code?: string };
    if (anyErr.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}

export async function writeActiveContext(params: {
  workspaceDir: string;
  data: ActiveContextData;
}): Promise<void> {
  const resolvedDir = resolveUserPath(params.workspaceDir);
  const activePath = path.join(resolvedDir, "ACTIVE.md");

  // Set updatedAt if not provided
  const dataWithTimestamp: ActiveContextData = {
    ...params.data,
    updatedAt: params.data.updatedAt ?? new Date().toISOString(),
  };

  const content = formatActiveContext(dataWithTimestamp);

  // Atomic write: write to temp file, then rename
  const tempPath = `${activePath}.tmp.${process.pid}`;
  try {
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, activePath);
  } catch (err) {
    // Clean up temp file on error
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}
