# Architecture Patterns: Live Agent Dashboard Integration

**Project:** v2.3 Live Agent Dashboard
**Researched:** 2026-02-03
**Confidence:** HIGH (based on actual source code)

## Executive Summary

The OpenClaw UI follows a **Lit-based reactive architecture** with a clear separation between:

- **Gateway layer** (WebSocket client with device auth)
- **State layer** (Lit signals for reactive state management)
- **Controller layer** (business logic bridging gateway events to state)
- **View layer** (pure render functions consuming state)
- **Component layer** (Web Components for reusable UI elements)

The "Agents" tab will integrate as a new tab following the existing patterns established by the "Chat" tab, reusing the v2.2 components (agent-session-card, agent-handoff, etc.) and wiring them to gateway agent events via the metrics signals.

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Gateway Layer                            │
│  GatewayBrowserClient (WebSocket) ─> AgentEventPayload         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ onEvent callback
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Controller Layer                            │
│  AgentsController.handleAgentEvent()                            │
│    ├─> Parse stream/phase from event                            │
│    ├─> updateSessionFromEvent() [metrics.ts]                    │
│    └─> Emit to subscribers                                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Updates signals
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         State Layer                              │
│  Signals (Lit @lit-labs/signals)                                │
│    - agentSessions (Map<string, SessionCardData>)               │
│    - agentCosts (Map<string, UsageEntry[]>)                     │
│    - agentRegistry (Map<string, AgentIdentity>)                 │
│    - agentStatuses (Map<string, AgentStatus>)                   │
│  Computed signals:                                               │
│    - activeSpawnedSessions                                       │
│    - totalCost                                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Subscribe
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                         View Layer                               │
│  renderAgents() [views/agents.ts]                               │
│    ├─> Reads signals via agentSessions.get()                    │
│    ├─> Maps to <agent-session-card> components                  │
│    └─> Renders <agent-handoff> for spawn events                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Composes
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Component Layer                             │
│  Web Components (Lit custom elements)                           │
│    - <agent-session-card> [EXISTING v2.2]                       │
│    - <agent-handoff> [EXISTING v2.2]                            │
│    - <latency-badge> [EXISTING v2.2]                            │
│    - <cost-display> [EXISTING v2.2]                             │
│    - <error-card> [EXISTING v2.2]                               │
└─────────────────────────────────────────────────────────────────┘
```

## Event Flow: Gateway → UI

### 1. Gateway WebSocket Connection

**Existing:** `GatewayBrowserClient` (ui/src/ui/gateway.ts)

- Connects to gateway WebSocket on URL from settings
- Handles device auth (loadOrCreateDeviceIdentity, signDevicePayload)
- Receives frames: `{ type: "event", event: string, payload: unknown, seq?: number }`
- Calls `opts.onEvent?.(evt)` for each event frame

**Integration point:** Already wired in app.ts `connectGatewayInternal()`

```typescript
// app-gateway.ts (EXISTING)
const client = new GatewayBrowserClient({
  url: state.settings.gatewayUrl,
  // ...
  onEvent: (evt) => {
    // Existing handlers for chat, presence, etc.
    // NEW: Route agent events to AgentsController
    if (evt.event === "agent") {
      agentsController.handleAgentEvent(evt.payload as AgentEventPayload);
    }
  },
});
```

### 2. Agent Event Payload Structure

**Source:** ui/src/../src/infra/agent-events.ts (backend)

```typescript
type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: AgentEventStream; // "lifecycle" | "tool" | "assistant" | "error"
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
  spawnedBy?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    tier: "local" | "cheap" | "quality";
    costUsd: number;
  };
};
```

**Key streams:**

- `lifecycle`: phase="start" | "end" | "error"
- `tool`: data.tool = tool name
- `assistant`: data = assistant reply chunks
- `error`: data = error details

### 3. Controller Layer (NEW)

**File:** `ui/src/ui/controllers/agents.ts` (CREATE)

```typescript
export class AgentsController {
  handleAgentEvent(evt: AgentEventPayload): void {
    // Delegate to metrics.ts mutators
    updateSessionFromEvent({
      sessionKey: evt.sessionKey,
      stream: evt.stream,
      data: evt.data,
      spawnedBy: evt.spawnedBy,
      usage: evt.usage,
    });

    // Track agent identity if new
    if (evt.sessionKey) {
      const agentId = (evt.data?.agentId as string) ?? evt.sessionKey;
      if (!agentRegistry.get().has(agentId)) {
        registerAgent({
          id: agentId,
          name: agentId,
          avatar: null, // Or extract from evt.data if available
          color: getAgentColor(agentId),
        });
      }
    }
  }
}
```

**Why separate controller?**

- Matches existing pattern (agent-chat.ts for chat tab)
- Encapsulates agent event logic
- Keeps metrics.ts pure (no gateway coupling)

### 4. State Layer (EXISTING)

**File:** `ui/src/ui/state/metrics.ts` (v2.2)

Already implements:

- `agentSessions` signal (Map<string, SessionCardData>)
- `agentCosts` signal (Map<string, UsageEntry[]>)
- `updateSessionFromEvent()` mutator (converts lifecycle/tool/error streams to session state)
- `trackAgentCost()` mutator (records usage entries)
- Computed signals: `activeSpawnedSessions`, `totalCost`

**No changes needed.** Controller calls existing mutators.

**File:** `ui/src/ui/state/agents.ts` (v2.2)

Already implements:

- `agentRegistry` signal (Map<string, AgentIdentity>)
- `agentStatuses` signal (Map<string, AgentStatus>)
- `registerAgent()`, `setAgentStatus()` mutators
- `getAgentIdentity()` helper (derives identity if not registered)

**No changes needed.** Controller calls existing mutators.

### 5. View Layer (NEW)

**File:** `ui/src/ui/views/agents.ts` (CREATE)

```typescript
import { html, nothing } from "lit";
import { agentSessions, activeSpawnedSessions } from "../state/metrics";
import { getAgentIdentity } from "../state/agents";

