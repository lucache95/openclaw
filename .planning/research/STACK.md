# Technology Stack — Agents Tab Wiring

**Project:** OpenClaw Gateway Dashboard — Agents Tab
**Researched:** 2026-02-03
**Confidence:** HIGH (based on actual codebase patterns)

## Executive Summary

The existing stack is complete. No new dependencies needed. The task is pure wiring: subscribe to existing gateway WebSocket events, map them to existing signals, and render existing components in a new tab.

**Key finding:** The gateway client already handles subscriptions via `onEvent` callback. Agent events flow through `handleGatewayEvent` → filter by event type → update component state. The signals layer (`@lit-labs/signals`) is already integrated with mutators (`updateSessionFromEvent`). The Agents tab just needs to register in navigation and render the v2.2 components with live signal data.

---

## Existing Stack (No Changes Needed)

### WebSocket Layer

| Technology           | Version | Purpose                                  | Integration Point                   |
| -------------------- | ------- | ---------------------------------------- | ----------------------------------- |
| GatewayBrowserClient | custom  | WebSocket connection with auto-reconnect | `ui/src/ui/gateway.ts` lines 67-341 |
| GatewayEventFrame    | type    | Typed event frames from gateway          | `ui/src/ui/gateway.ts` lines 12-18  |

**How it works:**

- `GatewayBrowserClient` constructor accepts `onEvent: (evt: GatewayEventFrame) => void` callback
- Gateway sends frames: `{ type: "event", event: "agent", payload: AgentEventPayload, seq: 123 }`
- `handleGatewayEvent` in `app-gateway.ts` routes by event name

### Event Subscription Pattern (Already Implemented)

**Current flow** (from `ui/src/ui/app-gateway.ts` lines 164-261):

```typescript
// In connectGateway (line 118):
host.client = new GatewayBrowserClient({
  onEvent: (evt) => handleGatewayEvent(host, evt),
  // ... other config
});

// In handleGatewayEvent (line 172):
function handleGatewayEventUnsafe(host: GatewayHost, evt: GatewayEventFrame) {
  // Buffer all events for debug tab
  host.eventLogBuffer = [
    { ts: Date.now(), event: evt.event, payload: evt.payload },
    ...host.eventLogBuffer,
  ].slice(0, 250);

  // Route by event name
  if (evt.event === "agent") {
    handleAgentEvent(host, evt.payload as AgentEventPayload);
    return;
  }

  if (evt.event === "chat") {
    handleChatEvent(host, evt.payload);
    return;
  }

  // ... other event types
}
```

**Existing agent event handler** (from `app-tool-stream.ts` line 184):

```typescript
export function handleAgentEvent(host: ToolStreamHost, payload?: AgentEventPayload) {
  if (!payload) return;

  if (payload.stream === "compaction") {
    handleCompactionEvent(host, payload);
    return;
  }

  if (payload.stream !== "tool") return;
  // ... tool stream logic
}
```

**Critical insight:** The current `handleAgentEvent` ONLY processes tool stream events. Agent lifecycle events (spawn, complete, error) are ignored. The Agents tab needs a separate handler.

### Signals Layer (Already Integrated)

| Library           | Version | Purpose                   | Files                  |
| ----------------- | ------- | ------------------------- | ---------------------- |
| @lit-labs/signals | v0.2.0  | Reactive state management | `ui/src/ui/state/*.ts` |

**Existing signals** (from `ui/src/ui/state/metrics.ts` lines 27-44):

```typescript
export const agentSessions = signal<Map<string, SessionCardData>>(new Map());
export const agentCosts = signal<Map<string, UsageEntry[]>>(new Map());

export const activeSpawnedSessions = computed(() => {
  return Array.from(agentSessions.get().values()).filter(
    (s) => s.spawnedBy && s.status !== "complete" && s.status !== "error",
  );
});

export const totalCost = computed(() => {
  let sum = 0;
  for (const entries of agentCosts.get().values()) {
    for (const e of entries) sum += e.costUsd;
  }
  return sum;
});
```

