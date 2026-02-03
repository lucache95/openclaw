# Phase 27: Conversation View - Research

**Researched:** 2026-02-03
**Domain:** Lit Web Components + WebSocket event wiring for real-time agent conversation streaming
**Confidence:** HIGH

## Summary

Phase 27 is a pure wiring phase. All UI components (message-stream, message-list, typing-indicator, agent-avatar, agent-status-bar, markdown renderer) already exist from v2.2. The gateway already broadcasts `agent` events to all WebSocket clients with stream types `lifecycle`, `tool`, `assistant`, and `error`. Phase 25 built AgentsController that bridges these events to signals. Phase 26 built the Agents tab with session cards.

The work is: (1) add conversation-level signals/state to track per-session messages and streaming text, (2) create a conversation view that opens when clicking a session card, (3) wire existing components to display that per-session data with proper auto-scroll and scroll-lock behavior.

The critical insight is that the gateway's `agent` events with `stream: "assistant"` already carry `data.text` (accumulated full text) and `data.delta` (incremental token) -- this is the same mechanism used by `handleChatEvent` for the Chat tab. The difference is that conversation view must track messages per-session (not per-active-chat-session) and display them for observation (read-only), not interaction.

**Primary recommendation:** Extend AgentsController to capture assistant text events per session, add per-session conversation signals, and create a conversation-view component that composes existing message-list, message-stream, typing-indicator, and agent-status-bar components.

## Standard Stack

No new dependencies. Everything is already in place.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| lit | existing | Web component framework | Already used throughout UI |
| @lit-labs/signals | existing | Reactive state | Already used for agentSessions, chatStream, etc. |
| marked | existing | Markdown parsing | Already wired in markdown.ts |
| dompurify | existing | HTML sanitization | Already wired in markdown.ts |
| highlight.js | existing | Code syntax highlighting | Already wired in markdown.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lit/decorators.js | existing | @customElement, @property, @state | Component definitions |
| lit/directives/unsafe-html.js | existing | Render sanitized markdown HTML | Message bubble content |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-session signal Map | Separate signal per session | Map is simpler, matches agentSessions pattern |
| New route/page | Inline expansion in agents view | Route adds URL bookmarkability but is more complex; inline is simpler for v2.3 scope |

**Installation:**
```bash
# No installation needed -- zero new dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
ui/src/ui/
  state/
    metrics.ts          # MODIFY: add per-session conversation signals
  controllers/
    agents-controller.ts # MODIFY: capture assistant stream events
  views/
    agents.ts           # MODIFY: add session card click -> conversation view
    conversation-view.ts # NEW: conversation view composition
  components/
    message-stream.ts   # REUSE: streaming text display (may need agentId prop wiring)
    message-list.ts     # REUSE: message history (may need per-session message array)
    typing-indicator.ts # REUSE: agent thinking indicator
    agent-avatar.ts     # REUSE: agent identity markers
    agent-status-bar.ts # REUSE: multi-agent status overview
```

### Pattern 1: Per-Session Conversation State
**What:** Track conversation messages and streaming text per sessionKey using a signals Map, exactly like agentSessions already works.
**When to use:** When the conversation view needs to display messages for a specific session.
**Example:**
```typescript
// Source: existing pattern from ui/src/ui/state/metrics.ts
import { signal } from "@lit-labs/signals";

export type ConversationMessage = {
  agentId: string;
  text: string;
  timestamp: number;
  role: "assistant" | "system" | "tool";
};

// Per-session conversation state
export const sessionConversations = signal<Map<string, ConversationMessage[]>>(new Map());
export const sessionStreams = signal<Map<string, { agentId: string; text: string }>>(new Map());

export function pushSessionMessage(sessionKey: string, msg: ConversationMessage) {
  const next = new Map(sessionConversations.get());
  const messages = [...(next.get(sessionKey) ?? []), msg];
  next.set(sessionKey, messages);
  sessionConversations.set(next);
}

export function setSessionStream(sessionKey: string, agentId: string, text: string) {
  const next = new Map(sessionStreams.get());
  next.set(sessionKey, { agentId, text });
  sessionStreams.set(next);
}

export function clearSessionStream(sessionKey: string) {
  const next = new Map(sessionStreams.get());
  next.delete(sessionKey);
  sessionStreams.set(next);
}
```

