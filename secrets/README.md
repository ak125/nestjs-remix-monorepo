# `secrets/` — SOPS-encrypted environment files

Files in this directory are **encrypted at rest** using [SOPS](https://github.com/getsops/sops) with [age](https://github.com/FiloSottile/age) keys. Safe to commit. Decrypted only at deploy time, in memory, by `sops exec-env`.

## Files

| File | Purpose | Recipients (.sops.yaml) |
|------|---------|-------------------------|
| `sentry.dev.sops.env` | Sentry DSN backend + frontend + auth token, DEV env | `owner_fafa`, `dev_vps` |

Future (PR-B+) :
- `database.dev.sops.env` — Supabase keys, DATABASE_URL
- `payments.dev.sops.env` — Paybox + SystemPay HMAC keys
- `redis.dev.sops.env` — REDIS_URL with auth (if/when re-enabled)

## Editing

```bash
# Edit a file (opens $EDITOR with cleartext, encrypts on save)
sops edit secrets/sentry.dev.sops.env

# View cleartext without editing
sops decrypt secrets/sentry.dev.sops.env

# Encrypt a fresh plaintext file (one-time)
sops encrypt --in-place secrets/sentry.dev.sops.env
```

## Using at runtime

```bash
# Inject into env, run command, secrets never touch disk
sops exec-env secrets/sentry.dev.sops.env \
  'docker compose -f docker-compose.preprod.yml up -d'
```

## Adding a recipient (new machine / new operator)

See top of [`/.sops.yaml`](../.sops.yaml).

## **Never commit a plaintext file**

The `.gitignore` has guards (`secrets/*.env` ignored, `secrets/*.sops.env` allowed) but always sanity-check `git diff` before commit.

See [`docs/runbooks/secrets-sops.md`](../docs/runbooks/secrets-sops.md) for the full workflow.