**Existing mutator** (from `ui/src/ui/state/metrics.ts` lines 52-116):

```typescript
export function updateSessionFromEvent(evt: {
  sessionKey?: string;
  stream: string;
  data: Record<string, unknown>;
  spawnedBy?: string;
  usage?: UsageEntry;
}): void {
  const key = evt.sessionKey;
  if (!key) return;

  const next = new Map(agentSessions.get());
  const existing = next.get(key);

  if (evt.stream === "lifecycle") {
    const phase = evt.data?.phase as string | undefined;

    if (phase === "start") {
      next.set(key, {
        sessionKey: key,
        agentId: (evt.data?.agentId as string) ?? key,
        task: (evt.data?.task as string) ?? "",
        status: "thinking",
        spawnedBy: evt.spawnedBy,
        startedAt: Date.now(),
      });
    } else if (phase === "end" && existing) {
      next.set(key, { ...existing, status: "complete", endedAt: Date.now() });
    } else if (phase === "error" && existing) {
      next.set(key, { ...existing, status: "error", endedAt: Date.now() });
    }
  } else if (evt.stream === "tool" && existing) {
    next.set(key, {
      ...existing,
      status: "executing",
      currentStep: (evt.data?.tool as string) ?? existing.currentStep,
    });
  }

  agentSessions.set(next);

  if (evt.usage) {
    trackAgentCost(key, evt.usage);
  }
}
```

**Perfect fit:** This mutator already handles the AgentEventPayload shape. It just needs to be called from the agent event handler.

### UI Components (Already Built)

| Component               | File                                          | Purpose                           |
| ----------------------- | --------------------------------------------- | --------------------------------- |
| `<agent-session-card>`  | `ui/src/ui/components/agent-session-card.ts`  | Session status cards              |
| `<latency-badge>`       | `ui/src/ui/components/latency-badge.ts`       | Duration badges (green/amber/red) |
| `<cost-display>`        | `ui/src/ui/components/cost-display.ts`        | Token/cost breakdown              |
| `<error-card>`          | `ui/src/ui/components/error-card.ts`          | Error display with stack trace    |
| `<conversation-export>` | `ui/src/ui/components/conversation-export.ts` | Export to markdown/JSON           |

**Demo view exists** (`ui/src/ui/views/viz-demo.ts`):

- Shows all components with sample data
- Not wired to live events
- Currently in "viz" tab (Dev group)

### Tab Routing (Already Implemented)

**Navigation structure** (from `ui/src/ui/navigation.ts` lines 3-26):

```typescript
export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] },
  { label: "Control", tabs: ["overview", "channels", "instances", "sessions", "cron"] },
  { label: "Agent", tabs: ["skills", "nodes"] },
  { label: "Settings", tabs: ["config", "debug", "logs"] },
  { label: "Dev", tabs: ["viz"] },
] as const;

export type Tab =
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "cron"
  | "skills"
  | "nodes"
  | "chat"
  | "config"
  | "debug"
  | "logs"
  | "viz";
```

**Tab registration pattern:**

1. Add tab to `Tab` union type
2. Add entry to `TAB_GROUPS` in appropriate group
3. Add path mapping in `TAB_PATHS` (e.g., `agents: "/agents"`)
4. Add icon in `iconForTab` switch
5. Add title/subtitle in `titleForTab`/`subtitleForTab`
6. Add render logic in `app-render.ts` (via `renderApp` function)

---

## Integration Strategy

### 1. Event Subscription (New Handler)

**Where:** `ui/src/ui/app-gateway.ts` (modify `handleGatewayEventUnsafe`)

**Current code** (line 181):

```typescript
if (evt.event === "agent") {
  if (host.onboarding) return;
  handleAgentEvent(host, evt.payload as AgentEventPayload);
  return;
}
```

**New approach:**

