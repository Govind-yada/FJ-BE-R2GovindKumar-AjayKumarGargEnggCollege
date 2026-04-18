CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 VARCHAR(255) UNIQUE NOT NULL,
  password_hash         TEXT,
  google_id             VARCHAR(255) UNIQUE,
  first_name            VARCHAR(100) NOT NULL DEFAULT '',
  last_name             VARCHAR(100) NOT NULL DEFAULT '',
  preferred_currency    CHAR(3)      NOT NULL DEFAULT 'INR',
  notif_budget_overrun  BOOLEAN      NOT NULL DEFAULT TRUE,
  notif_budget_warning  BOOLEAN      NOT NULL DEFAULT TRUE,
  notif_monthly_summary BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
