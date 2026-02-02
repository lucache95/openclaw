import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isMinimaxAvailable, generateWithMinimax } from "./minimax-client.js";
import { isOllamaAvailable, generateWithOllama } from "./ollama-client.js";
import {
  classifyTask,
  classifyTaskThreeTier,
  TaskRouter,
  TEXT_TRANSFORM_PATTERNS,
  TOOL_SIGNAL_PATTERNS,
  MEDIUM_TRANSFORM_PATTERNS,
} from "./task-router.js";

vi.mock("./ollama-client.js");
vi.mock("./minimax-client.js");

describe("classifyTask (legacy two-tier)", () => {
  // Note: classifyTask is kept for backward compatibility but uses the old keyword approach
  describe("simple keyword detection", () => {
    it("routes short prompt with 'summarize' to local", () => {
      const result = classifyTask("Please summarize this text");
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("high");
    });

    it("routes short prompt with 'translate' to local", () => {
      const result = classifyTask("Translate this to Spanish");
      expect(result.destination).toBe("local");
      expect(result.confidence).toBe("high");
    });
  });

  describe("complex indicator detection", () => {
    it("routes prompt with 'step by step' to cloud", () => {
      const result = classifyTask("Explain this step by step");
      expect(result.destination).toBe("cloud");
      expect(result.confidence).toBe("high");
    });
  });
});

describe("classifyTaskThreeTier (new whitelist approach)", () => {
  describe("tool signals always route to quality", () => {
    it("routes queries about user data to quality", () => {
      const result = classifyTaskThreeTier("What are my cron jobs?");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes action verbs to quality", () => {
      const result = classifyTaskThreeTier("Send a message to Bob");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes channel names to quality", () => {
      const result = classifyTaskThreeTier("Post this on telegram");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes questions about state to quality", () => {
      const result = classifyTaskThreeTier("What files do we have?");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes conversational greetings to quality", () => {
      const result = classifyTaskThreeTier("Hey, can you help me?");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes time-sensitive queries to quality", () => {
      const result = classifyTaskThreeTier("What happened today?");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes possessive queries to quality", () => {
      const result = classifyTaskThreeTier("Check my calendar");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes file references to quality", () => {
      const result = classifyTaskThreeTier("Read the file and tell me what's in it");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });
  });

  describe("pure text transforms with inline content route to local", () => {
    it("routes translate with inline content to local", () => {
      const result = classifyTaskThreeTier(
        "Translate this to Spanish: Hello, how are you today? I hope you're having a great day!",
      );
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("translate");
    });

    it("routes summarize with inline content to local", () => {
      const result = classifyTaskThreeTier(
        "Summarize this: The quick brown fox jumps over the lazy dog. This is a test sentence with enough content.",
      );
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("summarize");
    });

    it("routes rewrite with inline content to local", () => {
      const result = classifyTaskThreeTier(
        "Rewrite this more formally: hey whats up, just wanted to check in and see how things are going!",
      );
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("rewrite");
    });

    it("routes format with inline content to local", () => {
      const result = classifyTaskThreeTier(
        "Format this as JSON: name John, age 30, city New York, occupation Software Engineer",
      );
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("format");
    });

    it("routes convert to local", () => {
      const result = classifyTaskThreeTier(
        "Convert these units: 100 kilometers to miles, 50 fahrenheit to celsius, 200 pounds to kilograms.",
      );
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("convert");
    });

    it("routes extract with inline content to local", () => {
      const result = classifyTaskThreeTier(
        "Extract the emails from: Contact john@example.com or jane@test.org for more information.",
      );
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("extract");
    });

    it("routes fix spelling/grammar to local", () => {
      const result = classifyTaskThreeTier(
        "Fix the grammar in this text: Their going to the store and there car is parked over they're.",
      );
      expect(result.tier).toBe("local");
      expect(result.reason).toContain("proofread");
    });
  });

  describe("medium complexity transforms route to cheap", () => {
    it("routes compare with inline content to cheap", () => {
      const result = classifyTaskThreeTier(
        "Compare these two approaches: Method A uses iteration while Method B uses recursion. Both have their trade-offs.",
      );
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("compare");
    });

    it("routes analyze with inline content to cheap", () => {
      const result = classifyTaskThreeTier(
        "Analyze this data: Sales Q1: $10k, Q2: $15k, Q3: $12k, Q4: $20k. Revenue grew consistently.",
      );
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("analyze");
    });

    it("routes explain with inline content to cheap", () => {
      const result = classifyTaskThreeTier(
        "Explain this: The Pythagorean theorem states that a² + b² = c² for right triangles. This is fundamental in geometry.",
      );
      expect(result.tier).toBe("cheap");
      expect(result.reason).toContain("explain");
    });
  });

  describe("ambiguous or unknown requests default to quality", () => {
    it("routes general questions to quality", () => {
      const result = classifyTaskThreeTier("Tell me about the weather");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("No clear text transform");
    });

    it("routes complex reasoning to quality", () => {
      const result = classifyTaskThreeTier("Why is the sky blue?");
      expect(result.tier).toBe("quality");
    });

    it("routes short prompts without patterns to quality", () => {
      const result = classifyTaskThreeTier("Hello");
      expect(result.tier).toBe("quality");
    });
  });

  describe("tool signals take precedence over transform patterns", () => {
    it("routes summarize + file reference to quality", () => {
      const result = classifyTaskThreeTier("Summarize the file I uploaded");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });

    it("routes translate + check action to quality", () => {
      const result = classifyTaskThreeTier("Translate and check my document");
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Tool signal");
    });
  });

  describe("inline content requirement", () => {
    it("requires substantial content after colon", () => {
      // Too short after colon
      const result = classifyTaskThreeTier("Translate this: hi");
      expect(result.tier).toBe("quality");
    });

    it("accepts content in quotes as inline", () => {
      const result = classifyTaskThreeTier('Translate "Hello, how are you doing today my friend?"');
      expect(result.tier).toBe("local");
    });
  });
});

