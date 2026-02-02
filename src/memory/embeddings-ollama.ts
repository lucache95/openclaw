import type { EmbeddingProvider, EmbeddingProviderOptions } from "./embeddings.js";

export type OllamaEmbeddingClient = {
  baseUrl: string;
  model: string;
};

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_EMBEDDING_MODEL = "nomic-embed-text";
const OLLAMA_TIMEOUT_MS = 5000;

/**
 * Check if Ollama is running and accessible.
 * Returns true if Ollama responds to a health check within timeout.
 */
export async function checkOllamaHealth(baseUrl?: string): Promise<boolean> {
  const url = (baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    // Ollama exposes a simple GET endpoint at root that returns version info
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if a specific embedding model is available in Ollama.
 */
export async function checkOllamaModel(model: string, baseUrl?: string): Promise<boolean> {
  const url = (baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const res = await fetch(`${url}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!res.ok) {
      return false;
    }
    const payload = (await res.json()) as { models?: Array<{ name?: string }> };
    const models = payload.models ?? [];
    // Model names can be "nomic-embed-text:latest" or just "nomic-embed-text"
    return models.some((m) => {
      const name = m.name ?? "";
      return name === model || name.startsWith(`${model}:`);
    });
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function createOllamaEmbeddingProvider(
  options: EmbeddingProviderOptions,
): Promise<{ provider: EmbeddingProvider; client: OllamaEmbeddingClient }> {
  const client = resolveOllamaEmbeddingClient(options);
  const embedUrl = `${client.baseUrl}/api/embed`;

  // Verify Ollama is accessible before returning provider
  const healthy = await checkOllamaHealth(client.baseUrl);
  if (!healthy) {
    throw new Error(
      `Ollama is not running or not accessible at ${client.baseUrl}. ` +
        "Start Ollama with: ollama serve",
    );
  }

  const embed = async (input: string | string[]): Promise<number[][]> => {
    const texts = Array.isArray(input) ? input : [input];
    if (texts.length === 0) {
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS * 2);

    try {
      const res = await fetch(embedUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: client.model,
          input: texts,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ollama embeddings failed: ${res.status} ${text}`);
      }

      const payload = (await res.json()) as {
        embeddings?: number[][];
      };

      return payload.embeddings ?? [];
    } finally {
      clearTimeout(timeoutId);
    }
  };

  return {
    provider: {
      id: "ollama",
      model: client.model,
      embedQuery: async (text) => {
        const [vec] = await embed(text);
        return vec ?? [];
      },
      embedBatch: async (texts) => {
        return embed(texts);
      },
    },
    client,
  };
}

export function resolveOllamaEmbeddingClient(
  options: EmbeddingProviderOptions,
): OllamaEmbeddingClient {
  // Ollama doesn't use API keys - it's a local service
  // Use remote.baseUrl if provided, otherwise default to localhost
  const remote = options.remote;
  const baseUrl = (remote?.baseUrl?.trim() || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, "");
  const model = normalizeOllamaModel(options.model);

  return { baseUrl, model };
}

function normalizeOllamaModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return DEFAULT_OLLAMA_EMBEDDING_MODEL;
  }
  // Strip provider prefix if present
  if (trimmed.startsWith("ollama/")) {
    return trimmed.slice("ollama/".length);
  }
  return trimmed;
}
