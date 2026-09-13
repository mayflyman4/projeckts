CREATE TABLE IF NOT EXISTS users (
  google_sub    TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  name          TEXT,
  created_at    TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
