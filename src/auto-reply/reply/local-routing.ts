/**
 * Local Routing Integration Module
 *
 * Thin adapter layer that integrates TaskRouter into the agent execution pipeline.
 * Routes simple tasks to Ollama when available, with graceful fallback to cloud.
 * Injects agent identity (IDENTITY.md, SOUL.md) into all tiers for consistent persona.
 */

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { globalCostTracker } from "../../agents/cost-tracker.js";
import {
  TaskRouter,
  type RouteResult,
  type ThreeTierRouteResult,
  type RoutingTier,
} from "../../agents/task-router.js";

/**
 * Load agent identity from workspace files (IDENTITY.md, SOUL.md)
 * Returns a combined system prompt for consistent persona across all tiers
 */
function loadAgentIdentity(): string | undefined {
  const workspaceDir = join(homedir(), "clawd");
  const parts: string[] = [];

  try {
    const identity = readFileSync(join(workspaceDir, "IDENTITY.md"), "utf8");
    parts.push(identity.trim());
  } catch {
    // IDENTITY.md not found, continue
  }

  try {
    const soul = readFileSync(join(workspaceDir, "SOUL.md"), "utf8");
    parts.push(soul.trim());
  } catch {
    // SOUL.md not found, continue
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join("\n\n---\n\n");
}

/**
 * Feature flag to enable/disable local routing
 * Can be overridden via config in future
 */
export let LOCAL_ROUTING_ENABLED = true;

/**
 * Debug flag for local routing
 * Can be overridden via config in future
 */
export let LOCAL_ROUTING_DEBUG = true;

/**
 * Feature flag to enable three-tier routing (local/cheap/quality)
 * When enabled, tryLocalRouting delegates to tryThreeTierRouting
 */
export let THREE_TIER_ROUTING_ENABLED = true;

/**
 * Set the THREE_TIER_ROUTING_ENABLED flag
 * Exported for testing purposes and gradual rollout
 */
export function setThreeTierRoutingEnabled(enabled: boolean): void {
  THREE_TIER_ROUTING_ENABLED = enabled;
}

/**
 * Result of attempting local routing
 */
export interface LocalRoutingResult {
  /** Whether the task was handled locally */
  handled: boolean;
  /** Generated response (only present if handled locally) */
  response?: string;
  /** Human-readable reason for the routing decision */
  reason?: string;
  /** Which tier actually handled the request (for three-tier routing) */
  tier?: RoutingTier;
}

/**
 * Parameters for tryLocalRouting
 */
export interface TryLocalRoutingParams {
  /** The prompt to route */
  prompt: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Attempt to route a prompt using three-tier routing (local/cheap/quality).
 *
 * Routes to:
 * - local (Ollama): Simple tasks, free
 * - cheap (MiniMax): Medium tasks, low cost
 * - quality (Claude): Complex tasks, full capability
 *
 * @param params - Routing parameters
 * @returns LocalRoutingResult indicating whether the task was handled
 */
export async function tryThreeTierRouting(
  params: TryLocalRoutingParams,
): Promise<LocalRoutingResult> {
  const systemPrompt = loadAgentIdentity();
  const router = new TaskRouter({
    debug: params.debug ?? LOCAL_ROUTING_DEBUG,
    systemPrompt,
  });

  try {
    const result: ThreeTierRouteResult = await router.routeThreeTier(params.prompt);

    // If we got a response from local or cheap tier, track and return
    if (result.response && result.actualTier && result.actualTier !== "quality") {
      // Track cost (estimate tokens from string length for now)
      const promptTokens = Math.ceil(params.prompt.length / 4);
      const completionTokens = Math.ceil(result.response.length / 4);
      globalCostTracker.track({
        tier: result.actualTier,
        model: result.actualTier === "local" ? "qwen2.5:3b" : "minimax-m2",
        promptTokens,
        completionTokens,
        durationMs: result.durationMs ?? 0,
      });

      return {
        handled: true,
        response: result.response,
        reason: result.decision.reason,
        tier: result.actualTier,
      };
    }

    // Route to quality tier (Claude) - not handled locally
    return {
      handled: false,
      reason: result.decision.reason,
      tier: "quality",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      handled: false,
      reason: `Three-tier routing error: ${errorMessage}`,
    };
  }
}

/**
 * Attempt to route a prompt to local Ollama for processing.
 *
 * When THREE_TIER_ROUTING_ENABLED is true, delegates to tryThreeTierRouting.
 * Otherwise uses two-tier routing (local/cloud) for backward compatibility.
 *
 * @param params - Routing parameters
 * @returns LocalRoutingResult indicating whether the task was handled
 */
export async function tryLocalRouting(params: TryLocalRoutingParams): Promise<LocalRoutingResult> {
  // If three-tier routing is enabled, delegate to the new function
  if (THREE_TIER_ROUTING_ENABLED) {
    return tryThreeTierRouting(params);
  }

  // Otherwise, use existing two-tier logic for backward compatibility
  const systemPrompt = loadAgentIdentity();
  const router = new TaskRouter({
    debug: params.debug ?? LOCAL_ROUTING_DEBUG,
    systemPrompt,
  });

  try {
    // Route the prompt (handles classification, availability check, and generation)
    const result: RouteResult = await router.route(params.prompt);

    // If routed to local AND we got a response, it was handled locally
    if (result.decision.destination === "local" && result.response) {
      return {
        handled: true,
        response: result.response,
        reason: result.decision.reason,
      };
    }

    // Otherwise, route to cloud (either classified as cloud-bound or Ollama failed)
    return {
      handled: false,
      reason: result.decision.reason,
    };
  } catch (error) {
    // Unexpected error - fall back to cloud
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      handled: false,
      reason: `Local routing error: ${errorMessage}`,
    };
  }
}

/**
 * Set the LOCAL_ROUTING_ENABLED flag
 * Exported for testing purposes
 */
export function setLocalRoutingEnabled(enabled: boolean): void {
  LOCAL_ROUTING_ENABLED = enabled;
}

/**
 * Set the LOCAL_ROUTING_DEBUG flag
 * Exported for testing purposes
 */
export function setLocalRoutingDebug(debug: boolean): void {
  LOCAL_ROUTING_DEBUG = debug;
}
