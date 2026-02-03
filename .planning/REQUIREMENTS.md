# Requirements: OpenClaw Optimization

**Defined:** 2026-02-02
**Core Value:** Context must survive -- build coordination layer for reliable multi-agent fleet

## v2.0 Requirements

Requirements for multi-agent infrastructure. Each maps to roadmap phases.

### Infrastructure Completion

- [ ] **INFRA-01**: phi4 reasoning model pulled and available for complex local tasks
- [ ] **INFRA-02**: Encrypted backup script creates daily GPG-encrypted ~/clawd backup
- [ ] **INFRA-03**: All remaining plaintext credentials migrated to GPG vault

### Heartbeat System

- [ ] **HEART-01**: Staggered heartbeat crons configured (2-min offset per agent)
- [ ] **HEART-02**: HEARTBEAT.md checklist defines agent wake protocol
- [ ] **HEART-03**: Heartbeat state tracking via lastChecks JSON file
- [ ] **HEART-04**: Agent can check Mission Control for @mentions on wake

### Notification System

- [ ] **NOTIF-01**: @mention detection parses messages for @agentname patterns
- [ ] **NOTIF-02**: Notification delivery daemon polls DB and delivers to agent sessions
- [ ] **NOTIF-03**: Thread subscription system auto-subscribes on comment/assign
- [ ] **NOTIF-04**: Notifications table tracks delivered status

### Fleet Coordination

- [ ] **COORD-01**: Daily standup cron generates summary and sends to Telegram
- [ ] **COORD-02**: Agent status tracked in Mission Control (idle/active/blocked)
- [ ] **COORD-03**: Task lifecycle states enforced (inbox -> assigned -> in_progress -> review -> done)
- [ ] **COORD-04**: Activity feed logs all agent actions

### Agent Templates

- [ ] **TMPL-01**: SOUL.md created for Coder agent (GSD-focused implementation)
- [ ] **TMPL-02**: SOUL.md created for Researcher agent (market/tech intel)
- [ ] **TMPL-03**: SOUL.md created for Writer agent (content/docs/emails)
- [ ] **TMPL-04**: SOUL.md created for QA/Tester agent (bug hunting, test cases)
- [ ] **TMPL-05**: SOUL.md created for DevOps agent (deployment, CI/CD, monitoring)
- [ ] **TMPL-06**: SOUL.md created for Designer agent (UI mockups, visual assets)
- [ ] **TMPL-07**: Session configs added to openclaw.json for all 6 agents

## v2.3 Requirements

Requirements for the Live Agent Dashboard. Wires v2.2 components to live gateway events.

### Event Wiring

- [ ] **WIRE-01**: Route gateway "agent" WebSocket events to updateSessionFromEvent mutator via AgentsController
- [ ] **WIRE-02**: Create AgentsController class that bridges gateway events to metrics signals
- [ ] **WIRE-03**: Wire AgentsController into app.ts state and app-gateway.ts event routing

### Agents Tab

- [ ] **TAB-01**: Register "agents" tab in navigation.ts (Tab type, TAB_GROUPS Agent group, path, icon, title, subtitle)
- [ ] **TAB-02**: Create renderAgents view function in views/agents.ts consuming live signal data
- [ ] **TAB-03**: Wire renderAgents into app-render.ts tab switch statement

### Live Session Cards

- [ ] **LIVE-01**: Session cards render from agentSessions signal with real-time status updates (thinking/executing/complete/error)
- [ ] **LIVE-02**: Agent identity markers (name, color) display on each session card from live events
- [ ] **LIVE-03**: Empty state and disconnected state shown when no sessions or gateway offline

### Agent Conversation View

