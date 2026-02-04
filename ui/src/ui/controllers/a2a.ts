import type { GatewayBrowserClient } from "../gateway.ts";
import { pushA2ATurn, finalizeA2AConversation } from "../state/metrics.ts";

type A2AState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
};

type A2ATurnRow = {
  conversation_id: string;
  session_key: string;
  from_agent: string;
  to_agent: string;
  turn: number;
  max_turns: number;
  text: string;
  status: string;
  server_ts: number;
};

/** Load A2A conversation history from the gateway on connect. */
export async function loadA2AHistory(state: A2AState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request<{ turns: A2ATurnRow[] }>("a2a.list", {});
    if (!res?.turns) {
      return;
    }
    // Group turns by conversation and push into signals.
    const seenConversations = new Set<string>();
    for (const row of res.turns) {
      pushA2ATurn({
        conversationId: row.conversation_id,
        fromAgent: row.from_agent,
        toAgent: row.to_agent,
        turn: row.turn,
        maxTurns: row.max_turns,
        text: row.text,
        timestamp: row.server_ts,
        sessionKey: row.session_key,
      });
      if (row.status === "complete") {
        seenConversations.add(row.conversation_id);
      }
    }
    for (const convId of seenConversations) {
      finalizeA2AConversation(convId);
    }
  } catch {
    // A2A history load is non-fatal.
  }
}
