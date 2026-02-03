# Feature Landscape: Live Agent Dashboard

**Domain:** Real-time multi-agent monitoring dashboard
**Researched:** 2026-02-03
**Confidence:** MEDIUM (based on observability patterns, collaboration UI research, and OpenClaw context)

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature                     | Why Expected                                                                                 | Complexity | Notes                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| Live message stream         | Core value proposition — users expect to see agent conversations as they happen              | Medium     | Already have agent-chat view/controller from v2.2; need WebSocket wiring                       |
| Real-time session cards     | Users need to see which agents are active, their status, and how long they've been working   | Low        | Already have session-card component from v2.2; need live data connection                       |
| Agent presence indicators   | Users expect status badges (idle/thinking/responding) to quickly assess agent activity       | Low        | Established pattern from Slack/Discord presence UI                                             |
| Elapsed time display        | Users need to know how long an agent has been working on a task                              | Low        | Real-time timer updates expected in monitoring dashboards                                      |
| Auto-scroll to latest       | Users expect new messages to appear without manual scrolling (with scroll-lock escape hatch) | Low        | Standard chat UI pattern from Slack/Discord                                                    |
| Session filtering/sorting   | Users need to find specific agents or conversations when multiple agents are active          | Medium     | Standard observability dashboard pattern (filter by status, time, agent name)                  |
| Visual handoff indication   | Users expect to see when one agent spawns another or hands off work                          | Medium     | Agent handoff animation component exists from v2.2; needs event trigger                        |
| Message timestamps          | Users need temporal context for agent conversations                                          | Low        | Standard chat UI requirement                                                                   |
| Agent identification        | Users need to distinguish messages from different agents (names, avatars, or color coding)   | Low        | Prevents confusion in multi-agent conversations                                                |
| Connection status indicator | Users expect to know if WebSocket is connected or disconnected                               | Low        | Critical for real-time dashboards — without this, users don't know if they're seeing live data |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature                       | Value Proposition                                                                              | Complexity | Notes                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| Conversation threading        | Shows parent-child relationships between agent spawns (e.g., GSD spawns Coder → visual thread) | High       | Would provide clarity in complex multi-agent workflows, but v2.3 focuses on flat message stream |
| Agent spawn visualization     | Network graph or tree view showing agent hierarchy in real-time                                | High       | Powerful for understanding agent orchestration, but defer to later milestone                    |
| Message search within session | Find specific messages or tool calls within a long agent conversation                          | Medium     | Useful for debugging, but not critical for v2.3 MVP                                             |
| Session playback              | Replay agent conversation from start to current state at adjustable speed                      | High       | Great for debugging/learning, but deferred                                                      |
| Agent-specific filtering      | Toggle visibility of specific agents in the message stream                                     | Low        | Reduces noise when many agents are active                                                       |
| Session bookmarking           | Mark interesting moments in agent conversations for later review                               | Medium     | Useful for learning/debugging patterns                                                          |
| Live typing indicators        | Show when an agent is actively "thinking" before message appears                               | Low        | Borrowed from chat UIs; adds polish and responsiveness feel                                     |
| Multi-session view            | Split screen or tabs to monitor multiple agent sessions simultaneously                         | High       | Advanced use case for power users monitoring fleet                                              |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature                        | Why Avoid                                                                                 | What to Do Instead                                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Message editing/deletion            | Agents produce immutable logs; editing would break auditability                           | Show full conversation history as-is; use filtering to hide noise if needed      |
| Real-time cost/latency displays     | Cost/latency components exist (v2.2) but data wiring is explicitly deferred in v2.3 scope | Focus on message stream and session cards; wire cost/latency in later milestone  |
| Export functionality in v2.3        | Conversation export component exists (v2.2) but wiring deferred                           | Keep component for later; focus on live monitoring first                         |
| Inline tool execution               | Let users manually trigger tools from the dashboard                                       | Agents should be autonomous; dashboard is for observation, not control           |
| Message reactions/emojis            | This is a monitoring dashboard, not a chat app                                            | Keep interface professional and focused on observability                         |
| Agent interruption/pause            | Adds complexity and breaks agent autonomy assumptions                                     | If needed, build as separate control mechanism later                             |
| Historical session browsing in v2.3 | Scope is live monitoring, not log replay                                                  | Focus on active sessions; add historical view as separate feature later          |
| Real-time token consumption meter   | Tempting for cost-conscious users, but deferred per scope                                 | Already have cost-display component; wire later when other metrics are connected |

## Feature Dependencies

```
WebSocket connection
  ↓
Live message stream
  ├─→ Auto-scroll to latest
  ├─→ Message timestamps
  ├─→ Agent identification
  └─→ Typing indicators (optional)

WebSocket connection
  ↓
Real-time session cards
  ├─→ Agent presence indicators
  ├─→ Elapsed time display
  └─→ Agent handoff animations (triggers from spawn events)

Session cards + Message stream
  ↓
Session filtering/sorting
  └─→ Agent-specific filtering (optional)
```

