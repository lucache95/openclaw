import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

// --- Types ---

export interface ExportMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  agentId?: string;
  sessionKey?: string;
  spawnedBy?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    model: string;
    tier: string;
    costUsd: number;
  };
}

interface AgentNode {
  agentId: string;
  sessionKey: string;
  children: AgentNode[];
}

// --- Pure helpers ---

/** Build a parent-child tree from spawnedBy relationships across messages. */
function buildAgentTree(messages: ExportMessage[]): AgentNode[] {
  const sessions = new Map<string, { agentId: string; spawnedBy?: string }>();

  for (const m of messages) {
    if (!m.sessionKey) continue;
    if (sessions.has(m.sessionKey)) continue;
    sessions.set(m.sessionKey, {
      agentId: m.agentId ?? m.sessionKey,
      spawnedBy: m.spawnedBy,
    });
  }

  const nodes = new Map<string, AgentNode>();
  for (const [key, info] of sessions) {
    nodes.set(key, { agentId: info.agentId, sessionKey: key, children: [] });
  }

  const roots: AgentNode[] = [];
  for (const [key, info] of sessions) {
    const node = nodes.get(key)!;
    if (info.spawnedBy && nodes.has(info.spawnedBy)) {
      nodes.get(info.spawnedBy)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/** Render an agent tree as indented markdown lines. */
function renderTreeMarkdown(nodes: AgentNode[], depth = 0): string {
  let out = "";
  const indent = "  ".repeat(depth);
  for (const node of nodes) {
    out += `${indent}- **${node.agentId}** (session: ${node.sessionKey})\n`;
    if (node.children.length > 0) {
      out += renderTreeMarkdown(node.children, depth + 1);
    }
  }
  return out;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toISOString();
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 1000).toFixed(2)}m`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

// --- Exported pure functions ---

/**
 * Generate a human-readable markdown export of a conversation.
 * Includes agent hierarchy for multi-agent conversations and cost metadata.
 */
export function generateMarkdownExport(messages: ExportMessage[]): string {
  const lines: string[] = [];

  // Header
  lines.push("# Agent Conversation Export\n");
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(`**Messages:** ${messages.length}\n`);
  lines.push("---\n");

  // Agent hierarchy (only for multi-agent conversations)
  const uniqueAgents = new Set(messages.filter((m) => m.agentId).map((m) => m.agentId));
  if (uniqueAgents.size > 1) {
    const tree = buildAgentTree(messages);
    if (tree.length > 0) {
      lines.push("## Agent Hierarchy\n");
      lines.push(renderTreeMarkdown(tree));
      lines.push("---\n");
    }
  }

  // Messages
  for (const m of messages) {
    if (m.role === "user") {
      lines.push(`### **User**`);
    } else if (m.role === "assistant") {
      const agent = m.agentId ? ` (${m.agentId})` : "";
      lines.push(`### **Assistant**${agent}`);
    } else {
      lines.push(`### **System**`);
    }

    lines.push(`*${formatTimestamp(m.timestamp)}*\n`);
    lines.push(m.content);

    if (m.usage) {
      const total = m.usage.promptTokens + m.usage.completionTokens;
      lines.push(
        `\n*Tokens: ${total.toLocaleString()} | Cost: ${formatCost(m.usage.costUsd)} | Tier: ${m.usage.tier}*`,
      );
    }

    lines.push("\n---\n");
  }

  return lines.join("\n");
}

/**
 * Generate a machine-readable JSON export of a conversation.
 * Includes version, metadata with costs, agent hierarchy, and full messages.
 */
export function generateJSONExport(messages: ExportMessage[]): string {
  const uniqueAgents = new Set(messages.filter((m) => m.agentId).map((m) => m.agentId));
  let totalCost = 0;
  for (const m of messages) {
    if (m.usage) totalCost += m.usage.costUsd;
  }

  const data = {
    version: "1.0",
    exported: new Date().toISOString(),
    metadata: {
      messageCount: messages.length,
      agentCount: uniqueAgents.size,
      totalCost,
    },
    agentHierarchy: buildAgentTree(messages),
    messages,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Trigger a browser file download from in-memory content.
 * Uses Blob + URL.createObjectURL for zero-latency client-side generation.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

// --- Lit component ---

/** Download icon as inline SVG string (no external dependency). */
const DOWNLOAD_ICON = html`<svg
  width="14"
  height="14"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  style="vertical-align: middle; margin-right: 4px;"
>
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
  <polyline points="7 10 12 15 17 10" />
  <line x1="12" y1="15" x2="12" y2="3" />
</svg>`;

/**
 * Export buttons for downloading conversation as Markdown or JSON.
 *
 * Usage:
 *   <conversation-export .messages=${myMessages}></conversation-export>
 */
@customElement("conversation-export")
export class ConversationExportElement extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
    }

    .export-row {
      display: flex;
      flex-direction: row;
      gap: 8px;
      align-items: center;
    }

    button {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px 10px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 6px;
      background: transparent;
      color: #94a3b8;
      font-size: 0.75rem;
      font-family: inherit;
      cursor: pointer;
      transition:
        background 0.15s,
        color 0.15s,
        border-color 0.15s;
    }

    button:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.06);
      color: #e2e8f0;
      border-color: rgba(255, 255, 255, 0.2);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;

  @property({ attribute: false }) messages: ExportMessage[] = [];
  @property({ type: Boolean }) disabled = false;

  private get isDisabled(): boolean {
    return this.disabled || this.messages.length === 0;
  }

  private handleMarkdownExport(): void {
    const md = generateMarkdownExport(this.messages);
    const date = new Date().toISOString().split("T")[0];
    downloadFile(md, `conversation-${date}.md`, "text/markdown;charset=utf-8");
  }

  private handleJSONExport(): void {
    const json = generateJSONExport(this.messages);
    const date = new Date().toISOString().split("T")[0];
    downloadFile(json, `conversation-${date}.json`, "application/json;charset=utf-8");
  }

  render() {
    return html`
      <div class="export-row">
        <button ?disabled=${this.isDisabled} @click=${this.handleMarkdownExport}>
          ${DOWNLOAD_ICON} Export Markdown
        </button>
        <button ?disabled=${this.isDisabled} @click=${this.handleJSONExport}>
          ${DOWNLOAD_ICON} Export JSON
        </button>
      </div>
    `;
  }
}
