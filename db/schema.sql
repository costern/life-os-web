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
-- tf: Timeframe-Badges fuers Trading-Log, z.B. ["4H"] oder ["3D","1W"] bei mehreren.
-- Rein informativ, wie Colins Notion-Tabelle (dort ein Multi-Select). Als TEXT[] statt
-- einem einzelnen TEXT, damit ein Trade mehrere Timeframes gleichzeitig haben kann.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tf TEXT;
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns WHERE table_name = 'trades' AND column_name = 'tf') = 'text' THEN
    ALTER TABLE trades ALTER COLUMN tf TYPE TEXT[] USING (
      CASE WHEN tf IS NULL OR btrim(tf) = '' THEN NULL ELSE ARRAY[tf] END
    );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_trades_open ON trades ((exit_price IS NULL));
-- trade_type: regular | mistake - war der Trade nach eigener Strategie geplant, oder
-- eigentlich ein Fehlgriff (nicht die eigene Strategie, haette so nicht genommen werden
-- sollen)? NULL = noch nicht bewertet. Rein informativ fuers Trading-Log.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trade_type TEXT;
-- deleted_at: "weiches" Loeschen statt sofort endgueltig - siehe Undo-Toast im Frontend
-- (public/app.js `zeigeUndoToast`) und die Aufraeum-Routine in lib/softDelete.js.
ALTER TABLE trades ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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
ALTER TABLE todos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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
-- Seit wann dieser Bestand tatsaechlich gehalten wird (optional). Ohne das nimmt die
-- Verlaufs-Schaetzung in /portfolio/backfill sonst die JETZIGEN Bestaende und
-- multipliziert sie mit Kursen aus Zeiten, in denen der Coin noch gar nicht gehalten
-- wurde - das Portfolio sieht dann faelschlich schon vor dem eigentlichen Kauf werthaltig aus.
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS held_since DATE;
ALTER TABLE portfolio ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

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
-- candles      choppy | decent | gap | mini    (Kerzenbild am Boden; mini = Doji/Hammer/Shooting Star)
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
ALTER TABLE watchlist_signals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Trading-Log: Verlauf von Entry/SL/TP-Anpassungen je Trade, damit man im Nachhinein
-- sehen kann, wie eine Position im Zeitverlauf nachjustiert wurde (z.B. SL hochgezogen).
CREATE TABLE IF NOT EXISTS trade_events (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  field TEXT NOT NULL CHECK (field IN ('entry','sl','tp')),
  value NUMERIC NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Freitext-Anmerkung fuer manuell (per Claude, wenn Colin einen neuen Screenshot
  -- schickt) eingetragene Punkte, z.B. "Teilverkauf 50% bei 1.42" oder "Position
  -- aufgestockt". Bei automatisch vom Trigger geloggten Aenderungen bleibt sie leer.
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_trade_events_trade ON trade_events (trade_id, field, changed_at);

-- Automatisches Protokollieren: jede tatsaechliche Aenderung an entry1/entry2/sl/tp wird als
-- neuer Trade-Event gespeichert - egal ob sie ueber das Dashboard-Formular oder per direktem
-- SQL-Update (z.B. wenn Colin einen Screenshot schickt und die Position von Hand angepasst
-- wird) passiert. Beim Anlegen eines Trades wird der Startwert gleich als erster Punkt
-- gespeichert, sonst haette das Log am Anfang keine Linie zum Einzeichnen. entry2 (zweiter
-- Einstieg/Nachkauf) faellt mit unter 'entry', damit die Entry-Linie auch Nachkaeufe zeigt.
CREATE OR REPLACE FUNCTION trg_trade_log_change() RETURNS trigger AS $$
BEGIN
  IF NEW.entry1 IS NOT NULL AND NEW.entry1 IS DISTINCT FROM OLD.entry1 THEN
    INSERT INTO trade_events (trade_id, field, value) VALUES (NEW.id, 'entry', NEW.entry1);
  END IF;
  IF NEW.entry2 IS NOT NULL AND NEW.entry2 IS DISTINCT FROM OLD.entry2 THEN
    INSERT INTO trade_events (trade_id, field, value) VALUES (NEW.id, 'entry', NEW.entry2);
  END IF;
  IF NEW.sl IS NOT NULL AND NEW.sl IS DISTINCT FROM OLD.sl THEN
    INSERT INTO trade_events (trade_id, field, value) VALUES (NEW.id, 'sl', NEW.sl);
  END IF;
  IF NEW.tp IS NOT NULL AND NEW.tp IS DISTINCT FROM OLD.tp THEN
    INSERT INTO trade_events (trade_id, field, value) VALUES (NEW.id, 'tp', NEW.tp);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trades_log_change ON trades;
CREATE TRIGGER trades_log_change AFTER UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION trg_trade_log_change();

CREATE OR REPLACE FUNCTION trg_trade_log_initial() RETURNS trigger AS $$
BEGIN
  IF NEW.entry1 IS NOT NULL THEN INSERT INTO trade_events (trade_id, field, value, changed_at) VALUES (NEW.id, 'entry', NEW.entry1, NEW.opened_at); END IF;
  IF NEW.entry2 IS NOT NULL THEN INSERT INTO trade_events (trade_id, field, value, changed_at) VALUES (NEW.id, 'entry', NEW.entry2, NEW.opened_at); END IF;
  IF NEW.sl IS NOT NULL THEN INSERT INTO trade_events (trade_id, field, value, changed_at) VALUES (NEW.id, 'sl', NEW.sl, NEW.opened_at); END IF;
  IF NEW.tp IS NOT NULL THEN INSERT INTO trade_events (trade_id, field, value, changed_at) VALUES (NEW.id, 'tp', NEW.tp, NEW.opened_at); END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trades_log_initial ON trades;
CREATE TRIGGER trades_log_initial AFTER INSERT ON trades FOR EACH ROW EXECUTE FUNCTION trg_trade_log_initial();

-- Trading-Log: Screenshots statt automatisch gezeichnetem Chart. Colin zeichnet seine
-- Analyse (Entry/SL/TP, Marken) selbst in TradingView ein, macht einen Screenshot und
-- laedt den hier hoch - das ersetzt den Versuch, TradingView im Dashboard nachzubauen.
CREATE TABLE IF NOT EXISTS trade_screenshots (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  image_data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trade_screenshots_trade ON trade_screenshots (trade_id, uploaded_at);
-- deleted_at: weiches Loeschen wie bei den anderen Tabellen (Rueckgaengig-Toast), damit ein
-- versehentlich geloeschter Screenshot nicht sofort unwiderruflich weg ist.
ALTER TABLE trade_screenshots ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Bottom-Events-Screenshots: analog zu trade_screenshots, damit man bei einem Watchlist-
-- Signal ebenfalls eigene TradingView-Screenshots ablegen kann (zu viele/falsche lassen
-- sich ueber die dazugehoerige DELETE-Route wieder entfernen).
CREATE TABLE IF NOT EXISTS watchlist_screenshots (
  id SERIAL PRIMARY KEY,
  signal_id INTEGER NOT NULL REFERENCES watchlist_signals(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  image_data BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_watchlist_screenshots_signal ON watchlist_screenshots (signal_id, uploaded_at);
ALTER TABLE watchlist_screenshots ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