### Pattern 2: AgentsController Event Capture Extension
**What:** Extend handleEvent in AgentsController to capture assistant text events and lifecycle events as conversation messages.
**When to use:** When agent events arrive via the gateway WebSocket.
**Example:**
```typescript
// Source: existing pattern from ui/src/ui/controllers/agents-controller.ts
handleEvent(payload: AgentEventPayload | undefined): void {
  if (!payload) return;

  // Existing: update session card data
  updateSessionFromEvent({ ... });

  // NEW: capture conversation data
  const sessionKey = payload.sessionKey;
  if (!sessionKey) return;

  if (payload.stream === "assistant") {
    const text = payload.data?.text as string | undefined;
    const agentId = payload.data?.agentId as string ?? sessionKey;
    if (typeof text === "string") {
      setSessionStream(sessionKey, agentId, text);
    }
  } else if (payload.stream === "lifecycle") {
    const phase = payload.data?.phase as string;
    if (phase === "end" || phase === "error") {
      // Finalize: move stream to messages, clear stream
      finalizeSessionStream(sessionKey);
    }
  }
}
```

### Pattern 3: Session Card Click -> Conversation View Navigation
**What:** Clicking a session card in the agents view opens the conversation view for that session.
**When to use:** User interaction to drill into a specific session.
**Example:**
```typescript
// In views/agents.ts, add click handler to session cards
// Option A: Inline expansion (simpler)
<agent-session-card
  @click=${() => { selectedSession.set(s.sessionKey); }}
  ...
></agent-session-card>

// Then conditionally render conversation view
${selected ? html`<conversation-view .sessionKey=${selected}></conversation-view>` : nothing}

// Option B: Separate tab/route (more complex but cleaner URL)
// Would need navigation.ts changes -- defer this for simplicity
```

### Pattern 4: Auto-Scroll with Scroll-Lock (Already Implemented)
**What:** The message-list component already implements auto-scroll with scroll-lock. When the user scrolls up, auto-scroll pauses. A "Scroll to bottom" FAB appears. Scrolling back down or clicking FAB re-enables auto-scroll.
**When to use:** This is already built into message-list.ts lines 149-189.
**Key detail:** The auto-scroll logic uses `requestAnimationFrame(() => this.scrollToBottom())` and tracks `userScrolledUp` state based on distance from bottom (>50px threshold).

### Anti-Patterns to Avoid
- **Creating new WebSocket connections:** The gateway WebSocket is already connected. All agent events already flow through the existing `handleGatewayEvent` -> `agentsController.handleEvent` pipeline. Do NOT create additional connections.
- **Duplicating markdown rendering:** `toSanitizedMarkdownHtml()` from `ui/src/ui/markdown.ts` already handles marked + DOMPurify + highlight.js. Do NOT create a separate rendering pipeline.
- **Ignoring the chatStream signal pattern:** The existing `chatStream` signal shows how streaming text is managed. Follow the same accumulation pattern (text field = full accumulated text, not just deltas).
- **Re-implementing auto-scroll:** `message-list` already has scroll detection, `userScrolledUp` state, and a "Scroll to bottom" FAB. Reuse it, do not rebuild.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom markdown parser | `toSanitizedMarkdownHtml()` from `ui/src/ui/markdown.ts` | Handles marked + DOMPurify + highlight.js + caching + truncation |
| Auto-scroll with lock | Custom scroll management | `message-list` component's built-in scroll handling | Already handles threshold detection, FAB, requestAnimationFrame |
| Agent color assignment | Random or manual colors | `getAgentColor(agentId)` from `ui/src/ui/state/agents.ts` | Deterministic hash*31 to 10-color WCAG palette |
| Agent identity lookup | Manual identity construction | `getAgentIdentity(agentId)` from `ui/src/ui/state/agents.ts` | Checks registry, falls back to derived identity |
| Token streaming display | Custom streaming renderer | `message-stream` component | Already reads stream signal, shows blinking cursor, handles markdown |
| Typing indicator | Custom typing animation | `typing-indicator` component | Already has avatar, name, dots animation |
| Agent status badges | Custom status rendering | `agent-status-bar` component | Already reads agentRegistry and agentStatuses signals |

