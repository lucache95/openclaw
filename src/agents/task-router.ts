/**
 * Task Router
 *
 * Routes tasks to either local Ollama (for simple tasks) or cloud Claude
 * (for complex tasks) based on prompt characteristics.
 */

import { generateWithMinimax, isMinimaxAvailable } from "./minimax-client.js";
import {
  generateWithOllama,
  isOllamaAvailable,
  type OllamaGenerateResult,
} from "./ollama-client.js";

export type RoutingDestination = "local" | "cloud";

export type RoutingTier = "local" | "cheap" | "quality";

export interface RoutingDecision {
  /** Where the task should be routed */
  destination: RoutingDestination;
  /** Human-readable reason for the routing decision */
  reason: string;
  /** Length of the prompt in characters */
  promptLength: number;
  /** Confidence level of the classification */
  confidence: "high" | "medium" | "low";
}

export interface ThreeTierDecision {
  /** Which tier the task should be routed to */
  tier: RoutingTier;
  /** Human-readable reason for the routing decision */
  reason: string;
  /** Length of the prompt in characters */
  promptLength: number;
  /** Confidence level of the classification */
  confidence: "high" | "medium" | "low";
}

export interface TaskRouterOptions {
  /** Ollama API URL (default: http://localhost:11434) */
  ollamaUrl?: string;
  /** Maximum prompt length for local routing (default: 500) */
  maxLocalPromptLength?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export interface RouteResult {
  /** The routing decision made */
  decision: RoutingDecision;
  /** Generated response (only present if routed to local and succeeded) */
  response?: string;
  /** Duration in milliseconds (only present if response generated) */
  durationMs?: number;
}

export interface ThreeTierRouteResult {
  /** The routing decision made */
  decision: ThreeTierDecision;
  /** Generated response (only present if handled locally or by cheap tier) */
  response?: string;
  /** Duration in milliseconds (only present if response generated) */
  durationMs?: number;
  /** May differ from decision.tier if fallback occurred */
  actualTier?: RoutingTier;
}

/**
 * Keywords that indicate simple tasks suitable for local processing
 */
export const SIMPLE_KEYWORDS = new Set([
  "summarize",
  "classify",
  "format",
  "extract",
  "list",
  "rewrite",
  "translate",
  "yes or no",
  "true or false",
  "count",
  "convert",
  "simplify",
  "shorten",
  "expand",
  "paraphrase",
]);

/**
 * Patterns that indicate complex tasks requiring cloud processing
 */
export const COMPLEX_INDICATORS = [
  "step by step",
  "first...then",
  "first,",
  "then,",
  "analyze and",
  "compare and",
  "write code",
  "implement",
  "debug",
  "refactor",
  "explain why",
  "explain how",
  "reason about",
  "think through",
  "pros and cons",
  "advantages and disadvantages",
  "evaluate",
  "critique",
  "review this code",
  "fix this code",
  "create a",
  "build a",
  "design a",
  "architect",
  "optimize",
  "improve",
];

/**
 * Patterns that indicate medium-complexity tasks suitable for cheap tier (MiniMax)
 */
export const MEDIUM_INDICATORS = new Set([
  "summarize multiple",
  "summarize these",
  "compare these",
  "compare the",
  "analyze this",
  "analyze the",
  "explain this",
  "explain the",
  "review this",
  "review the",
  "what does this mean",
  "describe the",
  "outline the",
  "list the differences",
  "break down",
  "walk me through",
  "give me an overview",
]);

/**
 * Classify a task based on prompt characteristics
 *
 * @param prompt - The user prompt to classify
 * @param maxLocalPromptLength - Maximum length for local routing (default: 500)
 * @returns Routing decision with destination, reason, and confidence
 */
export function classifyTask(prompt: string, maxLocalPromptLength: number = 500): RoutingDecision {
  const normalizedPrompt = prompt.toLowerCase().trim();
  const promptLength = prompt.length;

  // Check for complex indicators first (conservative: cloud if uncertain)
  for (const indicator of COMPLEX_INDICATORS) {
    if (normalizedPrompt.includes(indicator)) {
      return {
        destination: "cloud",
        reason: `Contains complex indicator: "${indicator}"`,
        promptLength,
        confidence: "high",
      };
    }
  }

  // Check for simple keywords
  let hasSimpleKeyword = false;
  let matchedKeyword = "";
  for (const keyword of SIMPLE_KEYWORDS) {
    if (normalizedPrompt.includes(keyword)) {
      hasSimpleKeyword = true;
      matchedKeyword = keyword;
      break;
    }
  }

  // Short prompt with simple keyword = high confidence local
  if (promptLength <= maxLocalPromptLength && hasSimpleKeyword) {
    return {
      destination: "local",
      reason: `Short prompt with simple keyword: "${matchedKeyword}"`,
      promptLength,
      confidence: "high",
    };
  }

  // Short prompt without keywords = medium confidence local
  if (promptLength <= maxLocalPromptLength) {
    return {
      destination: "local",
      reason: "Short prompt without complex indicators",
      promptLength,
      confidence: "medium",
    };
  }

  // Long prompt with simple keyword = low confidence local
  if (hasSimpleKeyword) {
    return {
      destination: "local",
      reason: `Long prompt but has simple keyword: "${matchedKeyword}"`,
      promptLength,
      confidence: "low",
    };
  }

  // Long prompt without simple keywords = route to cloud
  return {
    destination: "cloud",
    reason: "Long prompt without simple task indicators",
    promptLength,
    confidence: "medium",
  };
}

/**
 * Classify a task into three tiers: local, cheap (MiniMax), or quality (Claude)
 *
 * Routing priority:
 * 1. Complex indicators -> quality tier
 * 2. Simple keywords with short prompt -> local tier
 * 3. Medium indicators -> cheap tier
 * 4. Length-based defaults (short->local, medium->cheap, long->quality)
 *
 * @param prompt - The user prompt to classify
 * @param maxLocalPromptLength - Maximum length for local routing (default: 500)
 * @returns Three-tier decision with tier, reason, and confidence
 */
export function classifyTaskThreeTier(
  prompt: string,
  maxLocalPromptLength: number = 500,
): ThreeTierDecision {
  const normalizedPrompt = prompt.toLowerCase().trim();
  const promptLength = prompt.length;

  // First check for complex indicators -> quality tier
  for (const indicator of COMPLEX_INDICATORS) {
    if (normalizedPrompt.includes(indicator)) {
      return {
        tier: "quality",
        reason: `Complex task: "${indicator}"`,
        promptLength,
        confidence: "high",
      };
    }
  }

  // Check for simple keywords with short prompt -> local tier
  for (const keyword of SIMPLE_KEYWORDS) {
    if (normalizedPrompt.includes(keyword) && promptLength <= maxLocalPromptLength) {
      return {
        tier: "local",
        reason: `Simple task with keyword: "${keyword}"`,
        promptLength,
        confidence: "high",
      };
    }
  }

  // Check for medium indicators -> cheap tier
  for (const indicator of MEDIUM_INDICATORS) {
    if (normalizedPrompt.includes(indicator)) {
      return {
        tier: "cheap",
        reason: `Medium complexity: "${indicator}"`,
        promptLength,
        confidence: "medium",
      };
    }
  }

  // Length-based defaults
  if (promptLength <= 300) {
    return {
      tier: "local",
      reason: "Short prompt",
      promptLength,
      confidence: "medium",
    };
  }
  if (promptLength <= 2000) {
    return {
      tier: "cheap",
      reason: "Medium-length prompt",
      promptLength,
      confidence: "low",
    };
  }

  // Long prompts default to quality
  return {
    tier: "quality",
    reason: "Long/complex prompt",
    promptLength,
    confidence: "low",
  };
}

/**
 * Task Router class for routing tasks to appropriate model
 */
export class TaskRouter {
  private readonly ollamaUrl: string;
  private readonly maxLocalPromptLength: number;
  private readonly debug: boolean;

