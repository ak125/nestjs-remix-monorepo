# Runbook — Sentry on VPS DEV

> **Prerequisite** : SOPS bootstrap done — see [`secrets-sops.md`](secrets-sops.md). The Sentry workflow assumes `secrets/sentry.dev.sops.env` is already encrypted and pushed.

## Overview

| Layer | Lives where | Lifecycle |
|-------|-------------|-----------|
| `SENTRY_DSN` (backend), `VITE_SENTRY_DSN` (frontend) | SOPS-encrypted in `secrets/sentry.dev.sops.env`, decrypted in-memory by `run-with-secrets.sh` at `docker compose up` | Per request — passed to container via `environment:` block |
| `SENTRY_AUTH_TOKEN` | SOPS-encrypted in same file | Used **only on VPS** by `sentry-cli` post-deploy + cron signal A. Never reaches the container. |
| Source maps | Generated at build, uploaded to Sentry post-deploy by `sentry-cli` | Per release |
| Signal A (error rate) | Computed by `scripts/observability/sentry-signal-a.sh` cron | Hourly |

## One-time bootstrap on VPS DEV

```bash
ssh deploy@46.224.118.55
cd /opt/automecanik/app

# 1. Install sops + age (idempotent)
./scripts/secrets/install-sops.sh

# 2. Generate the VPS age key (if not already done in secrets-sops bootstrap)
mkdir -p ~/.config/sops/age
test -f ~/.config/sops/age/keys.txt || age-keygen -o ~/.config/sops/age/keys.txt
chmod 600 ~/.config/sops/age/keys.txt
grep '# public key:' ~/.config/sops/age/keys.txt
# → copy this age1... into .sops.yaml on your dev machine,
#   re-encrypt secrets/sentry.dev.sops.env, push, pull here.

# 3. Verify decryption works on this host
sops decrypt secrets/sentry.dev.sops.env >/dev/null && echo "✓ decryptable"

# 4. Install sentry-cli (once)
curl -sL https://sentry.io/get-cli/ | INSTALL_DIR=$HOME/.local/bin bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
sentry-cli --version
```

## Deploy with Sentry secrets injected

Replace direct `docker compose up` with the SOPS wrapper:

```bash
# Full deploy chain (DEV)
cd /opt/automecanik/app
git pull
docker compose -f docker-compose.preprod.yml pull
./scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- \
  docker compose -f docker-compose.preprod.yml up -d monorepo_preprod
```

The wrapper decrypts `sentry.dev.sops.env` in-memory, exports its variables to the env, then `exec`s `docker compose`. Compose forwards them to the container per the `environment:` block in `docker-compose.preprod.yml`.

> **Belt-and-suspenders** : the same command is safe to run when `SENTRY_DSN` is empty in the SOPS file — the SDK no-ops. So you can ship the SOPS file with placeholder values during the bootstrap window without breaking startup.

## Source map upload (post-deploy hook)

After a successful `docker compose up`, run:

```bash
./scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- bash -c '
  sentry-cli releases new "$GIT_SHA" \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT_BACKEND"

  sentry-cli sourcemaps upload \
    --release "$GIT_SHA" \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT_BACKEND" \
    backend/dist/

  sentry-cli sourcemaps upload \
    --release "$GIT_SHA" \
    --org "$SENTRY_ORG" \
    --project "$SENTRY_PROJECT_FRONTEND" \
    frontend/build/

  sentry-cli releases finalize "$GIT_SHA" \
    --org "$SENTRY_ORG"

  sentry-cli releases deploys "$GIT_SHA" new \
    --env preprod \
    --org "$SENTRY_ORG"
'
```

`$GIT_SHA` defaults to `git rev-parse HEAD`. To make this part of every deploy, append the block above to whatever script the VPS runs after `docker compose up` (often `~/.deploy/post-deploy.sh` or a CI-driven hook).

## Signal A — checkout error rate cron

```bash
# Test the script manually first
./scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- \
  ./scripts/observability/sentry-signal-a.sh --hours 24

cat /var/log/sentry-signal-a-latest.json
```

Once the manual run is green, add a cron entry:

```bash
sudo tee /etc/cron.d/sentry-signal-a > /dev/null <<'CRON'
# Compute Sentry signal A (checkout error rate) every hour at :07
# Reads SOPS-encrypted secrets in-memory, never persists plaintext.
7 * * * * deploy cd /opt/automecanik/app && ./scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- ./scripts/observability/sentry-signal-a.sh >> /var/log/sentry-signal-a.log 2>&1
CRON
```

The output JSON file is read by the dashboard / alerting (TBD in PR-B+).

## Smoke test the wiring after first deploy

```bash
# 1. Backend — the debug endpoint is exposed in DEV by default
curl -s https://dev.automecanik.com/health/sentry-debug
# → expect HTTP 500 + Sentry should show this exception in the Issues feed
#   within ~30s

# 2. Frontend — open https://dev.automecanik.com in a browser, then in devtools:
#    > throw new Error('Sentry frontend smoke test')
#    → expect a new event in the frontend project's Issues feed.

# 3. Verify release tagging worked
sentry-cli releases list --org "$SENTRY_ORG" --project "$SENTRY_PROJECT_BACKEND" | head -5
```

## Rotation (auth token compromise)

```bash
# On dev machine:
# 1. Revoke old token in Sentry UI → Settings → Auth Tokens
# 2. Generate new token, edit SOPS file
sops edit secrets/sentry.dev.sops.env  # replace SENTRY_AUTH_TOKEN
git add secrets/sentry.dev.sops.env
git commit -s -m 'chore(secrets): rotate SENTRY_AUTH_TOKEN'
git push

# On VPS:
ssh deploy@46.224.118.55 'cd /opt/automecanik/app && git pull && \
  ./scripts/secrets/run-with-secrets.sh secrets/sentry.dev.sops.env -- \
  docker compose -f docker-compose.preprod.yml restart monorepo_preprod'
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Sentry SDK initialized but no events appear` | DSN unset in container env, or in-process firewall | `docker compose exec monorepo_preprod env \| grep SENTRY` to verify; check VPS network egress to `*.ingest.de.sentry.io` |
| `sentry-cli: error: Failed to load credentials` | `SENTRY_AUTH_TOKEN` not exported to the shell running `sentry-cli` | Wrap the command with `run-with-secrets.sh` |
| Events appear in PROD project from DEV traffic | Same image promoted from preprod has DEV env injected at runtime — but `SENTRY_PROJECT_*` is wrong somewhere | Ensure VPS PROD has its own SOPS secrets file with PROD project slugs |
| Stack traces unsymbolicated | Source maps not uploaded for that release | Re-run the source-map upload block above with the correct `$GIT_SHA` |

## References

- [Sentry NestJS docs](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [Sentry Remix docs](https://docs.sentry.io/platforms/javascript/guides/remix/)
- [`secrets-sops.md`](secrets-sops.md) — secret management foundation
- [`backend/src/instrument.ts`](../../backend/src/instrument.ts) — backend SDK init
- [`frontend/app/entry.client.tsx`](../../frontend/app/entry.client.tsx) + [`entry.server.tsx`](../../frontend/app/entry.server.tsx) — frontend SDK init
