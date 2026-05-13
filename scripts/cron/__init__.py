"""
scripts/cron — Schedulers systemd canon (ADR-059 Phase B).

Composants Phase B PR-5b :
- sync_exports_seo.py     : orchestrator (pull wiki + run builder + snapshot)
- snapshot_exports_seo.py : tar.zst content-addressed object-store immutable

Garde-fous stricts :
- 0 LLM (extraction déterministe uniquement)
- 0 DB applicative (aucune écriture Supabase/Postgres)
- 0 écriture hors `<object_store>/exports-snapshots/` (path enforcement)
- READ_ONLY gate au processor (per feedback_readonly_gate_at_processor_not_scheduler)
- sd_notify natif (NOTIFY_SOCKET socket Unix, sans dépendance python-systemd)
"""
