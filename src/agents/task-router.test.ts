import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isMinimaxAvailable, generateWithMinimax } from "./minimax-client.js";
import { isOllamaAvailable, generateWithOllama } from "./ollama-client.js";
import {
  classifyTask,
  classifyTaskThreeTier,
  TaskRouter,
  SIMPLE_KEYWORDS,
  COMPLEX_INDICATORS,
  MEDIUM_INDICATORS,
} from "./task-router.js";

vi.mock("./ollama-client.js");
vi.mock("./minimax-client.js");

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

describe("classifyTaskThreeTier", () => {
  describe("complex tasks route to quality tier", () => {
    it("routes 'write code' to quality tier", () => {
      const result = classifyTaskThreeTier("Write code to sort an array");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("write code");
      expect(result.confidence).toBe("high");
    });

    it("routes 'debug' to quality tier", () => {
      const result = classifyTaskThreeTier("Debug this function");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("debug");
      expect(result.confidence).toBe("high");
    });

    it("routes 'architect' to quality tier", () => {
      const result = classifyTaskThreeTier("Architect a new system");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("architect");
      expect(result.confidence).toBe("high");
    });

    it("routes 'step by step' to quality tier", () => {
      const result = classifyTaskThreeTier("Explain this step by step");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("step by step");
      expect(result.confidence).toBe("high");
    });
  });

  describe("simple tasks with short prompt route to local tier", () => {
    it("routes 'summarize' with short prompt to local", () => {
      const result = classifyTaskThreeTier("Summarize this text");
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("summarize");
      expect(result.confidence).toBe("high");
    });

    it("routes 'classify' with short prompt to local", () => {
      const result = classifyTaskThreeTier("Classify this sentence");
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("classify");
      expect(result.confidence).toBe("high");
    });

    it("routes 'format' with short prompt to local", () => {
      const result = classifyTaskThreeTier("Format this as JSON");
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("format");
      expect(result.confidence).toBe("high");
    });
  });

  describe("medium complexity tasks route to cheap tier", () => {
    it("routes 'summarize multiple' to cheap tier when prompt is long", () => {
      // Use a long prompt so simple keyword + short prompt check fails
      const result = classifyTaskThreeTier(
        "Please summarize multiple documents for me. " + "x".repeat(500),
      );
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("summarize multiple");
      expect(result.confidence).toBe("medium");
    });

    it("routes 'compare these' to cheap tier", () => {
      const result = classifyTaskThreeTier("Compare these two approaches");
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("compare these");
      expect(result.confidence).toBe("medium");
    });

    it("routes 'analyze this' to cheap tier", () => {
      const result = classifyTaskThreeTier("Analyze this data for patterns");
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("analyze this");
      expect(result.confidence).toBe("medium");
    });

    it("routes 'explain this' to cheap tier", () => {
      const result = classifyTaskThreeTier("Explain this concept to me");
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("explain this");
      expect(result.confidence).toBe("medium");
    });

    it("routes 'what does this mean' to cheap tier", () => {
      const result = classifyTaskThreeTier("What does this mean in context?");
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("what does this mean");
      expect(result.confidence).toBe("medium");
    });

    it("routes 'break down' to cheap tier", () => {
      const result = classifyTaskThreeTier("Break down this process");
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("break down");
      expect(result.confidence).toBe("medium");
    });

    it("routes 'walk me through' to cheap tier", () => {
      const result = classifyTaskThreeTier("Walk me through this workflow");
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("walk me through");
      expect(result.confidence).toBe("medium");
    });
  });

  describe("length-based defaults", () => {
    it("routes short prompt (<=300 chars) without keywords to local", () => {
      const result = classifyTaskThreeTier("Hello world");
      expect(result.tier).toBe("local");
      expect(result.reason).toBe("Short prompt");
      expect(result.confidence).toBe("medium");
    });

    it("routes medium prompt (301-2000 chars) without keywords to cheap", () => {
      const mediumPrompt = "a".repeat(1000);
      const result = classifyTaskThreeTier(mediumPrompt);
      expect(result.tier).toBe("cheap");
      expect(result.reason).toBe("Medium-length prompt");
      expect(result.confidence).toBe("low");
    });

    it("routes long prompt (>2000 chars) without keywords to quality", () => {
      const longPrompt = "a".repeat(2500);
      const result = classifyTaskThreeTier(longPrompt);
      expect(result.tier).toBe("quality");
      expect(result.reason).toBe("Long/complex prompt");
      expect(result.confidence).toBe("low");
    });

    it("routes exactly 300 char prompt to local", () => {
      const exactPrompt = "b".repeat(300);
      const result = classifyTaskThreeTier(exactPrompt);
      expect(result.tier).toBe("local");
      expect(result.promptLength).toBe(300);
    });

    it("routes exactly 2000 char prompt to cheap", () => {
      const exactPrompt = "c".repeat(2000);
      const result = classifyTaskThreeTier(exactPrompt);
      expect(result.tier).toBe("cheap");
      expect(result.promptLength).toBe(2000);
    });

    it("routes 2001 char prompt to quality", () => {
      const longPrompt = "d".repeat(2001);
      const result = classifyTaskThreeTier(longPrompt);
      expect(result.tier).toBe("quality");
      expect(result.promptLength).toBe(2001);
    });
  });

  describe("priority ordering", () => {
    it("complex indicator takes precedence over medium indicator", () => {
      // "review this code" is complex, even though "review this" is medium
      const result = classifyTaskThreeTier("Review this code carefully");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("review this code");
    });

    it("complex indicator takes precedence over simple keyword", () => {
      const result = classifyTaskThreeTier("Summarize this step by step");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("step by step");
    });

    it("simple keyword with short prompt takes precedence over medium indicator", () => {
      // "summarize" is simple, but prompt is short and contains "summarize"
      const result = classifyTaskThreeTier("Summarize this");
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("summarize");
    });
  });

  describe("custom maxLocalPromptLength", () => {
    it("respects custom max length for local routing", () => {
      // "summarize" + 600 chars would normally exceed 500 default
      const prompt = "summarize " + "x".repeat(600);
      const result = classifyTaskThreeTier(prompt, 1000);
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("summarize");
    });

    it("routes to cheap tier when simple keyword prompt exceeds custom max length", () => {
      // Short prompt with simple keyword but max length is very small
      // Since it exceeds maxLocalPromptLength, it falls through to medium indicator check
      // "Summarize this text" doesn't match any medium indicator, so it falls to length-based
      // At 19 chars, it's <= 300, so it routes to local based on length
      // Let's use a prompt that matches a medium indicator instead
      const result = classifyTaskThreeTier("Compare the two options carefully", 10);
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("compare the");
    });
  });
});

