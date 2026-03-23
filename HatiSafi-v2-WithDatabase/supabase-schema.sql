-- ═══════════════════════════════════════════════════
-- Hati Safi — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════

-- ── TABLE 1: analyses
-- Stores every document analysis result
-- ──────────────────────────────────────
CREATE TABLE analyses (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),

  -- Document info
  file_name     TEXT,
  file_type     TEXT,                          -- pdf, image/jpeg, etc.
  doc_type      TEXT NOT NULL,                 -- e.g. "HELB Loan Default Letter"
  language      TEXT DEFAULT 'English',

  -- Risk
  risk          TEXT CHECK (risk IN ('low','medium','high')),
  risk_explanation TEXT,

  -- Core results (stored as JSON)
  summary       TEXT,
  answer_to_question TEXT,
  key_terms     JSONB,                         -- [{term, definition}]
  action_steps  JSONB,                         -- ["step1", "step2"]
  deadlines     JSONB,                         -- ["deadline1"]
  help_resources JSONB,                        -- [{name, description, icon}]
  web_sources   JSONB,                         -- [{title, url, snippet}]
  live_research_summary TEXT,

  -- Session tracking (no login required)
  session_id    TEXT,                          -- random ID stored in localStorage
  user_question TEXT                           -- what the user asked (if any)
);

-- ── TABLE 2: legal_searches
-- Stores questions from the "Ask" tab
-- ──────────────────────────────────────
CREATE TABLE legal_searches (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),

  question    TEXT NOT NULL,
  language    TEXT DEFAULT 'English',
  headline    TEXT,
  answer      TEXT,
  steps       JSONB,
  contacts    JSONB,
  sources     JSONB,

  session_id  TEXT
);

-- ── TABLE 3: document_types_stats
-- Auto-updated view — shows most common document types
-- ──────────────────────────────────────
CREATE VIEW document_type_stats AS
SELECT
  doc_type,
  COUNT(*) AS total_analyses,
  COUNT(CASE WHEN risk = 'high'   THEN 1 END) AS high_risk_count,
  COUNT(CASE WHEN risk = 'medium' THEN 1 END) AS medium_risk_count,
  COUNT(CASE WHEN risk = 'low'    THEN 1 END) AS low_risk_count,
  MAX(created_at) AS last_seen
FROM analyses
GROUP BY doc_type
ORDER BY total_analyses DESC;

-- ── ROW LEVEL SECURITY (RLS)
-- Allow anyone to insert and read their own session data
-- (no login required — uses session_id for isolation)
-- ──────────────────────────────────────
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_searches ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT
CREATE POLICY "Anyone can insert analyses"
  ON analyses FOR INSERT
  WITH CHECK (true);

-- Anyone can SELECT (read) all analyses
-- (for shared history — change if you add auth later)
CREATE POLICY "Anyone can read analyses"
  ON analyses FOR SELECT
  USING (true);

-- Anyone can INSERT legal searches
CREATE POLICY "Anyone can insert searches"
  ON legal_searches FOR INSERT
  WITH CHECK (true);

-- Anyone can read legal searches
CREATE POLICY "Anyone can read searches"
  ON legal_searches FOR SELECT
  USING (true);

-- ── INDEXES for fast queries
CREATE INDEX idx_analyses_session   ON analyses (session_id);
CREATE INDEX idx_analyses_created   ON analyses (created_at DESC);
CREATE INDEX idx_analyses_doc_type  ON analyses (doc_type);
CREATE INDEX idx_searches_session   ON legal_searches (session_id);

-- ── SAMPLE DATA (optional — delete if not needed)
-- INSERT INTO analyses (doc_type, risk, summary, file_name, language, session_id)
-- VALUES ('Test Document', 'low', 'This is a test entry.', 'test.pdf', 'English', 'test-session-001');