describe("pattern exports", () => {
  it("exports TEXT_TRANSFORM_PATTERNS as array of pattern objects", () => {
    expect(Array.isArray(TEXT_TRANSFORM_PATTERNS)).toBe(true);
    expect(TEXT_TRANSFORM_PATTERNS.length).toBeGreaterThan(0);
    expect(TEXT_TRANSFORM_PATTERNS[0]).toHaveProperty("pattern");
    expect(TEXT_TRANSFORM_PATTERNS[0]).toHaveProperty("name");
  });

  it("exports TOOL_SIGNAL_PATTERNS as array of RegExp", () => {
    expect(Array.isArray(TOOL_SIGNAL_PATTERNS)).toBe(true);
    expect(TOOL_SIGNAL_PATTERNS.length).toBeGreaterThan(0);
    expect(TOOL_SIGNAL_PATTERNS[0]).toBeInstanceOf(RegExp);
  });

  it("exports MEDIUM_TRANSFORM_PATTERNS as array of pattern objects", () => {
    expect(Array.isArray(MEDIUM_TRANSFORM_PATTERNS)).toBe(true);
    expect(MEDIUM_TRANSFORM_PATTERNS.length).toBeGreaterThan(0);
    expect(MEDIUM_TRANSFORM_PATTERNS[0]).toHaveProperty("pattern");
    expect(MEDIUM_TRANSFORM_PATTERNS[0]).toHaveProperty("name");
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
      const result = router.classify("Summarize this text");
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

  describe("route method (two-tier)", () => {
    it("routes to cloud without calling Ollama when complex task", async () => {
      const result = await router.route("Write code to sort an array");
      expect(result.decision.destination).toBe("cloud");
      expect(result.response).toBeUndefined();
    });

    it("routes simple task and generates response when Ollama available", async () => {
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
    });

    it("falls back to cloud when local generation fails", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithOllama.mockRejectedValueOnce(new Error("Generation error"));

      const result = await router.route("Summarize this text");
      expect(result.decision.destination).toBe("cloud");
      expect(result.decision.reason).toContain("local generation failed");
    });
  });

  describe("routeThreeTier method", () => {
    it("routes tool-requiring task to quality tier", async () => {
      const result = await router.routeThreeTier("What cron jobs do we have?");
      expect(result.decision.tier).toBe("quality");
      expect(result.actualTier).toBe("quality");
      expect(result.response).toBeUndefined();
      // Should not try local or cheap tiers
      expect(mockedIsOllamaAvailable).not.toHaveBeenCalled();
      expect(mockedIsMinimaxAvailable).not.toHaveBeenCalled();
    });

    it("routes pure text transform to local tier when Ollama available", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithOllama.mockResolvedValueOnce({
        response: "Translated result",
        model: "qwen2.5:3b",
        durationMs: 50,
      });

      const result = await router.routeThreeTier(
        "Translate this to French: Hello, how are you today? I hope everything is going well.",
      );
      expect(result.decision.tier).toBe("local");
      expect(result.actualTier).toBe("local");
      expect(result.response).toBe("Translated result");
    });

    it("routes medium task to cheap tier when MiniMax available", async () => {
      mockedIsMinimaxAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithMinimax.mockResolvedValueOnce({
        response: "Comparison result",
        model: "minimax-m2",
        durationMs: 200,
        usage: { promptTokens: 10, completionTokens: 50 },
      });

      const result = await router.routeThreeTier(
        "Compare these two: Option A is faster but uses more memory. Option B is slower but memory efficient.",
      );
      expect(result.decision.tier).toBe("cheap");
      expect(result.actualTier).toBe("cheap");
      expect(result.response).toBe("Comparison result");
    });

    it("falls back from local to cheap when Ollama unavailable", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(false);
      mockedIsMinimaxAvailable.mockResolvedValueOnce(true);
      mockedGenerateWithMinimax.mockResolvedValueOnce({
        response: "MiniMax translation",
        model: "minimax-m2",
        durationMs: 150,
        usage: { promptTokens: 5, completionTokens: 30 },
      });

      const result = await router.routeThreeTier(
        "Translate this to Spanish: Good morning, I would like to order breakfast please.",
      );
      expect(result.decision.tier).toBe("local");
      expect(result.actualTier).toBe("cheap");
      expect(result.response).toBe("MiniMax translation");
    });

    it("falls back from local to quality when both tiers unavailable", async () => {
      mockedIsOllamaAvailable.mockResolvedValueOnce(false);
      mockedIsMinimaxAvailable.mockResolvedValueOnce(false);

      const result = await router.routeThreeTier(
        "Translate this to German: The weather is beautiful today and I want to go outside.",
      );
      expect(result.decision.tier).toBe("local");
      expect(result.actualTier).toBe("quality");
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
  });

  describe("debug logging", () => {
    it("logs when debug enabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const debugRouter = new TaskRouter({ debug: true });

      mockedIsMinimaxAvailable.mockResolvedValueOnce(false);

      await debugRouter.routeThreeTier("Compare these: A and B have different features.");

      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c?.includes?.("[TaskRouter]"))).toBe(true);

      consoleSpy.mockRestore();
    });

    it("does not log when debug disabled", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const normalRouter = new TaskRouter({ debug: false });

      mockedIsMinimaxAvailable.mockResolvedValueOnce(false);

      await normalRouter.routeThreeTier("Compare these: X versus Y in performance terms.");

      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c?.includes?.("[TaskRouter]"))).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