**Critical path for v2.3:**

1. WebSocket event subscription to gateway agent events
2. Live message stream showing agent conversations
3. Real-time session cards with status/elapsed time
4. Agent handoff animation triggered by spawn events

**Deferred to post-v2.3:**

- Cost/latency data wiring (components exist, data connection later)
- Export wiring (component exists, trigger later)
- Historical session browsing
- Advanced visualizations (threading, network graphs)

## MVP Recommendation

For v2.3 "Agents" tab, prioritize:

1. **WebSocket connection status indicator** - Users need to know if they're seeing live data
2. **Live message stream** - Core value proposition; wire agent-chat view to WebSocket events
3. **Real-time session cards** - Show active agents with status badges and elapsed time
4. **Agent handoff animations** - Trigger existing animation component on spawn events
5. **Auto-scroll with escape hatch** - Standard chat UI behavior
6. **Basic filtering** - Filter by agent name or status (idle/active)

Defer to post-v2.3:

- **Cost/latency wiring** - Components exist, data connection is explicitly out of scope
- **Export wiring** - Component exists, trigger is out of scope
- **Conversation threading** - High complexity, not needed for flat message stream
- **Session playback** - Advanced feature for later
- **Multi-session split view** - Power user feature for fleet monitoring later

## Information Hierarchy

Based on observability dashboard research (Datadog, Grafana patterns) and real-time collaboration UI (Slack, Discord):

**Primary focus (largest screen area):**

- Live message stream (center panel) - Users spend most time here watching agent conversations

**Secondary focus (sidebar or top panel):**

- Session cards (left sidebar or top row) - Quick glance at active agents, click to switch sessions

**Tertiary focus (header/status bar):**

- Connection status indicator (always visible)
- Current session name/agent ID
- Session count (e.g., "3 active agents")

**Hidden until needed:**

- Filters/search (collapsible panel)
- Settings (modal or drawer)
- Cost/latency metrics (exist as components, deferred wiring)

## User Expectations from Research

**From observability tools (Datadog, Grafana):**

- At-a-glance system health without overwhelming information
- Real-time updates without page refresh
- Clear visual indication of connection status
- Filtering/sorting for large datasets
- Unified view of related information

**From collaboration tools (Slack, Discord):**

- Auto-scroll to latest messages
- Clear message authorship (agent names/avatars)
- Timestamps for temporal context
- Presence indicators (who's active)
- Visual separation between messages from different senders

**From multi-agent monitoring tools (AgentOps, Langfuse patterns):**

- End-to-end visibility of agent workflows
- Real-time activity feeds showing what agents are doing
- Clear indication of agent spawning/handoffs
- Ability to drill down into specific agent sessions

## Sources

- [AI Agent Monitoring: Best Practices, Tools, and Metrics for 2026 - UptimeRobot](https://uptimerobot.com/knowledge-hub/monitoring/ai-agent-monitoring-best-practices-tools-and-metrics/)
- [15 AI Agent Observability Tools in 2026: AgentOps & Langfuse](https://research.aimultiple.com/agentic-monitoring/)
- [Building a Production Ready Observability Stack: The Complete 2026 Guide - Medium](https://medium.com/@krishnafattepurkar/building-a-production-ready-observability-stack-the-complete-2026-guide-9ec6e7e06da2)
- [Observability Dashboards - Information Hierarchy Best Practices (Medium confidence - WebSearch verified with multiple sources)](https://medium.com/@krishnafattepurkar/building-a-production-ready-observability-stack-the-complete-2026-guide-9ec6e7e06da2)
- [Slack vs Discord: Real-time collaboration UI patterns - Pumble Blog](https://pumble.com/blog/slack-vs-discord/)
- [Agentic Workflows: Best Practices - Vellum](https://www.vellum.ai/blog/agentic-workflows-emerging-architectures-and-design-patterns)
- [The 11 Best Observability Tools in 2026 - Dash0](https://www.dash0.com/comparisons/best-observability-tools)
- [Datadog vs Grafana 2026 - SigNoz](https://signoz.io/blog/datadog-vs-grafana/)

**Confidence note:** Research confidence is MEDIUM because:

- HIGH: Observability dashboard patterns are well-established and verified from multiple 2026 sources
- HIGH: Collaboration UI patterns (Slack/Discord) are mature and well-documented
- MEDIUM: Multi-agent monitoring is emerging; patterns are less standardized (AgentOps/Langfuse examples, but fewer years of established practice)
- HIGH: OpenClaw v2.2 component inventory is confirmed from PROJECT.md (session-card, agent-chat, handoff animation exist)

**Gaps:** Specific patterns for agent-to-agent conversation monitoring are less documented than human-to-agent chat. Adapting Slack-style threading to agent spawn hierarchies is a novel pattern not widely covered in research. Recommendation is based on synthesis of observability + collaboration patterns rather than direct precedent.
