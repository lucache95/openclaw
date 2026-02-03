# Phase 19: Gateway Connection & State Management - Research

**Researched:** 2026-02-02
**Domain:** WebSocket reconnection patterns + Lit reactive state with signals
**Confidence:** MEDIUM

## Summary

This phase extends the existing `GatewayBrowserClient` (from Phase 18) to integrate with a new reactive UI state layer using @lit-labs/signals. The foundation already includes auto-reconnect with exponential backoff (800ms → 15s) and gap detection. The research focused on three technical domains:

1. **@lit-labs/signals integration** - TC39 signals proposal integration with Lit's reactive lifecycle for shared observable state across components
2. **WebSocket reconnection patterns** - Industry best practices for resilient browser WebSocket connections with proper UI feedback
3. **Connection status UI patterns** - Visual indicators for connected/reconnecting/disconnected states

The standard approach is to use @lit-labs/signals for shared connection state (connected status, messages) that multiple components observe, while keeping component-local state in @state decorators. WebSocket reconnection should include exponential backoff with jitter, heartbeat detection, and clear user-facing status indicators.

**Primary recommendation:** Use @lit-labs/signals v0.2.0 with SignalWatcher mixin for shared gateway state (connection status, incoming messages), combine with existing GatewayBrowserClient auto-reconnect, and provide visible connection status UI (connected, reconnecting, disconnected).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @lit-labs/signals | 0.2.0 | Reactive state management for Lit | Official Lit Labs package implementing TC39 Signals Proposal; enables shared observable state across components with fine-grained reactivity |
| signal-polyfill | (bundled) | TC39 signals polyfill | Automatically included with @lit-labs/signals; provides cross-browser support for signals standard |
| Lit | 3.3.2+ | Web components framework | Already in use (ui/package.json shows ^3.3.2); signals integrate with Lit's reactive lifecycle |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| WebSocket API | (browser native) | Real-time bidirectional communication | Built-in browser API; no library needed for basic WebSocket operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @lit-labs/signals | @lit-labs/preact-signals | Preact signals have more mature ecosystem but require Preact dependency; TC39 signals are the future standard |
| @lit-labs/signals | Zustand or Redux | More mature state libs but heavier weight; signals are lighter and integrate natively with Lit's reactive system |
| Signals for all state | @state decorators only | @state works for component-local state; signals better for shared cross-component state like connection status |

**Installation:**
```bash
npm install @lit-labs/signals
```

Note: @lit-labs/signals automatically includes signal-polyfill as a dependency.

## Architecture Patterns

### Recommended Project Structure
```
ui/src/
├── state/              # Shared signals state
│   ├── gateway.ts      # Gateway connection signals (connected, status, etc)
│   └── messages.ts     # Message state signals
├── ui/
│   ├── gateway.ts      # GatewayBrowserClient (existing, Phase 18)
│   ├── app-gateway.ts  # Gateway integration (existing)
│   └── components/
│       └── connection-status.ts  # Connection indicator component
```

### Pattern 1: Shared Observable State with Signals
**What:** Create signals for state shared across multiple components (connection status, incoming messages)
**When to use:** When multiple components need to react to the same state changes (e.g., connection status affects header, sidebar, chat input)
**Example:**
```typescript
// Source: https://lit.dev/docs/data/signals/ (verified via WebSearch)
import { signal } from '@lit-labs/signals';
import { SignalWatcher } from '@lit-labs/signals';

// Shared state - multiple components can observe
export const connectionStatus = signal<'connected' | 'reconnecting' | 'disconnected'>('disconnected');
export const lastError = signal<string | null>(null);

// Component consuming shared state
@customElement('connection-status')
export class ConnectionStatus extends SignalWatcher(LitElement) {
  render() {
    const status = connectionStatus.get();
    return html`
      <div class="status status-${status}">
        ${status === 'connected' ? '●' : status === 'reconnecting' ? '◐' : '○'}
        ${status}
      </div>
    `;
  }
}
```

