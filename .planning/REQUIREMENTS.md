# Requirements: OpenClaw v2.0 Multi-Agent Infrastructure

**Defined:** 2026-02-02
**Core Value:** Context must survive — build coordination layer for reliable multi-agent fleet

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
- [ ] **COORD-03**: Task lifecycle states enforced (inbox → assigned → in_progress → review → done)
- [ ] **COORD-04**: Activity feed logs all agent actions

### Agent Templates

- [ ] **TMPL-01**: SOUL.md created for Coder agent (GSD-focused implementation)
- [ ] **TMPL-02**: SOUL.md created for Researcher agent (market/tech intel)
- [ ] **TMPL-03**: SOUL.md created for Writer agent (content/docs/emails)
- [ ] **TMPL-04**: SOUL.md created for QA/Tester agent (bug hunting, test cases)
- [ ] **TMPL-05**: SOUL.md created for DevOps agent (deployment, CI/CD, monitoring)
- [ ] **TMPL-06**: SOUL.md created for Designer agent (UI mockups, visual assets)
- [ ] **TMPL-07**: Session configs added to openclaw.json for all 6 agents

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

| Feature | Reason |
|---------|--------|
| Mission Control UI | After core coordination working (v2.1+) |
| Multiple gateway instances | Single gateway sufficient for current scale |
| Agent deployment | v2.1 after infrastructure stable |
| New channel integrations | Focus on fleet, not expansion |
| Xcode app fix | Separate project |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |
| INFRA-03 | TBD | Pending |
| HEART-01 | TBD | Pending |
| HEART-02 | TBD | Pending |
| HEART-03 | TBD | Pending |
| HEART-04 | TBD | Pending |
| NOTIF-01 | TBD | Pending |
| NOTIF-02 | TBD | Pending |
| NOTIF-03 | TBD | Pending |
| NOTIF-04 | TBD | Pending |
| COORD-01 | TBD | Pending |
| COORD-02 | TBD | Pending |
| COORD-03 | TBD | Pending |
| COORD-04 | TBD | Pending |
| TMPL-01 | TBD | Pending |
| TMPL-02 | TBD | Pending |
| TMPL-03 | TBD | Pending |
| TMPL-04 | TBD | Pending |
| TMPL-05 | TBD | Pending |
| TMPL-06 | TBD | Pending |
| TMPL-07 | TBD | Pending |

**Coverage:**
- v2.0 requirements: 22 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 22

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after initial definition*
