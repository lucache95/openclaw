import { html, nothing } from "lit";
import { signal } from "@lit-labs/signals";
import { agentSessions } from "../state/metrics";
import { connectionStatus } from "../state/connection";
import { renderConversation } from "./conversation-view";
import "../components/agent-session-card";

/** Currently selected session key for conversation drill-down. */
const selectedSession = signal<string | null>(null);

export function renderAgents() {
  const selected = selectedSession.get();
  if (selected) {
    return renderConversation(selected, () => selectedSession.set(null));
  }
  const status = connectionStatus.get();

  if (status === "disconnected") {
    return html`
      <section class="card">
        <div class="card-title">Agent Sessions</div>
        <div class="card-sub">Live multi-agent activity monitor.</div>
        <div class="callout" style="margin-top: 16px;">
          Not connected to gateway. Agent session data is unavailable while offline.
        </div>
      </section>
    `;
  }

  const sessions = Array.from(agentSessions.get().values());

  if (sessions.length === 0) {
    return html`
      <section class="card">
        <div class="card-title">Agent Sessions</div>
        <div class="card-sub">Live multi-agent activity monitor.</div>
        <div class="muted" style="margin-top: 16px;">
          No active agent sessions. Sessions will appear here when agents start running.
        </div>
      </section>
    `;
  }

  return html`
    <section class="card">
      <div class="card-title">Agent Sessions</div>
      <div class="card-sub">${sessions.length} active session${sessions.length !== 1 ? "s" : ""}.</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:16px;">
        ${sessions.map(
          (s) => html`
            <div
              @click=${() => selectedSession.set(s.sessionKey)}
              style="cursor:pointer;"
            >
              <agent-session-card
                sessionKey=${s.sessionKey}
                agentId=${s.agentId}
                task=${s.task}
                status=${s.status}
                spawnedBy=${s.spawnedBy ?? ""}
                .startedAt=${s.startedAt}
                .endedAt=${s.endedAt ?? 0}
                currentStep=${s.currentStep ?? ""}
              ></agent-session-card>
            </div>
          `,
        )}
      </div>
    </section>
  `;
}