```typescript
if (evt.event === "agent") {
  if (host.onboarding) return;
  const payload = evt.payload as AgentEventPayload | undefined;

  // Feed metrics signals for Agents tab
  if (payload) {
    updateSessionFromEvent({
      sessionKey: payload.sessionKey,
      stream: payload.stream,
      data: payload.data,
      spawnedBy: payload.spawnedBy,
      usage: payload.usage,
    });
  }

  // Keep tool stream handler for chat tab
  handleAgentEvent(host, payload);
  return;
}
```

**Why this works:**

- `updateSessionFromEvent` is pure (no side effects beyond signal updates)
- No session filtering (metrics track all agents across all sessions)
- Usage tracking happens automatically via the mutator
- Tool stream handler continues to work for chat view

### 2. Signals Integration (Already Done)

**Pattern:** Lit components with `SignalWatcher` mixin automatically re-render when signals change.

**Example** (from existing component pattern):

```typescript
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { SignalWatcher } from "@lit-labs/signals";
import { agentSessions, activeSpawnedSessions, totalCost } from "../state/metrics";

@customElement("agents-view")
export class AgentsView extends SignalWatcher(LitElement) {
  render() {
    const sessions = Array.from(agentSessions.get().values());
    const activeSpawned = activeSpawnedSessions.get();
    const cost = totalCost.get();

    return html`
      <div>Total cost: $${cost.toFixed(4)}</div>
      ${sessions.map(
        (session) => html`
          <agent-session-card
            .sessionKey=${session.sessionKey}
            .agentId=${session.agentId}
            .task=${session.task}
            .status=${session.status}
            .spawnedBy=${session.spawnedBy}
            .startedAt=${session.startedAt}
            .endedAt=${session.endedAt}
            .currentStep=${session.currentStep}
          ></agent-session-card>
        `,
      )}
    </div>
    `;
  }
}
```

**No manual subscriptions needed.** SignalWatcher handles reactivity.

### 3. New Tab Registration

**Where:** `ui/src/ui/navigation.ts` (lines 3-26, 28-41, 104-195)

**Changes:**

1. Add `"agents"` to `Tab` union type (line 14-26)
2. Add `"agents"` to Agent group in `TAB_GROUPS` (line 9): `{ label: "Agent", tabs: ["agents", "skills", "nodes"] }`
3. Add path mapping (line 28-41): `agents: "/agents"`
4. Add icon (line 104): `case "agents": return "users";`
5. Add title/subtitle (lines 135-195):
   ```typescript
   case "agents": return "Agents";
   case "agents": return "Live agent sessions with cost tracking and handoff visualization.";
   ```

### 4. View Rendering

**Where:** `ui/src/ui/app-render.ts` (add around line 444, before `chat` block)

**Pattern** (following existing tabs):

```typescript
${
  state.tab === "agents"
    ? renderAgents({
        loading: false, // no async load needed, signals are live
        sessions: Array.from(agentSessions.get().values()),
        activeSpawned: activeSpawnedSessions.get(),
        totalCost: totalCost.get(),
        onRefresh: () => {
          // Optional: clear metrics state and wait for new events
          resetMetrics();
        },
      })
    : nothing
}
```

**View file:** `ui/src/ui/views/agents.ts` (new file)

**Structure:**

