/**
 * MiniMax M2 text generation client
 *
 * Wraps the MiniMax OpenAI-compatible API for medium-complexity text generation tasks.
 * Uses macOS Keychain for secure credential retrieval.
 */

import { execSync } from "child_process";

const DEFAULT_MINIMAX_URL = "https://api.minimax.io/v1";
const DEFAULT_MODEL = "minimax-m2";
const DEFAULT_TIMEOUT_MS = 60000;

export interface MinimaxGenerateOptions {
  /** The prompt to generate from */
  prompt: string;
  /** System prompt for agent identity (optional) */
  system?: string;
  /** Model to use (default: minimax-m2) */
  model?: string;
  /** Temperature for generation (0.01-1.0, MiniMax rejects 0) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
}

export interface MinimaxGenerateResult {
  /** The generated text response */
  response: string;
  /** Time taken for generation in milliseconds */
  durationMs: number;
  /** Model used for generation */
  model: string;
  /** Token usage statistics */
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

/**
 * OpenAI-compatible chat completion response structure
 */
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Retrieve MiniMax API key from macOS Keychain
 *
 * @returns The API key if found, null otherwise
 */
export function getMinimaxApiKey(): string | null {
  try {
    const key = execSync(
      'security find-generic-password -a "clawd" -s "minimax-api-key" -w 2>/dev/null',
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
    return key || null;
  } catch {
    return null;
  }
}

/**
 * Check if MiniMax API is available and responding
 *
 * @param apiKey - Optional API key (will retrieve from Keychain if not provided)
 * @param baseUrl - Optional base URL (default: https://api.minimax.io/v1)
 * @returns true if API is available and authenticated, false otherwise
 */
export async function isMinimaxAvailable(
  apiKey?: string,
  baseUrl: string = DEFAULT_MINIMAX_URL,
): Promise<boolean> {
  const key = apiKey ?? getMinimaxApiKey();
  if (!key) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${key}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Clamp temperature to MiniMax's valid range (0.01-1.0)
 * MiniMax rejects temperature values of exactly 0
 */
function clampTemperature(temp: number | undefined): number {
  if (temp === undefined) {
    return 1.0;
  }
  return Math.min(Math.max(temp, 0.01), 1.0);
}

/**
 * Generate text using MiniMax API
 *
 * @param options - Generation options
 * @param apiKey - Optional API key (will retrieve from Keychain if not provided)
 * @param baseUrl - Optional base URL (default: https://api.minimax.io/v1)
 * @returns Generation result with response, duration, model, and usage stats
 */
export async function generateWithMinimax(
  options: MinimaxGenerateOptions,
  apiKey?: string,
  baseUrl: string = DEFAULT_MINIMAX_URL,
): Promise<MinimaxGenerateResult> {
  const startTime = Date.now();
  const key = apiKey ?? getMinimaxApiKey();

  if (!key) {
    throw new Error(
      "MiniMax API key not found. Add to Keychain:\n" +
        'security add-generic-password -a "clawd" -s "minimax-api-key" -w "YOUR_KEY"',
    );
  }

  const model = options.model ?? DEFAULT_MODEL;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (options.system) {
      messages.push({ role: "system", content: options.system });
    }
    messages.push({ role: "user", content: options.prompt });

    const requestBody = {
      model,
      messages,
      temperature: clampTemperature(options.temperature),
      ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const durationMs = Date.now() - startTime;

    return {
      response: data.choices[0]?.message?.content ?? "",
      durationMs,
      model: data.model,
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
      },
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`MiniMax generation timed out after ${DEFAULT_TIMEOUT_MS}ms`, {
        cause: error,
      });
    }

    throw error;
  }
}

/**
 * MiniMax client class for stateful operations
 */
export class MinimaxClient {
  private readonly apiKey: string | null;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly defaultModel: string;

  constructor(options?: { apiKey?: string; baseUrl?: string; timeout?: number; model?: string }) {
    this.apiKey = options?.apiKey ?? getMinimaxApiKey();
    this.baseUrl = options?.baseUrl ?? DEFAULT_MINIMAX_URL;
    this.timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
    this.defaultModel = options?.model ?? DEFAULT_MODEL;
  }

  /**
   * Check if MiniMax API is available
   */
  async isAvailable(): Promise<boolean> {
    return isMinimaxAvailable(this.apiKey ?? undefined, this.baseUrl);
  }

  /**
   * Generate text using MiniMax API
   */
  async generate(
    options: Omit<MinimaxGenerateOptions, "model"> & { model?: string },
  ): Promise<MinimaxGenerateResult> {
    if (!this.apiKey) {
      throw new Error(
        "MiniMax API key not found. Add to Keychain:\n" +
          'security add-generic-password -a "clawd" -s "minimax-api-key" -w "YOUR_KEY"',
      );
    }

    return generateWithMinimax(
      {
        ...options,
        model: options.model ?? this.defaultModel,
      },
      this.apiKey,
      this.baseUrl,
    );
  }
}