**Key insight:** Every UI element needed for conversation view already exists as a v2.2 component. The work is wiring them to per-session data, not building new visual components.

## Common Pitfalls

### Pitfall 1: Not Distinguishing Per-Session vs Global Streaming
**What goes wrong:** The existing `chatStream` signal is a single global signal for the active chat session. Using it for the conversation view would conflict -- it only tracks one session's stream at a time.
**Why it happens:** It's tempting to reuse `chatStream` since it already works with `message-stream`.
**How to avoid:** Create a per-session stream map (`sessionStreams` signal) that tracks streaming text per sessionKey. The conversation view reads from this map for the selected session.
**Warning signs:** Stream text from one agent's session appearing in another session's view.

### Pitfall 2: Missing Stream Finalization
**What goes wrong:** When an agent completes (lifecycle.end), its streaming text stays in `sessionStreams` forever and never moves to the completed messages list.
**Why it happens:** The assistant stream accumulates text in `data.text` but the final message is only sent as the last delta before lifecycle.end. Without explicit finalization, the stream lingers.
**How to avoid:** On `lifecycle.end` or `lifecycle.error`, take the current stream text for that session, push it as a completed ConversationMessage to `sessionConversations`, and clear the session from `sessionStreams`.
**Warning signs:** Active streaming cursor visible after agent has completed.

### Pitfall 3: Agent Identity Not Available from Events
**What goes wrong:** Agent events carry `sessionKey` and sometimes `data.agentId`, but the session card's `agentId` may differ from what's in the event data. The conversation view needs to know which agent sent each message.
**Why it happens:** The `AgentEventPayload` doesn't always carry a clear sender identity. The `sessionKey` often encodes the agent (e.g., `agent:coder:main`), and the `data.agentId` field is set at lifecycle.start.
**How to avoid:** When lifecycle.start fires, capture the agentId from `data.agentId`. Store it in the session's state. For subsequent events on that session, use the stored agentId.
**Warning signs:** All messages showing the same avatar or "?" instead of agent-specific identifiers.

### Pitfall 4: Message-List Expects Specific Message Format
**What goes wrong:** The existing `message-list` component uses `normalizeMessage()` and `extractTextCached()` to process messages. These expect the message format from `chat.history` API responses (with `role`, `content` arrays, etc.).
**Why it happens:** The message-list was built for the Chat tab, which receives fully structured messages from the API.
**How to avoid:** Either (a) format conversation messages to match the expected structure, or (b) create a lightweight conversation-specific message renderer that directly renders ConversationMessage objects. Option (b) is cleaner since conversation messages are simpler (just agentId + text + timestamp).
**Warning signs:** Blank bubbles, missing text, or extraction errors in console.

### Pitfall 5: Auto-Scroll Race with Streaming Updates
**What goes wrong:** High-frequency token streaming (every ~80ms per TOOL_STREAM_THROTTLE_MS) causes excessive re-renders and scroll jitter.
**Why it happens:** Each signal update triggers a Lit re-render, which triggers the auto-scroll logic in `updated()`.
**How to avoid:** The message-stream component already handles this well -- it reads the stream signal directly and uses `requestAnimationFrame` for scroll. For the conversation view wrapper, ensure the scroll container is on the outer conversation-view, not duplicated inside nested components.
**Warning signs:** Janky scrolling, visible frame drops during fast streaming.

### Pitfall 6: Stale Closures on Signal Updates
**What goes wrong:** Signal `.get()` called in a closure captures a stale snapshot, not the latest value.
**Why it happens:** JavaScript closures capture variable references. If you read the signal value in a setup callback and use it later, you get the old value.
**How to avoid:** Always call `.get()` at render time inside `render()`, or use `SignalWatcher` mixin which automatically subscribes. This is already the pattern throughout the codebase (every component extends `SignalWatcher(LitElement)`).
**Warning signs:** UI showing stale data, state not updating on new events.

