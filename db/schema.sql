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
ALTER TABLE trades ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC DEFAULT 0;
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
ALTER TABLE macro_status ADD COLUMN IF NOT EXISTS prev_ffr NUMERIC;
ALTER TABLE macro_status ADD COLUMN IF NOT EXISTS prev_ty NUMERIC;
ALTER TABLE macro_status ADD COLUMN IF NOT EXISTS prev_inflation NUMERIC;
ALTER TABLE macro_status ADD COLUMN IF NOT EXISTS prev_real_rate NUMERIC;
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

CREATE TABLE IF NOT EXISTS portfolios (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO portfolios (name) SELECT 'Portfolio 1' WHERE NOT EXISTS (SELECT 1 FROM portfolios);

CREATE TABLE IF NOT EXISTS portfolio (
  id SERIAL PRIMARY KEY,
  asset TEXT NOT NULL,
  ticker TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  buy_price NUMERIC,
  wallet TEXT,
  chain TEXT,
  notiz TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS portfolio_id INTEGER REFERENCES portfolios(id) DEFAULT 1;

-- Performance-Verlauf: ein Wert pro Portfolio pro Tag. "estimated=true" heisst
-- rueckwirkend geschaetzt (aktuelle Bestaende x historische Kurse), "false" ist ein
-- echter, am jeweiligen Tag aufgenommener Snapshot. UNIQUE macht beides ueber
-- ON CONFLICT wiederholbar (mehrfacher Aufruf am selben Tag legt keine Duplikate an).
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id SERIAL PRIMARY KEY,
  portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  taken_at DATE NOT NULL,
  value_usd NUMERIC NOT NULL,
  estimated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, taken_at)
);

-- Double-Bottom-Watchlist (urspruenglich aus Obsidian importiert, jetzt im Dashboard
-- direkt pflegbar). "status": worked | be | failed, NULL = noch nicht bewertet.
CREATE TABLE IF NOT EXISTS watchlist_signals (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  label TEXT,
  asset TEXT NOT NULL,
  tf TEXT,
  notiz TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Detailfelder zum Setup: event_typ single|double, mtf = Anzahl Timeframes (1-3),
-- multi_asset = Signal auf mehreren Assets gleichzeitig, form = bottom|bogen.
ALTER TABLE watchlist_signals ALTER COLUMN status DROP NOT NULL;
ALTER TABLE watchlist_signals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS event_typ TEXT;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS mtf INTEGER;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS multi_asset BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS form TEXT;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS details TEXT;
-- trade_id: frei vergebene Nummer/Kennung. Mehrere Signale mit derselben trade_id
-- gehoeren zu EINEM Trade (z.B. dasselbe Setup auf 3D, 1W und 2W) und werden in den
-- Ergebnis-Zahlen nur einmal gezaehlt.
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS trade_id TEXT;
-- note: Setup-Qualitaet A++ | A+ | A | B (bewertet das Signal, nicht den Ausgang)
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS note TEXT;
-- Chart-Eigenschaften, aus denen (plus eigener Einschaetzung) die Note entsteht:
-- marktphase   uptrend | downtrend | ranging
-- pattern      valid | clean | choppy          (Qualitaet der Struktur)
-- candles      pivot | decent | gap | mini     (Kerzenbild am Boden)
-- div_lokal    rsi | none | hidden             (lokale RSI-Divergenz)
-- div_struktur rsi | none | hidden             (strukturelle RSI-Divergenz)
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS marktphase TEXT;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS pattern TEXT;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS candles TEXT;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS div_lokal TEXT;
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS div_struktur TEXT;
-- uhrzeit: Kerzen-Close des Signals. Standard 02:00 = Tageschart-Close; 12:00 = 12H-Close
-- mitten am Tag; kuerzere Timeframes werden von Hand eingetragen. NULL = unbekannt.
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS uhrzeit TIME;
