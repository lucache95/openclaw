/**
 * Ollama text generation client
 *
 * Wraps the Ollama API for simple text generation tasks.
 * Uses qwen2.5:3b model with optimized settings for fast context loading.
 */

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_MODEL = "qwen2.5:3b";
const DEFAULT_NUM_CTX = 4096;
const DEFAULT_TIMEOUT_MS = 30000;

export interface OllamaGenerateOptions {
  /** The prompt to generate from */
  prompt: string;
  /** System prompt for agent identity (optional) */
  system?: string;
  /** Model to use (default: qwen2.5:3b) */
  model?: string;
  /** Whether to stream the response (default: false) */
  stream?: boolean;
  /** Additional model options */
  options?: {
    /** Context window size (default: 4096) */
    num_ctx?: number;
    /** Temperature for generation (default: model default) */
    temperature?: number;
  };
}

export interface OllamaGenerateResult {
  /** The generated text response */
  response: string;
  /** Time taken for generation in milliseconds */
  durationMs: number;
  /** Model used for generation */
  model: string;
}

export interface OllamaStreamChunk {
  /** Partial response text */
  response: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Model used (only present on final chunk) */
  model?: string;
  /** Total duration in nanoseconds (only present on final chunk) */
  total_duration?: number;
}

/**
 * Check if Ollama is available and responding
 */
export async function isOllamaAvailable(ollamaUrl: string = DEFAULT_OLLAMA_URL): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a specific model is available in Ollama
 */
export async function isModelAvailable(
  model: string = DEFAULT_MODEL,
  ollamaUrl: string = DEFAULT_OLLAMA_URL,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaUrl}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as {
      models?: Array<{ name: string }>;
    };
    const models = data.models || [];
    return models.some((m) => m.name === model || m.name.startsWith(`${model}:`));
  } catch {
    return false;
  }
}

/**
 * Generate text using Ollama
 *
 * @param options - Generation options
 * @param ollamaUrl - Ollama API URL (default: http://localhost:11434)
 * @returns Generation result with response, duration, and model
 */
export async function generateWithOllama(
  options: OllamaGenerateOptions,
  ollamaUrl: string = DEFAULT_OLLAMA_URL,
): Promise<OllamaGenerateResult> {
  const startTime = Date.now();
  const model = options.model ?? DEFAULT_MODEL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const requestBody = {
      model,
      prompt: options.prompt,
      stream: false,
      ...(options.system && { system: options.system }),
      options: {
        num_ctx: options.options?.num_ctx ?? DEFAULT_NUM_CTX,
        ...(options.options?.temperature !== undefined && {
          temperature: options.options.temperature,
        }),
      },
    };

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      response: string;
      model: string;
      total_duration?: number;
    };
    const durationMs = Date.now() - startTime;

    return {
      response: data.response,
      durationMs,
      model: data.model,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama generation timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }

    throw error;
  }
}

/**
 * Generate text using Ollama with streaming
 *
 * @param options - Generation options (stream option is ignored, always streams)
 * @param onChunk - Callback for each chunk received
 * @param ollamaUrl - Ollama API URL (default: http://localhost:11434)
 * @returns Final generation result
 */
export async function generateWithOllamaStream(
  options: OllamaGenerateOptions,
  onChunk: (chunk: OllamaStreamChunk) => void,
  ollamaUrl: string = DEFAULT_OLLAMA_URL,
): Promise<OllamaGenerateResult> {
  const startTime = Date.now();
  const model = options.model ?? DEFAULT_MODEL;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const requestBody = {
      model,
      prompt: options.prompt,
      stream: true,
      ...(options.system && { system: options.system }),
      options: {
        num_ctx: options.options?.num_ctx ?? DEFAULT_NUM_CTX,
        ...(options.options?.temperature !== undefined && {
          temperature: options.options.temperature,
        }),
      },
    };

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error("Ollama response has no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let finalModel = model;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value, { stream: true });
      const lines = text.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const chunk = JSON.parse(line) as OllamaStreamChunk;
          fullResponse += chunk.response;
          onChunk(chunk);

          if (chunk.done && chunk.model) {
            finalModel = chunk.model;
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return {
      response: fullResponse,
      durationMs,
      model: finalModel,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Ollama generation timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }

    throw error;
  }
}

/**
 * Ollama client class for stateful operations
 */
export class OllamaClient {
  private readonly url: string;
  private readonly defaultModel: string;

  constructor(options?: { url?: string; model?: string }) {
    this.url = options?.url ?? DEFAULT_OLLAMA_URL;
    this.defaultModel = options?.model ?? DEFAULT_MODEL;
  }

  /**
   * Check if Ollama is available
   */
  async isAvailable(): Promise<boolean> {
    return isOllamaAvailable(this.url);
  }

  /**
   * Check if the configured model is available
   */
  async isModelAvailable(): Promise<boolean> {
    return isModelAvailable(this.defaultModel, this.url);
  }

  /**
   * Generate text (non-streaming)
   */
  async generate(
    options: Omit<OllamaGenerateOptions, "model"> & { model?: string },
  ): Promise<OllamaGenerateResult> {
    return generateWithOllama(
      {
        ...options,
        model: options.model ?? this.defaultModel,
      },
      this.url,
    );
  }

  /**
   * Generate text (streaming)
   */
  async generateStream(
    options: Omit<OllamaGenerateOptions, "model" | "stream"> & { model?: string },
    onChunk: (chunk: OllamaStreamChunk) => void,
  ): Promise<OllamaGenerateResult> {
    return generateWithOllamaStream(
      {
        ...options,
        model: options.model ?? this.defaultModel,
      },
      onChunk,
      this.url,
    );
  }
}