export type AgentsViewProps = {
  connected: boolean;
  onRefresh: () => void;
};

export function renderAgents(props: AgentsViewProps) {
  const sessions = Array.from(agentSessions.get().values());
  const spawned = activeSpawnedSessions.get();

  return html`
    <div class="agents-view">
      <div class="agents-header">
        <h2>Active Agents</h2>
        <button @click=${props.onRefresh}>Refresh</button>
      </div>

      ${!props.connected ? html`<div class="status-msg">Disconnected from gateway</div>` : nothing}

      <div class="agent-grid">
        ${sessions.length === 0
          ? html`<div class="empty-state">No active agents</div>`
          : sessions.map((session) => {
              const identity = getAgentIdentity(session.agentId);
              return html`
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
              `;
            })}
      </div>

      ${spawned.length > 0
        ? html`
            <div class="spawn-indicators">
              ${spawned.map(
                (s) => html`
                  <agent-handoff
                    .fromAgent=${s.spawnedBy}
                    .toAgent=${s.agentId}
                    .task=${s.task}
                  ></agent-handoff>
                `,
              )}
            </div>
          `
        : nothing}
    </div>
  `;
}
```

**Styling:** Extract from existing chat view; place in `ui/src/ui/views/agents.css` (imported by app.ts).

### 6. App Shell Integration (MODIFY)

**File:** `ui/src/ui/navigation.ts`

Add "agents" tab to TAB_GROUPS:

```typescript
export const TAB_GROUPS = [
  { label: "Chat", tabs: ["chat"] },
  {
    label: "Control",
    tabs: ["overview", "channels", "instances", "sessions", "cron"],
  },
  { label: "Agent", tabs: ["agents", "skills", "nodes"] },  // ADD "agents"
  { label: "Settings", tabs: ["config", "debug", "logs"] },
  { label: "Dev", tabs: ["viz"] },
] as const;

export type Tab =
  | "overview"
  | "channels"
  | "instances"
  | "sessions"
  | "cron"
  | "agents"    // ADD
  | "skills"
  | "nodes"
  | "chat"
  | "config"
  | "debug"
  | "logs"
  | "viz";

// Add path/title/icon/subtitle
const TAB_PATHS: Record<Tab, string> = {
  // ...
  agents: "/agents",
  // ...
};

export function iconForTab(tab: Tab): IconName {
  // ...
  case "agents": return "users";  // Or "brain", "zap", etc.
  // ...
}

export function titleForTab(tab: Tab) {
  // ...
  case "agents": return "Agents";
  // ...
}

