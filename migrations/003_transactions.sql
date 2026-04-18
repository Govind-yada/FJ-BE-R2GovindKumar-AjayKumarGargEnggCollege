CREATE TABLE IF NOT EXISTS transactions (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID          REFERENCES categories(id) ON DELETE SET NULL,
  type        VARCHAR(20)   NOT NULL CHECK (type IN ('income','expense','investment')),
  description TEXT          NOT NULL,
  amount      NUMERIC(15,2) NOT NULL,
  currency    CHAR(3)       NOT NULL DEFAULT 'INR',
  amount_inr  NUMERIC(15,2),
  date        DATE          NOT NULL,
  receipt_url TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user      ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_date      ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_tx_category  ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_type      ON transactions(user_id, type);
