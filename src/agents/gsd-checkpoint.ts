import type { GsdWorkflowState } from "./gsd-state.js";
import { writeActiveContext } from "./active-context.js";
import { saveGsdState, resolveGsdStatePath } from "./gsd-state.js";

/**
 * Write a dual-format checkpoint: JSON state file + ACTIVE.md.
 *
 * The JSON state file preserves full structured data for programmatic recovery.
 * ACTIVE.md preserves a human-readable summary that survives context compaction,
 * including the state file path so an agent can locate and reload the full state.
 */
export async function writeGsdCheckpoint(params: {
  state: GsdWorkflowState;
  workspaceDir: string;
  description: string;
}): Promise<void> {
  // 1. Update checkpoint metadata in state
  const updatedState: GsdWorkflowState = {
    ...params.state,
    updatedAt: Date.now(),
    checkpoint: {
      phase: params.state.currentPhase,
      timestamp: Date.now(),
      description: params.description,
    },
  };

  // 2. Save JSON state file (synchronous, via infra/json-file.ts)
  saveGsdState(updatedState);

  // 3. Write ACTIVE.md with human-readable summary (async)
  await writeActiveContext({
    workspaceDir: params.workspaceDir,
    data: {
      currentTask: `GSD Workflow: ${updatedState.projectName} [${updatedState.currentPhase}]`,
      decisions: [
        `Current phase: ${updatedState.currentPhase}`,
        `Last checkpoint: ${params.description}`,
        `Session: ${updatedState.sessionId}`,
      ],
      constraints: [
        `State file: ${resolveGsdStatePath(updatedState.sessionId)}`,
        `Recovery: load state file to resume workflow`,
      ],
      workingFiles: [`~/.openclaw/gsd-state/${updatedState.sessionId}.json`],
      openQuestions: buildPhaseQuestions(updatedState),
    },
  });
}

/** Build phase-specific context questions for ACTIVE.md open questions section. */
export function buildPhaseQuestions(state: GsdWorkflowState): string[] {
  switch (state.currentPhase) {
    case "questioning":
      return [
        `Questions asked: ${state.questioning?.questions.length ?? 0}`,
        "Waiting for Ethos responses",
      ];
    case "research":
      return [`Findings so far: ${state.research?.findings.length ?? 0}`];
    case "requirements":
      return [state.requirements?.approved ? "Requirements approved" : "Awaiting Ethos approval"];
    case "roadmap":
      return [`Phases planned: ${state.roadmap?.phases.length ?? 0}`];
    case "planning":
      return [`Plans created: ${state.planning?.plans.length ?? 0}`];
    case "execution":
      return [`Completed: ${state.execution?.completedPlans.length ?? 0} plans`];
    case "complete":
      return ["Workflow complete"];
    default:
      return [];
  }
}
