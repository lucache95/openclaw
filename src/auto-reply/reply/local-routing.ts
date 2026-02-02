/**
 * Local Routing Integration Module
 *
 * Thin adapter layer that integrates TaskRouter into the agent execution pipeline.
 * Routes simple tasks to Ollama when available, with graceful fallback to cloud.
 */

import { TaskRouter, type RouteResult } from "../../agents/task-router.js";

/**
 * Feature flag to enable/disable local routing
 * Can be overridden via config in future
 */
export let LOCAL_ROUTING_ENABLED = true;

/**
 * Debug flag for local routing
 * Can be overridden via config in future
 */
export let LOCAL_ROUTING_DEBUG = false;

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
 * Attempt to route a prompt to local Ollama for processing.
 *
 * If the prompt is classified as simple and Ollama is available and succeeds,
 * returns { handled: true, response, reason }.
 *
 * If the prompt is complex, Ollama is unavailable, or generation fails,
 * returns { handled: false, reason } to signal fall-through to cloud.
 *
 * @param params - Routing parameters
 * @returns LocalRoutingResult indicating whether the task was handled
 */
export async function tryLocalRouting(params: TryLocalRoutingParams): Promise<LocalRoutingResult> {
  // Create router with debug option
  const router = new TaskRouter({
    debug: params.debug ?? LOCAL_ROUTING_DEBUG,
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