describe("MEDIUM_INDICATORS", () => {
  it("has all expected medium indicators", () => {
    const expectedIndicators = [
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
    ];

    for (const indicator of expectedIndicators) {
      expect(MEDIUM_INDICATORS.has(indicator)).toBe(true);
    }
  });

  it("all MEDIUM_INDICATORS route to cheap tier when prompt is long enough", () => {
    // Some medium indicators contain simple keywords (like "summarize")
    // which would match simple keyword check for short prompts.
    // Use a long prompt to ensure we test the medium indicator path.
    for (const indicator of MEDIUM_INDICATORS) {
      const prompt = `Please ${indicator} for me. ` + "x".repeat(500);
      const result = classifyTaskThreeTier(prompt);
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain(indicator);
    }
  });
});

describe("TaskRouter", () => {
  let router: TaskRouter;

  const mockedIsOllamaAvailable = vi.mocked(isOllamaAvailable);
  const mockedGenerateWithOllama = vi.mocked(generateWithOllama);
  const mockedIsMinimaxAvailable = vi.mocked(isMinimaxAvailable);
  const mockedGenerateWithMinimax = vi.mocked(generateWithMinimax);

  beforeEach(() => {
    router = new TaskRouter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("classify method", () => {
    it("classifies without making network requests", () => {
      const result = router.classify("Summarize this");
      expect(result.destination).toBe("local");
      expect(mockedIsOllamaAvailable).not.toHaveBeenCalled();
    });
  });

  describe("isLocalAvailable method", () => {
    it("returns true when Ollama is available", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);

      const available = await router.isLocalAvailable();
      expect(available).toBe(true);
      expect(mockedIsOllamaAvailable).toHaveBeenCalledWith("http://localhost:11434");
    });

    it("returns false when Ollama is unavailable", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(false);

      const available = await router.isLocalAvailable();
      expect(available).toBe(false);
    });
  });

  describe("route method", () => {
    it("routes to cloud without calling Ollama when complex task", async () => {
      const result = await router.route("Write code to sort an array");
      expect(result.decision.destination).toBe("cloud");
      expect(result.response).toBeUndefined();
      // Should not have called Ollama
      expect(mockedIsOllamaAvailable).not.toHaveBeenCalled();
    });

    it("routes to local when Ollama available and simple task", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithOllama.mockResolvedValueOnce({
        response: "Here is the summary...",
        model: "qwen2.5:3b",
        durationMs: 100,
      });

      const result = await router.route("Summarize this text");
      expect(result.decision.destination).toBe("local");
      expect(result.response).toBe("Here is the summary...");
      expect(result.durationMs).toBe(100);
    });

    it("falls back to cloud when Ollama unavailable", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(false);

      const result = await router.route("Summarize this text");
      expect(result.decision.destination).toBe("cloud");
      expect(result.decision.reason).toContain("Ollama unavailable");
      expect(result.response).toBeUndefined();
    });

    it("falls back to cloud when local generation fails", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithOllama.mockRejectedValueOnce(new Error("Generation error"));

      const result = await router.route("Summarize this text");
      expect(result.decision.destination).toBe("cloud");
      expect(result.decision.reason).toContain("local generation failed");
      expect(result.response).toBeUndefined();
    });
  });

  describe("constructor options", () => {
    it("uses custom ollama URL", async () => {
      const customRouter = new TaskRouter({ ollamaUrl: "http://custom:8080" });
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);

      await customRouter.isLocalAvailable();
      expect(mockedIsOllamaAvailable).toHaveBeenCalledWith("http://custom:8080");
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

      mockedIsOllamaAvailable.mockResolvedValueOnce(false);

      await debugRouter.route("Summarize this");

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c.includes("[TaskRouter]"))).toBe(true);

      consoleSpy.mockRestore();
    });

    it("does not log when debug disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const normalRouter = new TaskRouter({ debug: false });

      mockedIsOllamaAvailable.mockResolvedValueOnce(false);

      await normalRouter.route("Summarize this");

      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c?.includes?.("[TaskRouter]"))).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("routeThreeTier method", () => {
    it("routes complex task to quality tier", async () => {
      const result = await router.routeThreeTier("Write code to sort an array");
      expect(result.decision.tier).toBe("quality");
      expect(result.actualTier).toBe("quality");
      expect(result.response).toBeUndefined();
      // Should not try local or cheap tiers
      expect(mockedIsOllamaAvailable).not.toHaveBeenCalled();
      expect(mockedIsMinimaxAvailable).not.toHaveBeenCalled();
    });

    it("routes simple task to local tier when Ollama available", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithOllama.mockResolvedValueOnce({
        response: "Summary result",
        model: "qwen2.5:3b",
        durationMs: 50,
      });

      const result = await router.routeThreeTier("Summarize this text");
      expect(result.decision.tier).toBe("local");
      expect(result.actualTier).toBe("local");
      expect(result.response).toBe("Summary result");
      expect(result.durationMs).toBe(50);
    });

    it("routes medium task to cheap tier when MiniMax available", async () => {
      mockedIsMinimaxAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithMinimax.mockResolvedValueOnce({
        response: "Comparison result",
        model: "minimax-m2",
        durationMs: 200,
        usage: { promptTokens: 10, completionTokens: 50 },
      });

      const result = await router.routeThreeTier("Compare these two approaches");
      expect(result.decision.tier).toBe("cheap");
      expect(result.actualTier).toBe("cheap");
      expect(result.response).toBe("Comparison result");
      expect(result.durationMs).toBe(200);
    });

    it("falls back from local to cheap when Ollama unavailable", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(false);
      mockedIsMinimaxAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithMinimax.mockResolvedValueOnce({
        response: "MiniMax summary",
        model: "minimax-m2",
        durationMs: 150,
        usage: { promptTokens: 5, completionTokens: 30 },
      });

      const result = await router.routeThreeTier("Summarize this");
      expect(result.decision.tier).toBe("local");
      expect(result.actualTier).toBe("cheap");
      expect(result.response).toBe("MiniMax summary");
    });

    it("falls back from local to cheap when Ollama generation fails", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithOllama.mockRejectedValueOnce(new Error("Ollama error"));
      mockedIsMinimaxAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithMinimax.mockResolvedValueOnce({
        response: "MiniMax fallback",
        model: "minimax-m2",
        durationMs: 180,
        usage: { promptTokens: 8, completionTokens: 40 },
      });

      const result = await router.routeThreeTier("Summarize this");
      expect(result.decision.tier).toBe("local");
      expect(result.actualTier).toBe("cheap");
      expect(result.response).toBe("MiniMax fallback");
    });

    it("falls back from cheap to quality when MiniMax unavailable", async () => {
      mockedIsMinimaxAvailable.mockResolvedValueOnce(false);

      const result = await router.routeThreeTier("Compare these two approaches");
      expect(result.decision.tier).toBe("cheap");
      expect(result.actualTier).toBe("quality");
      expect(result.response).toBeUndefined();
    });

    it("falls back from cheap to quality when MiniMax generation fails", async () => {
      mockedIsMinimaxAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithMinimax.mockRejectedValueOnce(new Error("MiniMax error"));

      const result = await router.routeThreeTier("Compare these two approaches");
      expect(result.decision.tier).toBe("cheap");
      expect(result.actualTier).toBe("quality");
      expect(result.response).toBeUndefined();
    });

    it("falls back from local to quality when both Ollama and MiniMax unavailable", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(false);
      mockedIsMinimaxAvailable.mockResolvedValueOnce(false);

      const result = await router.routeThreeTier("Summarize this");
      expect(result.decision.tier).toBe("local");
      expect(result.actualTier).toBe("quality");
      expect(result.response).toBeUndefined();
    });

    it("logs debug messages when debug enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const debugRouter = new TaskRouter({ debug: true });

      mockedIsMinimaxAvailable.mockResolvedValueOnce(false);

      await debugRouter.routeThreeTier("Compare these two approaches");

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c.includes("Three-tier decision"))).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
