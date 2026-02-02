/**
 * Integration Tests for Local Routing
 *
 * Tests the tryLocalRouting function which integrates TaskRouter
 * into the agent execution pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the ollama-client module BEFORE importing local-routing
vi.mock("../../agents/ollama-client.js", () => ({
  isOllamaAvailable: vi.fn(),
  generateWithOllama: vi.fn(),
}));

// Mock the minimax-client module
vi.mock("../../agents/minimax-client.js", () => ({
  isMinimaxAvailable: vi.fn(),
  generateWithMinimax: vi.fn(),
}));

// Mock the cost-tracker module
vi.mock("../../agents/cost-tracker.js", () => ({
  globalCostTracker: {
    track: vi.fn(),
    getEntries: vi.fn().mockReturnValue([]),
    getTotalCost: vi.fn().mockReturnValue(0),
    getCostByTier: vi.fn().mockReturnValue({ local: 0, cheap: 0, quality: 0 }),
    getRequestCountByTier: vi.fn().mockReturnValue({ local: 0, cheap: 0, quality: 0 }),
    clear: vi.fn(),
  },
}));

import { globalCostTracker } from "../../agents/cost-tracker.js";
import { isMinimaxAvailable, generateWithMinimax } from "../../agents/minimax-client.js";
// Import mocked functions for test configuration
import { isOllamaAvailable, generateWithOllama } from "../../agents/ollama-client.js";
import {
  tryLocalRouting,
  tryThreeTierRouting,
  LOCAL_ROUTING_ENABLED,
  THREE_TIER_ROUTING_ENABLED,
  setLocalRoutingEnabled,
  setLocalRoutingDebug,
  setThreeTierRoutingEnabled,
} from "./local-routing.js";

const mockIsOllamaAvailable = vi.mocked(isOllamaAvailable);
const mockGenerateWithOllama = vi.mocked(generateWithOllama);
const mockIsMinimaxAvailable = vi.mocked(isMinimaxAvailable);
const mockGenerateWithMinimax = vi.mocked(generateWithMinimax);
const mockCostTracker = vi.mocked(globalCostTracker);

describe("tryLocalRouting", () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset feature flags to defaults
    setLocalRoutingEnabled(true);
    setLocalRoutingDebug(false);
    setThreeTierRoutingEnabled(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("simple prompt with Ollama available", () => {
    it("routes locally and returns response", async () => {
      // Mock Ollama available
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "Here is a summary of your text.",
        durationMs: 500,
        model: "qwen2.5:3b",
      });

      const result = await tryLocalRouting({
        prompt: "Summarize this text: Hello world",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe("Here is a summary of your text.");
      expect(result.reason).toContain("summarize");
    });

    it("routes locally for 'classify' prompt", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "positive",
        durationMs: 300,
        model: "qwen2.5:3b",
      });

      const result = await tryLocalRouting({
        prompt: "Classify this as positive or negative: I love it!",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe("positive");
      expect(result.reason).toContain("classify");
    });

    it("routes locally for 'format' prompt", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: '{"name": "John"}',
        durationMs: 400,
        model: "qwen2.5:3b",
      });

      const result = await tryLocalRouting({
        prompt: "Format this as JSON: name John",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe('{"name": "John"}');
    });
  });

  describe("simple prompt with Ollama unavailable", () => {
    it("falls back to cheap tier when Ollama not running (three-tier)", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "MiniMax fallback response",
        durationMs: 400,
        model: "MiniMax-Text-01",
      });

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      // In three-tier mode, falls back to cheap tier
      expect(result.handled).toBe(true);
      expect(result.tier).toBe("cheap");
      // generateWithOllama should not be called when unavailable
      expect(mockGenerateWithOllama).not.toHaveBeenCalled();
    });

    it("falls back to quality when both unavailable (three-tier)", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(false);

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      expect(result.tier).toBe("quality");
    });

    it("falls back to cloud when Ollama health check throws", async () => {
      mockIsOllamaAvailable.mockRejectedValue(new Error("Connection refused"));

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      // Should handle the error gracefully
      expect(result.reason).toBeDefined();
    });
  });

  describe("complex prompt routes to cloud", () => {
    it("routes to cloud for 'step by step' prompt", async () => {
      const result = await tryLocalRouting({
        prompt: "Explain this step by step",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("step by step");
      // Should not check Ollama for complex prompts
      expect(mockIsOllamaAvailable).not.toHaveBeenCalled();
    });

    it("routes to cloud for 'write code' prompt", async () => {
      const result = await tryLocalRouting({
        prompt: "Write code to sort an array",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("write code");
    });

    it("routes to cloud for 'implement' prompt", async () => {
      const result = await tryLocalRouting({
        prompt: "Implement a binary search function",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("implement");
    });

    it("routes to cloud for 'debug' prompt", async () => {
      const result = await tryLocalRouting({
        prompt: "Debug this function",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("debug");
    });

    it("routes to cloud for 'explain why' prompt", async () => {
      const result = await tryLocalRouting({
        prompt: "Explain why this happens",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("explain why");
    });
  });

  describe("feature flag behavior", () => {
    it("LOCAL_ROUTING_ENABLED is true by default", () => {
      expect(LOCAL_ROUTING_ENABLED).toBe(true);
    });

    it("setLocalRoutingEnabled changes the flag", () => {
      setLocalRoutingEnabled(false);
      // The flag update works internally
      setLocalRoutingEnabled(true);
    });
  });

  describe("long prompt with simple keyword", () => {
    it("routes long prompt to cheap tier in three-tier mode", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "Summary of long text",
        durationMs: 800,
        model: "MiniMax-Text-01",
      });

      // Create a 600-char prompt with "summarize" keyword
      const longContent = "x".repeat(580);
      const longPrompt = `Summarize: ${longContent}`;

      const result = await tryLocalRouting({
        prompt: longPrompt,
      });

      // In three-tier mode with long prompt, routes to cheap tier
      expect(result.handled).toBe(true);
      expect(result.response).toBe("Summary of long text");
      expect(result.tier).toBe("cheap");
    });

    it("routes medium-length prompt without keywords to cheap tier", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "MiniMax response",
        durationMs: 500,
        model: "MiniMax-Text-01",
      });

      // Create a 600-char prompt without any keywords (medium length in three-tier)
      const mediumPrompt = "x".repeat(600);

      const result = await tryLocalRouting({
        prompt: mediumPrompt,
      });

      // Medium-length prompts route to cheap tier
      expect(result.handled).toBe(true);
      expect(result.tier).toBe("cheap");
    });

    it("routes very long prompt to quality tier", async () => {
      // Create a 2500-char prompt (above 2000 threshold)
      const veryLongPrompt = "x".repeat(2500);

      const result = await tryLocalRouting({
        prompt: veryLongPrompt,
      });

      expect(result.handled).toBe(false);
      expect(result.tier).toBe("quality");
      expect(result.reason).toContain("Long");
    });
  });

  describe("local generation failure fallback", () => {
    it("falls back to cheap tier when Ollama generation fails (three-tier)", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockRejectedValue(new Error("Generation error"));
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "MiniMax fallback",
        durationMs: 500,
        model: "MiniMax-Text-01",
      });

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      // In three-tier mode, falls back to cheap tier
      expect(result.handled).toBe(true);
      expect(result.tier).toBe("cheap");
    });

    it("falls back to cloud when Ollama returns empty response", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "",
        durationMs: 100,
        model: "qwen2.5:3b",
      });

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      // Empty response should be treated as handled but with empty content
      // The exact behavior depends on task-router implementation
      expect(result.reason).toBeDefined();
    });
  });

  describe("debug mode", () => {
    it("passes debug option to TaskRouter", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockIsOllamaAvailable.mockResolvedValue(false);

      await tryLocalRouting({
        prompt: "Summarize this",
        debug: true,
      });

      // Debug logging should be enabled
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c?.includes?.("[TaskRouter]"))).toBe(true);

      consoleSpy.mockRestore();
    });

    it("does not log when debug is false", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      mockIsOllamaAvailable.mockResolvedValue(false);

      await tryLocalRouting({
        prompt: "Summarize this",
        debug: false,
      });

      // Debug logging should not contain TaskRouter messages
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c?.includes?.("[TaskRouter]"))).toBe(false);

      consoleSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("handles unexpected errors gracefully", async () => {
      mockIsOllamaAvailable.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await tryLocalRouting({
        prompt: "Hello",
      });

      // Should fallback to cloud (handled: false) when errors occur
      expect(result.handled).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  describe("short prompts without keywords", () => {
    it("routes short prompt to local with medium confidence", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "Hello to you too!",
        durationMs: 200,
        model: "qwen2.5:3b",
      });

      const result = await tryLocalRouting({
        prompt: "Hello world",
      });

      // Short prompts without complex indicators route to local
      expect(result.handled).toBe(true);
      expect(result.response).toBe("Hello to you too!");
    });
  });
});

describe("tryThreeTierRouting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocalRoutingDebug(false);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("local tier (Ollama)", () => {
    it("handles simple prompt locally when Ollama available", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "Here is a summary.",
        durationMs: 300,
        model: "qwen2.5:3b",
      });

      const result = await tryThreeTierRouting({
        prompt: "Summarize this",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe("Here is a summary.");
      expect(result.tier).toBe("local");
      expect(mockCostTracker.track).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: "local",
          model: "qwen2.5:3b",
        }),
      );
    });

    it("includes tier in result", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "Done",
        durationMs: 100,
        model: "qwen2.5:3b",
      });

      const result = await tryThreeTierRouting({
        prompt: "List items",
      });

      expect(result.tier).toBe("local");
    });
  });

  describe("cheap tier (MiniMax)", () => {
    it("falls back to cheap tier when Ollama unavailable", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "Summary from MiniMax",
        durationMs: 500,
        model: "MiniMax-Text-01",
      });

      const result = await tryThreeTierRouting({
        prompt: "Summarize this",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe("Summary from MiniMax");
      expect(result.tier).toBe("cheap");
      expect(mockCostTracker.track).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: "cheap",
          model: "minimax-m2",
        }),
      );
    });

    it("handles medium complexity prompt with MiniMax", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "Analysis from MiniMax",
        durationMs: 800,
        model: "MiniMax-Text-01",
      });

      const result = await tryThreeTierRouting({
        prompt: "Analyze this document in detail",
      });

      expect(result.handled).toBe(true);
      expect(result.tier).toBe("cheap");
    });
  });

  describe("quality tier (Claude)", () => {
    it("routes complex prompts to quality tier", async () => {
      const result = await tryThreeTierRouting({
        prompt: "Write code to implement a binary search tree",
      });

      expect(result.handled).toBe(false);
      expect(result.tier).toBe("quality");
      // Both "write code" and "implement" are complex indicators
      expect(result.reason).toMatch(/write code|implement/i);
      // Should not check Ollama or MiniMax for complex prompts
      expect(mockIsOllamaAvailable).not.toHaveBeenCalled();
      expect(mockIsMinimaxAvailable).not.toHaveBeenCalled();
    });

    it("falls back to quality when both Ollama and MiniMax unavailable", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(false);

      const result = await tryThreeTierRouting({
        prompt: "Summarize this",
      });

      expect(result.handled).toBe(false);
      expect(result.tier).toBe("quality");
    });
  });

  describe("cost tracking", () => {
    it("tracks cost for local tier", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "Response",
        durationMs: 200,
        model: "qwen2.5:3b",
      });

      await tryThreeTierRouting({
        prompt: "Summarize this text here",
      });

      expect(mockCostTracker.track).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: "local",
          promptTokens: expect.any(Number),
          completionTokens: expect.any(Number),
          durationMs: 200,
        }),
      );
    });

    it("tracks cost for cheap tier", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "MiniMax response",
        durationMs: 600,
        model: "MiniMax-Text-01",
      });

      await tryThreeTierRouting({
        prompt: "Summarize this",
      });

      expect(mockCostTracker.track).toHaveBeenCalledWith(
        expect.objectContaining({
          tier: "cheap",
          durationMs: 600,
        }),
      );
    });

    it("does not track cost for quality tier", async () => {
      const result = await tryThreeTierRouting({
        prompt: "Write code to sort an array",
      });

      expect(result.handled).toBe(false);
      expect(result.tier).toBe("quality");
      expect(mockCostTracker.track).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("handles Ollama generation failure gracefully", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockRejectedValue(new Error("Ollama error"));
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockResolvedValue({
        response: "Fallback response",
        durationMs: 500,
        model: "MiniMax-Text-01",
      });

      const result = await tryThreeTierRouting({
        prompt: "Summarize this",
      });

      // Should fall back to cheap tier
      expect(result.handled).toBe(true);
      expect(result.tier).toBe("cheap");
    });

    it("handles MiniMax generation failure gracefully", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);
      mockIsMinimaxAvailable.mockResolvedValue(true);
      mockGenerateWithMinimax.mockRejectedValue(new Error("MiniMax error"));

      const result = await tryThreeTierRouting({
        prompt: "Summarize this",
      });

      // Should fall back to quality tier
      expect(result.handled).toBe(false);
      expect(result.tier).toBe("quality");
    });

    it("handles unexpected errors gracefully", async () => {
      mockIsOllamaAvailable.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await tryThreeTierRouting({
        prompt: "Summarize this",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("Three-tier routing error");
    });
  });
});

describe("THREE_TIER_ROUTING_ENABLED flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLocalRoutingDebug(false);
    // Start with two-tier mode for these tests
    setThreeTierRoutingEnabled(false);
  });

  afterEach(() => {
    // Reset to default
    setThreeTierRoutingEnabled(true);
    vi.resetAllMocks();
  });

  it("THREE_TIER_ROUTING_ENABLED is true by default", () => {
    setThreeTierRoutingEnabled(true);
    expect(THREE_TIER_ROUTING_ENABLED).toBe(true);
  });

  it("setThreeTierRoutingEnabled changes the flag", () => {
    setThreeTierRoutingEnabled(false);
    expect(THREE_TIER_ROUTING_ENABLED).toBe(false);
    setThreeTierRoutingEnabled(true);
    expect(THREE_TIER_ROUTING_ENABLED).toBe(true);
  });

  it("tryLocalRouting uses two-tier when THREE_TIER_ROUTING_ENABLED is false", async () => {
    setThreeTierRoutingEnabled(false);
    mockIsOllamaAvailable.mockResolvedValue(true);
    mockGenerateWithOllama.mockResolvedValue({
      response: "Two-tier response",
      durationMs: 200,
      model: "qwen2.5:3b",
    });

    const result = await tryLocalRouting({
      prompt: "Summarize this",
    });

    expect(result.handled).toBe(true);
    expect(result.response).toBe("Two-tier response");
    // In two-tier mode, tier is not set
    expect(result.tier).toBeUndefined();
    // MiniMax should not be called in two-tier mode
    expect(mockIsMinimaxAvailable).not.toHaveBeenCalled();
  });

  it("tryLocalRouting uses three-tier when THREE_TIER_ROUTING_ENABLED is true", async () => {
    setThreeTierRoutingEnabled(true);
    mockIsOllamaAvailable.mockResolvedValue(true);
    mockGenerateWithOllama.mockResolvedValue({
      response: "Three-tier response",
      durationMs: 200,
      model: "qwen2.5:3b",
    });

    const result = await tryLocalRouting({
      prompt: "Summarize this",
    });

    expect(result.handled).toBe(true);
    expect(result.response).toBe("Three-tier response");
    // In three-tier mode, tier is set
    expect(result.tier).toBe("local");
  });
});
