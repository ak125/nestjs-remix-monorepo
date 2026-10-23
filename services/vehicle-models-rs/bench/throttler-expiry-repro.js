'use strict';
// repro.js <dossier du paquet @nestjs/throttler> <sortie.jsonl>
// Reproduit en isolement la charge du palier « long » observée dans la passe a2-L20-diag :
// N coups vivants répartis sur KEYS clés, puis expiration à R/s pendant que de nouveaux coups
// arrivent à R/s (ttl 1 h), comme à 80 req/s × 2 contextes. Relève chaque seconde le retard de
// la boucle, RSS, tas et nombre de coups vivants. Aucune requête réseau, aucune écriture hors sortie.
const fs = require('fs');
const path = require('path');
const { monitorEventLoopDelay } = require('perf_hooks');
const v8 = require('v8');
require(require.resolve('reflect-metadata', { paths: [process.argv[2]] }));
const pkg = process.argv[2];
const out = fs.openSync(process.argv[3], 'w');
const { ThrottlerStorageService } = require(path.join(pkg, 'dist', 'throttler.service.js'));
const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;

const N = +(process.env.N || 576000), KEYS = +(process.env.KEYS || 8192), R = +(process.env.R || 160);
const LEAD_S = +(process.env.LEAD_S || 20), AFTER_S = +(process.env.AFTER_S || 60);
const LIMIT = 1e9, TTL_LONG = 3600 * 1000, BLOCK = TTL_LONG;
const st = new ThrottlerStorageService();
const key = (i) => 'k' + (i % KEYS);
const live = () => st.timeoutIds ? st.timeoutIds.get('long').length
  : [...st.hitExpirations.values()].reduce((a, m) => a + (m.get('long') || []).length, 0);
const write = (o) => fs.writeSync(out, JSON.stringify(o) + '\n');

(async () => {
  const t0 = Date.now();
  // Remplissage : le coup i expire à fin + LEAD_S + i/R secondes.
  const fillEnd = t0 + 15000;
  for (let i = 0; i < N; i++) {
    const at = fillEnd + LEAD_S * 1000 + (i * 1000) / R;
    await st.increment(key(i), at - Date.now(), LIMIT, BLOCK, 'long');
  }
  const filledMs = Date.now() - t0;
  while (Date.now() < fillEnd) await new Promise((r) => setTimeout(r, 50));
  write({ version, N, KEYS, R, filled_ms: filledMs, live: live(), heap_limit: v8.getHeapStatistics().heap_size_limit });
  const h = monitorEventLoopDelay({ resolution: 10 }); h.enable();
  let sent = 0, done = 0, j = N;
  const tick = setInterval(() => {
    for (let k = 0; k < R / 40; k++) { sent++; st.increment(key(j++), TTL_LONG, LIMIT, BLOCK, 'long').then(() => done++); }
  }, 25);
  const start = Date.now();
  let last = start;
  const sample = setInterval(() => {
    const now = Date.now(), m = process.memoryUsage();
    write({ s: +((now - fillEnd) / 1000 - LEAD_S).toFixed(1), gap_ms: now - last, sent, done,
      loop_p99_ms: h.percentile(99) / 1e6, loop_max_ms: h.max / 1e6, rss_mb: m.rss / 2 ** 20,
      heap_used_mb: m.heapUsed / 2 ** 20, heap_total_mb: m.heapTotal / 2 ** 20, live: live() });
    h.reset(); last = now;
    if (now - fillEnd > (LEAD_S + AFTER_S) * 1000) { clearInterval(tick); clearInterval(sample); st.onApplicationShutdown(); write({ end: true }); process.exit(0); }
  }, 1000);
})();
