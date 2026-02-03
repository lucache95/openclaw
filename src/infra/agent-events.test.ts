import { afterEach, describe, expect, test } from "vitest";
import {
  clearAgentRunContext,
  emitAgentEvent,
  getAgentRunContext,
  onAgentEvent,
  registerAgentRunContext,
  resetAgentRunContextForTest,
  type AgentEventPayload,
} from "./agent-events.js";

describe("agent-events sequencing", () => {
  test("stores and clears run context", async () => {
    resetAgentRunContextForTest();
    registerAgentRunContext("run-1", { sessionKey: "main" });
    expect(getAgentRunContext("run-1")?.sessionKey).toBe("main");
    clearAgentRunContext("run-1");
    expect(getAgentRunContext("run-1")).toBeUndefined();
  });

  test("maintains monotonic seq per runId", async () => {
    const seen: Record<string, number[]> = {};
    const stop = onAgentEvent((evt) => {
      const list = seen[evt.runId] ?? [];
      seen[evt.runId] = list;
      list.push(evt.seq);
    });

    emitAgentEvent({ runId: "run-1", stream: "lifecycle", data: {} });
    emitAgentEvent({ runId: "run-1", stream: "lifecycle", data: {} });
    emitAgentEvent({ runId: "run-2", stream: "lifecycle", data: {} });
    emitAgentEvent({ runId: "run-1", stream: "lifecycle", data: {} });

    stop();

    expect(seen["run-1"]).toEqual([1, 2, 3]);
    expect(seen["run-2"]).toEqual([1]);
  });

  test("preserves compaction ordering on the event bus", async () => {
    const phases: Array<string> = [];
    const stop = onAgentEvent((evt) => {
      if (evt.runId !== "run-1") {
        return;
      }
      if (evt.stream !== "compaction") {
        return;
      }
      if (typeof evt.data?.phase === "string") {
        phases.push(evt.data.phase);
      }
    });

    emitAgentEvent({ runId: "run-1", stream: "compaction", data: { phase: "start" } });
    emitAgentEvent({
      runId: "run-1",
      stream: "compaction",
      data: { phase: "end", willRetry: false },
    });

    stop();

    expect(phases).toEqual(["start", "end"]);
  });
});

describe("agent-events spawnedBy context", () => {
  afterEach(() => {
    resetAgentRunContextForTest();
  });

  test("registers spawnedBy in run context", () => {
    registerAgentRunContext("spawn-1", {
      sessionKey: "agent:coder:subagent:abc",
      spawnedBy: "agent:ethos:main",
    });
    const ctx = getAgentRunContext("spawn-1");
    expect(ctx?.spawnedBy).toBe("agent:ethos:main");
    expect(ctx?.sessionKey).toBe("agent:coder:subagent:abc");
  });

  test("preserves spawnedBy when updating existing context", () => {
    registerAgentRunContext("spawn-2", {
      sessionKey: "agent:gsd:subagent:xyz",
      spawnedBy: "agent:ethos:main",
    });
    // Update with no spawnedBy -- should keep original
    registerAgentRunContext("spawn-2", {
      sessionKey: "agent:gsd:subagent:xyz",
    });
    const ctx = getAgentRunContext("spawn-2");
    expect(ctx?.spawnedBy).toBe("agent:ethos:main");
  });

  test("emits lifecycle event with session key from context", () => {
    const events: AgentEventPayload[] = [];
    const unsub = onAgentEvent((evt) => events.push(evt));
    registerAgentRunContext("spawn-3", {
      sessionKey: "agent:coder:subagent:def",
      spawnedBy: "agent:gsd:main",
    });
    emitAgentEvent({
      runId: "spawn-3",
      stream: "lifecycle",
      data: { phase: "start" },
    });
    unsub();
    expect(events).toHaveLength(1);
    expect(events[0].sessionKey).toBe("agent:coder:subagent:def");
    expect(events[0].stream).toBe("lifecycle");
    expect(events[0].data.phase).toBe("start");
  });

  test("clears context on clearAgentRunContext", () => {
    registerAgentRunContext("spawn-4", {
      sessionKey: "agent:qa:subagent:ghi",
      spawnedBy: "agent:gsd:main",
    });
    clearAgentRunContext("spawn-4");
    expect(getAgentRunContext("spawn-4")).toBeUndefined();
  });

  test("emits monotonically increasing sequence numbers per run", () => {
    const events: AgentEventPayload[] = [];
    const unsub = onAgentEvent((evt) => {
      if (evt.runId === "spawn-5") events.push(evt);
    });
    emitAgentEvent({ runId: "spawn-5", stream: "lifecycle", data: { phase: "start" } });
    emitAgentEvent({ runId: "spawn-5", stream: "assistant", data: { text: "hello" } });
    emitAgentEvent({ runId: "spawn-5", stream: "lifecycle", data: { phase: "end" } });
    unsub();
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3]);
  });
});
