CREATE TABLE IF NOT EXISTS exchange_rates (
  base        CHAR(3)       NOT NULL,
  target      CHAR(3)       NOT NULL,
  rate        NUMERIC(18,8) NOT NULL,
  fetched_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  PRIMARY KEY (base, target)
);

-- Seed static fallback rates (base = INR)
INSERT INTO exchange_rates (base, target, rate) VALUES
  ('INR','USD', 0.01199),
  ('INR','EUR', 0.01104),
  ('INR','GBP', 0.00953),
  ('INR','JPY', 1.79300),
  ('INR','AED', 0.04402),
  ('INR','SGD', 0.01611),
  ('USD','INR', 83.4000),
  ('EUR','INR', 90.5800),
  ('GBP','INR',104.9200),
  ('JPY','INR',  0.55800),
  ('AED','INR', 22.7100),
  ('SGD','INR', 62.1000)
ON CONFLICT (base, target) DO NOTHING;
