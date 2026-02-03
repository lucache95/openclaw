# Roadmap: OpenClaw Optimization

## Milestones

- v1.0 Core Optimization - Phases 1-7 (shipped 2026-02-02)
- **v2.0 Multi-Agent Infrastructure** - Phases 8-12 (in progress)
- **v2.2 Agent Chat Interface** - Phases 18-24
- **v2.3 Live Agent Dashboard** - Phases 25-27

## Phases

<details>
<summary>v1.0 Core Optimization (Phases 1-7) - SHIPPED 2026-02-02</summary>

### Phase 1: Setup

**Goal**: Fork and configure OpenClaw repository
**Plans**: 1 plan

Plans:

- [x] 01-01: Fork repo, update to latest, set up upstream tracking

### Phase 2: Context Survival

**Goal**: Implement hot context pattern and monitoring
**Plans**: 5 plans

Plans:

- [x] 02-01: Implement ACTIVE.md hot context pattern
- [x] 02-02: Add context monitoring with tiered thresholds
- [x] 02-03: Implement structured compaction
- [x] 02-04: Add pre-compaction memory flush
- [x] 02-05: Integration testing

### Phase 3: Local LLM

**Goal**: Set up Ollama for local inference
**Plans**: 4 plans

Plans:

- [x] 03-01: Install Ollama on Apple Silicon
- [x] 03-02: Pull qwen2.5:3b model
- [x] 03-03: Set up nomic-embed-text and sqlite-vec
- [x] 03-04: Implement task routing

### Phase 4: Security

**Goal**: Secure credential storage
**Plans**: 4 plans

Plans:

- [x] 04-01: Move credentials to Keychain
- [x] 04-02: Set up GPG vault
- [x] 04-03: Automated security audit
- [x] 04-04: Final verification

### Phase 5: Sub-Agents

**Goal**: Prepare delegation infrastructure
**Plans**: 2 plans

Plans:

- [x] 05-01: Create delegation brief templates
- [x] 05-02: Define result aggregation format

### Phase 6: Secondary Provider

**Goal**: Integrate MiniMax M2 for cost savings
**Plans**: 3 plans

Plans:

- [x] 06-01: Integrate MiniMax M2
- [x] 06-02: Implement three-tier routing
- [x] 06-03: Wire API key into config

### Phase 7: Documentation

**Goal**: Document multi-agent patterns
**Plans**: 2 plans

Plans:

- [x] 07-01: Document context survival patterns
- [x] 07-02: Document fleet deployment guide

</details>

## v2.0 Multi-Agent Infrastructure (In Progress)

**Milestone Goal:** Complete infrastructure gaps and build coordination layer for multi-agent fleet deployment. Prepares everything needed to deploy 6 specialized agents in v2.1.

**Phase Numbering:**

