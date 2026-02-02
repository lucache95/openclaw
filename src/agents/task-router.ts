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
  /** System prompt for agent identity (passed to all tiers) */
  systemPrompt?: string;
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
 * Pure text transformation patterns - MUST have inline content to process
 * These are the ONLY tasks safe for local/cheap routing
 * Pattern: { regex to match, requires inline content after match }
 */
export const TEXT_TRANSFORM_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Translation - "translate this: ..." or "translate to spanish: ..."
  { pattern: /^translate\b/i, name: "translate" },
  { pattern: /^traduire\b/i, name: "translate" },
  { pattern: /^übersetze\b/i, name: "translate" },
  // Summarization with inline content
  { pattern: /^summarize\s*(this|the following)?[:\s]/i, name: "summarize" },
  { pattern: /^tldr[:\s]/i, name: "summarize" },
  // Rewriting/paraphrasing
  { pattern: /^(rewrite|rephrase|paraphrase)\b/i, name: "rewrite" },
  // Formatting
  { pattern: /^format\s*(this|the following)?\s*(as|into|to)\b/i, name: "format" },
  // Conversion (units, formats, etc)
  { pattern: /^convert\b/i, name: "convert" },
  // Simple classification
  { pattern: /^(classify|categorize)\s*(this|the following)?[:\s]/i, name: "classify" },
  // Extraction with inline content
  {
    pattern: /^extract\s*(the|all)?\s*(names|emails|dates|numbers|urls)\s*(from)?[:\s]/i,
    name: "extract",
  },
  // Simple yes/no or true/false questions with context provided
  { pattern: /^(is this|does this|true or false)[:\s]/i, name: "boolean" },
  // Text expansion/shortening
  { pattern: /^(shorten|simplify|expand)\s*(this)?[:\s]/i, name: "transform" },
  // Spelling/grammar
  { pattern: /^(fix|correct)\s*(the)?\s*(spelling|grammar|typos)\b/i, name: "proofread" },
];

/**
 * Tool signals - if ANY of these match, route to Claude
 * These indicate the user wants to interact with their data/systems
 */
export const TOOL_SIGNAL_PATTERNS: RegExp[] = [
  // Possessives indicating user's data/resources
  /\b(my|our|your)\s+\w+/i,
  // Questions about state/existence (implies reading data)
  /\b(what|which|where|who|how many|do (we|i|you) have|is there|are there)\b/i,
  // Action verbs implying tool use
  /\b(send|check|read|look|search|find|run|execute|open|fetch|get|show|list|delete|create|update|add|remove|set|change|modify|edit)\b/i,
  // Channel/service names
  /\b(telegram|whatsapp|discord|slack|signal|email|gmail|calendar|cron|reminder|file|folder|directory|git|github)\b/i,
  // References to external resources
  /\b(the file|this file|that file|the code|this code|the repo|the project)\b/i,
  // Conversational/contextual queries
  /\b(hey|hi|hello|can you|could you|would you|please|help me|I need|we need)\b/i,
  // Time-sensitive or stateful queries
  /\b(today|tomorrow|yesterday|this week|last week|now|currently|latest|recent)\b/i,
];

/**
 * Patterns for medium-complexity tasks (cheap tier)
 * These are still text-only but need more reasoning capability
 */
export const MEDIUM_TRANSFORM_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Comparison with inline content
  { pattern: /^compare\s*(these|the following|this and that)[:\s]/i, name: "compare" },
  // Analysis with inline content
  { pattern: /^analyze\s*(this|the following)[:\s]/i, name: "analyze" },
  // Explanation requests with inline content
  { pattern: /^explain\s*(this|the following|what)[:\s]/i, name: "explain" },
  // Multi-item summarization
  { pattern: /^summarize\s*(these|all|the following)\s*\d+/i, name: "multi-summarize" },
  // Overview/outline with content
  { pattern: /^(outline|give me an overview of)\s*(this|the following)?[:\s]/i, name: "outline" },
];

// Legacy exports for backward compatibility (used by classifyTask)
export const SIMPLE_KEYWORDS = new Set([
  "summarize",
  "classify",
  "format",
  "extract",
  "rewrite",
  "translate",
  "convert",
  "simplify",
  "shorten",
  "expand",
  "paraphrase",
]);

export const COMPLEX_INDICATORS = [
  "step by step",
  "analyze and",
  "compare and",
  "explain why",
  "explain how",
  "write code",
  "implement",
  "debug",
  "refactor",
  "create a",
  "build a",
];

