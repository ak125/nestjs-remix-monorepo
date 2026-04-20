-- Dedicated error log table. Replaces the fourre-tout `___xtr_msg` usage
-- (which also hosts REDIRECT_RULE, legal documents, support messages) for
-- runtime error logging. Typed schema, proper indexes, 30-day retention via
-- pg_cron.
--
-- Companion to backend/src/modules/errors/services/error-log.service.ts
-- (buffered + batched writes, see fix/rag-xtr-msg-firehose).

CREATE TABLE IF NOT EXISTS public.__error_logs (
  err_id          bigserial PRIMARY KEY,
  err_created_at  timestamptz NOT NULL DEFAULT now(),
  err_code        text        NOT NULL,
  err_subject     text        NOT NULL,
  err_severity    text        NOT NULL
    CHECK (err_severity IN ('low','medium','high','critical')),
  err_url         text,
  err_method      text,
  err_status      int,
  err_user_agent  text,
  err_ip          inet,
  err_user_id     text,
  err_session_id  text,
  err_correlation text,
  err_message     text,
  err_stack       text,
  err_context     jsonb,
  err_env         text        NOT NULL DEFAULT 'production',
  err_resolved_at timestamptz,
  err_resolved_by text
);

COMMENT ON TABLE public.__error_logs IS
  'Runtime error log. Written by ErrorLogService (buffered+batched). 30-day retention via cron.';

CREATE INDEX IF NOT EXISTS idx_err_created_at
  ON public.__error_logs (err_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_err_subject_created
  ON public.__error_logs (err_subject, err_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_err_unresolved
  ON public.__error_logs (err_created_at DESC)
  WHERE err_resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_err_severity_created
  ON public.__error_logs (err_severity, err_created_at DESC)
  WHERE err_severity IN ('high','critical');

-- Access: backend writes via service role, admin dashboards read via authenticated
REVOKE ALL ON public.__error_logs FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.__error_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.__error_logs_err_id_seq TO service_role;
GRANT SELECT ON public.__error_logs TO authenticated;

-- Retention: 30 days, daily at 03:00 UTC (off-peak)
SELECT cron.schedule(
  'error-logs-retention',
  '0 3 * * *',
  $$DELETE FROM public.__error_logs WHERE err_created_at < now() - interval '30 days'$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'error-logs-retention'
);