```typescript
import { html } from "lit";
import { agentSessions, activeSpawnedSessions, totalCost, getSessionCost } from "../state/metrics";
import "../components/agent-session-card";
import "../components/cost-display";

export type AgentsViewProps = {
  loading: boolean;
  sessions: Array<SessionCardData>;
  activeSpawned: Array<SessionCardData>;
  totalCost: number;
  onRefresh?: () => void;
};

export function renderAgents(props: AgentsViewProps) {
  return html`
    <div class="agents-view">
      <div class="agents-header">
        <cost-display .entries=${/* aggregate usage */} mode="inline"></cost-display>
        <button @click=${props.onRefresh}>Refresh</button>
      </div>

      <section class="agents-section">
        <h3>Active Sessions</h3>
        ${props.activeSpawned.map(session => html`
          <agent-session-card
            .sessionKey=${session.sessionKey}
            .agentId=${session.agentId}
            .task=${session.task}
            .status=${session.status}
            .spawnedBy=${session.spawnedBy}
            .startedAt=${session.startedAt}
            .currentStep=${session.currentStep}
          ></agent-session-card>
        `)}
      </section>

      <section class="agents-section">
        <h3>All Sessions</h3>
        ${props.sessions.map(session => html`
          <agent-session-card
            .sessionKey=${session.sessionKey}
            .agentId=${session.agentId}
            .task=${session.task}
            .status=${session.status}
            .spawnedBy=${session.spawnedBy}
            .startedAt=${session.startedAt}
            .endedAt=${session.endedAt}
          ></agent-session-card>
        `)}
      </section>
    </div>
  `;
}
```

---

## Data Flow Architecture

### Event → Signal → Component Flow

```
Gateway WebSocket
    ↓
GatewayBrowserClient.onEvent
    ↓
handleGatewayEvent (app-gateway.ts)
    ↓ [evt.event === "agent"]
updateSessionFromEvent (state/metrics.ts)
    ↓
agentSessions.set(next)  [signal update]
    ↓
SignalWatcher.requestUpdate()  [automatic]
    ↓
AgentsView.render()  [re-render]
    ↓
<agent-session-card> receives updated props
```

**Key insight:** No polling, no manual subscriptions. Signals are updated on every agent event, components re-render automatically.

### Agent Event Protocol (from `src/infra/agent-events.ts`)

**Event structure:**

```typescript
type AgentEventPayload = {
  runId: string; // Unique run identifier
  seq: number; // Monotonic sequence per run
  stream: string; // "lifecycle" | "tool" | "assistant" | "error"
  ts: number; // Event timestamp
  data: Record<string, unknown>; // Stream-specific data
  sessionKey?: string; // Session this event belongs to
  spawnedBy?: string; // Parent session key (if spawned)
  usage?: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    tier: "local" | "cheap" | "quality";
    costUsd: number;
  };
};
```

**Lifecycle stream phases** (from existing mutator):

- `phase: "start"` → create session card, status "thinking"
- `phase: "end"` → mark complete, set endedAt
- `phase: "error"` → mark error, set endedAt

**Tool stream phases** (existing handler):

- `phase: "start"` → status "executing", set currentStep to tool name
- `phase: "update"` → update currentStep with partial result
- `phase: "result"` → status "thinking", clear currentStep

**Usage tracking:** Any event with `usage` field automatically updates cost signals via `trackAgentCost`.

---

## Alternatives Considered (None Viable)

| Approach                                 | Why Not                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Separate WebSocket connection            | Gateway enforces single connection per client; would conflict with existing client                           |
| Direct signal imports in components      | Already done; SignalWatcher mixin handles reactivity                                                         |
| Manual `onAgentEvent` subscriptions      | Gateway event routing is centralized in `app-gateway.ts`; adding separate subscription would duplicate logic |
| Polling gateway API                      | Real-time events already available; polling would add latency and server load                                |
| State management library (Zustand/Pinia) | @lit-labs/signals already integrated; no benefit to migration                                                |

---

## Implementation Checklist

### Phase 1: Event Wiring (Core Milestone Goal)

- [ ] Modify `handleGatewayEventUnsafe` in `app-gateway.ts` to call `updateSessionFromEvent`
- [ ] Register "agents" tab in `navigation.ts` (type, group, path, icon, title)
- [ ] Create `views/agents.ts` with `renderAgents` function
- [ ] Wire `renderAgents` into `app-render.ts` switch statement
- [ ] Test: open Agents tab, spawn agent, verify session card appears live

### Phase 2: UI Polish (Post-Milestone)

- [ ] Add handoff animation when `spawnedBy` populates
- [ ] Add conversation export button per session
- [ ] Add session filtering (active/complete/error)
- [ ] Add cost breakdown per session (click to expand)
- [ ] Add latency badges for session duration

