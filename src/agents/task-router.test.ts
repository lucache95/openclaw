import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { classifyTask, TaskRouter, SIMPLE_KEYWORDS, COMPLEX_INDICATORS } from "./task-router.js";

describe("classifyTask", () => {
  describe("simple keyword detection", () => {
    it("routes short prompt with 'summarize' to local", () => {
      const result = classifyTask("Please summarize this text");
      expect(result.destination).toBe("local");
      expect(result.reason).toContain("summarize");
      expect(result.confidence).toBe("high");
    });

    it("routes short prompt with 'classify' to local", () => {
      const result = classifyTask("Classify this sentence as positive or negative");
      expect(result.destination).toBe("local");
      expect(result.reason).toContain("classify");
      expect(result.confidence).toBe("high");
    });

    it("routes short prompt with 'rewrite' to local", () => {
      const result = classifyTask("Rewrite this sentence more formally");
      expect(result.destination).toBe("local");
      expect(result.reason).toContain("rewrite");
      expect(result.confidence).toBe("high");
    });

    it("routes short prompt with 'format' to local", () => {
      const result = classifyTask("Format this data as JSON");
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("high");
    });

    it("routes short prompt with 'translate' to local", () => {
      const result = classifyTask("Translate this to Spanish");
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("high");
    });

    it("routes short prompt with 'yes or no' to local", () => {
      const result = classifyTask("Is this a valid email? Answer yes or no");
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("high");
    });

    it("routes short prompt with 'true or false' to local", () => {
      const result = classifyTask("Is 2+2=4? Answer true or false");
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("high");
    });
  });

  describe("complex indicator detection", () => {
    it("routes prompt with 'step by step' to cloud", () => {
      const result = classifyTask("Explain this step by step");
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("step by step");
      expect(result.confidence).toBe("high");
    });

    it("routes prompt with 'write code' to cloud", () => {
      const result = classifyTask("Write code to sort an array");
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("write code");
      expect(result.confidence).toBe("high");
    });

    it("routes prompt with 'implement' to cloud", () => {
      const result = classifyTask("Implement a binary search function");
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("implement");
      expect(result.confidence).toBe("high");
    });

    it("routes prompt with 'debug' to cloud", () => {
      const result = classifyTask("Debug this function");
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("debug");
      expect(result.confidence).toBe("high");
    });

    it("routes prompt with 'refactor' to cloud", () => {
      const result = classifyTask("Refactor this code for better readability");
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("refactor");
      expect(result.confidence).toBe("high");
    });

    it("routes prompt with 'explain why' to cloud", () => {
      const result = classifyTask("Explain why this happens");
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("explain why");
      expect(result.confidence).toBe("high");
    });
  });

  describe("prompt length handling", () => {
    it("routes long prompt without simple keywords to cloud", () => {
      const longPrompt = "x".repeat(600);
      const result = classifyTask(longPrompt);
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("Long prompt");
      expect(result.promptLength).toBe(600);
    });

    it("routes exactly 500 char prompt without keywords to local", () => {
      const exactPrompt = "a".repeat(500);
      const result = classifyTask(exactPrompt);
      expect(result.destination).toBe("local");
      expect(result.promptLength).toBe(500);
      expect(result.confidence).toBe("medium");
    });

    it("routes 501 char prompt without simple keywords to cloud", () => {
      const slightlyLongPrompt = "a".repeat(501);
      const result = classifyTask(slightlyLongPrompt);
      expect(result.destination).toBe("cloud");
      expect(result.promptLength).toBe(501);
    });

    it("routes long prompt with simple keyword to local with low confidence", () => {
      const longPrompt = "Please summarize " + "x".repeat(600);
      const result = classifyTask(longPrompt);
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("low");
      expect(result.reason).toContain("Long prompt");
      expect(result.reason).toContain("summarize");
    });
  });

  describe("mixed signals (conservative routing)", () => {
    it("routes short prompt with complex indicator to cloud", () => {
      // Even though it's short, complex indicator takes precedence
      const result = classifyTask("Summarize this step by step");
      expect(result.destination).toBe("cloud");
      expect(result.reason).toContain("step by step");
    });

    it("routes prompt with both simple and complex indicators to cloud", () => {
      const result = classifyTask("Summarize and then write code");
      expect(result.destination).toBe("cloud");
      // Complex indicator should be detected first
    });
  });

  describe("short prompts without keywords", () => {
    it("routes short prompt without keywords to local with medium confidence", () => {
      const result = classifyTask("Hello world");
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("medium");
      expect(result.reason).toContain("Short prompt without complex indicators");
    });
  });

  describe("keyword sets are properly defined", () => {
    it("has expected simple keywords", () => {
      expect(SIMPLE_KEYWORDS.has("summarize")).toBe(true);
      expect(SIMPLE_KEYWORDS.has("classify")).toBe(true);
      expect(SIMPLE_KEYWORDS.has("format")).toBe(true);
      expect(SIMPLE_KEYWORDS.has("extract")).toBe(true);
      expect(SIMPLE_KEYWORDS.has("list")).toBe(true);
      expect(SIMPLE_KEYWORDS.has("rewrite")).toBe(true);
      expect(SIMPLE_KEYWORDS.has("translate")).toBe(true);
    });

    it("has expected complex indicators", () => {
      expect(COMPLEX_INDICATORS).toContain("step by step");
      expect(COMPLEX_INDICATORS).toContain("write code");
      expect(COMPLEX_INDICATORS).toContain("implement");
      expect(COMPLEX_INDICATORS).toContain("debug");
      expect(COMPLEX_INDICATORS).toContain("refactor");
    });
  });
});