- [ ] **CHAT-01**: Live message stream showing agent-to-agent conversations with token-by-token streaming
- [ ] **CHAT-02**: Agent message bubbles with identity markers (avatar, name, color) distinguishing each agent
- [ ] **CHAT-03**: Typing/activity indicators showing which agent is currently generating
- [ ] **CHAT-04**: Auto-scroll to newest messages with scroll-up pause override
- [ ] **CHAT-05**: Markdown and code block rendering in agent messages
- [ ] **CHAT-06**: Agent status indicators (idle/thinking/executing/waiting) in conversation view

## Future Requirements (v2.1+)

Deferred to agent deployment milestone.

### Agent Deployment

- **DEPLOY-01**: Deploy Coder agent with GSD plugin
- **DEPLOY-02**: Deploy Researcher agent
- **DEPLOY-03**: Deploy Writer agent
- **DEPLOY-04**: Deploy QA/Tester agent
- **DEPLOY-05**: Deploy DevOps agent
- **DEPLOY-06**: Deploy Designer agent
- **DEPLOY-07**: Verify cross-agent communication working

### Mission Control UI

- **UI-01**: Web dashboard for task board visualization
- **UI-02**: Agent status cards
- **UI-03**: Activity feed display

## Out of Scope

| Feature                    | Reason                                      |
| -------------------------- | ------------------------------------------- |
| Mission Control UI         | After core coordination working (v2.1+)     |
| Multiple gateway instances | Single gateway sufficient for current scale |
| Agent deployment           | v2.1 after infrastructure stable            |
| New channel integrations   | Focus on fleet, not expansion               |
| Xcode app fix              | Separate project                            |
| Cost analytics / export    | Deferred from v2.3 (not core dashboard)     |

## Traceability

| Requirement | Phase    | Status  |
| ----------- | -------- | ------- |
| INFRA-01    | Phase 8  | Pending |
| INFRA-02    | Phase 8  | Pending |
| INFRA-03    | Phase 8  | Pending |
| HEART-01    | Phase 9  | Pending |
| HEART-02    | Phase 9  | Pending |
| HEART-03    | Phase 9  | Pending |
| HEART-04    | Phase 9  | Pending |
| NOTIF-01    | Phase 10 | Pending |
| NOTIF-02    | Phase 10 | Pending |
| NOTIF-03    | Phase 10 | Pending |
| NOTIF-04    | Phase 10 | Pending |
| COORD-01    | Phase 11 | Pending |
| COORD-02    | Phase 11 | Pending |
| COORD-03    | Phase 11 | Pending |
| COORD-04    | Phase 11 | Pending |
| TMPL-01     | Phase 12 | Pending |
| TMPL-02     | Phase 12 | Pending |
| TMPL-03     | Phase 12 | Pending |
| TMPL-04     | Phase 12 | Pending |
| TMPL-05     | Phase 12 | Pending |
| TMPL-06     | Phase 12 | Pending |
| TMPL-07     | Phase 12 | Pending |
| WIRE-01     | Phase 25 | Pending |
| WIRE-02     | Phase 25 | Pending |
| WIRE-03     | Phase 25 | Pending |
| TAB-01      | Phase 26 | Pending |
| TAB-02      | Phase 26 | Pending |
| TAB-03      | Phase 26 | Pending |
| LIVE-01     | Phase 26 | Pending |
| LIVE-02     | Phase 26 | Pending |
| LIVE-03     | Phase 26 | Pending |
| CHAT-01     | Phase 27 | Pending |
| CHAT-02     | Phase 27 | Pending |
| CHAT-03     | Phase 27 | Pending |
| CHAT-04     | Phase 27 | Pending |
| CHAT-05     | Phase 27 | Pending |
| CHAT-06     | Phase 27 | Pending |

**Coverage:**

- v2.0 requirements: 22 mapped / 22 total
- v2.3 requirements: 15 mapped / 15 total
- Unmapped: 0

---

_Requirements defined: 2026-02-02_
_Traceability updated: 2026-02-02 after roadmap creation_
_v2.3 requirements added: 2026-02-03_
_v2.3 traceability updated: 2026-02-03_
