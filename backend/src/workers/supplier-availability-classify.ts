/* eslint-disable no-console -- READ-ONLY full-feed availability classifier (ops CLI) */
/**
 * Generic supplier FULL-FEED availability classifier — bulk `POST /search` route.
 *
 * Verifies EVERY ref of a prepared supplier feed against the portal in ONE batched
 * pass (~0.2s/ref via multi-ref search vs ~17s/ref page render), and classifies each
 * into an ACTIVATION bucket (CONFIRMED_AG/GRP → sellable, BLOCK_NONE → rupture, the
 * REVIEW_* → human). This is the efficient successor to per-ref portal spot-checks;
 * it is the brick that tells the price-load which refs may become `pri_dispo='1'/'2'`.
 *
 * READ-ONLY. NO DB write, NO PricingModule call, NO `pri_dispo` touched. Produces a
 * cumulative classification report + per-bucket CSV lists + gzip'd raw HTML in OUT_DIR.
 * Resumable (JSONL checkpoint) so a multi-hour run survives a session hiccup, and a
 * failed batch is never checkpointed (so a transient timeout never becomes a false
 * NOT_FOUND). Generic over supplier (SUPPLIER_SPL) and brand (BRAND_TOKENS) — nothing
 * is hardcoded to NK/DCA, so the same worker serves every future supplier/tariff.
 *
 * Env (required): SUPPLIER_SPL (registry spl_id, must be an `inoshop` platform),
 *   FEED_PATH (CSV with `ref` + `ean` columns), BRAND_TOKENS (csv of the portal brand
 *   labels/short-codes to lock onto, e.g. "NK,SBS" or "MECAFILTER,MEFI").
 * Env (required): OUT_DIR — durable output dir; holds the resumable JSONL checkpoint
 *   + gz HTML, so it MUST be a persistent path the operator controls, never an
 *   ephemeral OS temp dir.
 * Env (optional): BATCH (default 50), LIMIT (cap refs, for a pilot).
 *
 * Run: SUPPLIER_SPL=71 BRAND_TOKENS=NK,SBS \
 *      FEED_PATH=/opt/automecanik/data/tecdoc/<supplier>-<brand>-<YYYYMM>-feed.csv \
 *      OUT_DIR=/opt/automecanik/data/tecdoc/dca-nk [LIMIT=100] \
 *      npx tsx -r dotenv/config backend/src/workers/supplier-availability-classify.ts \
 *        dotenv_config_path=backend/.env
 */
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
} from 'node:fs';
import { gzipSync } from 'node:zlib';
import { getSupplierConnectorConfig } from '../modules/supplier-truth/connectors/supplier-registry';
import { InoshopConnector } from '../modules/supplier-truth/connectors/inoshop.connector';
import {
  brandTokenSet,
  verdictForRef,
  type ActivationBucket,
  type RefVerdict,
  type SearchRow,
} from '../modules/supplier-truth/connectors/inoshop-search-parse';
import { runResilientClassify } from '../modules/supplier-truth/connectors/portal-classify-resilience';

const req = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`missing env ${k}`);
  return v;
};
const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));
const pct = (n: number, d: number): string =>
  d ? ((n / d) * 100).toFixed(1) + '%' : '0%';
// Supplier refs can contain `/` (e.g. VDO "2910000102400/483") — a raw ref in the
// cache filename becomes a nested path and crashes writeFileSync (ENOENT).
const fsSafe = (ref: string): string => ref.replace(/[^A-Za-z0-9._-]/g, '-');

// Terminal verdict for a ref that persistently fails its OWN single-ref search while
// the portal is otherwise healthy (owner rule 2026-06-11: "504 sur une ref = la ref a
// un pb / pas pertinente → skip au lieu de bloquer"). Checkpointed so the run CONVERGES
// (never re-hit on resume) and surfaced as a REVIEW bucket for human follow-up. It is
// NOT a stock signal — never auto-activates anything.
const portalTimeoutVerdict = (b: FeedRow): RefVerdict => ({
  ref: b.ref,
  ean: b.ean,
  bucket: 'REVIEW_PORTAL_TIMEOUT',
  matchKind: 'NOT_FOUND',
  reason: 'portal_persistent_timeout',
  code: null,
  marque: null,
  dispoType: null,
  icon: null,
  portalPrix: null,
});

interface FeedRow {
  ref: string;
  ean: string | null;
}

