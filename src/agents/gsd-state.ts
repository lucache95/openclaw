import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "../config/paths.js";
import { loadJsonFile, saveJsonFile } from "../infra/json-file.js";

export type GsdPhase =
  | "questioning"
  | "research"
  | "requirements"
  | "roadmap"
  | "planning"
  | "execution"
  | "complete";

export type GsdQuestionEntry = {
  question: string;
  answer: string;
  timestamp: number;
};

export type GsdWorkflowState = {
  version: 1;
  sessionId: string;
  projectName: string;
  createdAt: number;
  updatedAt: number;
  currentPhase: GsdPhase;

  questioning?: {
    questions: GsdQuestionEntry[];
    complete: boolean;
  };
  research?: {
    findings: string[];
    complete: boolean;
  };
  requirements?: {
    items: string[];
    approved: boolean;
    complete: boolean;
  };
  roadmap?: {
    phases: Array<{ name: string; description: string }>;
    complete: boolean;
  };
  planning?: {
    plans: string[];
    complete: boolean;
  };
  execution?: {
    currentPlan: number;
    completedPlans: number[];
    complete: boolean;
  };

  checkpoint: {
    phase: GsdPhase;
    timestamp: number;
    description: string;
  };
};

/** Resolve the file path for a GSD workflow state by session ID. */
export function resolveGsdStatePath(sessionId: string): string {
  return path.join(STATE_DIR, "gsd-state", `${sessionId}.json`);
}

/** Create a fresh initial workflow state for a new GSD session. */
export function createInitialState(sessionId: string, projectName: string): GsdWorkflowState {
  const now = Date.now();
  return {
    version: 1,
    sessionId,
    projectName,
    createdAt: now,
    updatedAt: now,
    currentPhase: "questioning",
    checkpoint: {
      phase: "questioning",
      timestamp: now,
      description: "",
    },
  };
}

/** Save a GSD workflow state to disk, updating the `updatedAt` timestamp. */
export function saveGsdState(state: GsdWorkflowState): void {
  state.updatedAt = Date.now();
  const pathname = resolveGsdStatePath(state.sessionId);
  saveJsonFile(pathname, state);
}

/** Load a GSD workflow state from disk. Returns null if not found or invalid. */
export function loadGsdState(sessionId: string): GsdWorkflowState | null {
  const pathname = resolveGsdStatePath(sessionId);
  const raw = loadJsonFile(pathname);
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Partial<GsdWorkflowState>;
  if (record.version !== 1) {
    return null;
  }
  return raw as GsdWorkflowState;
}

/** List all persisted GSD workflow states. Returns empty array if directory is missing. */
export function listGsdStates(): Array<{ sessionId: string; state: GsdWorkflowState }> {
  const dir = path.join(STATE_DIR, "gsd-state");
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const results: Array<{ sessionId: string; state: GsdWorkflowState }> = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) {
      continue;
    }
    const sessionId = entry.slice(0, -5);
    const state = loadGsdState(sessionId);
    if (state) {
      results.push({ sessionId, state });
    }
  }
  return results;
}
