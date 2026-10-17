-- Candidate only: apply after ledger, existing table, permissions and isolated DB review.
-- No approval, RLS, grants or historical production records are changed.
BEGIN;
SET LOCAL lock_timeout = '3s';
ALTER TABLE public.__video_productions ADD COLUMN IF NOT EXISTS scenario jsonb;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.__video_productions'::regclass
      AND conname = 'video_productions_scenario_envelope'
  ) THEN
    ALTER TABLE public.__video_productions
      ADD CONSTRAINT video_productions_scenario_envelope CHECK (
        scenario IS NULL OR (
          jsonb_typeof(scenario) = 'object'
          AND scenario ? 'schemaVersion'
          AND scenario ? 'compositionId'
          AND scenario ? 'props'
        )
      );
  END IF;
END $$;
COMMIT;