export function subtitleForTab(tab: Tab) {
  // ...
  case "agents": return "Live multi-agent session monitor";
  // ...
}
```

**File:** `ui/src/ui/app-render.ts`

Add case for agents tab:

```typescript
${
  state.tab === "agents"
    ? renderAgents({
        connected: state.connected,
        onRefresh: () => {
          // Optional: reload agent list or force signal refresh
          // For now, signals auto-update from WebSocket events
        },
      })
    : nothing
}
```

**File:** `ui/src/ui/app.ts`

Add state for agents controller:

```typescript
@customElement("openclaw-app")
export class OpenClawApp extends LitElement {
  // ... existing state ...

  // NEW: Agents controller
  private agentsController: AgentsController | null = null;

  connectedCallback() {
    super.connectedCallback();
    this.agentsController = new AgentsController();
    // ...
  }
}
```

**File:** `ui/src/ui/app-gateway.ts`

Wire agent events in `onEvent` handler:

```typescript
onEvent: (evt) => {
  // Existing handlers...

  // NEW: Route agent events
  if (evt.event === "agent" && state.agentsController) {
    const payload = evt.payload as AgentEventPayload;
    state.agentsController.handleAgentEvent(payload);
  }
},
```

## Component Boundaries

| Component            | Responsibility                                   | Communicates With                                  |
| -------------------- | ------------------------------------------------ | -------------------------------------------------- |
| GatewayBrowserClient | WebSocket connection, device auth, frame parsing | app-gateway.ts (onEvent callback)                  |
| AgentsController     | Bridge agent events to metrics signals           | metrics.ts mutators, agents.ts mutators            |
| metrics.ts           | Session/cost signal state, update logic          | AgentsController (write), renderAgents (read)      |
| agents.ts            | Agent identity/status signal state               | AgentsController (write), renderAgents (read)      |
| renderAgents()       | Compose agent session cards UI                   | metrics/agents signals (read), components (render) |
| agent-session-card   | Display single agent session                     | renderAgents() (properties)                        |
| agent-handoff        | Animate agent spawn/handoff                      | renderAgents() (properties)                        |

## Data Flow

```
Gateway (WebSocket)
  ├─> onEvent({ event: "agent", payload: AgentEventPayload })
  └─> AgentsController.handleAgentEvent(payload)
        ├─> updateSessionFromEvent() [metrics.ts]
        │     └─> agentSessions.set(nextMap)
        ├─> registerAgent() [agents.ts]
        │     └─> agentRegistry.set(nextMap)
        └─> setAgentStatus() [agents.ts]
              └─> agentStatuses.set(nextMap)

Signals (reactive)
  ├─> agentSessions signal
  ├─> agentRegistry signal
  └─> agentStatuses signal

View (render on signal change)
  ├─> renderAgents() reads signals
  └─> Renders <agent-session-card> per session