### Phase 3: Advanced Features (Future)

- [ ] Session graph view (parent → spawned hierarchy)
- [ ] Cost projections (based on active sessions)
- [ ] Session replay (load history from gateway)
- [ ] Export all sessions to JSON/markdown

---

## Known Constraints

### 1. Gateway Event Protocol

**Constraint:** Gateway emits events with `sessionKey` OR without (for global context).

**Implication:** Agents tab must accept both. Filter by `sessionKey` when tracking session-specific data, but aggregate costs globally.

**Mitigation:** `updateSessionFromEvent` already handles this (line 65: `if (!key) return;` skips keyless events).

### 2. Signal Reactivity Scope

**Constraint:** Signals update synchronously. High-frequency events (tool updates) may cause excessive re-renders.

**Implication:** Throttle signal updates for tool stream events (already done in `app-tool-stream.ts` line 127: `TOOL_STREAM_THROTTLE_MS = 80`).

**Mitigation:** Use same throttling pattern for agent lifecycle events if needed. Currently not needed (lifecycle events are infrequent).

### 3. Session Cleanup

**Constraint:** `agentSessions` Map grows unbounded as sessions complete.

**Implication:** Memory leak if gateway runs for days with thousands of sessions.

**Mitigation:** Add cleanup logic:

```typescript
// In metrics.ts, add:
export function pruneCompletedSessions(maxAge: number = 3600_000) {
  const now = Date.now();
  const next = new Map(agentSessions.get());
  for (const [key, session] of next.entries()) {
    if (session.endedAt && now - session.endedAt > maxAge) {
      next.delete(key);
    }
  }
  agentSessions.set(next);
}
```

**Schedule:** Call `pruneCompletedSessions()` every 5 minutes if Agents tab is active.

### 4. Cost Aggregation Precision

**Constraint:** JavaScript floating-point arithmetic loses precision after ~15 decimals.

**Implication:** Total cost may drift after millions of events.

**Mitigation:** Use integer cents internally, display as dollars:

```typescript
// In metrics.ts, modify trackAgentCost to store cents:
costCents: Math.round(usage.costUsd * 100_000_000);

// In totalCost computed, sum cents then divide:
return sum / 100_000_000;
```

**Not critical for MVP.** Real-world sessions have <1000 events, error is negligible.

---

## Testing Strategy

### Unit Tests (Signals Layer)

**File:** `ui/src/ui/state/metrics.test.ts`

**Test cases:**

- `updateSessionFromEvent` creates session on "lifecycle:start"
- `updateSessionFromEvent` marks complete on "lifecycle:end"
- `updateSessionFromEvent` marks error on "lifecycle:error"
- `updateSessionFromEvent` updates status to "executing" on "tool:start"
- `trackAgentCost` appends usage entry
- `totalCost` sums all usage entries correctly
- `activeSpawnedSessions` filters by spawnedBy and status

### Integration Tests (Event Flow)

**File:** `ui/src/ui/app-gateway.test.ts`

**Test cases:**

- Mock GatewayBrowserClient with fake events
- Verify `handleGatewayEvent` routes "agent" events to mutator
- Verify signals update after event handling
- Verify components re-render (via LitElement test helpers)

### E2E Tests (Live Gateway)

**File:** `ui/e2e/agents-tab.test.ts` (Playwright/Puppeteer)

**Test flow:**

1. Start local gateway on port 18789
2. Open UI in browser
3. Navigate to Agents tab
4. Send test message to gateway: `/spawn researcher "Find all TypeScript files"`
5. Verify session card appears within 2s
6. Verify status changes: thinking → executing → complete
7. Verify cost display updates with usage data
8. Verify spawned session has `spawnedBy` badge

---

## Performance Considerations

### Event Processing Overhead

**Current state:**