### Pattern 2: Pinpoint Updates with watch() Directive
**What:** Use watch() directive for targeted DOM updates without full component re-render
**When to use:** When a signal change should only update specific bindings, not entire component
**Example:**
```typescript
// Source: https://lit.dev/docs/data/signals/ (verified via WebSearch)
import { watch } from '@lit-labs/signals';
import { html, LitElement } from 'lit';

@customElement('message-count')
export class MessageCount extends LitElement {
  render() {
    // Only this binding updates when messageCount changes, not entire render()
    return html`
      <span>Messages: ${watch(messageCount)}</span>
    `;
  }
}
```

### Pattern 3: Gateway Integration with Signals
**What:** Bridge GatewayBrowserClient callbacks to signal updates
**When to use:** Connect existing WebSocket client (Phase 18) to new signals-based reactive state
**Example:**
```typescript
// Source: Existing gateway.ts pattern + signals integration pattern
import { connectionStatus, lastError } from './state/gateway';

export function connectGateway(host: GatewayHost) {
  connectionStatus.set('reconnecting');

  host.client = new GatewayBrowserClient({
    url: host.settings.gatewayUrl,
    onHello: (hello) => {
      connectionStatus.set('connected');
      lastError.set(null);
      // existing logic...
    },
    onClose: ({ code, reason }) => {
      connectionStatus.set('disconnected');
      if (code !== 1012) {
        lastError.set(`disconnected (${code}): ${reason || "no reason"}`);
      }
    },
    onEvent: (evt) => {
      // Update message signals when events arrive
      handleGatewayEvent(host, evt);
    }
  });
}
```