describe("TaskRouter", () => {
  let router: TaskRouter;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    router = new TaskRouter();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("classify method", () => {
    it("classifies without making network requests", () => {
      const result = router.classify("Summarize this");
      expect(result.destination).toBe("local");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("isLocalAvailable method", () => {
    it("returns true when Ollama is available", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
      } as Response);

      const available = await router.isLocalAvailable();
      expect(available).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith("http://localhost:11434/api/tags", expect.any(Object));
    });

    it("returns false when Ollama is unavailable", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Connection refused"));

      const available = await router.isLocalAvailable();
      expect(available).toBe(false);
    });
  });

  describe("route method", () => {
    it("routes to cloud without calling Ollama when complex task", async () => {
      const result = await router.route("Write code to sort an array");
      expect(result.decision.destination).toBe("cloud");
      expect(result.response).toBeUndefined();
      // Should not have called fetch for generation
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("routes to local when Ollama available and simple task", async () => {
      // Mock Ollama availability check
      fetchSpy.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "Here is the summary...",
          model: "qwen2.5:3b",
        }),
      } as Response);

      const result = await router.route("Summarize this text");
      expect(result.decision.destination).toBe("local");
      expect(result.response).toBe("Here is the summary...");
      expect(result.durationMs).toBeDefined();
    });

    it("falls back to cloud when Ollama unavailable", async () => {
      // Mock Ollama availability check fails
      fetchSpy.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await router.route("Summarize this text");
      expect(result.decision.destination).toBe("cloud");
      expect(result.decision.reason).toContain("Ollama unavailable");
      expect(result.response).toBeUndefined();
    });

    it("falls back to cloud when local generation fails", async () => {
      // Mock Ollama availability check
      fetchSpy.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call fails
      fetchSpy.mockRejectedValueOnce(new Error("Generation error"));

      const result = await router.route("Summarize this text");
      expect(result.decision.destination).toBe("cloud");
      expect(result.decision.reason).toContain("local generation failed");
      expect(result.response).toBeUndefined();
    });
  });

  describe("constructor options", () => {
    it("uses custom ollama URL", async () => {
      const customRouter = new TaskRouter({ ollamaUrl: "http://custom:8080" });

      fetchSpy.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await customRouter.isLocalAvailable();
      expect(fetchSpy).toHaveBeenCalledWith("http://custom:8080/api/tags", expect.any(Object));
    });

    it("uses custom max prompt length", () => {
      const customRouter = new TaskRouter({ maxLocalPromptLength: 1000 });
      const longPrompt = "a".repeat(800);
      const result = customRouter.classify(longPrompt);
      // With default 500, this would route to cloud; with 1000, it's local
      expect(result.destination).toBe("local");
    });
  });

  describe("debug logging", () => {
    it("logs when debug enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const debugRouter = new TaskRouter({ debug: true });

      // Mock Ollama unavailable
      fetchSpy.mockRejectedValueOnce(new Error("Connection refused"));

      await debugRouter.route("Summarize this");

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c.includes("[TaskRouter]"))).toBe(true);

      consoleSpy.mockRestore();
    });

    it("does not log when debug disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const normalRouter = new TaskRouter({ debug: false });

      // Mock Ollama unavailable
      fetchSpy.mockRejectedValueOnce(new Error("Connection refused"));

      await normalRouter.route("Summarize this");

      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c?.includes?.("[TaskRouter]"))).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
