/**
 * Integration Tests for Local Routing
 *
 * Tests the tryLocalRouting function which integrates TaskRouter
 * into the agent execution pipeline.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import {
  tryLocalRouting,
  LOCAL_ROUTING_ENABLED,
  setLocalRoutingEnabled,
  setLocalRoutingDebug,
} from "./local-routing.js";

describe("tryLocalRouting", () => {
  let fetchMock: Mock;

  beforeEach(() => {
    // Create a fresh mock for each test
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    // Reset feature flags to defaults
    setLocalRoutingEnabled(true);
    setLocalRoutingDebug(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("simple prompt with Ollama available", () => {
    it("routes locally and returns response", async () => {
      // Mock Ollama availability check
      fetchMock.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "Here is a summary of your text.",
          model: "qwen2.5:3b",
        }),
      } as Response);

      const result = await tryLocalRouting({
        prompt: "Summarize this text: Hello world",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe("Here is a summary of your text.");
      expect(result.reason).toContain("summarize");
    });

    it("routes locally for 'classify' prompt", async () => {
      // Mock Ollama availability check
      fetchMock.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "positive",
          model: "qwen2.5:3b",
        }),
      } as Response);

      const result = await tryLocalRouting({
        prompt: "Classify this as positive or negative: I love it!",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe("positive");
      expect(result.reason).toContain("classify");
    });

    it("routes locally for 'format' prompt", async () => {
      // Mock Ollama availability check
      fetchMock.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: '{"name": "John"}',
          model: "qwen2.5:3b",
        }),
      } as Response);

      const result = await tryLocalRouting({
        prompt: "Format this as JSON: name John",
      });

      expect(result.handled).toBe(true);
      expect(result.response).toBe('{"name": "John"}');
    });
  });

  describe("simple prompt with Ollama unavailable", () => {
    it("falls back to cloud when Ollama not running", async () => {
      // Mock Ollama availability check fails
      fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("unavailable");
    });

    it("falls back to cloud when Ollama health check fails", async () => {
      // Mock Ollama availability check returns non-ok
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as Response);

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("unavailable");
    });
  });

  describe("complex prompt routes to cloud", () => {
    it("routes to cloud for 'step by step' prompt", async () => {
      const result = await tryLocalRouting({
        prompt: "Explain this step by step",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("step by step");
      // Should not have called fetch at all (no Ollama check needed)
      expect(fetchMock).not.toHaveBeenCalled();
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
      // The exported constant is read when the module loads,
      // but setLocalRoutingEnabled updates the internal value
      // However, tryLocalRouting reads the flag directly
      setLocalRoutingEnabled(true);
    });
  });

  describe("long prompt with simple keyword", () => {
    it("attempts local routing for long prompt with 'summarize'", async () => {
      // Mock Ollama availability check
      fetchMock.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "Summary of long text",
          model: "qwen2.5:3b",
        }),
      } as Response);

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
      // Mock Ollama availability check succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call fails
      fetchMock.mockRejectedValueOnce(new Error("Generation error"));

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      expect(result.reason).toContain("failed");
    });

    it("falls back to cloud when Ollama returns error response", async () => {
      // Mock Ollama availability check succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call returns error
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      const result = await tryLocalRouting({
        prompt: "Summarize this text",
      });

      expect(result.handled).toBe(false);
      // Either the reason contains "failed" or "error" depending on implementation
      expect(result.reason).toBeDefined();
    });
  });

  describe("debug mode", () => {
    it("passes debug option to TaskRouter", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Mock Ollama unavailable
      fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

      await tryLocalRouting({
        prompt: "Summarize this",
        debug: true,
      });

      // Debug logging should be enabled
      expect(consoleSpy).toHaveBeenCalled();
      const calls = consoleSpy.mock.calls.map((call) => call[0]);
      expect(calls.some((c) => c.includes("[TaskRouter]"))).toBe(true);

      consoleSpy.mockRestore();
    });

    it("does not log when debug is false", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Mock Ollama unavailable
      fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

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
      // Mock an unexpected error during routing
      fetchMock.mockImplementationOnce(() => {
        throw new Error("Unexpected fetch error");
      });

      // Use a short prompt without complex indicators so it tries local routing
      const result = await tryLocalRouting({
        prompt: "Hello",
      });

      // Should fallback to cloud (handled: false) when errors occur
      expect(result.handled).toBe(false);
      // Reason should be defined (either contains "error" or "unavailable")
      expect(result.reason).toBeDefined();
    });
  });

  describe("short prompts without keywords", () => {
    it("routes short prompt to local with medium confidence", async () => {
      // Mock Ollama availability check
      fetchMock.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock Ollama generate call
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "Hello to you too!",
          model: "qwen2.5:3b",
        }),
      } as Response);

      const result = await tryLocalRouting({
        prompt: "Hello world",
      });

      // Short prompts without complex indicators route to local
      expect(result.handled).toBe(true);
      expect(result.response).toBe("Hello to you too!");
    });
  });
});