### Pattern 4: Connection Status UI Indicator
**What:** Visual component showing connected/reconnecting/disconnected states
**When to use:** Always - users need feedback about connection health
**Example:**
```typescript
// Source: https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view
// Combined with Lit signals pattern
@customElement('gateway-status')
export class GatewayStatus extends SignalWatcher(LitElement) {
  render() {
    const status = connectionStatus.get();
    const error = lastError.get();

    return html`
      <div class="gateway-status ${status}">
        <span class="indicator"></span>
        <span class="label">
          ${status === 'connected' ? 'Connected' :
            status === 'reconnecting' ? 'Reconnecting...' :
            'Disconnected'}
        </span>
        ${error ? html`<span class="error">${error}</span>` : ''}
      </div>
    `;
  }

  static styles = css`
    .indicator {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .connected .indicator { background: green; }
    .reconnecting .indicator { background: orange; animation: pulse 1s infinite; }
    .disconnected .indicator { background: red; }
  `;
}
```

### Anti-Patterns to Avoid
- **Mixing @state and signals for same data:** Don't duplicate connection status in both @state() and signals. Choose one source of truth (signals for shared state, @state for component-local).
- **Forgetting SignalWatcher mixin:** If you use signal.get() in render() without SignalWatcher mixin, component won't auto-update when signal changes.
- **Over-using signals:** Don't convert all @state to signals. Keep component-local state as @state; only use signals for shared cross-component state.
- **Synchronous signal updates in async callbacks:** Signals update synchronously; be careful about updating signals from within async WebSocket callbacks to avoid race conditions.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exponential backoff with jitter | Custom setTimeout logic with manual delay calculation | Built into GatewayBrowserClient (Phase 18: 800ms → 15s with 1.7x multiplier) | Already implemented; handles thundering herd prevention, max delay cap, backoff reset on success |
| Reactive state across components | Custom event emitters or global objects | @lit-labs/signals with SignalWatcher mixin | TC39 standard, native Lit integration, automatic component updates, pinpoint DOM updates |
| Message gap detection | Manual sequence number tracking | GatewayBrowserClient.onGap callback (Phase 18) | Already tracks lastSeq, detects gaps, provides expected/received for debugging |
| Connection heartbeat/ping | Custom setInterval pong logic | GatewayBrowserClient already handles (via gateway.policy.tickIntervalMs) | Server-driven heartbeat policy, automatic disconnect on timeout |

**Key insight:** Phase 18 already built a robust WebSocket client with auto-reconnect, backoff, gap detection, and heartbeat. Phase 19 adds reactive UI state layer, not WebSocket plumbing. Don't rebuild what exists; bridge it to signals.

## Common Pitfalls

### Pitfall 1: Race Condition Between Initial State Fetch and WebSocket Connection
**What goes wrong:** Events can be missed in the window between fetching initial snapshot and establishing WebSocket connection. For example: fetch state at T0, WebSocket connects at T2, but event arrives at T1 (after fetch, before socket connected).
**Why it happens:** Snapshot capture and WebSocket establishment are separate async operations with no coordination.
**How to avoid:** GatewayBrowserClient already implements chat.replay on reconnect (lines 232-258 in gateway.ts). Use similar pattern for other state: after WebSocket hello, request replay/sync of missed events based on lastSeq tracking.
**Warning signs:** Users report "missing messages" after reconnect; event sequence numbers show gaps that onGap doesn't catch (because events arrived before connection).

### Pitfall 2: Thundering Herd on Server Restart
**What goes wrong:** All clients attempt to reconnect simultaneously when server restarts, overwhelming server and causing cascading failures.
**Why it happens:** Plain exponential backoff without jitter causes synchronized reconnection attempts.
**How to avoid:** Add randomization/jitter to backoff delays. Current implementation uses 1.7x multiplier which helps, but consider adding ±10% jitter. Example: `const delay = backoffMs * (0.9 + Math.random() * 0.2)`.
**Warning signs:** Server CPU/memory spikes during restarts; connection success rate drops during high-load reconnection windows.

### Pitfall 3: Stale Signals After Component Disconnection
**What goes wrong:** Signals continue to hold values after component disconnects, potentially causing memory leaks or stale state.
**Why it happens:** Signals are global/shared state; components may disconnect but signals persist.
**How to avoid:** For connection-scoped signals, reset them when gateway disconnects. Example: `connectionStatus.set('disconnected'); lastError.set(null);` in onClose handler. Don't try to "clean up" signals on component disconnect - signals are meant to persist.
**Warning signs:** Memory usage grows over time; old connection errors appear after new connection established.

### Pitfall 4: Silent Connection Failures Without User Feedback
**What goes wrong:** WebSocket disconnects but user doesn't notice until they try to interact, leading to confusion and perceived bugs.
**Why it happens:** No visible connection status indicator in UI.
**How to avoid:** Always display connection status visibly (header, sidebar, toast). Use color coding (green/orange/red) and status text. Disable interactive elements (chat input, send button) when disconnected.
**Warning signs:** Users report "app is broken" when actually just disconnected; support tickets about "messages not sending" during network issues.

### Pitfall 5: Using Experimental @lit-labs/signals in Production Without Understanding Stability Risks
**What goes wrong:** Breaking changes in @lit-labs/signals (or underlying TC39 proposal/polyfill) break production app unexpectedly.
**Why it happens:** @lit-labs/signals is experimental (v0.2.0); Labs packages have "missing features, serious bugs, and more frequent breaking changes than core Lit libraries"; depends on unstable TC39 proposal.
**How to avoid:** Pin exact version (@lit-labs/signals@0.2.0, not ^0.2.0). Monitor Lit Labs discussions (https://github.com/lit/lit/discussions/4779) for breaking changes. Test thoroughly before updating. Consider fallback plan (can revert to @state if signals breaks).
**Warning signs:** Unexpected errors after npm install/update; signals stop triggering updates; TypeScript errors from changed API.

### Pitfall 6: Not Resetting Backoff Delay After Successful Connection
**What goes wrong:** After a long disconnection with maxed-out backoff (15s), next disconnection still uses 15s delay instead of resetting to 800ms.
**Why it happens:** Forgetting to reset backoffMs on successful connection.
**How to avoid:** GatewayBrowserClient already resets backoff in sendConnect() success handler (line 229: `this.backoffMs = 800`). Ensure any custom reconnection logic includes similar reset.
**Warning signs:** Reconnection feels sluggish even after stable connection; users wait 15s for reconnect on brief network blips.

## Code Examples

Verified patterns from official sources:

### Creating and Using Signals
```typescript
// Source: https://lit.dev/docs/data/signals/ + https://www.npmjs.com/package/@lit-labs/signals
import { signal } from '@lit-labs/signals';

// Create signal with initial value
const connectionStatus = signal<'connected' | 'reconnecting' | 'disconnected'>('disconnected');

// Read signal value
const currentStatus = connectionStatus.get();

// Update signal value
connectionStatus.set('connected');

// Computed signals (derive from other signals)
import { computed } from '@lit-labs/signals';
const isOnline = computed(() => connectionStatus.get() === 'connected');
```

### SignalWatcher Mixin for Auto-Tracking
```typescript
// Source: https://lit.dev/docs/data/signals/
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';

@customElement('my-component')
export class MyComponent extends SignalWatcher(LitElement) {
  render() {
    // Any signal.get() calls in render() are automatically tracked
    // Component re-renders when those signals change
    return html`<div>Status: ${connectionStatus.get()}</div>`;
  }
}
```

### watch() Directive for Pinpoint Updates
```typescript
// Source: https://lit.dev/docs/data/signals/
import { LitElement, html } from 'lit';
import { watch } from '@lit-labs/signals';

@customElement('message-indicator')
export class MessageIndicator extends LitElement {
  render() {
    // Only this specific binding updates when messageCount changes
    // Rest of render() is not re-run
    return html`
      <div>
        <h1>Messages</h1>
        <span class="count">${watch(messageCount)}</span>
      </div>
    `;
  }
}
```

### Integrating with GatewayBrowserClient
```typescript
// Source: Existing ui/src/ui/gateway.ts + signals pattern
import { signal } from '@lit-labs/signals';
import { GatewayBrowserClient } from './gateway';

// Shared signals
export const gatewayConnected = signal(false);
export const gatewayError = signal<string | null>(null);
export const incomingMessages = signal<GatewayEventFrame[]>([]);

export function initGateway(url: string, token?: string) {
  const client = new GatewayBrowserClient({
    url,
    token,
    clientName: 'openclaw-control-ui',
    mode: 'webchat',
    onHello: (hello) => {
      gatewayConnected.set(true);
      gatewayError.set(null);
    },
    onClose: ({ code, reason }) => {
      gatewayConnected.set(false);
      if (code !== 1012) {
        gatewayError.set(`disconnected (${code}): ${reason || 'no reason'}`);
      }
    },
    onEvent: (evt) => {
      // Update signals with new events
      incomingMessages.set([...incomingMessages.get(), evt]);
    },
    onGap: ({ expected, received }) => {
      gatewayError.set(`event gap detected (expected seq ${expected}, got ${received})`);
    },
  });

  client.start();
  return client;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual WebSocket reconnection with setTimeout | Exponential backoff with jitter | Became best practice ~2020-2022 | Prevents thundering herd, reduces server load during outages |
| Custom global state objects | TC39 Signals Proposal | Proposal active 2023+; Lit integration Oct 2024 | Cross-framework compatible signals; native browser support coming |
| Reactive properties (@state) for all state | Signals for shared state, @state for local | @lit-labs/signals released Oct 2024 | Fine-grained reactivity, pinpoint DOM updates, shared observable state |
| Silent WebSocket failures | Visible connection status indicators | Industry standard by 2023 | Better UX, users understand network issues vs app bugs |

**Deprecated/outdated:**
- **@lit-labs/preact-signals**: While still functional, TC39 signals (@lit-labs/signals) are the recommended path forward as they align with the future standard; Preact signals require Preact dependency.
- **Custom event emitters for cross-component state**: Replaced by signals; events are for one-time notifications, signals for reactive state.
- **Manual gap detection**: GatewayBrowserClient already implements sequence tracking and gap detection (Phase 18); don't build custom logic.

## Open Questions

Things that couldn't be fully resolved:

1. **@lit-labs/signals production readiness timeline**
   - What we know: Package is v0.2.0 (Oct 2024), marked experimental, "not recommended for production use"
   - What's unclear: When will signals graduate from Labs to core Lit? What's the breaking change risk in next 6-12 months?
   - Recommendation: Use signals but pin exact version (0.2.0); monitor https://github.com/lit/lit/discussions/4779; have rollback plan to @state if needed. Acceptable risk for internal tool; reconsider for public-facing app.

2. **Optimal jitter strategy for reconnection backoff**
   - What we know: Current implementation uses 1.7x multiplier (800ms → 1360ms → 2312ms → ... → 15s max)
   - What's unclear: Should we add additional randomization (±10% jitter) or is 1.7x multiplier sufficient to prevent thundering herd?
   - Recommendation: Test current behavior first; if server shows reconnection spikes during restarts, add jitter: `const delay = this.backoffMs * (0.9 + Math.random() * 0.2);`

3. **Signal cleanup strategy for long-lived sessions**
   - What we know: Signals persist globally; messages accumulate in incomingMessages signal
   - What's unclear: Should we cap message history in signals? When to trim old messages?
   - Recommendation: For incomingMessages, implement sliding window (e.g., keep last 100 messages) or clear on session change. Monitor memory usage during testing.

4. **Integration with existing @state decorators**
   - What we know: Current app.ts uses ~30+ @state() properties; mixing @state and signals is allowed
   - What's unclear: Which existing @state properties should migrate to signals vs stay as @state?
   - Recommendation: Migrate only shared cross-component state (connected, hello, eventLog, chatMessages); keep component-local state as @state. Don't convert everything blindly.

## Sources

### Primary (HIGH confidence)
- Lit official docs - Signals: https://lit.dev/docs/data/signals/
- @lit-labs/signals npm package: https://www.npmjs.com/package/@lit-labs/signals
- Lit blog - Bringing Signals to Lit Labs: https://lit.dev/blog/2024-10-08-signals/
- Existing codebase - ui/src/ui/gateway.ts (Phase 18 implementation)

### Secondary (MEDIUM confidence)
- Justin Fagnani's blog - Reactive State with Signals in Lit: https://justinfagnani.com/2024/10/09/reactive-state-with-signals-in-lit/ (Lit team member, Oct 2024)
- OneUpTime blog - WebSocket Reconnection Logic: https://oneuptime.com/blog/post/2026-01-24-websocket-reconnection-logic/view (Jan 2026, recent best practices)
- Apidog blog - WebSocket Reconnect Strategies: https://apidog.com/blog/websocket-reconnect/ (verified patterns)
- DEV Community - Robust WebSocket Reconnection with Exponential Backoff: https://dev.to/hexshift/robust-websocket-reconnection-strategies-in-javascript-with-exponential-backoff-40n1

### Tertiary (LOW confidence)
- GitHub discussions - Labs Feedback: @lit-labs/signals: https://github.com/lit/lit/discussions/4779 (community feedback, some concerns about stability)
- Medium - Effective State Management in Lit Components: https://medium.com/@asierr/effective-state-management-in-lit-components-a-developers-guide-696e7f637354 (general patterns, not signals-specific)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - @lit-labs/signals is experimental (v0.2.0, Labs package, unstable TC39 proposal); version verified via WebSearch but not official docs (403 blocked). WebSocket patterns are HIGH confidence (well-established, Phase 18 already implements).
- Architecture: MEDIUM - Signals patterns verified from Lit official docs and team member blog; existing gateway.ts provides solid foundation. Integration approach is logical but not yet battle-tested in this codebase.
- Pitfalls: MEDIUM - WebSocket pitfalls are well-documented industry knowledge (HIGH); signals pitfalls are partially documented (experimental warnings clear) but production experience limited (MEDIUM).

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days) - @lit-labs/signals is under active development; check for updates before implementation. WebSocket patterns are stable (valid 6+ months).

**Notes:**
- Phase 18 already built robust WebSocket foundation; Phase 19 is about reactive UI layer, not WebSocket plumbing
- @lit-labs/signals is experimental but aligns with TC39 standard (future-proof direction)
- Existing codebase uses Lit 3.3.2 with @state decorators; signals complement (not replace) @state
- Connection status UI is critical for UX; WebSocket failures are common and must be visible to users