```

## Build Order

### Phase 1: Controller + Event Wiring

1. Create `ui/src/ui/controllers/agents.ts` (AgentsController class)
2. Wire `onEvent` handler in `app-gateway.ts` to route "agent" events
3. Add agentsController instance to `app.ts` state
4. Test: Verify agent events update metrics signals (use debug tab event log)

**Dependencies:** None (metrics.ts, agents.ts already exist)
**Testing:** Gateway emits agent events → metrics signals update

### Phase 2: View + Tab Registration

1. Create `ui/src/ui/views/agents.ts` (renderAgents function)
2. Add "agents" tab to TAB_GROUPS in `navigation.ts`
3. Add tab path, title, icon, subtitle
4. Wire renderAgents in `app-render.ts` switch statement
5. Add CSS for agents view (grid layout, empty state)

**Dependencies:** Phase 1 complete
**Testing:** Click "Agents" tab → view renders with live session cards

### Phase 3: Polish + Real Data

1. Test with real multi-agent scenario (spawn sub-agent from chat)
2. Verify session cards update in real-time as agents work
3. Verify agent-handoff animation triggers on spawn
4. Add loading/error states to view
5. Add optional auto-scroll or sort-by-activity

**Dependencies:** Phase 2 complete
**Testing:** Full end-to-end with multi-agent tasks

## Integration Points with Existing App Shell

### Tab Navigation

**Existing pattern:** navigation.ts defines tabs → app-render.ts renders view for active tab

**Integration:**

- Add "agents" to TAB_GROUPS under "Agent" label
- Add case in app-render.ts: `state.tab === "agents" ? renderAgents(...) : nothing`

### WebSocket Event Routing

**Existing pattern:** app-gateway.ts onEvent callback routes events to handlers

**Integration:**

- Add case: `if (evt.event === "agent") { agentsController.handleAgentEvent(...) }`

### Signal Reactivity

**Existing pattern:** Lit signals trigger re-render when updated

**Integration:**

- renderAgents() reads `agentSessions.get()` → auto re-renders when signal changes
- No manual subscriptions needed (Lit handles it)

### Component Composition

**Existing pattern:** Views compose Web Components via `html` template literals

**Integration:**

- renderAgents() uses existing `<agent-session-card>` (v2.2)
- renderAgents() uses existing `<agent-handoff>` (v2.2)
- No new components needed for v2.3

## New Files to Create

| File                            | Purpose                          | Lines (est) |
| ------------------------------- | -------------------------------- | ----------- |
| ui/src/ui/controllers/agents.ts | Bridge gateway events to signals | ~80         |
| ui/src/ui/views/agents.ts       | Render agents tab view           | ~150        |
| ui/src/ui/views/agents.css      | Styling for agents view          | ~100        |

**Total:** ~330 LOC (new code)

## Existing Files to Modify

| File                     | Changes                       | Lines (est) |
| ------------------------ | ----------------------------- | ----------- |
| ui/src/ui/navigation.ts  | Add "agents" tab definition   | +15         |
| ui/src/ui/app-render.ts  | Add renderAgents() case       | +10         |
| ui/src/ui/app.ts         | Add agentsController instance | +5          |
| ui/src/ui/app-gateway.ts | Route "agent" events          | +8          |

**Total:** ~38 LOC (modifications)

## Patterns to Follow

### Pattern 1: Signal-Driven UI

**What:** Lit signals (@lit-labs/signals) for reactive state management
**When:** Any state that triggers UI updates
**Example:**

```typescript
// State layer (metrics.ts)
export const agentSessions = signal<Map<string, SessionCardData>>(new Map());

export function updateSessionFromEvent(evt: {...}): void {
  const next = new Map(agentSessions.get());
  // ... mutate next ...
  agentSessions.set(next);  // Triggers re-render
}

// View layer (agents.ts)
export function renderAgents() {
  const sessions = Array.from(agentSessions.get().values());
  // ... render sessions ...
}
```

**Why:** Decouples state from UI; avoids manual DOM manipulation; follows Lit best practices

### Pattern 2: Pure View Functions

**What:** Views are pure functions that take props and return TemplateResult
**When:** All tab views
**Example:**

```typescript
export type AgentsViewProps = {
  connected: boolean;
  onRefresh: () => void;
};

export function renderAgents(props: AgentsViewProps) {
  return html`<div>${props.connected ? "OK" : "Offline"}</div>`;
}
```

**Why:** Testable; no side effects; composable; matches existing chat/config/debug views

### Pattern 3: Controller as Event Bridge

**What:** Controller receives gateway events, calls signal mutators
**When:** Bridging WebSocket events to UI state
**Example:**

```typescript
export class AgentsController {
  handleAgentEvent(evt: AgentEventPayload): void {
    updateSessionFromEvent(evt);  // Call pure mutator
    registerAgent({...});         // Call pure mutator
  }
}
```

**Why:** Encapsulates event logic; keeps signals pure; testable in isolation

### Pattern 4: Tab-Based Routing

**What:** Define tab in navigation.ts → render in app-render.ts
**When:** Adding new top-level view
**Example:**

```typescript
// navigation.ts
export const TAB_GROUPS = [
  { label: "Agent", tabs: ["agents", "skills", "nodes"] },
];

