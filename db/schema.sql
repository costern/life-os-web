-- Life OS Web – Schema v1
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  asset TEXT NOT NULL,
  ticker TEXT,
  trade_name TEXT,
  side TEXT NOT NULL DEFAULT 'Long',
  entry1 NUMERIC,
  entry2 NUMERIC,
  size1 NUMERIC,
  size2 NUMERIC,
  sl NUMERIC,
  tp NUMERIC,
  exit_price NUMERIC,
  pnl NUMERIC,
  funding_fees NUMERIC,
  strategy TEXT,
  risk_usd NUMERIC,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trades_open ON trades ((exit_price IS NULL));

CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  thema TEXT,
  prio TEXT,
  notiz TEXT,
  due_date DATE,
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS macro_status (
  id INTEGER PRIMARY KEY DEFAULT 1,
  ffr NUMERIC, ffr_date TEXT,
  ty NUMERIC, ty_date TEXT,
  inflation NUMERIC, cpi_date TEXT,
  real_rate NUMERIC,
  note TEXT,
  updated_at TIMESTAMPTZ,
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO macro_status (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  source TEXT,
  category TEXT,
  sentiment TEXT,
  importance NUMERIC,
  in_focus BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_reading (
  id INTEGER PRIMARY KEY DEFAULT 1,
  content_md TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row_reading CHECK (id = 1)
);
INSERT INTO daily_reading (id, content_md) VALUES (1, '') ON CONFLICT (id) DO NOTHING;