- Integer phases (8, 9, 10): Planned milestone work
- Decimal phases (8.1, 8.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 8: Infrastructure Completion** - Complete local models, backup, and credential migration
- [ ] **Phase 9: Heartbeat System** - Staggered wake protocol for fleet coordination
- [ ] **Phase 10: Notification System** - @mention detection and delivery between agents
- [ ] **Phase 11: Fleet Coordination** - Daily standup, status tracking, activity feed
- [ ] **Phase 12: Agent Templates** - SOUL.md templates and session configs for 6 agent roles

## Phase Details

### Phase 8: Infrastructure Completion

**Goal**: All infrastructure prerequisites complete for multi-agent deployment
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: INFRA-01, INFRA-02, INFRA-03
**Success Criteria** (what must be TRUE):

1. phi4 model responds to test prompt via Ollama
2. Encrypted backup script runs and creates GPG-encrypted archive of ~/clawd
3. `scripts/security-audit.sh` reports zero plaintext credentials
   **Plans**: TBD

Plans:

- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Heartbeat System

**Goal**: Agents wake on schedule with staggered timing to avoid resource contention
**Depends on**: Phase 8
**Requirements**: HEART-01, HEART-02, HEART-03, HEART-04
**Success Criteria** (what must be TRUE):

1. Cron jobs configured with 2-minute offsets per agent
2. HEARTBEAT.md checklist exists with wake protocol steps
3. lastChecks.json tracks heartbeat state per agent
4. Wake protocol includes Mission Control @mention check
   **Plans**: TBD

Plans:

- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Notification System

**Goal**: Agents can notify each other via @mentions with reliable delivery
**Depends on**: Phase 9
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04
**Success Criteria** (what must be TRUE):

1. Message containing @agentname triggers notification creation
2. Notification daemon delivers pending notifications to agent sessions
3. Commenting on or being assigned to a thread auto-subscribes the agent
4. Notifications table tracks delivered status (pending/delivered)
   **Plans**: TBD

Plans:

- [ ] 10-01: TBD
- [ ] 10-02: TBD

### Phase 11: Fleet Coordination

**Goal**: Fleet operates as coordinated unit with visible status and activity tracking
**Depends on**: Phase 10
**Requirements**: COORD-01, COORD-02, COORD-03, COORD-04
**Success Criteria** (what must be TRUE):

1. Daily standup cron sends summary to Telegram at configured time
2. Agent status visible in Mission Control (idle/active/blocked)
3. Tasks enforce lifecycle: inbox -> assigned -> in_progress -> review -> done
4. Activity feed logs all agent actions with timestamps
   **Plans**: TBD

Plans:

- [ ] 11-01: TBD
- [ ] 11-02: TBD

### Phase 12: Agent Templates

**Goal**: All 6 agent roles defined with SOUL templates and session configs ready for deployment
**Depends on**: Phase 11
**Requirements**: TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06, TMPL-07
**Success Criteria** (what must be TRUE):

1. SOUL.md exists for Coder agent (GSD-focused implementation patterns)
2. SOUL.md exists for Researcher agent (market/tech intel gathering)
3. SOUL.md exists for Writer agent (content/docs/emails)
4. SOUL.md exists for QA/Tester, DevOps, and Designer agents
5. openclaw.json contains session configs for all 6 agents
   **Plans**: TBD

Plans:

- [ ] 12-01: TBD
- [ ] 12-02: TBD
- [ ] 12-03: TBD

## v2.2 Agent Chat Interface

**Milestone Goal:** Build the webchat agent interface with real-time messaging, resilient connections, and reactive UI state.

- [x] **Phase 18: Message Persistence & Replay** - SQLite chat persistence, replay RPC, sequence tracking
- [ ] **Phase 19: Gateway Connection & State Management** - Resilient WebSocket connection with reactive signals

### Phase 19: Gateway Connection & State Management

**Goal**: Clients maintain a resilient real-time connection with reactive UI state
**Depends on**: Phase 18 (completed)
**Requirements**: MSG-04, MSG-05
**Success Criteria** (what must be TRUE):

1. WebSocket auto-reconnects after network interruption with exponential backoff (no manual refresh needed)
2. UI components reactively update when new messages arrive via @lit-labs/signals state layer
3. Connection status is visible to the user (connected, reconnecting, disconnected)
   **Plans**: 2 plans

Plans:

- [ ] 19-01-PLAN.md -- Install @lit-labs/signals, create connection state signals and indicator component
- [ ] 19-02-PLAN.md -- Wire signals into gateway lifecycle, create chat signals, render indicator in UI

## v2.3 Live Agent Dashboard

**Milestone Goal:** Wire v2.2 UI components to live gateway events so the Agents tab shows real-time agent sessions, handoffs, and status updates with full agent conversation visibility.

- [ ] **Phase 25: Event Wiring Foundation** - AgentsController, gateway event routing, signals connection
- [ ] **Phase 26: Agents Tab & Session Cards** - Tab registration, view rendering, live session cards
- [ ] **Phase 27: Conversation View** - Live message stream, typing indicators, markdown, auto-scroll
- [ ] **Phase 27.1: A2A Conversation Visibility** - Make inter-agent conversations visible as threaded back-and-forth chat (INSERTED)

### Phase 25: Event Wiring Foundation

**Goal**: Gateway agent events flow through a controller to reactive signals that drive UI updates
**Depends on**: Phase 24 (v2.2 complete)
**Requirements**: WIRE-01, WIRE-02, WIRE-03
**Success Criteria** (what must be TRUE):

1. AgentsController class exists and bridges gateway WebSocket events to agentSessions signal updates
2. Gateway "agent" lifecycle events (spawn, status change, complete, error) update the agentSessions signal in real time
3. AgentsController is initialized in app.ts and wired into app-gateway.ts event routing so events flow end-to-end
   **Plans**: TBD

Plans:

- [ ] 25-01: TBD
- [ ] 25-02: TBD

### Phase 26: Agents Tab & Session Cards

**Goal**: Users can navigate to an Agents tab and see live session cards reflecting real-time agent activity
**Depends on**: Phase 25
**Requirements**: TAB-01, TAB-02, TAB-03, LIVE-01, LIVE-02, LIVE-03
**Success Criteria** (what must be TRUE):

1. "Agents" tab appears in navigation with icon, title, and subtitle, and clicking it shows the agents view
2. Session cards render from live agentSessions signal data with real-time status updates (thinking/executing/complete/error)
3. Each session card displays the agent's name and color identity marker from live event data
4. When no sessions exist or the gateway is offline, appropriate empty/disconnected states are shown
   **Plans**: 1 plan

Plans:

- [ ] 26-01-PLAN.md -- Register agents tab in navigation and create live session cards view with signal wiring

### Phase 27: Conversation View

**Goal**: Users can watch full agent-to-agent conversations stream in real time with rich formatting
**Depends on**: Phase 26
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06
**Success Criteria** (what must be TRUE):

1. Clicking a session card opens a live message stream showing agent-to-agent conversation with token-by-token streaming
2. Each message bubble shows the agent's avatar, name, and color so agents are visually distinguishable
3. Typing/activity indicators show which agent is currently generating, and agent status (idle/thinking/executing/waiting) is visible
4. Messages auto-scroll to newest content, but scrolling up pauses auto-scroll until the user scrolls back down
5. Agent messages render markdown and code blocks with proper formatting
   **Plans**: 2 plans

Plans:

- [ ] 27-01-PLAN.md -- Per-session conversation signals and AgentsController event capture
- [ ] 27-02-PLAN.md -- Conversation view component with live streaming, auto-scroll, and markdown

### Phase 27.1: A2A Conversation Visibility (INSERTED)

**Goal**: Inter-agent conversations (Ethos ↔ GSD ping-pong via sessions_send) are visible in the Agents tab as a threaded back-and-forth chat showing both sides of the conversation
**Depends on**: Phase 27
**Requirements**: CHAT-01 (gap closure), CHAT-02 (gap closure)
**Success Criteria** (what must be TRUE):

1. When Ethos calls sessions_send to GSD, each ping-pong turn emits a conversation event with fromAgent, toAgent, conversationId, and turn number
2. The UI merges events from both sessions into a unified conversation thread showing "Ethos asked: X" → "GSD replied: Y" back-and-forth
3. Clicking a session card that has A2A conversation data shows the threaded conversation view with both agents' messages interleaved
4. GSD's questioning phase (clarifying questions to Ethos) is visible as a real conversation in the Agents tab
   **Plans**: 3 plans

Plans:

- [ ] 27.1-01-PLAN.md -- Backend A2A event emission (conversationId, turn events, REPLY_SKIP filtering)
- [ ] 27.1-02-PLAN.md -- UI state layer (a2aConversations signal, mutators, AgentsController routing)
- [ ] 27.1-03-PLAN.md -- UI rendering (threaded conversation view, session card A2A indicators)

## Progress

**Execution Order:**
Phases execute in numeric order: 8 -> 8.1 -> 8.2 -> 9 -> 9.1 -> 10 -> etc.

| Phase                   | Milestone | Plans Complete | Status      | Completed  |
| ----------------------- | --------- | -------------- | ----------- | ---------- |
| 1-7                     | v1.0      | 21/21          | Complete    | 2026-02-02 |
| 8. Infrastructure       | v2.0      | 0/TBD          | Not started | -          |
| 9. Heartbeat            | v2.0      | 0/TBD          | Not started | -          |
| 10. Notification        | v2.0      | 0/TBD          | Not started | -          |
| 11. Coordination        | v2.0      | 0/TBD          | Not started | -          |
| 12. Templates           | v2.0      | 0/TBD          | Not started | -          |
| 18. Message Persistence | v2.2      | 3/3            | Complete    | -          |
| 19. Gateway Connection  | v2.2      | 0/2            | Planned     | -          |
| 25. Event Wiring        | v2.3      | 0/TBD          | Not started | -          |
| 26. Agents Tab & Cards  | v2.3      | 1/1            | Complete    | -          |
| 27. Conversation View   | v2.3      | 0/2            | Planned     | -          |
| 27.1 A2A Conversation   | v2.3      | 0/TBD          | Not started | -          |

---

_Roadmap created: 2026-02-02_
_v1.0 shipped: 2026-02-02_
_v2.0 started: 2026-02-02_
_v2.2 phase 19 planned: 2026-02-02_
_v2.3 phases 25-27 planned: 2026-02-03_
_Phase 26 planned: 2026-02-03_
_Phase 27 planned: 2026-02-03_
