# BotGuard measurement correction

> Execute inline with the executing-plans skill; no delegation or automatic code review. The user's repeated instruction to continue corrections authorizes this bounded DEV change. PROD remains read-only.

Goal: remove lost updates and misleading 24-hour totals from the existing BotGuard admin measurements. This does not add a traffic-blocking rule.

Design/spec: reuse CacheService's existing Redis connection, native HINCRBY and MULTI/EXEC, and expiring minute hashes. Read the last 1,440 completed UTC minutes (explicit inclusive start/exclusive end, delay under 60 seconds). Use a pipeline for the bounded read. Retain hashes for 25 hours; never scan the keyspace. Keep the current numeric fields under stats24h when data is available, add measurement metadata, and return null values with unavailable status when Redis fails. Version keys so legacy non-windowed counts are never relabeled as accurate history. History is not backfilled and completeness cannot be guaranteed after cache loss. Recent blocks use an atomic bounded Redis list, limited to 100 entries and filtered to the last 24 hours. Counter and recent-list failures must not alter enforcement decisions; emit a throttled warning without request identifiers.

Files: backend/src/cache/cache.service.ts (strict native primitives), backend/src/config/cache-ttl.config.ts (key/retention ownership), backend/src/modules/bot-guard/bot-guard.service.ts (measurement semantics), backend/src/modules/bot-guard/bot-guard.metrics.test.ts (behavioral regression proof). Existing middleware, session handling, crawler/synthetic exemptions, threshold and country policy unchanged.

Constraints: no new dependency, no second Redis connection at runtime, no paid service, no SQL or PROD mutation. Same draft PR #1582; no merge, release tag or deployment. Redis transactions do not roll back command-level errors: inspect every result and surface unavailable telemetry. Tests use ioredis-mock by default and the same assertions against a dedicated Unix-socket Redis fixture when explicitly selected; never use application REDIS_URL or flush shared data.

Review focus: concurrent allowed/blocked requests; exact window boundaries across midnight; absence vs failure/corrupt Redis counters; bounded recent history; retention and failure observability. Counters cover only requests evaluated by BotGuard, not all origin requests, visitors, verified crawlers or synthetic probes. Version 2 needs new observations; historical legacy counters cannot be recovered.

- [x] Reproduce counter loss, aging and recent-list loss before implementation.
- [x] Add strict native Redis helpers and versioned minute-window measurements.
- [x] Run targeted existing and new tests, types and lint; repeat the behavioral suite against isolated real Redis.
- [ ] Refresh canonical generated projections, push the existing draft PR, verify CI, and send the concrete result/limitations to Hermes.

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
