import * as childProcess from "child_process";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getMinimaxApiKey,
  isMinimaxAvailable,
  generateWithMinimax,
  MinimaxClient,
} from "./minimax-client.js";

// Mock child_process module
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("getMinimaxApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns key when Keychain has valid entry", () => {
    vi.mocked(childProcess.execSync).mockReturnValue("test-api-key-123\n");

    const result = getMinimaxApiKey();
    expect(result).toBe("test-api-key-123");
    expect(childProcess.execSync).toHaveBeenCalledWith(
      'security find-generic-password -a "clawd" -s "minimax-api-key" -w 2>/dev/null',
      expect.objectContaining({ encoding: "utf8" }),
    );
  });

  it("returns null when Keychain entry missing", () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error("security: SecKeychainSearchCopyNext: The specified item could not be found");
    });

    const result = getMinimaxApiKey();
    expect(result).toBeNull();
  });

  it("returns null on empty string response", () => {
    vi.mocked(childProcess.execSync).mockReturnValue("   \n");

    const result = getMinimaxApiKey();
    expect(result).toBeNull();
  });
});

describe("isMinimaxAvailable", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns false when no API key available", async () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error("not found");
    });

    const result = await isMinimaxAvailable();
    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns true when API responds successfully", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
    } as Response);

    const result = await isMinimaxAvailable("test-key");
    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.minimax.io/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer test-key" },
      }),
    );
  });

  it("returns false on network error", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("Network error"));

    const result = await isMinimaxAvailable("test-key");
    expect(result).toBe(false);
  });

  it("returns false on API error response (401)", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response);

    const result = await isMinimaxAvailable("invalid-key");
    expect(result).toBe(false);
  });

  it("uses custom base URL when provided", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
    } as Response);

    await isMinimaxAvailable("test-key", "https://custom.minimax.io/v1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://custom.minimax.io/v1/models",
      expect.any(Object),
    );
  });
});

describe("generateWithMinimax", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws error when no API key available", async () => {
    vi.mocked(childProcess.execSync).mockImplementation(() => {
      throw new Error("not found");
    });

    await expect(generateWithMinimax({ prompt: "test" })).rejects.toThrow(
      "MiniMax API key not found",
    );
  });

  it("returns proper result structure on success", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "chatcmpl-123",
        object: "chat.completion",
        created: 1700000000,
        model: "minimax-m2",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "Test response" },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      }),
    } as Response);

    const result = await generateWithMinimax({ prompt: "Hello" }, "test-key");

    expect(result.response).toBe("Test response");
    expect(result.model).toBe("minimax-m2");
    expect(result.usage.promptTokens).toBe(10);
    expect(result.usage.completionTokens).toBe(5);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("clamps temperature to valid range (0.01 minimum)", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "minimax-m2",
        choices: [{ message: { content: "response" } }],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      }),
    } as Response);

    await generateWithMinimax({ prompt: "test", temperature: 0 }, "test-key");

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs?.[1]?.body as string);
    expect(body.temperature).toBe(0.01);
  });

  it("clamps temperature above 1.0 to 1.0", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "minimax-m2",
        choices: [{ message: { content: "response" } }],
        usage: { prompt_tokens: 0, completion_tokens: 0 },
      }),
    } as Response);

    await generateWithMinimax({ prompt: "test", temperature: 2.0 }, "test-key");

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs?.[1]?.body as string);
    expect(body.temperature).toBe(1.0);
  });

  it("includes usage stats in result", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "minimax-m2",
        choices: [{ message: { content: "test" } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      }),
    } as Response);

    const result = await generateWithMinimax({ prompt: "test" }, "test-key");

    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 50,
    });
  });

  it("handles missing usage in response", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "minimax-m2",
        choices: [{ message: { content: "test" } }],
      }),
    } as Response);

    const result = await generateWithMinimax({ prompt: "test" }, "test-key");

    expect(result.usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
    });
  });

  it("throws on API error response", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => "Bad Request: invalid model",
    } as Response);

    await expect(generateWithMinimax({ prompt: "test" }, "test-key")).rejects.toThrow(
      "MiniMax API error (400): Bad Request: invalid model",
    );
  });

  it("uses custom model when specified", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "minimax-m2.1",
        choices: [{ message: { content: "response" } }],
        usage: {},
      }),
    } as Response);

    await generateWithMinimax({ prompt: "test", model: "minimax-m2.1" }, "test-key");

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs?.[1]?.body as string);
    expect(body.model).toBe("minimax-m2.1");
  });

  it("includes max_tokens when specified", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        model: "minimax-m2",
        choices: [{ message: { content: "response" } }],
        usage: {},
      }),
    } as Response);

    await generateWithMinimax({ prompt: "test", maxTokens: 1000 }, "test-key");

    const callArgs = fetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs?.[1]?.body as string);
    expect(body.max_tokens).toBe(1000);
  });
});

describe("MinimaxClient", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("uses explicit apiKey when provided", () => {
      const client = new MinimaxClient({ apiKey: "explicit-key" });
      expect(client).toBeDefined();
      // Verify key is used by checking isAvailable behavior
    });

    it("retrieves key from Keychain when not provided", () => {
      vi.mocked(childProcess.execSync).mockReturnValue("keychain-key\n");

      const client = new MinimaxClient();
      expect(client).toBeDefined();
      expect(childProcess.execSync).toHaveBeenCalled();
    });

    it("accepts custom baseUrl", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true } as Response);

      const client = new MinimaxClient({
        apiKey: "test-key",
        baseUrl: "https://custom.api.io/v1",
      });
      await client.isAvailable();

      expect(fetchSpy).toHaveBeenCalledWith("https://custom.api.io/v1/models", expect.any(Object));
    });
  });

  describe("isAvailable", () => {
    it("delegates to isMinimaxAvailable", async () => {
      fetchSpy.mockResolvedValueOnce({ ok: true } as Response);

      const client = new MinimaxClient({ apiKey: "test-key" });
      const result = await client.isAvailable();

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/models"), expect.any(Object));
    });
  });

  describe("generate", () => {
    it("throws when no API key available", async () => {
      vi.mocked(childProcess.execSync).mockImplementation(() => {
        throw new Error("not found");
      });

      const client = new MinimaxClient();

      await expect(client.generate({ prompt: "test" })).rejects.toThrow(
        "MiniMax API key not found",
      );
    });

    it("delegates to generateWithMinimax with client config", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "minimax-m2",
          choices: [{ message: { content: "response" } }],
          usage: { prompt_tokens: 5, completion_tokens: 10 },
        }),
      } as Response);

      const client = new MinimaxClient({ apiKey: "test-key" });
      const result = await client.generate({ prompt: "Hello" });

      expect(result.response).toBe("response");
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.minimax.io/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("uses default model from constructor", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "custom-model",
          choices: [{ message: { content: "response" } }],
          usage: {},
        }),
      } as Response);

      const client = new MinimaxClient({
        apiKey: "test-key",
        model: "custom-model",
      });
      await client.generate({ prompt: "test" });

      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs?.[1]?.body as string);
      expect(body.model).toBe("custom-model");
    });

    it("allows overriding model per request", async () => {
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          model: "override-model",
          choices: [{ message: { content: "response" } }],
          usage: {},
        }),
      } as Response);

      const client = new MinimaxClient({
        apiKey: "test-key",
        model: "default-model",
      });
      await client.generate({ prompt: "test", model: "override-model" });

      const callArgs = fetchSpy.mock.calls[0];
      const body = JSON.parse(callArgs?.[1]?.body as string);
      expect(body.model).toBe("override-model");
    });
  });
});
