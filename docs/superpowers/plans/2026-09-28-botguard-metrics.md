# BotGuard measurement correction

> Execute inline with the executing-plans skill; no delegation or automatic code review. The user's repeated instruction to continue corrections authorizes this bounded DEV change. PROD remains read-only.

Goal: remove lost updates and misleading 24-hour totals from the existing BotGuard admin measurements. This does not add a traffic-blocking rule.

Design/spec: reuse CacheService's existing Redis connection, native HINCRBY and MULTI/EXEC, and expiring minute hashes. Read the last 1,440 completed UTC minutes (explicit inclusive start/exclusive end, delay under 60 seconds). Use a pipeline for the bounded read. Retain hashes for 25 hours; never scan the keyspace. Keep the current numeric fields under stats24h when data is available, add measurement metadata, and return null values with unavailable status when Redis fails. Version keys so legacy non-windowed counts are never relabeled as accurate history. History is not backfilled and completeness cannot be guaranteed after cache loss. Recent blocks use an atomic bounded Redis list, limited to 100 entries and filtered to the last 24 hours. Counter and recent-list failures must not alter enforcement decisions; emit a throttled warning without request identifiers.

Files: backend/src/cache/cache.service.ts (strict native primitives), backend/src/config/cache-ttl.config.ts (key/retention ownership), backend/src/modules/bot-guard/bot-guard.service.ts (measurement semantics), backend/src/modules/bot-guard/bot-guard.metrics.test.ts (behavioral regression proof). Existing middleware, session handling, crawler/synthetic exemptions, threshold and country policy unchanged.

Constraints: no new dependency, no second Redis connection at runtime, no paid service, no SQL or PROD mutation. Same draft PR #1582; no PR merge, release tag or deployment. Redis transactions do not roll back command-level errors: inspect every result and surface unavailable telemetry. Tests use ioredis-mock by default and the same assertions against a dedicated Unix-socket Redis fixture when explicitly selected; never use application REDIS_URL or flush shared data.

Review focus: concurrent allowed/blocked requests; exact window boundaries across midnight; absence vs failure/corrupt Redis counters; bounded recent history; retention and failure observability. Counters cover requests reaching BotGuard accounting, including allowed verified crawlers and synthetic probes; they are not all origin requests or visitors. Version 2 needs new observations; historical legacy counters cannot be recovered.

- [x] Reproduce counter loss, aging and recent-list loss before implementation.
- [x] Add strict native Redis helpers and versioned minute-window measurements.
- [x] Run targeted existing and new tests, types and lint; repeat the behavioral suite against isolated real Redis.
- [x] Refresh canonical generated projections, push the existing draft PR, verify CI, and send the concrete result/limitations to Hermes (completed on 28 September; later integration evidence below).

Evidence ledger: baseline 5da6b96a73892e44b2eb38e2113fdee5b0c4443b; main 4fca2ef26f6af27451e7bb31945982258c904ede. Prior CI 38 success / 9 skipped applies only to that baseline. Consumer search found no repository frontend consumer of stats24h; external consumers must honor status and window metadata.


Validation ledger (28 September 2026): the baseline lost 158 of 160 concurrent observations (allowed 1 / blocked 1), retained 3 observations when only 2 belonged to the window, and lost recent-list entries. Seven initial behavioral cases failed as expected. After correction, the 17 measurement cases pass both in-memory and on a dedicated Redis 7.0.15 Unix socket. The isolated fixture used ~1.25 MiB Redis memory at completion and was shut down without saving. The targeted BotGuard/cache suites pass 74 tests, and the separate synthetic identity suite passes 24 tests (98 distinct tests total). Backend TypeScript passes. ESLint has no error and 3 existing no-explicit-any warnings in unchanged portions of CacheService.

Ruling: the mock lacks Redis connection status and WRONGTYPE enforcement. Tests model its missing status explicitly; the two error-result cases inject native-shaped errors only in mock mode. The real Redis run uses actual wrong-type commands without stubbing. No runtime fallback was weakened for the mock.

Operational contract: stats24h.status must be checked before numeric values. The window is [from,to), exactly 24 hours ending at the latest completed UTC minute. The current partial minute is excluded. historyBackfilled=false and completeness=not_guaranteed are intentional: the first 24 hours after version 2 starts lack prior measurements; later cache loss or write failures can also leave gaps. These counters measure evaluated BotGuard requests, not visitors or all traffic. Recent-block cache outages now produce an error, not a successful empty list. Consumers outside the repository must handle these explicit failure states.

Rollback: reverting the application restores legacy keys/code; do not convert or delete Redis data. The versioned hashes expire after 25 hours and the recent list after 24 hours of inactivity. No command here authorizes PROD delivery.