function loadFeed(path: string): FeedRow[] {
  const lines = readFileSync(path, 'utf8').split('\n');
  const h = lines[0].split(',');
  const iRef = h.indexOf('ref');
  const iEan = h.indexOf('ean');
  if (iRef < 0) throw new Error(`feed ${path} has no 'ref' column`);
  const out: FeedRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const ref = c[iRef]?.trim();
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    out.push({ ref, ean: (iEan >= 0 ? c[iEan]?.trim() : '') || null });
  }
  return out;
}

async function main(): Promise<void> {
  const cfg = getSupplierConnectorConfig(req('SUPPLIER_SPL'));
  if (!cfg)
    throw new Error(
      `no connector cfg for SUPPLIER_SPL=${process.env.SUPPLIER_SPL}`,
    );
  if (cfg.platform !== 'inoshop')
    throw new Error(
      `supplier ${cfg.supplierId} platform '${cfg.platform}' has no bulk /search route — classifier supports 'inoshop' only`,
    );
  const tokens = brandTokenSet({ tokens: req('BRAND_TOKENS').split(',') });
  if (tokens.size === 0) throw new Error('BRAND_TOKENS resolved to empty set');

  // Durable, operator-chosen output dir (required): holds the resumable JSONL
  // checkpoint + gz HTML, so it must persist across runs. Deliberately NO default —
  // a hardcoded /tmp path is an insecure predictable temp location, and a random
  // per-run temp dir (mkdtemp) would defeat --resume. The operator passes a stable
  // path under the repo data dir (e.g. OUT_DIR=/opt/automecanik/data/tecdoc/dca-<brand>).
  const OUT = req('OUT_DIR');
  const HTML_DIR = `${OUT}/html`;
  mkdirSync(HTML_DIR, { recursive: true });
  const JSONL = `${OUT}/verdicts.jsonl`;
  const PROGRESS = `${OUT}/progress.txt`;
  const BATCH = Number(process.env.BATCH ?? 50);

  let feed = loadFeed(req('FEED_PATH'));
  if (process.env.LIMIT) feed = feed.slice(0, Number(process.env.LIMIT));

  // resume: skip refs already in the checkpoint. Read directly + tolerate a missing
  // file (fresh run) rather than existsSync-then-read — removes a TOCTOU on JSONL.
  const done = new Set<string>();
  let checkpoint = '';
  try {
    checkpoint = readFileSync(JSONL, 'utf8');
  } catch {
    /* no checkpoint yet (fresh run) — start with an empty set */
  }
  for (const line of checkpoint.split('\n')) {
    if (!line.trim()) continue;
    try {
      done.add((JSON.parse(line) as RefVerdict).ref);
    } catch {
      /* skip malformed checkpoint line */
    }
  }
  const todo = feed.filter((r) => !done.has(r.ref));
  console.log(
    `CLASSIFY supplier=${cfg.supplierName} (${cfg.supplierId}) brand=[${[...tokens].join(',')}] feed=${feed.length} done=${done.size} todo=${todo.length} batch=${BATCH}`,
  );
  if (todo.length === 0)
    console.log('nothing to do — already complete; regenerating report only');

  const connector = new InoshopConnector({
    supplierId: cfg.supplierId,
    baseUrl: cfg.baseUrl,
  });
  let token = '';
  if (todo.length > 0) {
    await connector.login({
      user: req(cfg.credEnv.userKey),
      password: req(cfg.credEnv.passKey),
    });
    token = await connector.getCsrfToken();
    console.log('LOGIN OK, token acquired');
  }

  let attemptErrors = 0;
  const t0 = Date.now();
  const BACKOFF = [4000, 12000, 30000];

  const relogin = async (): Promise<void> => {
    await connector.login({
      user: req(cfg.credEnv.userKey),
      password: req(cfg.credEnv.passKey),
    });
    token = await connector.getCsrfToken();
  };
  // up to 3 attempts; refresh token (re-login from attempt 2) + backoff between tries.
  const fetchBatch = async (
    refs: string[],
  ): Promise<{ html: string; rows: SearchRow[] } | null> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const r = await connector.fetchSearchRaw(refs, token);
        if (r.rows.length === 0) throw new Error('0 rows');
        return r;
      } catch (e) {
        attemptErrors++;
        console.log(`    attempt ${attempt} failed: ${(e as Error).message}`);
        try {
          if (attempt >= 2) await relogin();
          else token = await connector.getCsrfToken();
        } catch {
          try {
            await relogin();
          } catch {
            /* keep old token */
          }
        }
        await sleep(BACKOFF[attempt - 1]);
      }
    }
    return null;
  };

  // ----- resilient classification: bisect + per-ref budget + circuit breaker -----
  // Resumable per-ref isolated-attempt budget: a persistently-failing ref accumulates
  // attempts across resumes too, not only within one run.
  const ATTEMPTS = `${OUT}/attempts.json`;
  let refAttempts: Record<string, number> = {};
  try {
    refAttempts = JSON.parse(readFileSync(ATTEMPTS, 'utf8')) as Record<
      string,
      number
    >;
  } catch {
    /* fresh run — no prior attempts */
  }

  let classified = 0;
  let successGroups = 0;
  let pace = 0;
  const result = await runResilientClassify(
    todo,
    {
      batchSize: BATCH,
      maxRefAttempts: Number(process.env.MAX_REF_ATTEMPTS ?? 3),
      breakerWindow: Number(process.env.BREAKER_WINDOW ?? 8),
    },
    {
      fetchGroup: async (group) => {
        const r = await fetchBatch(group.map((b) => b.ref));
        if (!r) return false;
        writeFileSync(
          `${HTML_DIR}/${fsSafe(group[0].ref)}_${fsSafe(group[group.length - 1].ref)}.html.gz`,
          gzipSync(r.html),
        );
        appendFileSync(
          JSONL,
          group
            .map((b) =>
              JSON.stringify(verdictForRef(r.rows, b.ref, b.ean, tokens)),
            )
            .join('\n') + '\n',
        );
        classified += group.length;
        successGroups++;
        const elapsed = Math.round((Date.now() - t0) / 1000);
        const rate = classified / Math.max(1, elapsed);
        const etaMin = Math.round(
          (todo.length - classified) / Math.max(0.01, rate) / 60,
        );
        const msg = `progress ${done.size + classified}/${feed.length} | rows=${r.rows.length} | attErr=${attemptErrors} | ${elapsed}s | ETA ~${etaMin}min`;
        console.log('  ' + msg);
        writeFileSync(PROGRESS, msg + '\n');
        if (successGroups % 30 === 0) {
          try {
            token = await connector.getCsrfToken();
          } catch {
            /* keep old token */
          }
        }
        return true;
      },
      onRefDeadLettered: (item) => {
        appendFileSync(
          JSONL,
          JSON.stringify(portalTimeoutVerdict(item)) + '\n',
        );
      },
      recordRefAttempt: (ref) => {
        refAttempts[ref] = (refAttempts[ref] ?? 0) + 1;
        writeFileSync(ATTEMPTS, JSON.stringify(refAttempts));
        return refAttempts[ref];
      },
      sleepBetween: async () => {
        pace++;
        await sleep(4000 + Math.floor(Math.random() * 4000)); // 4-8s anti-ban
        if (pace % 50 === 0)
          await sleep(20000 + Math.floor(Math.random() * 20000));
      },
      log: (m) => console.log('  ' + m),
    },
  );
  const terminalTimeouts = result.deadLettered.length;
  await connector.close();
  const durationS = Math.round((Date.now() - t0) / 1000);

  // --- aggregate from the full checkpoint ---
  const all: RefVerdict[] = readFileSync(JSONL, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RefVerdict);
  const buckets: Record<ActivationBucket, number> = {
    CONFIRMED_AG: 0,
    CONFIRMED_GRP: 0,
    REVIEW_ARRIVAGE: 0,
    REVIEW_NO_SIGNAL: 0,
    REVIEW_NO_EAN: 0,
    REVIEW_CONTRADICTION: 0,
    REVIEW_FALSE_MATCH: 0,
    REVIEW_NOT_FOUND: 0,
    REVIEW_PORTAL_TIMEOUT: 0,
    BLOCK_NONE: 0,
  };
  for (const v of all) buckets[v.bucket]++;
  const confirmed = all.filter((v) => v.bucket.startsWith('CONFIRMED'));
  const confirmedNoEan = confirmed.filter((v) => v.matchKind === 'REF_BRAND');
  const blocked = all.filter((v) => v.bucket === 'BLOCK_NONE');
  const review = all.filter((v) => v.bucket.startsWith('REVIEW'));
  const activable = buckets.CONFIRMED_AG + buckets.CONFIRMED_GRP;

  const csv = (rows: RefVerdict[]): string =>
    'ref,ean,bucket,matchKind,dispoType,icon,code,marque,portalPrix,reason\n' +
    rows
      .map((v) =>
        [
          v.ref,
          v.ean ?? '',
          v.bucket,
          v.matchKind,
          v.dispoType ?? '',
          v.icon ?? '',
          v.code ?? '',
          v.marque ?? '',
          v.portalPrix ?? '',
          v.reason,
        ].join(','),
      )
      .join('\n');
  writeFileSync(`${OUT}/confirmed.csv`, csv(confirmed));
  writeFileSync(`${OUT}/blocked.csv`, csv(blocked));
  writeFileSync(`${OUT}/review.csv`, csv(review));
  writeFileSync(`${OUT}/confirmed-no-ean.csv`, csv(confirmedNoEan));

  const sumCheck = Object.values(buckets).reduce((a, b) => a + b, 0);
  const report = [
    `# SUPPLIER AVAILABILITY classification report (READ-ONLY, zero activation)`,
    ``,
    `supplier: ${cfg.supplierName} (spl ${cfg.supplierId})  |  brand tokens: ${[...tokens].join(',')}`,
    `feed: ${feed.length} refs  |  classified: ${all.length}`,
    `duration this session: ${durationS}s  |  attempt-errors: ${attemptErrors}  |  terminal portal-timeouts (dead-lettered): ${terminalTimeouts}  |  outage-stop (resumable): ${result.outage}`,
    `MECE sum_check: ${sumCheck} == ${all.length} → ${sumCheck === all.length ? 'OK' : 'FAIL'}`,
    ``,
    `## Buckets`,
    `| bucket | n | % | future pri_dispo |`,
    `|---|---|---|---|`,
    `| CONFIRMED_AG (ag/vert) | ${buckets.CONFIRMED_AG} | ${pct(buckets.CONFIRMED_AG, all.length)} | '1' |`,
    `| CONFIRMED_GRP (grp/vert+) | ${buckets.CONFIRMED_GRP} | ${pct(buckets.CONFIRMED_GRP, all.length)} | '2' |`,
    `| BLOCK_NONE (none/rouge) | ${buckets.BLOCK_NONE} | ${pct(buckets.BLOCK_NONE, all.length)} | '0' |`,
    `| REVIEW_NOT_FOUND | ${buckets.REVIEW_NOT_FOUND} | ${pct(buckets.REVIEW_NOT_FOUND, all.length)} | pending |`,
    `| REVIEW_PORTAL_TIMEOUT | ${buckets.REVIEW_PORTAL_TIMEOUT} | ${pct(buckets.REVIEW_PORTAL_TIMEOUT, all.length)} | pending (re-check) |`,
    `| REVIEW_FALSE_MATCH | ${buckets.REVIEW_FALSE_MATCH} | ${pct(buckets.REVIEW_FALSE_MATCH, all.length)} | pending |`,
    `| REVIEW_CONTRADICTION | ${buckets.REVIEW_CONTRADICTION} | ${pct(buckets.REVIEW_CONTRADICTION, all.length)} | pending |`,
    `| REVIEW_NO_EAN | ${buckets.REVIEW_NO_EAN} | ${pct(buckets.REVIEW_NO_EAN, all.length)} | pending |`,
    `| REVIEW_ARRIVAGE | ${buckets.REVIEW_ARRIVAGE} | ${pct(buckets.REVIEW_ARRIVAGE, all.length)} | pending |`,
    `| REVIEW_NO_SIGNAL | ${buckets.REVIEW_NO_SIGNAL} | ${pct(buckets.REVIEW_NO_SIGNAL, all.length)} | pending |`,
    ``,
    `## Headline`,
    `taux activable (CONFIRMED): ${activable}/${all.length} = ${pct(activable, all.length)}`,
    `  - dont EAN-locked: ${confirmed.length - confirmedNoEan.length}`,
    `  - dont non-EAN (code unique + marque + icône verte, listés à part): ${confirmedNoEan.length}`,
    `bloquées (rupture): ${blocked.length}  |  review (à trancher): ${review.length}`,
    ``,
    `## Lists (full CSVs)`,
    `- activable: ${OUT}/confirmed.csv (${confirmed.length})`,
    `- non-EAN CONFIRMED (séparé): ${OUT}/confirmed-no-ean.csv (${confirmedNoEan.length})`,
    `- bloquée: ${OUT}/blocked.csv (${blocked.length})`,
    `- review: ${OUT}/review.csv (${review.length})`,
    `- raw HTML (gzip): ${HTML_DIR}/*.html.gz`,
    `- checkpoint: ${JSONL}`,
    ``,
    `NEXT: human validation → only then GO activation CONFIRMED only (AG→'1', GRP→'2', BLOCK→'0', REVIEW→pending), via the governed PricingModule.`,
    ``,
  ].join('\n');
  writeFileSync(`${OUT}/report.md`, report);
  console.log('\n' + report);
  console.log(`\nDONE: ${all.length} classified. artifacts in ${OUT}/`);
  process.exit(0);
}

main().catch((e) => {
  console.error('supplier-availability-classify FAIL', e);
  process.exit(1);
});
