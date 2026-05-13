# `scripts/cron/` — Scheduler systemd canon (ADR-059 PR-5b)

Référence : [ADR-059 SEO Runtime Projection](https://github.com/ak125/governance-vault/blob/main/ledger/decisions/adr/ADR-059-seo-runtime-projection.md) — Phase B PR-5b.

## Rôle strict

Préparer le flux fiable `exports/seo/ → snapshot immutable` **avant** PR-6 (DB projection). Ce composant ne touche **jamais** la DB applicative.

```
sync_exports_seo.py (Type=notify systemd)
  ↓ git pull --ff-only wiki repo (read-only sur canon)
  ↓ subprocess: <wiki>/_scripts/build_exports_seo.py (PR-5a)
  ↓ subprocess: snapshot_exports_seo.py
      ↓ tar (déterministe, mtime=0, uid=0, sorted)
      ↓ zstd -19 (subprocess, pas de dep python)
      ↓ sha256(compressed) = filename
      ↓ <object_store>/exports-snapshots/<sha256>.tar.zst
      ↓ <object_store>/exports-snapshots/<sha256>.manifest.json
      ↓ chattr +i (silencieux si non-root)
  ↓ sd_notify READY=1 + journald structured logs JSON
```

## Garde-fous (testés statiquement + runtime)

| Garde-fou | Mécanisme |
|---|---|
| 0 LLM | `test_no_llm_inference_imports` |
| 0 DB applicative | `test_no_db_application_imports` |
| 0 écriture hors `<object_store>/exports-snapshots/` | `_enforce_object_store_path()` + tests négatifs |
| 0 projection DB | Aucun import psycopg/asyncpg/supabase ; ne crée pas/lit pas `__seo_projection_*` |
| READ_ONLY gate au processor | `READ_ONLY=true` skip builder + snapshot (per `feedback_readonly_gate_at_processor_not_scheduler.md`) |
| Idempotence | filename = sha256(compressed) ; skip si exists |
| Immutability | `chattr +i` post-write (skip silencieux non-root) |
| Replay SoT | manifest dit explicitement `wiki_commit_authority: informational-only` |
| Hardening systemd | `ProtectSystem=strict`, `ReadWritePaths=` limité, `PrivateTmp=yes`, `NoNewPrivileges=yes` |

## Déterminisme du tarball

Pour garantir que `sha256(tar.zst)` soit stable et reproductible :
- `mtime` fixé à epoch 0 sur tous les fichiers
- `uid` / `gid` = 0, `uname` / `gname` = ""
- Listing fichiers `sorted()` avant tar
- Format `PAX_FORMAT` (POSIX strict)
- zstd niveau 19 (déterministe)

## Manifest JSON

Versions complètes stockées pour replay determinism (per ADR-059 §"Versions complètes") :

```json
{
  "content_hash": "sha256:...",
  "filename": "<sha256>.tar.zst",
  "size_bytes": ...,
  "uncompressed_size_bytes": ...,
  "file_count": ...,
  "exports_dir": "/opt/automecanik/automecanik-wiki/exports/seo",
  "wiki_commit_sha": "<sha>",
  "builder_version": "1.0.0",
  "pipeline_version": "1.0.0",
  "extractor_version": "1.0.0",
  "runner_version": "1.0.0",
  "generated_at": "2026-05-XX",
  "snapshot_tool": "snapshot_exports_seo",
  "snapshot_tool_version": "1.0.0",
  "wiki_commit_authority": "informational-only (replay SoT = tar.zst, never git checkout)"
}
```

## Installation systemd (VPS DEV)

```bash
# Pré-requis système
apt install -y zstd python3 python3-click

# Object store
sudo mkdir -p /opt/automecanik/object-store/exports-snapshots
sudo chown -R deploy:deploy /opt/automecanik/object-store

# Units systemd
sudo cp app/scripts/cron/sync-exports-seo.service /etc/systemd/system/
sudo cp app/scripts/cron/sync-exports-seo.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sync-exports-seo.timer

# Vérification
systemctl status sync-exports-seo.timer
journalctl -u sync-exports-seo.service -n 50 --output=json-pretty
```

## Usage CLI standalone

```bash
# Exécution manuelle
python3 -m scripts.cron.sync_exports_seo \
    --wiki-root /opt/automecanik/automecanik-wiki \
    --object-store /opt/automecanik/object-store

# Mode READ_ONLY (observation pure, aucune écriture)
READ_ONLY=true python3 -m scripts.cron.sync_exports_seo

# Snapshot uniquement (skip pull + builder)
python3 -m scripts.cron.sync_exports_seo --skip-pull --skip-builder

# Dev local sans root (skip chattr +i)
python3 -m scripts.cron.sync_exports_seo --no-immutable
```

## Tests

```bash
cd /opt/automecanik/app
PYTHONPATH=. pytest tests/cron/ -v
```

## Hors scope PR-5b

- **Backup offsite** vers Hetzner Storage Box : `.timer` séparé à ajouter en PR followup (rsync nightly du object-store)
- **PR-6** : DB projection 7 tables + 2 MVs + 2 queues BullMQ + `replay_projection.py` (qui consomme les snapshots tar.zst de cette PR-5b)
- **PR-7** : RPC + adapter pages + depcruise/ast-grep guards