Reproduce the isolated Redis check from the DEV worktree (never use application REDIS_URL):

```bash
cd backend
fixture_dir=$(mktemp -d /tmp/automecanik-botguard-XXXXXXXX)
trap 'redis-cli -s "$fixture_dir/redis.sock" shutdown nosave >/dev/null 2>&1 || true' EXIT
redis-server --port 0 --unixsocket "$fixture_dir/redis.sock" --unixsocketperm 700 --save '' --appendonly no --daemonize yes --pidfile "$fixture_dir/redis.pid" --logfile "$fixture_dir/redis.log"
BOT_GUARD_TEST_REDIS_SOCKET="$fixture_dir/redis.sock" npx jest --runInBand src/modules/bot-guard/bot-guard.metrics.test.ts
```

The runtime primitives follow Redis' native transaction semantics: https://redis.io/docs/latest/develop/using-commands/transactions/ and https://redis.io/docs/latest/commands/hincrby/ . Pipeline/transaction command errors are inspected, not treated as complete success. No runtime metric retry is attempted after an ambiguous write.


## Integration qualification — 1 October 2026

The previous worktree path is now used by `codex/seo-maintenance-auth-20260928`; it must not be reset for this PR. Integration is isolated in the existing BotGuard branch at `/opt/automecanik/app/.claude/worktrees/bot-guard-delivery-20261001`.

The candidate `de546afc7e49a217249bdb6a849ef47fe2ca34c9` conflicts with main `571118e380ebb9f8a61106ce8921e4ed91022ab2` only in seven generated registry/inventory projections. Merge main without rewriting the candidate history, regenerate from merged sources with the official builders, and preserve the new cache policies from main. Application BotGuard/cache primitives are unchanged by this integration. Dependencies come from a clean `npm ci`; no shared dependency directory or local package build is reused for generation.

Fresh DEV check: backend TypeScript passes; 130 tests in eight suites pass, including BotGuard, cache, cache TTL policies, single-target Redis configuration, cache-store factory and synthetic probe identity. The 17 isolated real-Redis cases from 28 September remain historical evidence for unchanged metric primitives; they are not a new production verification.

Read-only PROD observation on 1 October: image revision `4cb25b2c85f9a549e9e2ca68576df63986fea313`; BotGuard enabled, environment threshold 80, blocked country CN, no persisted `bot-guard:config` override. Compiled code still lacks the three candidate markers (configured threshold, authenticated-session scoring and V2 metrics). This configuration observation must be repeated just before delivery; it is not an authenticated read of live in-memory admin state.

Delivery gates: PR checks at the final candidate SHA, then an approved integration onto main. The exact main SHA must pass the existing `ci.yml` push run's Deploy PREPROD, E2E Smoke and Lighthouse jobs. These jobs require a push to main, regardless of draft status; changing the PR to ready does not produce PREPROD evidence. Use the maintained `scripts/ci/prod-preprod-evidence.mjs` gate. A floating preprod image or unrelated healthy container is insufficient.

Only Marwane performs application PROD deployment. Before a release, retain the currently served immutable image and repeat the config check; afterward validate the authenticated BotGuard stats contract and legitimate visitor/admin/crawler paths without manufacturing traffic in production. The first 24 hours of V2 history remain incomplete. Rollback restores the retained application image, without Redis migration or purge. This integration does not change Cloudflare rules or prove the automated-browsing cohort is blocked.


## Application authorised — 2 October 2026

The owner asked to apply the prepared result after the 1 October checkpoint. Scope now includes updating the existing PR, making it ready, merging through GitHub's protected-branch checks and following the native PREPROD workflow. This supersedes the earlier draft-only/no-PR-merge preparation limit; PROD application delivery remains manual by Marwane.

Main `63ee54116471c8a4cf45402cad6163958ff8df9e` adds three commits since the previously integrated base. Four conflicts are generated projections only. Rebuild with the official generators and preserve the main source changes. The inputs of the eight targeted BotGuard/cache/synthetic suites and dependency lockfiles are unchanged from the 130 passing tests. Reuse that scoped evidence and require a fresh complete CI result on the updated candidate. Keep branch protections intact: no administrator bypass, no force push, no production tag.

After merge, record the exact main SHA and native CI run. Require its Deploy PREPROD, E2E Smoke and Lighthouse results before preparing the manual PROD command. A newer floating preprod image or an unrelated running container is not evidence for the merged candidate. The metrics need new history after activation; the traffic incident remains open until runtime measurements and false-positive checks support closure.

The protected merge was deferred because main advanced to `ee5aaa856918690ee4a9b6b0712d53b8f8ae204b` (PR #1691) during CI. That registry-only change was integrated; the four generated conflicts were rebuilt with the canonical generators. A new complete CI run is required for the updated candidate.
