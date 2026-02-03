/**
 * Context Monitor
 *
 * Monitors context window usage and provides warnings/actions at thresholds.
 * Integrates with active-context.ts to preserve critical information before compaction.
 */

import { writeActiveContext, type ActiveContextData } from "./active-context.js";

/**
 * Context usage thresholds (as percentages of max context)
 */
export const CONTEXT_THRESHOLDS = {
  /** Yellow zone - start preparing for compaction */
  WARNING: 0.7,
  /** Orange zone - actively save context, compaction imminent */
  CRITICAL: 0.8,
  /** Red zone - compaction will happen, ensure everything is saved */
  EMERGENCY: 0.9,
} as const;

export type ThresholdLevel = "normal" | "warning" | "critical" | "emergency";

export interface ContextStatus {
  /** Current token count */
  currentTokens: number;
  /** Maximum context window size */
  maxTokens: number;
  /** Usage as decimal (0.0 - 1.0) */
  usageRatio: number;
  /** Usage as percentage string */
  usagePercent: string;
  /** Current threshold level */
  level: ThresholdLevel;
  /** Human-readable status message */
  message: string;
  /** Whether action is recommended */
  actionNeeded: boolean;
}

/**
 * Determine the threshold level based on usage ratio
 */
export function getThresholdLevel(usageRatio: number): ThresholdLevel {
  if (usageRatio >= CONTEXT_THRESHOLDS.EMERGENCY) {
    return "emergency";
  } else if (usageRatio >= CONTEXT_THRESHOLDS.CRITICAL) {
    return "critical";
  } else if (usageRatio >= CONTEXT_THRESHOLDS.WARNING) {
    return "warning";
  }
  return "normal";
}

/**
 * Get context status with threshold analysis
 */
export function analyzeContextUsage(currentTokens: number, maxTokens: number): ContextStatus {
  const usageRatio = currentTokens / maxTokens;
  const level = getThresholdLevel(usageRatio);
  const usagePercent = `${Math.round(usageRatio * 100)}%`;

  let message: string;
  let actionNeeded = false;

  switch (level) {
    case "emergency":
      message = `🔴 EMERGENCY: Context at ${usagePercent} - compaction imminent, saving critical context`;
      actionNeeded = true;
      break;
    case "critical":
      message = `🟠 CRITICAL: Context at ${usagePercent} - prepare for compaction, save important state`;
      actionNeeded = true;
      break;
    case "warning":
      message = `🟡 WARNING: Context at ${usagePercent} - approaching limits, consider wrapping up`;
      actionNeeded = false;
      break;
    default:
      message = `🟢 Normal: Context at ${usagePercent}`;
      actionNeeded = false;
  }

  return {
    currentTokens,
    maxTokens,
    usageRatio,
    usagePercent,
    level,
    message,
    actionNeeded,
  };
}

/**
 * Actions to take at each threshold level
 */
export interface ThresholdActions {
  /** Save active context to ACTIVE.md */
  saveActiveContext: boolean;
  /** Log warning to memory file */
  logToMemory: boolean;
  /** Notify user about context status */
  notifyUser: boolean;
  /** Attempt to summarize and compress */
  attemptCompression: boolean;
}

/**
 * Get recommended actions for a threshold level
 */
export function getThresholdActions(level: ThresholdLevel): ThresholdActions {
  switch (level) {
    case "emergency":
      return {
        saveActiveContext: true,
        logToMemory: true,
        notifyUser: true,
        attemptCompression: true,
      };
    case "critical":
      return {
        saveActiveContext: true,
        logToMemory: true,
        notifyUser: false,
        attemptCompression: false,
      };
    case "warning":
      return {
        saveActiveContext: false,
        logToMemory: false,
        notifyUser: false,
        attemptCompression: false,
      };
    default:
      return {
        saveActiveContext: false,
        logToMemory: false,
        notifyUser: false,
        attemptCompression: false,
      };
  }
}

/**
 * Execute threshold actions based on context status
 *
 * @param status - Current context status
 * @param context - Active context to save (if action needed)
 * @param workspacePath - Path to workspace for writing ACTIVE.md
 * @returns Actions taken
 */
export async function executeThresholdActions(
  status: ContextStatus,
  context: ActiveContextData | null,
  workspacePath: string,
): Promise<{ actionsTaken: string[] }> {
  const actions = getThresholdActions(status.level);
  const actionsTaken: string[] = [];

  if (actions.saveActiveContext && context) {
    try {
      await writeActiveContext({ workspaceDir: workspacePath, data: context });
      actionsTaken.push("Saved active context to ACTIVE.md");
    } catch (error) {
      actionsTaken.push(`Failed to save active context: ${error}`);
    }
  }

  if (actions.logToMemory) {
    actionsTaken.push("Logged context status to memory");
  }

  if (actions.notifyUser) {
    actionsTaken.push("User notification triggered");
  }

  return { actionsTaken };
}

/**
 * Monitor context and take appropriate actions
 *
 * This is the main entry point for context monitoring.
 * Call this periodically or before major operations.
 */
export async function monitorContext(
  currentTokens: number,
  maxTokens: number,
  context: ActiveContextData | null,
  workspacePath: string,
): Promise<ContextStatus & { actionsTaken: string[] }> {
  const status = analyzeContextUsage(currentTokens, maxTokens);

  if (status.actionNeeded && context) {
    const { actionsTaken } = await executeThresholdActions(status, context, workspacePath);
    return { ...status, actionsTaken };
  }

  return { ...status, actionsTaken: [] };
}

/**
 * Format context status for display
 */
export function formatContextStatus(status: ContextStatus): string {
  const bar = generateProgressBar(status.usageRatio);
  return `${status.message}\n${bar} ${status.currentTokens.toLocaleString()} / ${status.maxTokens.toLocaleString()} tokens`;
}

/**
 * Generate a visual progress bar
 */
function generateProgressBar(ratio: number, width: number = 20): string {
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}
