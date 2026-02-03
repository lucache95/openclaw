import type { DatabaseSync, StatementSync } from "node:sqlite";
import { requireNodeSqlite } from "../memory/sqlite.js";

export interface ChatPersistence {
  persist(msg: {
    sessionKey: string;
    runId: string;
    state: string;
    role?: string;
    content?: string;
    errorMessage?: string;
  }): { seq: number; serverTs: number };

  replay(
    sessionKey: string,
    afterSeq: number,
    limit?: number,
  ): Array<{
    seq: number;
    session_key: string;
    run_id: string;
    state: string;
    role: string | null;
    content: string | null;
    error_message: string | null;
    server_ts: number;
  }>;

  close(): void;
}

export function createChatPersistence(dbPath: string): ChatPersistence {
  const { DatabaseSync: DB } = requireNodeSqlite();
  const db: DatabaseSync = new DB(dbPath);

  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT NOT NULL,
      run_id TEXT NOT NULL,
      state TEXT NOT NULL,
      role TEXT,
      content TEXT,
      error_message TEXT,
      server_ts INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_chat_session_seq ON chat_messages(session_key, seq);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_chat_run_id ON chat_messages(run_id);");

  const insertStmt: StatementSync = db.prepare(
    "INSERT INTO chat_messages (session_key, run_id, state, role, content, error_message, server_ts) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const replayStmt: StatementSync = db.prepare(
    "SELECT seq, session_key, run_id, state, role, content, error_message, server_ts FROM chat_messages WHERE session_key = ? AND seq > ? ORDER BY seq ASC LIMIT ?",
  );

  return {
    persist(msg) {
      const serverTs = Date.now();
      const result = insertStmt.run(
        msg.sessionKey,
        msg.runId,
        msg.state,
        msg.role ?? null,
        msg.content ?? null,
        msg.errorMessage ?? null,
        serverTs,
      );
      return { seq: Number(result.lastInsertRowid), serverTs };
    },

    replay(sessionKey, afterSeq, limit = 500) {
      return replayStmt.all(sessionKey, afterSeq, limit) as Array<{
        seq: number;
        session_key: string;
        run_id: string;
        state: string;
        role: string | null;
        content: string | null;
        error_message: string | null;
        server_ts: number;
      }>;
    },

    close() {
      db.close();
    },
  };
}