- Chat tab: ~100 events/second during active agent run (tool updates, assistant chunks)
- Agents tab: ~10 events/second (lifecycle + usage events only)

**Bottleneck:** Not event handling (pure JS map updates), but Lit re-renders.

**Optimization:**

1. Use `@lit-labs/virtualizer` for session list (if >100 sessions)
2. Memoize session cards with `cache` directive (Lit helper)
3. Debounce signal updates (already done for tool stream)

**Not needed for MVP.** Typical usage: 5-20 concurrent sessions.

### Memory Usage

**Signal state size:**

- `agentSessions` Map: ~500 bytes/session × 100 sessions = 50 KB
- `agentCosts` Map: ~200 bytes/entry × 1000 entries = 200 KB
- Total: <1 MB for typical workload

**Cleanup triggers:**

- Auto-prune completed sessions older than 1 hour (5-minute interval)
- Manual "Clear History" button in Agents tab
- Gateway restart clears all state (signals reset on reconnect)

### WebSocket Bandwidth

**Gateway event size:**

- Lifecycle event: ~200 bytes JSON
- Tool event with partial result: ~2 KB JSON
- Usage event: ~150 bytes JSON

**Estimated bandwidth:**

- Chat tab (active): ~200 KB/minute (tool updates dominate)
- Agents tab (passive): ~10 KB/minute (lifecycle + usage only)

**No optimization needed.** Modern browsers handle 1 MB/s WebSocket streams easily.

---

## Migration Path (Viz Tab → Agents Tab)

### Current Viz Tab (Demo Only)

**File:** `ui/src/ui/views/viz-demo.ts`
**Purpose:** Static demo of v2.2 components with hardcoded sample data
**Location:** Dev group (not user-facing)

### New Agents Tab (Live Data)

**File:** `ui/src/ui/views/agents.ts`
**Purpose:** Production view wired to live gateway events
**Location:** Agent group (alongside Skills, Nodes)

### Migration Strategy

**Option 1: Replace viz tab** (NOT RECOMMENDED)

- Remove "viz" from navigation
- Rename `viz-demo.ts` to `agents.ts`
- Wire signals instead of hardcoded data

**Option 2: Keep viz tab, add agents tab** (RECOMMENDED)

- Viz tab stays in Dev group for component testing
- Agents tab is new production view in Agent group
- Reuse component imports from viz-demo

**Why keep viz tab:**

- Useful for UI development (no gateway needed)
- Component showcase for documentation
- Regression testing (hardcoded data = stable baseline)

### Implementation

**Step 1:** Create `ui/src/ui/views/agents.ts`

```typescript
import { html } from "lit";
import { agentSessions, activeSpawnedSessions, totalCost } from "../state/metrics";
import "../components/agent-session-card";
import "../components/cost-display";

export function renderAgents() {
  const sessions = Array.from(agentSessions.get().values());
  const spawned = activeSpawnedSessions.get();
  const cost = totalCost.get();

  return html`
    <div class="agents-view">
      <!-- Copy structure from viz-demo, replace hardcoded data with signals -->
    </div>
  `;
}
```

**Step 2:** Register in navigation.ts (see Phase 1 checklist)

**Step 3:** Wire in app-render.ts (see Phase 1 checklist)

**Step 4:** Test with live gateway

---

## Sources

**High Confidence (Codebase Analysis):**

- `ui/src/ui/gateway.ts` — GatewayBrowserClient implementation
- `ui/src/ui/app-gateway.ts` — Event routing and subscription pattern
- `ui/src/ui/state/metrics.ts` — Signals and mutators
- `ui/src/ui/navigation.ts` — Tab registration pattern
- `ui/src/ui/app-render.ts` — View rendering pattern
- `ui/src/ui/views/viz-demo.ts` — Component demo with sample data
- `src/infra/agent-events.ts` — AgentEventPayload type definition
- `ui/src/ui/app-tool-stream.ts` — Existing agent event handler (tool stream only)

**No external sources needed.** All patterns derived from existing codebase.
