/**
 * Compaction Hooks
 *
 * Pre/post compaction hooks for preserving context across compaction events.
 * Integrates with active-context.ts to save critical state to ACTIVE.md.
 */

import { writeActiveContext, type ActiveContextData } from "./active-context.js";
import { analyzeContextUsage, type ContextStatus } from "./context-monitor.js";

export interface CompactionHookParams {
  /** Current goal or task being worked on */
  currentTask?: string;
  /** Key decisions made this session */
  decisions?: string[];
  /** Constraints or requirements */
  constraints?: string[];
  /** Files being worked on */
  workingFiles?: string[];
  /** Open questions or pending items */
  openQuestions?: string[];
  /** Session key for logging */
  sessionKey?: string;
  /** Workspace path for ACTIVE.md */
  workspacePath: string;
  /** Current token count */
  currentTokens?: number;
  /** Max token count */
  maxTokens?: number;
  /** Current compaction count */
  compactionCount?: number;
}

export interface CompactionHookResult {
  /** Whether ACTIVE.md was written */
  saved: boolean;
  /** Any errors encountered */
  error?: string;
  /** Context status at time of compaction */
  contextStatus?: ContextStatus;
}

/**
 * Pre-compaction hook - saves critical context to ACTIVE.md
 *
 * Call this before compaction to preserve important state.
 */
export async function preCompactionHook(
  params: CompactionHookParams,
): Promise<CompactionHookResult> {
  const {
    currentTask,
    decisions = [],
    constraints = [],
    workingFiles = [],
    openQuestions = [],
    workspacePath,
    currentTokens,
    maxTokens,
    compactionCount,
  } = params;

  // Skip if no meaningful context to save
  if (!currentTask && decisions.length === 0 && workingFiles.length === 0) {
    return { saved: false };
  }

  // Build active context
  const context: ActiveContextData = {
    currentTask,
    decisions,
    constraints,
    workingFiles,
    openQuestions,
    compactionCount,
    updatedAt: new Date().toISOString(),
  };

  try {
    await writeActiveContext({ workspaceDir: workspacePath, data: context });

    // Get context status if we have token info
    let contextStatus: ContextStatus | undefined;
    if (currentTokens && maxTokens) {
      contextStatus = analyzeContextUsage(currentTokens, maxTokens);
    }

    return {
      saved: true,
      contextStatus,
    };
  } catch (error) {
    return {
      saved: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Post-compaction hook - logs compaction event
 *
 * Call this after compaction completes.
 */
export async function postCompactionHook(params: {
  sessionKey?: string;
  compactionCount: number;
  tokensAfter?: number;
  workspacePath: string;
}): Promise<void> {
  // For now, just log. Could extend to update ACTIVE.md with post-compaction state.
  const { compactionCount, tokensAfter } = params;

  // Future: could append to memory file or update ACTIVE.md
  console.log(
    `[compaction-hooks] Compaction #${compactionCount} complete` +
      (tokensAfter ? `, tokens after: ${tokensAfter}` : ""),
  );
}

/**
 * Extract context from conversation history for saving
 *
 * This is a helper to pull relevant context from the current conversation
 * before compaction wipes it.
 */
export function extractContextFromHistory(history: Array<{ role: string; content: string }>): {
  decisions: string[];
  workingFiles: string[];
} {
  const decisions: string[] = [];
  const workingFiles: string[] = [];

  // Look for decision patterns in assistant responses
  const decisionPatterns = [
    /(?:decided|decision|chose|will|going to)[:.]?\s*(.+?)(?:\.|$)/gi,
    /\*\*(?:Decision|Decided|Choice)\*\*:?\s*(.+?)(?:\n|$)/gi,
  ];

  // Look for file paths
  const filePatterns = [
    /(?:reading|writing|editing|created|updated|modified)\s+[`"]?([^\s`"]+\.[a-z]+)[`"]?/gi,
    /(?:file|path):\s*[`"]?([^\s`"]+\.[a-z]+)[`"]?/gi,
  ];

  for (const msg of history) {
    if (msg.role === "assistant") {
      for (const pattern of decisionPatterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(msg.content)) !== null) {
          const extracted = match[1]?.trim();
          if (extracted && extracted.length > 10 && !decisions.includes(extracted)) {
            decisions.push(extracted.slice(0, 200)); // Cap length
          }
        }
      }

      for (const pattern of filePatterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;
        while ((match = regex.exec(msg.content)) !== null) {
          const extracted = match[1]?.trim();
          if (extracted && !workingFiles.includes(extracted)) {
            workingFiles.push(extracted);
          }
        }
      }
    }
  }

  return {
    decisions: decisions.slice(0, 10), // Max 10 decisions
    workingFiles: workingFiles.slice(0, 20), // Max 20 files
  };
}
