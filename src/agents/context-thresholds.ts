import { emitAgentEvent } from "../infra/agent-events.js";

export type ContextWarningLevel = "yellow" | "orange" | "red";

export const CONTEXT_WARNING_THRESHOLDS: Record<ContextWarningLevel, number> = {
  yellow: 0.7, // 70% - gentle reminder
  orange: 0.8, // 80% - approaching limit
  red: 0.9, // 90% - imminent compaction
} as const;

export const CONTEXT_WARNING_MESSAGES: Record<ContextWarningLevel, string> = {
  yellow: "Context usage at 70% - consider wrapping up current task",
  orange: "Context usage at 80% - compaction approaching",
  red: "Context usage at 90% - compaction imminent",
} as const;

// Order from lowest to highest for iteration
const THRESHOLD_ORDER: ContextWarningLevel[] = ["yellow", "orange", "red"];

export type ContextThresholdState = {
  emittedWarnings: Set<ContextWarningLevel>;
};

export function createContextThresholdState(): ContextThresholdState {
  return {
    emittedWarnings: new Set(),
  };
}

export type CheckContextThresholdsParams = {
  totalTokens: number;
  contextWindowTokens: number;
  state: ContextThresholdState;
  runId?: string;
  sessionKey?: string;
};

export type ContextWarningEvent = {
  level: ContextWarningLevel;
  usagePercent: number;
  message: string;
  totalTokens: number;
  contextWindowTokens: number;
};

/**
 * Checks token usage against thresholds and emits warnings for newly crossed thresholds.
 * Returns array of newly triggered warnings (empty if none).
 */
export function checkContextThresholds(
  params: CheckContextThresholdsParams,
): ContextWarningEvent[] {
  const { totalTokens, contextWindowTokens, state, runId, sessionKey } = params;

  if (!totalTokens || totalTokens <= 0 || !contextWindowTokens || contextWindowTokens <= 0) {
    return [];
  }

  const usagePercent = totalTokens / contextWindowTokens;
  const newWarnings: ContextWarningEvent[] = [];

  for (const level of THRESHOLD_ORDER) {
    const threshold = CONTEXT_WARNING_THRESHOLDS[level];

    // Skip if already emitted or not yet crossed
    if (state.emittedWarnings.has(level) || usagePercent < threshold) {
      continue;
    }

    // Mark as emitted and create warning event
    state.emittedWarnings.add(level);

    const warning: ContextWarningEvent = {
      level,
      usagePercent,
      message: CONTEXT_WARNING_MESSAGES[level],
      totalTokens,
      contextWindowTokens,
    };

    newWarnings.push(warning);

    // Emit agent event for UI/logging
    emitAgentEvent({
      runId: runId ?? "",
      stream: "context_warning",
      sessionKey,
      data: warning,
    });
  }

  return newWarnings;
}

/**
 * Resets threshold state (call on session reset or after compaction).
 */
export function resetContextThresholdState(state: ContextThresholdState): void {
  state.emittedWarnings.clear();
}

/**
 * Gets the current warning level based on usage (without emitting).
 * Useful for status display.
 */
export function getCurrentWarningLevel(
  totalTokens: number,
  contextWindowTokens: number,
): ContextWarningLevel | null {
  if (!totalTokens || totalTokens <= 0 || !contextWindowTokens || contextWindowTokens <= 0) {
    return null;
  }

  const usagePercent = totalTokens / contextWindowTokens;

  // Check in reverse order (red -> orange -> yellow) to get highest applicable
  for (const level of [...THRESHOLD_ORDER].reverse()) {
    if (usagePercent >= CONTEXT_WARNING_THRESHOLDS[level]) {
      return level;
    }
  }

  return null;
}

/**
 * Formats usage percentage for display.
 */
export function formatUsagePercent(totalTokens: number, contextWindowTokens: number): string {
  if (!contextWindowTokens || contextWindowTokens <= 0) {
    return "N/A";
  }
  const percent = (totalTokens / contextWindowTokens) * 100;
  return `${percent.toFixed(1)}%`;
}