  constructor(options?: TaskRouterOptions) {
    this.ollamaUrl = options?.ollamaUrl ?? "http://localhost:11434";
    this.maxLocalPromptLength = options?.maxLocalPromptLength ?? 500;
    this.debug = options?.debug ?? false;
  }

  /**
   * Route a prompt to the appropriate model and optionally generate response
   *
   * If routed to local and Ollama is available, generates the response.
   * If routed to cloud or Ollama unavailable, returns decision only.
   *
   * @param prompt - The user prompt to route
   * @returns Route result with decision and optional response
   */
  async route(prompt: string): Promise<RouteResult> {
    const decision = classifyTask(prompt, this.maxLocalPromptLength);

    if (this.debug) {
      console.log(`[TaskRouter] Prompt length: ${decision.promptLength}`);
      console.log(`[TaskRouter] Decision: ${decision.destination}`);
      console.log(`[TaskRouter] Reason: ${decision.reason}`);
      console.log(`[TaskRouter] Confidence: ${decision.confidence}`);
    }

    // If routed to cloud, return decision only
    if (decision.destination === "cloud") {
      return { decision };
    }

    // Check if Ollama is available
    const ollamaAvailable = await isOllamaAvailable(this.ollamaUrl);

    if (!ollamaAvailable) {
      if (this.debug) {
        console.log("[TaskRouter] Ollama unavailable, falling back to cloud");
      }

      return {
        decision: {
          ...decision,
          destination: "cloud",
          reason: `${decision.reason} (Ollama unavailable, falling back to cloud)`,
        },
      };
    }

    // Try to generate with Ollama
    try {
      const result: OllamaGenerateResult = await generateWithOllama({ prompt }, this.ollamaUrl);

      if (this.debug) {
        console.log(`[TaskRouter] Local generation succeeded in ${result.durationMs}ms`);
      }

      return {
        decision,
        response: result.response,
        durationMs: result.durationMs,
      };
    } catch (error) {
      if (this.debug) {
        console.log(`[TaskRouter] Local generation failed: ${error}`);
        console.log("[TaskRouter] Falling back to cloud");
      }

      // Fallback to cloud on error
      return {
        decision: {
          ...decision,
          destination: "cloud",
          reason: `${decision.reason} (local generation failed, falling back to cloud)`,
        },
      };
    }
  }

