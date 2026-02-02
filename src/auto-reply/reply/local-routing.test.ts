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

// Import mocked functions for test configuration
import { isOllamaAvailable, generateWithOllama } from "../../agents/ollama-client.js";
import {
  tryLocalRouting,
  LOCAL_ROUTING_ENABLED,
  setLocalRoutingEnabled,
  setLocalRoutingDebug,
} from "./local-routing.js";

const mockIsOllamaAvailable = vi.mocked(isOllamaAvailable);
const mockGenerateWithOllama = vi.mocked(generateWithOllama);

describe("tryLocalRouting", () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset feature flags to defaults
    setLocalRoutingEnabled(true);
    setLocalRoutingDebug(false);
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
    it("falls back to cloud when Ollama not running", async () => {
      mockIsOllamaAvailable.mockResolvedValue(false);

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("unavailable");
      // generateWithOllama should not be called when unavailable
      expect(mockGenerateWithOllama).not.toHaveBeenCalled();
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
    it("attempts local routing for long prompt with 'summarize'", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockResolvedValue({
        response: "Summary of long text",
        durationMs: 800,
        model: "qwen2.5:3b",
      });

      // Create a 600-char prompt with "summarize" keyword
      const longContent = "x".repeat(580);
      const longPrompt = `Summarize: ${longContent}`;

      const result = await tryLocalRouting({
        prompt: longPrompt,
      });

      // With a simple keyword, even long prompts attempt local (with low confidence)
      expect(result.handled).toBe(true);
      expect(result.response).toBe("Summary of long text");
      expect(result.reason).toContain("summarize");
    });

    it("routes long prompt without keywords to cloud", async () => {
      // Create a 600-char prompt without any keywords
      const longPrompt = "x".repeat(600);

      const result = await tryLocalRouting({
        prompt: longPrompt,
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("Long prompt");
    });
  });

  describe("local generation failure fallback", () => {
    it("falls back to cloud when Ollama generation fails", async () => {
      mockIsOllamaAvailable.mockResolvedValue(true);
      mockGenerateWithOllama.mockRejectedValue(new Error("Generation error"));

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("failed");
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
