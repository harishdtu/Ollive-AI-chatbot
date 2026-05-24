const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_PATH || path.join(__dirname, '../../data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(path.join(DB_DIR, 'ollive.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  -- Conversations table: one row per chat session
  CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    provider    TEXT NOT NULL DEFAULT 'gemini',
    model       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active',  -- active | cancelled
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );

  -- Messages table: each user/assistant turn
  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,  -- user | assistant
    content         TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );

  -- Inference logs: one row per LLM API call
  CREATE TABLE IF NOT EXISTS inference_logs (
    id                TEXT PRIMARY KEY,
    conversation_id   TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id        TEXT REFERENCES messages(id),
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    input_tokens      INTEGER,
    output_tokens     INTEGER,
    total_tokens      INTEGER,
    latency_ms        INTEGER,
    status            TEXT NOT NULL DEFAULT 'success',  -- success | error | cancelled
    error_message     TEXT,
    input_preview     TEXT,   -- first 200 chars of input
    output_preview    TEXT,   -- first 200 chars of output
    pii_redacted      INTEGER DEFAULT 0,  -- boolean flag
    stream            INTEGER DEFAULT 0,  -- was this a streaming call?
    created_at        INTEGER NOT NULL
  );

  -- Indexes for common query patterns
  CREATE INDEX IF NOT EXISTS idx_messages_conv     ON messages(conversation_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_conv         ON inference_logs(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_logs_created      ON inference_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_logs_provider     ON inference_logs(provider);
  CREATE INDEX IF NOT EXISTS idx_logs_status       ON inference_logs(status);
`);

module.exports = db;
