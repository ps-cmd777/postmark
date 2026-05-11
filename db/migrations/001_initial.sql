-- Postmark v1 schema. See POSTMARK_PROJECT_BRIEF.md §7.
--
-- Migration strategy: idempotent on first init, no framework.
-- src/lib/db.ts runs this SQL once if `experiments` table is missing.
-- When v2 schema evolution is needed, replace with a schema_migrations
-- table and per-file runner; not justified at v1's single-file scope.
--
-- No CHECK constraints on enum columns (lifecycle, decision, category,
-- severity). Zod validates at the data boundary; the TS union types
-- stay the single source of truth, avoiding two-place drift.
--
-- sqlite-vec loaded eagerly at connection time (see src/lib/db.ts) so
-- vec_experiments is queryable from the first statement.

CREATE TABLE experiments (
  id                         TEXT PRIMARY KEY,
  title                      TEXT NOT NULL,
  hypothesis                 TEXT NOT NULL,
  category                   TEXT NOT NULL,
  lifecycle                  TEXT NOT NULL,
  decision                   TEXT,
  start_date                 TEXT NOT NULL,
  end_date                   TEXT,
  duration_days              INTEGER NOT NULL,
  segment                    TEXT NOT NULL,
  segment_size               INTEGER NOT NULL,
  primary_metric             TEXT NOT NULL,
  primary_metric_baseline    REAL NOT NULL,
  primary_metric_treatment   REAL NOT NULL,
  lift_percent               REAL NOT NULL,
  p_value                    REAL NOT NULL,
  sample_size                INTEGER NOT NULL,
  guardrail_metrics          TEXT NOT NULL,  -- JSON: GuardrailMetric[]
  segment_breakdown          TEXT NOT NULL,  -- JSON: SegmentResult[]
  what_we_learned            TEXT NOT NULL,
  failure_modes              TEXT NOT NULL,  -- JSON: FailureMode[]
  team                       TEXT NOT NULL,
  pm                         TEXT NOT NULL,
  tags                       TEXT NOT NULL   -- JSON: string[]
);

CREATE INDEX idx_experiments_lifecycle  ON experiments(lifecycle);
CREATE INDEX idx_experiments_decision   ON experiments(decision);
CREATE INDEX idx_experiments_category   ON experiments(category);
CREATE INDEX idx_experiments_team       ON experiments(team);
CREATE INDEX idx_experiments_start_date ON experiments(start_date);

CREATE TABLE lessons (
  id                       TEXT PRIMARY KEY,
  pattern                  TEXT NOT NULL,
  description              TEXT NOT NULL,
  related_experiment_ids   TEXT NOT NULL,  -- JSON: string[]
  category                 TEXT NOT NULL,  -- JSON: ExperimentCategory[]
  severity                 TEXT NOT NULL,
  detection_query          TEXT NOT NULL
);

CREATE INDEX idx_lessons_severity ON lessons(severity);

-- Voyage voyage-3-large default output: 1024 dims, cosine. See brief §6.
-- Keyed by experiment_id; logical FK to experiments.id enforced by the
-- seed script (sqlite-vec virtual tables don't support FK constraints).
CREATE VIRTUAL TABLE vec_experiments USING vec0(
  experiment_id TEXT PRIMARY KEY,
  embedding float[1024] distance_metric=cosine
);
