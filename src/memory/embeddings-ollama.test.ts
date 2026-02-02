import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkOllamaHealth,
  checkOllamaModel,
  createOllamaEmbeddingProvider,
  DEFAULT_OLLAMA_EMBEDDING_MODEL,
} from "./embeddings-ollama.js";

describe("ollama embedding provider", () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  describe("checkOllamaHealth", () => {
    it("returns true when Ollama is running", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkOllamaHealth();

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith("http://localhost:11434", {
        method: "GET",
        signal: expect.any(AbortSignal),
      });
    });

    it("returns false when Ollama is not running", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkOllamaHealth();

      expect(result).toBe(false);
    });

    it("returns false when fetch fails with non-ok response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkOllamaHealth();

      expect(result).toBe(false);
    });

    it("uses custom base URL when provided", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true });
      vi.stubGlobal("fetch", fetchMock);

      await checkOllamaHealth("http://custom-host:11434");

      expect(fetchMock).toHaveBeenCalledWith("http://custom-host:11434", {
        method: "GET",
        signal: expect.any(AbortSignal),
      });
    });
  });

  describe("checkOllamaModel", () => {
    it("returns true when model is available", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [{ name: "nomic-embed-text:latest" }, { name: "llama3:latest" }],
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkOllamaModel("nomic-embed-text");

      expect(result).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith("http://localhost:11434/api/tags", {
        method: "GET",
        signal: expect.any(AbortSignal),
      });
    });

    it("returns false when model is not available", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [{ name: "llama3:latest" }],
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkOllamaModel("nomic-embed-text");

      expect(result).toBe(false);
    });

    it("returns false when Ollama is not accessible", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkOllamaModel("nomic-embed-text");

      expect(result).toBe(false);
    });

    it("returns false when API returns non-ok response", async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
      vi.stubGlobal("fetch", fetchMock);

      const result = await checkOllamaModel("nomic-embed-text");

      expect(result).toBe(false);
    });
  });

  describe("createOllamaEmbeddingProvider", () => {
    it("creates provider with default settings when Ollama is available", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({
          // embedQuery
          ok: true,
          json: () =>
            Promise.resolve({
              embeddings: [[0.1, 0.2, 0.3]],
            }),
        });
      vi.stubGlobal("fetch", fetchMock);

      const { provider, client } = await createOllamaEmbeddingProvider({
        config: {} as never,
        provider: "ollama",
        model: "",
        fallback: "none",
      });

      expect(provider.id).toBe("ollama");
      expect(provider.model).toBe(DEFAULT_OLLAMA_EMBEDDING_MODEL);
      expect(client.baseUrl).toBe("http://localhost:11434");
      expect(client.model).toBe(DEFAULT_OLLAMA_EMBEDDING_MODEL);
    });

    it("returns embeddings for single text", async () => {
      const embedding = Array.from({ length: 768 }, (_, i) => i / 768);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embeddings: [embedding] }),
        });
      vi.stubGlobal("fetch", fetchMock);

      const { provider } = await createOllamaEmbeddingProvider({
        config: {} as never,
        provider: "ollama",
        model: "nomic-embed-text",
        fallback: "none",
      });

      const result = await provider.embedQuery("test text");

      expect(result).toEqual(embedding);
      expect(result.length).toBe(768);
    });

    it("returns embeddings for batch texts", async () => {
      const embeddings = [
        Array.from({ length: 768 }, (_, i) => i / 768),
        Array.from({ length: 768 }, (_, i) => (i + 1) / 768),
        Array.from({ length: 768 }, (_, i) => (i + 2) / 768),
      ];
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ embeddings }),
        });
      vi.stubGlobal("fetch", fetchMock);

      const { provider } = await createOllamaEmbeddingProvider({
        config: {} as never,
        provider: "ollama",
        model: "nomic-embed-text",
        fallback: "none",
      });

      const result = await provider.embedBatch(["text 1", "text 2", "text 3"]);

      expect(result.length).toBe(3);
      expect(result).toEqual(embeddings);
    });

    it("throws error when Ollama is not running", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
      vi.stubGlobal("fetch", fetchMock);

      await expect(
        createOllamaEmbeddingProvider({
          config: {} as never,
          provider: "ollama",
          model: "",
          fallback: "none",
        }),
      ).rejects.toThrow(/Ollama is not running/);
    });

    it("handles empty batch gracefully", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true }); // health check only
      vi.stubGlobal("fetch", fetchMock);

      const { provider } = await createOllamaEmbeddingProvider({
        config: {} as never,
        provider: "ollama",
        model: "nomic-embed-text",
        fallback: "none",
      });

      const result = await provider.embedBatch([]);

      expect(result).toEqual([]);
      // Should only have health check, no embed call
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("uses custom base URL from remote options", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true }); // health check
      vi.stubGlobal("fetch", fetchMock);

      const { client } = await createOllamaEmbeddingProvider({
        config: {} as never,
        provider: "ollama",
        model: "nomic-embed-text",
        fallback: "none",
        remote: {
          baseUrl: "http://custom-ollama:11434",
        },
      });

      expect(client.baseUrl).toBe("http://custom-ollama:11434");
      expect(fetchMock).toHaveBeenCalledWith("http://custom-ollama:11434", {
        method: "GET",
        signal: expect.any(AbortSignal),
      });
    });

    it("normalizes model name with ollama/ prefix", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true }); // health check
      vi.stubGlobal("fetch", fetchMock);

      const { client } = await createOllamaEmbeddingProvider({
        config: {} as never,
        provider: "ollama",
        model: "ollama/nomic-embed-text",
        fallback: "none",
      });

      expect(client.model).toBe("nomic-embed-text");
    });

    it("throws error on API failure during embedding", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: true }) // health check
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("model not found"),
        });
      vi.stubGlobal("fetch", fetchMock);

      const { provider } = await createOllamaEmbeddingProvider({
        config: {} as never,
        provider: "ollama",
        model: "nonexistent-model",
        fallback: "none",
      });

      await expect(provider.embedQuery("test")).rejects.toThrow(/ollama embeddings failed: 500/);
    });
  });
});
