import { html } from "lit";
import "../components/latency-badge";
import "../components/error-card";
import "../components/cost-display";
import "../components/agent-session-card";
import "../components/conversation-export";
import type { UsageEntry } from "../state/metrics";

const sampleUsageEntries: UsageEntry[] = [
  {
    promptTokens: 1200,
    completionTokens: 800,
    model: "haiku",
    tier: "local",
    costUsd: 0.0002,
    timestamp: Date.now() - 30000,
  },
  {
    promptTokens: 5000,
    completionTokens: 3000,
    model: "sonnet",
    tier: "cheap",
    costUsd: 0.0034,
    timestamp: Date.now() - 20000,
  },
  {
    promptTokens: 12000,
    completionTokens: 8000,
    model: "opus",
    tier: "quality",
    costUsd: 0.12,
    timestamp: Date.now() - 10000,
  },
];

const sampleExportMessages = [
  {
    role: "user" as const,
    content: "Research the codebase and find all API endpoints",
    timestamp: Date.now() - 60000,
  },
  {
    role: "assistant" as const,
    content: "I'll scan the codebase for API endpoints. Let me spawn a sub-agent to help.",
    timestamp: Date.now() - 55000,
    agentId: "orchestrator",
    sessionKey: "session-1",
    usage: {
      promptTokens: 500,
      completionTokens: 200,
      model: "sonnet",
      tier: "cheap",
      costUsd: 0.001,
    },
  },
  {
    role: "assistant" as const,
    content: "Found 12 API endpoints across 3 route files.",
    timestamp: Date.now() - 40000,
    agentId: "researcher",
    sessionKey: "session-2",
    spawnedBy: "session-1",
    usage: {
      promptTokens: 8000,
      completionTokens: 3000,
      model: "opus",
      tier: "quality",
      costUsd: 0.08,
    },
  },
];

export function renderVizDemo() {
  return html`
    <div style="display:flex;flex-direction:column;gap:32px;max-width:800px;">

      <section>
        <h3 style="margin:0 0 12px;color:var(--text-primary,#cdd6f4);">Latency Badges</h3>
        <p style="margin:0 0 8px;color:var(--text-secondary,#a6adc8);font-size:0.85rem;">Color-coded duration badges: green &lt;1s, amber 1-5s, red &gt;5s</p>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
          <latency-badge .durationMs=${150} label="Fast:"></latency-badge>
          <latency-badge .durationMs=${342}></latency-badge>
          <latency-badge .durationMs=${2500} label="LLM:"></latency-badge>
          <latency-badge .durationMs=${4800} label="Tool:"></latency-badge>
          <latency-badge .durationMs=${8200} label="Chain:"></latency-badge>
          <latency-badge .durationMs=${62000} label="Total:"></latency-badge>
        </div>
      </section>

      <section>
        <h3 style="margin:0 0 12px;color:var(--text-primary,#cdd6f4);">Agent Session Cards</h3>
        <p style="margin:0 0 8px;color:var(--text-secondary,#a6adc8);font-size:0.85rem;">Live session cards with status, elapsed time, and agent identity</p>
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <agent-session-card
            sessionKey="session-orchestrator"
            agentId="orchestrator"
            task="Coordinate multi-agent research workflow"
            status="thinking"
            .startedAt=${Date.now() - 45000}
            currentStep="Planning next delegation"
          ></agent-session-card>
          <agent-session-card
            sessionKey="session-researcher"
            agentId="researcher"
            task="Scan codebase for API endpoints"
            status="executing"
            spawnedBy="session-orchestrator"
            .startedAt=${Date.now() - 30000}
            currentStep="grep: src/routes/**"
          ></agent-session-card>
          <agent-session-card
            sessionKey="session-writer"
            agentId="writer"
            task="Generate documentation from findings"
            status="complete"
            spawnedBy="session-orchestrator"
            .startedAt=${Date.now() - 120000}
            .endedAt=${Date.now() - 60000}
          ></agent-session-card>
          <agent-session-card
            sessionKey="session-failed"
            agentId="validator"
            task="Validate output against schema"
            status="error"
            spawnedBy="session-orchestrator"
            .startedAt=${Date.now() - 20000}
            .endedAt=${Date.now() - 5000}
          ></agent-session-card>
        </div>
      </section>

      <section>
        <h3 style="margin:0 0 12px;color:var(--text-primary,#cdd6f4);">Cost Display — Inline</h3>
        <p style="margin:0 0 8px;color:var(--text-secondary,#a6adc8);font-size:0.85rem;">Compact token/cost summary with tier badges</p>
        <cost-display .entries=${sampleUsageEntries} mode="inline"></cost-display>
      </section>

      <section>
        <h3 style="margin:0 0 12px;color:var(--text-primary,#cdd6f4);">Cost Display — Detail</h3>
        <p style="margin:0 0 8px;color:var(--text-secondary,#a6adc8);font-size:0.85rem;">Full breakdown by tier with token counts and costs</p>
        <cost-display .entries=${sampleUsageEntries} mode="detail"></cost-display>
      </section>

      <section>
        <h3 style="margin:0 0 12px;color:var(--text-primary,#cdd6f4);">Error Card</h3>
        <p style="margin:0 0 8px;color:var(--text-secondary,#a6adc8);font-size:0.85rem;">Inline error display with expandable stack trace</p>
        <error-card
          agentId="researcher"
          phase="tool_execution"
          errorMessage="Connection timeout after 30s: failed to reach external API"
          stack=${"Error: Connection timeout after 30s\n    at fetch (src/tools/http-client.ts:42:11)\n    at executeToolCall (src/agents/tool-runner.ts:108:5)\n    at AgentLoop.step (src/agents/loop.ts:67:12)"}
          errorContext=${'{"tool":"http_fetch","url":"https://api.example.com/data","retries":3}'}
          .timestamp=${Date.now() - 5000}
        ></error-card>
      </section>

      <section>
        <h3 style="margin:0 0 12px;color:var(--text-primary,#cdd6f4);">Conversation Export</h3>
        <p style="margin:0 0 8px;color:var(--text-secondary,#a6adc8);font-size:0.85rem;">Download conversation as Markdown or JSON</p>
        <conversation-export .messages=${sampleExportMessages}></conversation-export>
      </section>

    </div>
  `;
}
