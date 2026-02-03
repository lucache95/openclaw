---
phase: 27-conversation-view
plan: 01
subsystem: ui
tags: [lit-signals, conversation, streaming, agent-events]

# Dependency graph
requires:
  - phase: 26-agents-tab
    provides: "agentSessions/agentCosts signals, AgentsController, updateSessionFromEvent"
provides:
  - "sessionConversations signal (per-session message history)"
  - "sessionStreams signal (active streaming text per session)"
  - "Conversation mutator functions (push/set/clear/finalize)"
  - "AgentsController conversation capture from assistant/lifecycle events"
affects: [27-02 conversation-view UI rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immutable Map update pattern for conversation signals"
    - "Stream finalization pattern: active stream -> completed message on lifecycle.end"
    - "500-message cap with slice(-N) for bounded memory"

key-files:
  created: []
  modified:
    - "ui/src/ui/state/metrics.ts"
    - "ui/src/ui/controllers/agents-controller.ts"

key-decisions:
  - "ConversationMessage role union: assistant | system | tool (extensible for future tool output display)"
  - "500-message cap keeps most recent messages via slice(-500)"
  - "assistant stream data.text is full accumulated text, replaced each event (not delta-appended)"

patterns-established:
  - "finalizeSessionStream: atomic move from active stream to completed conversation message"
  - "Conversation capture runs after updateSessionFromEvent in same handleEvent call"

# Metrics
duration: 2min
completed: 2026-02-03
---

# Phase 27 Plan 01: Conversation Data Layer Summary

**Per-session conversation signals with 500-msg cap, stream finalization on lifecycle.end, and AgentsController event capture**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-03T21:52:12Z
- **Completed:** 2026-02-03T21:53:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ConversationMessage type and two new signals (sessionConversations, sessionStreams) added to metrics.ts
- Four mutator functions for conversation state management with 500-message memory bound
- AgentsController.handleEvent extended to route assistant stream events and lifecycle finalization to conversation state
- resetMetrics() clears all 4 signal maps for clean teardown

## Task Commits

Each task was committed atomically:

1. **Task 1: Add per-session conversation signals and mutators** - `eec3b8680` (feat)
2. **Task 2: Extend AgentsController.handleEvent to capture conversation data** - `369e1278d` (feat)

## Files Created/Modified
- `ui/src/ui/state/metrics.ts` - ConversationMessage type, sessionConversations/sessionStreams signals, 4 mutator functions, updated resetMetrics
- `ui/src/ui/controllers/agents-controller.ts` - Extended handleEvent with conversation capture for assistant and lifecycle streams

## Decisions Made
- None - followed plan as specified

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Conversation data layer complete, ready for Plan 02 UI rendering
- sessionConversations and sessionStreams signals are populated from live gateway events
- No blockers for conversation view component implementation

---
*Phase: 27-conversation-view*
*Completed: 2026-02-03*
