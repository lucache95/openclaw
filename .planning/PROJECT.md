# OpenClaw Optimization

## What This Is

Optimizing Lucas's existing OpenClaw (formerly Moltbot) setup. v1.0 solved the critical 173k token context overflow problem and added cost-saving infrastructure with three-tier routing (Ollama/MiniMax/Claude), security hardening, and multi-agent preparation. The system is now optimized and ready for fleet expansion.

## Core Value

**Context must survive.** The system should never hit token limits or lose important context during compaction. Everything else (cost savings, security) supports this.

## Current State (v1.0 Shipped)

**Shipped:** 2026-02-02
**LOC:** ~29,713 TypeScript
**Tech stack:** OpenClaw fork, Ollama qwen2.5:3b, MiniMax M2, macOS Keychain, GPG vault

**Infrastructure:**
- Mac mini running OpenClaw gateway on port 18789
- Claude Max subscription (no API billing for primary use)
- Telegram bot for messaging
- Ollama for local inference (free)
- MiniMax M2 for medium-complexity tasks (cheap)
- Three-tier routing: local → cheap → quality
- Secure credential storage via Keychain and GPG vault

## Current Milestone: v2.0 Multi-Agent Infrastructure

**Goal:** Complete infrastructure gaps and build coordination layer for multi-agent fleet deployment.

**Target features:**
- Encrypted backup scripts with GPG
- phi4 reasoning model for complex local tasks
- Complete GPG credential migration
- Staggered heartbeat system for fleet coordination
- Notification daemon for @mentions between agents
- Daily standup cron (summary to Telegram)
- Agent SOUL templates for: Coder, Researcher, Writer, QA/Tester, DevOps, Designer
- Session configs ready for fleet deployment

**Architecture decision:** Single gateway, multiple sessions (per Bhanu's guide)

**NOT in v2.0:** Actually deploying 6 new agents (that's v2.1+)

## Requirements

### Validated

- SETUP-01: Fork OpenClaw repo to personal GitHub — v1.0
- SETUP-02: Update OpenClaw to latest version (2026.1.30) — v1.0
- SETUP-03: Set up upstream tracking with periodic sync checks — v1.0
- CTX-01: Implement ACTIVE.md hot context pattern — v1.0
- CTX-02: Add context monitoring with tiered thresholds (70/80/90%) — v1.0
- CTX-03: Implement structured compaction preserving critical fields — v1.0
- CTX-04: Add pre-compaction memory flush — v1.0
- LLM-01: Install Ollama natively on Apple Silicon — v1.0
- LLM-02: Pull qwen2.5:3b model for simple tasks — v1.0
- LLM-03: Set up nomic-embed-text for local embeddings — v1.0
- LLM-04: Configure vector memory with sqlite-vec — v1.0
- LLM-05: Implement task routing (Ollama for simple, Claude for complex) — v1.0
- SEC-01: Move credentials to Keychain/vault — v1.0
- SEC-02: Set up GPG encrypted vault with owner tagging — v1.0
- SEC-03: Add automated daily security audit — v1.0
- SUB-01: Create delegation brief templates — v1.0
- SUB-02: Define structured result aggregation format — v1.0
- PVD-01: Integrate MiniMax M2 as secondary provider — v1.0
- PVD-02: Implement three-tier routing — v1.0
- DOC-01: Document multi-agent patterns — v1.0
- PVD-03: Wire MiniMax API key into OpenClaw config — v2.0 (done in session)

### Active

(v2.0 Multi-Agent Infrastructure)

**Infrastructure Completion:**
- INFRA-01: Pull phi4 reasoning model for complex local tasks
- INFRA-02: Create encrypted backup scripts (GPG)
- INFRA-03: Complete credential migration to GPG vault

**Multi-Agent Coordination:**
- COORD-01: Implement staggered heartbeat crons for fleet
- COORD-02: Build notification daemon for @mentions
- COORD-03: Create daily standup cron (summary to Telegram)
- COORD-04: Enhance Mission Control with thread subscriptions

**Fleet Preparation:**
- FLEET-01: Create SOUL templates for 6 agent roles
- FLEET-02: Configure agent sessions in OpenClaw config
- FLEET-03: Document fleet deployment protocol

### Out of Scope

- Buggy Xcode app fix — separate project
- New channel integrations — focus on fleet, not expansion
- Mission Control UI — after core coordination is working
- Deploying 6 new agents — v2.1 milestone after infra stable

## Constraints

- **Platform:** macOS (Apple Silicon) — Ollama models must be ARM-compatible
- **Cost:** Minimize API spend — use Claude Max for primary, Ollama for simple tasks, MiniMax for workers
- **Security:** No credentials in plain text configs
- **Compatibility:** Changes must not break existing Telegram, email, or cron functionality

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Ollama qwen2.5:3b as primary local model | Fast, small (1.9GB), good for simple tasks | Good |
| ACTIVE.md for hot context recovery | Glenn's recommended pattern for surviving compaction | Good |
| Keep existing cron jobs as-is | They work; don't fix what isn't broken | Good |
| Fork as lucache95/openclaw | Consistent naming with GitHub username | Good |
| Build via pnpm | Consistent with upstream OpenClaw | Good |
| Weekly sync checks on Mondays | Catch upstream changes early | Good |
| 70/80/90% thresholds | Progressive warnings before overflow | Good |
| Use Keychain for script access | Avoids GPG passphrase prompts in automation | Good |
| MiniMax temperature clamp (0.01-1.0] | MiniMax API rejects 0 | Good |
| Pattern-based task classification | Better than keyword matching | Good |
| Three-tier routing enabled by default | Immediate cost savings | Revisit |
| Single gateway for fleet | Simpler coordination, shared workspace, Bhanu's pattern | — Pending |
| Infra first, agents later | Build coordination layer before deploying 6 agents | — Pending |
| 6 agent roles planned | Coder, Researcher, Writer, QA/Tester, DevOps, Designer | — Pending |

---
*Last updated: 2026-02-02 after v2.0 milestone start*
