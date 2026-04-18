-- AI chat history
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id, created_at DESC);

-- Bank statement imports (tracks files already imported)
CREATE TABLE IF NOT EXISTS bank_imports (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename      TEXT        NOT NULL,
  file_type     VARCHAR(10) NOT NULL CHECK (file_type IN ('csv','pdf')),
  total_rows    INT         NOT NULL DEFAULT 0,
  imported_rows INT         NOT NULL DEFAULT 0,
  duplicate_rows INT        NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_imports_user ON bank_imports(user_id);

-- Duplicate detection hash per user
CREATE TABLE IF NOT EXISTS import_hashes (
  user_id    UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tx_hash    CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tx_hash)
);

-- Anomaly detection results
CREATE TABLE IF NOT EXISTS anomalies (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id UUID          REFERENCES transactions(id) ON DELETE CASCADE,
  anomaly_type   VARCHAR(50)   NOT NULL,
  severity       VARCHAR(20)   NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  description    TEXT          NOT NULL,
  category       TEXT,
  amount         NUMERIC(15,2),
  z_score        NUMERIC(8,4),
  is_dismissed   BOOLEAN       NOT NULL DEFAULT FALSE,
  detected_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_anomalies_user ON anomalies(user_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_tx   ON anomalies(transaction_id);