// app-render.ts
${state.tab === "agents" ? renderAgents({...}) : nothing}
```

**Why:** Centralized navigation; consistent URL structure; follows existing pattern

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct DOM Manipulation

**What:** Bypassing Lit's template system to mutate DOM
**Why bad:** Breaks reactivity; hard to debug; inconsistent with app architecture
**Instead:** Use signals + re-render pattern

### Anti-Pattern 2: Mixing Gateway Logic in Views

**What:** Calling `client.request()` directly from renderAgents()
**Why bad:** Couples view to gateway; makes testing hard; breaks pure function pattern
**Instead:** Route events through controller → mutate signals → view reads signals

### Anti-Pattern 3: Stateful Components Without Signals

**What:** Storing session data in component @state instead of shared signals
**Why bad:** Breaks cross-component synchronization; duplicates state
**Instead:** Components read from shared signals; only use @state for local UI state (e.g., hover, expanded)

### Anti-Pattern 4: Polling Instead of WebSocket Events

**What:** setInterval to fetch agent status via HTTP
**Why bad:** Gateway already pushes events; polling wastes resources; stale data
**Instead:** Subscribe to "agent" events from WebSocket; signals auto-update UI

## Testing Strategy

### Unit Tests

- `metrics.ts`: Test `updateSessionFromEvent()` with lifecycle/tool/error payloads
- `agents.ts`: Test `registerAgent()`, `getAgentIdentity()`, `getAgentColor()`
- `controllers/agents.ts`: Mock gateway events, verify signal calls

### Integration Tests

- Wire AgentsController to real gateway client (test mode)
- Emit agent events, verify session cards render
- Verify agent-handoff appears on spawn events

### E2E Tests

- Start gateway with multi-agent config
- Trigger agent spawn from chat
- Verify "Agents" tab shows live sessions
- Verify status updates (thinking → executing → complete)

## Dependencies

### Existing (No Installation Needed)

- `lit` (3.2.1): Web Components, html templates
- `@lit-labs/signals` (1.0.2): Reactive state management
- `@lit/reactive-element` (2.0.4): Base class for custom elements

### New Components (Already Exist from v2.2)

- `agent-session-card`: Display agent session with status badge
- `agent-handoff`: Animate agent spawn/handoff
- `latency-badge`: Show elapsed time for session
- `cost-display`: Show cumulative cost (deferred in v2.3)
- `error-card`: Show error state (deferred in v2.3)

**No new dependencies.** All components and libraries already present.

## Scalability Considerations

### At 10 Concurrent Agents

**Approach:**

- Render all sessions in grid (no pagination)
- Auto-scroll to active sessions
- Filter completed/errored sessions to separate section

**Performance:** Lit efficiently diffs templates; 10 cards = negligible render time

### At 100 Concurrent Agents

**Approach:**

- Virtual scrolling (consider `@lit-labs/virtualizer`)
- Pagination or "Load more" for completed sessions
- Filter by agent ID, status, or timeframe

**Performance:** May need optimization; defer until needed

### At 1000 Concurrent Agents

**Approach:**

- Pagination required (server-side)
- Search/filter on backend
- Consider separate "Agent Fleet" view

**Performance:** Current architecture won't scale; needs redesign

**Recommendation for v2.3:** Optimize for 10-20 concurrent agents (realistic for single-user dashboard). Defer fleet-scale optimizations.

## Known Limitations

1. **No agent event persistence:** Signals reset on page reload
   - Mitigation: Gateway could offer `/agents/sessions` endpoint for historical data
   - Defer to v2.4

2. **No cost data in v2.3:** Usage field in AgentEventPayload exists but not wired
   - Mitigation: trackAgentCost() exists in metrics.ts; wire in v2.4
   - Defer for now

3. **No message stream for agents tab:** Only session cards, not chat history
   - Mitigation: Could add message-list component per session
   - Defer to v2.4

4. **No gateway API for agent history:** Only live events
   - Mitigation: Add `/agents/sessions?since=<ts>` endpoint
   - Defer to backend work

## Sources

- ui/src/ui/gateway.ts (GatewayBrowserClient WebSocket implementation)
- ui/src/ui/app.ts (OpenClawApp main component)
- ui/src/ui/app-render.ts (Tab routing and view composition)
- ui/src/ui/navigation.ts (Tab definitions and helpers)
- ui/src/ui/state/metrics.ts (Agent session signals and mutators)
- ui/src/ui/state/agents.ts (Agent identity/status signals)
- ui/src/ui/controllers/agent-chat.ts (Existing controller pattern reference)
- ui/src/ui/views/agent-chat.ts (Existing view pattern reference)
- src/infra/agent-events.ts (AgentEventPayload type definition)
- ui/src/ui/components/agent-session-card.ts (Existing v2.2 component)
