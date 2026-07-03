-- Rollback: increment_advice_views atomic view counter.
-- Additive function → fully reversible, no data loss (ba_visit values untouched).
-- After rollback, advice.service.ts falls back to the non-atomic read-modify-write
-- path (observable: it logs the PGRST202 "function absent" before falling back).

drop function if exists public.increment_advice_views(text);
