---
phase: 03-local-llm
verified: 2026-02-01T20:30:00Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "Simple tasks route to Ollama instead of Claude"
    status: failed
    reason: "Task routing components exist but are not integrated into agent execution pipeline"
    artifacts:
      - path: "src/agents/task-router.ts"
        issue: "Not imported or used by agent runner or main agent command"
      - path: "src/agents/ollama-client.ts"
        issue: "Not imported or used by agent runner or main agent command"
    missing:
      - "Integration of TaskRouter into agent message handling flow"
      - "Route classification before sending prompts to LLM provider"
      - "Fallback logic from Ollama to Claude on failure"
  - truth: "OpenClaw memory search uses local embeddings when Ollama available"
    status: partial
    reason: "Ollama embeddings provider exists and is wired into memory manager, but auto-selection priority needs verification"
    artifacts:
      - path: "src/memory/embeddings-ollama.ts"
        issue: "Auto-selection priority: Ollama > node-llama-cpp > openai > gemini (line 172-180 in embeddings.ts)"
    missing:
      - "Runtime verification that memory search actually uses Ollama when available"
      - "Config documentation for enabling Ollama embeddings"
---

# Phase 03: Local LLM Verification Report

**Phase Goal:** Offload simple tasks to free local inference, reducing Claude Max usage
**Verified:** 2026-02-01T20:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                        | Status     | Evidence                                                                 |
| --- | ---------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------ |
| 1   | Ollama runs natively on macOS with Metal GPU acceleration                    | ✓ VERIFIED | ollama version 0.15.4, GPU at 100%                                       |
| 2   | qwen2.5:3b model responds to prompts within 2 seconds                        | ✓ VERIFIED | API responds successfully, model loaded                                  |
| 3   | nomic-embed-text generates embeddings for memory search                      | ✓ VERIFIED | Returns 768-dim vectors via API                                          |
| 4   | OpenClaw memory search uses local embeddings when Ollama available           | ⚠️ PARTIAL | Provider exists and wired, but auto-selection needs runtime verification |
| 5   | Simple tasks (summarize, classify, format) route to Ollama instead of Claude | ✗ FAILED   | Task router not integrated into agent pipeline                           |

**Score:** 3/5 truths verified (2 partial/failed)

### Required Artifacts

| Artifact                          | Expected                    | Status        | Details                                      |
| --------------------------------- | --------------------------- | ------------- | -------------------------------------------- |
| `src/memory/embeddings-ollama.ts` | Ollama embedding provider   | ✓ SUBSTANTIVE | 154 lines, full implementation               |
| `src/agents/ollama-client.ts`     | Text generation client      | ✓ SUBSTANTIVE | 323 lines, streaming + non-streaming         |
| `src/agents/task-router.ts`       | Task routing logic          | ✓ SUBSTANTIVE | 273 lines, classification + routing          |
| Agent integration                 | Router used in agent runner | ✗ ORPHANED    | Task router exists but not imported/used     |
| Memory integration                | Ollama used for embeddings  | ✓ WIRED       | Integrated into embeddings.ts auto-selection |

### Key Link Verification

| From            | To                   | Via                           | Status      | Details                                             |
| --------------- | -------------------- | ----------------------------- | ----------- | --------------------------------------------------- |
| embeddings.ts   | embeddings-ollama.ts | createOllamaEmbeddingProvider | ✓ WIRED     | Import and call present (line 8-9, 157)             |
| manager.ts      | embeddings.ts        | createEmbeddingProvider       | ✓ WIRED     | Memory manager uses provider factory (line 191-199) |
| task-router.ts  | ollama-client.ts     | generateWithOllama            | ✓ WIRED     | Router calls Ollama for local generation (line 228) |
| agent-runner.ts | task-router.ts       | TaskRouter                    | ✗ NOT_WIRED | No import or usage in agent execution path          |
| agent.ts        | task-router.ts       | TaskRouter                    | ✗ NOT_WIRED | No import or usage in CLI agent command             |

### Requirements Coverage

| Requirement                             | Status      | Blocking Issue                  |
| --------------------------------------- | ----------- | ------------------------------- |
| LLM-01: Install Ollama natively         | ✓ SATISFIED | Ollama 0.15.4 running           |
| LLM-02: Pull qwen2.5:3b model           | ✓ SATISFIED | Model loaded (1.9GB)            |
| LLM-03: Set up nomic-embed-text         | ✓ SATISFIED | Model loaded (274MB)            |
| LLM-04: Configure vector memory storage | ✓ SATISFIED | sqlite-vec + Ollama embeddings  |
| LLM-05: Implement task routing          | ✗ BLOCKED   | Router built but not integrated |

### Anti-Patterns Found

| File                        | Line | Pattern         | Severity   | Impact                                 |
| --------------------------- | ---- | --------------- | ---------- | -------------------------------------- |
| src/agents/task-router.ts   | N/A  | Orphaned module | 🛑 Blocker | Router never called, goal not achieved |
| src/agents/ollama-client.ts | N/A  | Orphaned module | 🛑 Blocker | Client never called by production code |

### Gaps Summary

**Critical Gap: Task routing not integrated**

The phase built all the infrastructure pieces:

- ✓ Ollama installed with qwen2.5:3b and nomic-embed-text models
- ✓ OllamaClient class for text generation (streaming + non-streaming)
- ✓ TaskRouter class for prompt classification and routing
- ✓ OllamaEmbeddingProvider integrated into memory system

But the **core goal is not achieved**: simple tasks do not route to Ollama because:

1. **No integration point:** Agent runner (`src/auto-reply/reply/agent-runner.ts`) does not import or use TaskRouter
2. **No routing decision:** Before sending prompts to Claude, there's no classification step
3. **No local execution:** OllamaClient is never called from production code paths

**What works:**

- Memory search CAN use Ollama embeddings (when provider=auto or provider=ollama)
- Manual testing of OllamaClient works
- Task classification logic works (tested in task-router.test.ts)

**What's missing:**

- Integration into agent message handling flow
- Routing decision before LLM provider selection
- Cost tracking for local vs cloud usage
- Config options for enabling/disabling task routing

**Impact:**

- Phase goal "reduce Claude Max usage" is NOT achieved
- All tasks still go to Claude (no cost savings)
- Local LLM infrastructure is idle

---

_Verified: 2026-02-01T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
