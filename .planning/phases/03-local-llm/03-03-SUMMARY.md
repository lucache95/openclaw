---
phase: 03-local-llm
plan: 03
subsystem: agents
tags: [ollama, task-routing, llm, classification, local-inference, qwen]

# Dependency graph
requires:
  - phase: 03-01
    provides: Ollama installation with qwen2.5:3b model
provides:
  - Task routing logic for local vs cloud LLM selection
  - Ollama text generation client
  - Rule-based prompt classification
affects: [04-ollama-integration, agent-routing, cost-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns: [keyword-classification, fallback-routing, local-first-ai]

key-files:
  created:
    - src/agents/ollama-client.ts
    - src/agents/task-router.ts
    - src/agents/task-router.test.ts
  modified: []

key-decisions:
  - "Simple keywords: summarize, classify, format, extract, list, rewrite, translate"
  - "Complex indicators: step by step, write code, implement, debug, refactor"
  - "500 char threshold for prompt length classification"
  - "Conservative routing: complex indicators take precedence over simple keywords"
  - "Automatic fallback to cloud when Ollama unavailable or fails"

patterns-established:
  - "Task routing: classify before generating, route simple to local"
  - "Graceful degradation: fall back to cloud on any local failure"
  - "Confidence levels: high/medium/low for routing decisions"

# Metrics
duration: 7min
completed: 2026-02-02
---

# Phase 3 Plan 3: Task Routing Summary

**Rule-based task router that classifies prompts and routes simple tasks (summarize, classify, format) to local Ollama while preserving Claude for complex reasoning (write code, step by step, debug)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-02T04:14:03Z
- **Completed:** 2026-02-02T04:20:46Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created Ollama text generation client with streaming and non-streaming modes
- Implemented task router with rule-based classification
- Comprehensive test suite with 33 tests and 93%+ coverage
- Graceful fallback to cloud when Ollama unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Ollama text generation client** - `a3f0c40` (feat)
2. **Task 2: Implement task routing logic** - `66b626a` (feat)
3. **Task 3: Add task router tests** - `b4cc237` (test)

## Files Created/Modified

- `src/agents/ollama-client.ts` - Ollama API client for text generation
- `src/agents/task-router.ts` - Task routing logic with classification
- `src/agents/task-router.test.ts` - Comprehensive test suite

## Decisions Made

1. **Keyword-based classification:** Used predefined keyword sets rather than ML-based classification for predictability and zero latency
2. **Conservative routing:** When mixed signals present (e.g., "summarize step by step"), route to cloud to preserve quality
3. **500 char threshold:** Short prompts are more likely to be simple tasks; this threshold provides good balance
4. **Confidence levels:** Added high/medium/low confidence to routing decisions for future analytics

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly.

## User Setup Required

None - Ollama was already installed in Phase 03-01. The task router is ready to use.

## Routing Rules Summary

| Prompt Characteristics | Destination | Confidence |
|----------------------|-------------|------------|
| Short + simple keyword | local | high |
| Short + no keywords | local | medium |
| Long + simple keyword | local | low |
| Any + complex indicator | cloud | high |
| Long + no simple keywords | cloud | medium |
| Ollama unavailable | cloud | fallback |

## Next Phase Readiness

- Task router ready for integration into agent pipeline
- Ollama client can be used for embeddings integration
- Ready for Phase 04: Full Ollama Integration

---
*Phase: 03-local-llm*
*Completed: 2026-02-02*