### Pitfall 7: Memory Leak from Unbounded Message Accumulation
**What goes wrong:** Long-running sessions accumulate thousands of conversation messages, consuming memory.
**Why it happens:** No cap on per-session message arrays.
**How to avoid:** Cap per-session conversation history (e.g., 500 messages). When lifecycle.end fires, can optionally trim older completed sessions. Follow the pattern from `toolStreamOrder` which caps at 50 entries.
**Warning signs:** Browser memory growing over time, page becoming sluggish.

## Code Examples

### Existing: How Agent Events Flow from Gateway to UI
```typescript
// Source: ui/src/ui/app-gateway.ts lines 185-191
// Gateway WebSocket receives event, dispatches to AgentsController
if (evt.event === "agent") {
  if (host.onboarding) return;
  agentsController.handleEvent(evt.payload as AgentEventPayload | undefined);
  handleAgentEvent(host, evt.payload as AgentEventPayload | undefined);
  return;
}
```

### Existing: Agent Event Payload Structure
```typescript
// Source: src/infra/agent-events.ts
export type AgentEventPayload = {
  runId: string;
  seq: number;
  stream: "lifecycle" | "tool" | "assistant" | "error" | (string & {});
  ts: number;
  data: Record<string, unknown>;
  sessionKey?: string;
  spawnedBy?: string;
  usage?: { ... };
};

// Assistant stream events carry:
// data.text = full accumulated text (string)
// data.delta = incremental token (string)
// data.mediaUrls = optional media (string[])
```

### Existing: Message Stream Component API
```typescript
// Source: ui/src/ui/components/message-stream.ts
// Currently reads from global chatStream signal
// Properties available:
@property() agentId = "";
@property({ type: Number }) startedAt = 0;
// Renders agent-avatar + markdown content from chatStream.get()
```

### Existing: Message List Auto-Scroll
```typescript
// Source: ui/src/ui/components/message-list.ts lines 153-189
// Tracks userScrolledUp state (>50px from bottom threshold)
// Auto-scrolls on new messages when !userScrolledUp
// Shows "Scroll to bottom" FAB when user has scrolled up
@state() private userScrolledUp = false;
private handleScroll(e: Event) {
  const container = e.currentTarget as HTMLElement;
  const distanceFromBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight;
  this.userScrolledUp = distanceFromBottom > 50;
}
```

### Existing: Typing Indicator API
```typescript
// Source: ui/src/ui/components/typing-indicator.ts
@property() agentId = "";
@property() agentName = "";
@property() agentColor = "#3b82f6";
// Renders: avatar + "{name} is thinking..." + pulsing dots
```

### Existing: Agent Status Bar
```typescript
// Source: ui/src/ui/components/agent-status-bar.ts
// Reads from agentRegistry and agentStatuses signals
// Renders a row of status badges for all registered agents
// No props needed -- reads signals directly via SignalWatcher
```

