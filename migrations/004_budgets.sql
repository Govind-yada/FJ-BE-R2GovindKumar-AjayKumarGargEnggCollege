CREATE TABLE IF NOT EXISTS budgets (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID          REFERENCES categories(id) ON DELETE SET NULL,
  category_name VARCHAR(100),
  amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  period      VARCHAR(20)   NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','weekly')),
  start_date  DATE          NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);

CREATE TABLE IF NOT EXISTS budget_alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id   UUID        NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type  VARCHAR(20) NOT NULL CHECK (alert_type IN ('warning','overrun')),
  period_key  VARCHAR(10) NOT NULL,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_unique ON budget_alerts(budget_id, alert_type, period_key);