  /**
   * Classify a prompt without generating a response
   *
   * @param prompt - The user prompt to classify
   * @returns Routing decision
   */
  classify(prompt: string): RoutingDecision {
    return classifyTask(prompt, this.maxLocalPromptLength);
  }

  /**
   * Check if Ollama is available for local routing
   */
  async isLocalAvailable(): Promise<boolean> {
    return isOllamaAvailable(this.ollamaUrl);
  }

  /**
   * Route a prompt using three-tier classification (local/cheap/quality)
   *
   * Tries tiers in order with fallback:
   * - local tier: Try Ollama, fall through to cheap if unavailable/fails
   * - cheap tier: Try MiniMax, fall through to quality if unavailable/fails
   * - quality tier: Return decision only (caller handles Claude)
   *
   * @param prompt - The user prompt to route
   * @returns Three-tier route result with decision and optional response
   */
  async routeThreeTier(prompt: string): Promise<ThreeTierRouteResult> {
    const decision = classifyTaskThreeTier(prompt, this.maxLocalPromptLength);

    if (this.debug) {
      console.log(`[TaskRouter] Three-tier decision: ${decision.tier}`);
      console.log(`[TaskRouter] Reason: ${decision.reason}`);
    }

    // Try local tier first
    if (decision.tier === "local") {
      const ollamaAvailable = await isOllamaAvailable(this.ollamaUrl);
      if (ollamaAvailable) {
        try {
          const result = await generateWithOllama({ prompt }, this.ollamaUrl);
          return {
            decision,
            response: result.response,
            durationMs: result.durationMs,
            actualTier: "local",
          };
        } catch {
          if (this.debug) {
            console.log("[TaskRouter] Local generation failed, trying cheap tier");
          }
        }
      }
      // Fall through to cheap tier
    }

    // Try cheap tier (MiniMax)
    if (decision.tier === "local" || decision.tier === "cheap") {
      const minimaxAvailable = await isMinimaxAvailable();
      if (minimaxAvailable) {
        try {
          const result = await generateWithMinimax({ prompt });
          return {
            decision,
            response: result.response,
            durationMs: result.durationMs,
            actualTier: "cheap",
          };
        } catch {
          if (this.debug) {
            console.log("[TaskRouter] Cheap generation failed, falling back to quality");
          }
        }
      }
    }

    // Quality tier - return decision only, caller handles Claude
    return {
      decision,
      actualTier: "quality",
    };
  }
}