export const MEDIUM_INDICATORS = new Set([
  "summarize multiple",
  "compare these",
  "analyze this",
  "explain this",
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
 * Check if a prompt contains any tool signals (indicators it needs Claude)
 */
function hasToolSignals(prompt: string): { found: boolean; signal?: string } {
  for (const pattern of TOOL_SIGNAL_PATTERNS) {
    const match = prompt.match(pattern);
    if (match) {
      return { found: true, signal: match[0] };
    }
  }
  return { found: false };
}

/**
 * Check if a prompt matches a pure text transformation pattern
 */
function matchesTextTransform(
  prompt: string,
  patterns: Array<{ pattern: RegExp; name: string }>,
): { matched: boolean; name?: string } {
  for (const { pattern, name } of patterns) {
    if (pattern.test(prompt)) {
      return { matched: true, name };
    }
  }
  return { matched: false };
}

/**
 * Extract the command portion of a prompt (before colon or quoted content)
 * This is used to check tool signals only against the command, not the content to transform
 */
function extractCommandPortion(prompt: string): string {
  // If there's a colon, everything before it is the command
  const colonIndex = prompt.indexOf(":");
  if (colonIndex !== -1 && colonIndex < 100) {
    return prompt.slice(0, colonIndex);
  }

  // If there's quoted content, everything before the first quote is the command
  const quoteMatch = prompt.match(/^([^"'`]*?)["'`]/);
  if (quoteMatch) {
    return quoteMatch[1];
  }

  // Otherwise, use the first 100 chars or full prompt if shorter
  return prompt.slice(0, 100);
}

/**
 * Check if the prompt has substantial inline content after the command
 * (i.e., the user provided text to transform, not just a command)
 */
function hasInlineContent(prompt: string): boolean {
  // Look for content after a colon
  const colonIndex = prompt.indexOf(":");
  if (colonIndex !== -1 && colonIndex < 100) {
    const afterColon = prompt.slice(colonIndex + 1).trim();
    return afterColon.length > 20; // Meaningful content threshold
  }

  // Check if there's quoted content with substantial length
  const hasQuotes = /["'`][\s\S]{20,}["'`]/.test(prompt);
  if (hasQuotes) return true;

  // Check if prompt is long enough to contain inline content after command
  // (command words are typically <50 chars)
  return prompt.length > 100;
}

/**
 * Classify a task into three tiers: local, cheap (MiniMax), or quality (Claude)
 *
 * NEW LOGIC (whitelist approach):
 * 1. If ANY tool signals present -> quality (Claude)
 * 2. If matches text transform pattern AND has inline content -> local or cheap
 * 3. Everything else -> quality (Claude)
 *
 * This is conservative by design: false negatives (routing to Claude when local
 * could work) are acceptable, false positives (routing to local when Claude is
 * needed) break the experience.
 *
 * @param prompt - The user prompt to classify
 * @param maxLocalPromptLength - Maximum length for local routing (default: 2000)
 * @returns Three-tier decision with tier, reason, and confidence
 */
export function classifyTaskThreeTier(
  prompt: string,
  maxLocalPromptLength: number = 2000,
): ThreeTierDecision {
  const promptLength = prompt.length;

  // STEP 1: Check if this looks like a text transform with inline content
  // If so, we only check tool signals against the COMMAND portion, not the content
  const simpleMatch = matchesTextTransform(prompt, TEXT_TRANSFORM_PATTERNS);
  const mediumMatch = matchesTextTransform(prompt, MEDIUM_TRANSFORM_PATTERNS);
  const hasContent = hasInlineContent(prompt);

  // If it looks like a text transform with inline content, only check the command for tool signals
  const textToCheckForSignals =
    (simpleMatch.matched || mediumMatch.matched) && hasContent
      ? extractCommandPortion(prompt)
      : prompt;

  // Check for tool signals in the appropriate portion
  const toolCheck = hasToolSignals(textToCheckForSignals);
  if (toolCheck.found) {
    return {
      tier: "quality",
      reason: `Tool signal detected: "${toolCheck.signal}"`,
      promptLength,
      confidence: "high",
    };
  }

  // STEP 2: Check for pure text transformations with inline content
  // Only route away from Claude if we're CONFIDENT it's a text-only task

  // Check simple transforms (local tier candidates)
  if (simpleMatch.matched && hasContent) {
    // Short enough for local? Use Ollama
    if (promptLength <= maxLocalPromptLength) {
      return {
        tier: "local",
        reason: `Pure text transform (${simpleMatch.name}) with inline content`,
        promptLength,
        confidence: "high",
      };
    }
    // Too long for local but still a text transform -> cheap tier
    return {
      tier: "cheap",
      reason: `Text transform (${simpleMatch.name}) too long for local`,
      promptLength,
      confidence: "medium",
    };
  }

  // Check medium transforms (cheap tier candidates)
  if (mediumMatch.matched && hasContent) {
    return {
      tier: "cheap",
      reason: `Medium complexity transform (${mediumMatch.name}) with inline content`,
      promptLength,
      confidence: "medium",
    };
  }

  // STEP 3: Default to quality (Claude)
  // This is the safe default - Claude can handle anything
  return {
    tier: "quality",
    reason: "No clear text transform pattern - defaulting to full capability",
    promptLength,
    confidence: "high",
  };
}

/**
 * Task Router class for routing tasks to appropriate model
 */
export class TaskRouter {
  private readonly ollamaUrl: string;
  private readonly maxLocalPromptLength: number;
  private readonly debug: boolean;
  private readonly systemPrompt: string | undefined;

  constructor(options?: TaskRouterOptions) {
    this.ollamaUrl = options?.ollamaUrl ?? "http://localhost:11434";
    this.maxLocalPromptLength = options?.maxLocalPromptLength ?? 500;
    this.debug = options?.debug ?? false;
    this.systemPrompt = options?.systemPrompt;
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
      const result: OllamaGenerateResult = await generateWithOllama(
        { prompt, system: this.systemPrompt },
        this.ollamaUrl,
      );

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
          const result = await generateWithOllama(
            { prompt, system: this.systemPrompt },
            this.ollamaUrl,
          );
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
          const result = await generateWithMinimax({ prompt, system: this.systemPrompt });
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