### Recommended: Conversation View Composition
```typescript
// NEW: ui/src/ui/views/conversation-view.ts (recommended structure)
import { html, nothing } from "lit";
import { sessionConversations, sessionStreams } from "../state/metrics";
import { getAgentIdentity } from "../state/agents";
import "../components/agent-avatar";
import "../components/typing-indicator";
import "../components/agent-status-bar";

export function renderConversation(sessionKey: string) {
  const messages = sessionConversations.get().get(sessionKey) ?? [];
  const activeStream = sessionStreams.get().get(sessionKey);

  return html`
    <div class="conversation-view">
      <agent-status-bar></agent-status-bar>
      <div class="conversation-messages">
        ${messages.map(msg => {
          const identity = getAgentIdentity(msg.agentId);
          return html`
            <div class="message-group">
              <agent-avatar
                .agentId=${msg.agentId}
                .name=${identity.name}
                .color=${identity.color}
                size="md"
              ></agent-avatar>
              <div class="bubble">
                ${unsafeHTML(toSanitizedMarkdownHtml(msg.text))}
              </div>
            </div>
          `;
        })}
        ${activeStream ? html`
          <message-stream
            .agentId=${activeStream.agentId}
          ></message-stream>
        ` : nothing}
      </div>
    </div>
  `;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global chatStream for streaming | Per-session stream tracking needed | Phase 27 | Must NOT conflict with existing chat tab streaming |
| Session cards as read-only | Session cards as drill-down entry points | Phase 27 | Click handler added to session cards |
| agentsController only updates metrics | agentsController also captures conversation data | Phase 27 | Extends existing handleEvent method |

**Deprecated/outdated:**
- None. All existing components are current and stable from v2.2.

## Open Questions

1. **Message-stream component: per-session vs global signal**
   - What we know: `message-stream` currently reads from the global `chatStream` signal. The conversation view needs per-session streaming.
   - What's unclear: Whether to modify message-stream to accept an optional signal/text prop, or create a conversation-specific streaming component.
   - Recommendation: Add an optional `.streamText` property to message-stream. If set, use it instead of `chatStream.get()`. This is backward-compatible and avoids component duplication. If this proves too invasive, create a `conversation-stream` wrapper that passes text directly.

2. **Session card click interaction: inline expansion vs separate view**
   - What we know: Phase 26's agents view shows session cards in a flex grid. The conversation view needs to display when a card is clicked.
   - What's unclear: Whether to expand inline (slide-down panel), replace the card grid (full-screen conversation), or use a split-pane layout.
   - Recommendation: Use a conditional layout -- when a session is selected, show conversation view full-width with a back button to return to the card grid. This matches the mobile-first pattern and avoids complex split-pane CSS. The selected sessionKey can be stored in a local signal.

3. **Agent identity in multi-agent conversations**
   - What we know: A session may involve handoffs between agents (spawnedBy relationship). The conversation view should show which agent is speaking.
   - What's unclear: Whether sub-agent messages arrive on the parent's sessionKey or on their own sessionKey.
   - Recommendation: Start with single-session conversations. Each session shows messages from that session's agent. If the gateway sends events with different agentIds on the same sessionKey (e.g., during handoff), the view should handle it by showing different avatars per message.

4. **Reconnection behavior and conversation state**
   - What we know: STATE.md notes "Reconnection does not replay agent lifecycle events -- need re-fetch after hello-ok." The AgentsController.reset() is called on reconnect.
   - What's unclear: Whether conversation history is lost on reconnect (likely yes, since it's from in-memory signals).
   - Recommendation: Accept that conversation history is session-scoped (lost on disconnect). This matches the current agentSessions behavior. Can show a "Reconnected -- previous conversation data was not preserved" message. History fetch via API can be a future enhancement.

## Sources

### Primary (HIGH confidence)
- `ui/src/ui/components/message-stream.ts` - Component API and signal usage verified
- `ui/src/ui/components/message-list.ts` - Auto-scroll implementation verified
- `ui/src/ui/components/typing-indicator.ts` - Component props verified
- `ui/src/ui/components/agent-avatar.ts` - Component props and color resolution verified
- `ui/src/ui/components/agent-status-bar.ts` - Signal consumption verified
- `ui/src/ui/state/metrics.ts` - Session signal pattern verified
- `ui/src/ui/state/agents.ts` - Agent identity and color signals verified
- `ui/src/ui/state/chat.ts` - Chat stream signal pattern verified
- `ui/src/ui/controllers/agents-controller.ts` - Event handling pipeline verified
- `ui/src/ui/app-gateway.ts` - Gateway event dispatch verified
- `ui/src/ui/app-tool-stream.ts` - AgentEventPayload type definition verified
- `src/infra/agent-events.ts` - Backend event stream types verified (lifecycle, tool, assistant, error)
- `src/gateway/server-chat.ts` - Gateway broadcasts agent events to all clients verified
- `src/agents/pi-embedded-subscribe.handlers.messages.ts` - Assistant stream emits text + delta verified
- `ui/src/ui/markdown.ts` - Markdown rendering pipeline verified

### Secondary (MEDIUM confidence)
- `ui/src/ui/views/agent-chat.ts` - Reference architecture for conversation composition (verified via code reading, used as pattern reference)

### Tertiary (LOW confidence)
- None. All findings derived from direct codebase inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Zero new dependencies, all components verified in codebase
- Architecture: HIGH - All patterns derived from existing codebase conventions (signal maps, controller event handling, view composition)
- Pitfalls: HIGH - Identified from actual code analysis (chatStream global vs per-session, message format expectations, scroll behavior)

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days -- stable codebase, no external dependency changes expected)
