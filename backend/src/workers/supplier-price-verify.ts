/**
 * Generic READ-ONLY supplier-portal price/availability verification. NO DB WRITE.
 *
 * Logs into a supplier portal (by registry spl_id) and compares the prepared
 * feed's achat to the LIVE portal achat + availability, for a risk-weighted
 * selection of refs. Catches feed-prep errors + indispo BEFORE any commit.
 * See .claude/knowledge/ops/supplier-brand-price-load-procedure.md.
 *
 * ⚠️ Portal ref search is FUZZY — re-run flagged refs with BY_EAN=true for exact.
 *
 * Env (required): SUPPLIER_SPL (registry spl_id), FEED_PATH. Optional: VERIFY_N
 * (default 200), BY_EAN=true (search by EAN), REFS (csv — verify exactly these).
 *
 * Run: SUPPLIER_SPL=71 FEED_PATH=<feed>.csv VERIFY_N=200 \
 *      node -r dotenv/config dist/workers/supplier-price-verify.js dotenv_config_path=.env
 */
import { readFileSync } from 'node:fs';
import {
  getSupplierConnectorConfig,
  type SupplierConnectorConfig,
} from '../modules/supplier-truth/connectors/supplier-registry';
import { InoshopConnector } from '../modules/supplier-truth/connectors/inoshop.connector';
import { CalConnector } from '../modules/supplier-truth/connectors/cal.connector';
import type { SupplierConnector } from '../modules/supplier-truth/connectors/supplier-connector.interface';

function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`missing required env ${k}`);
  return v;
}
const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

function connectorFor(cfg: SupplierConnectorConfig): SupplierConnector {
  if (cfg.platform === 'inoshop')
    return new InoshopConnector({ supplierId: cfg.supplierId, baseUrl: cfg.baseUrl });
  if (cfg.platform === 'cal')
    return new CalConnector({ supplierId: cfg.supplierId, baseUrl: cfg.baseUrl });
  throw new Error(`no connector for platform ${cfg.platform}`);
}

type Row = { ref: string; ean: string; achat: number };

async function main(): Promise<void> {
  const cfg = getSupplierConnectorConfig(req('SUPPLIER_SPL'));
  if (!cfg) throw new Error(`no connectable supplier ${process.env.SUPPLIER_SPL}`);
  const byEan = process.env.BY_EAN === 'true';
  const N = Number(process.env.VERIFY_N ?? 200);

  const lines = readFileSync(req('FEED_PATH'), 'utf8').split('\n');
  const h = lines[0].split(',');
  const [iRef, iEan, iAchat] = [h.indexOf('ref'), h.indexOf('ean'), h.indexOf('achat_ht')];
  const feed: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    const achat = num(c[iAchat]);
    if (!c[iRef] || !(achat && achat > 0)) continue;
    feed.push({ ref: c[iRef], ean: c[iEan] ?? '', achat });
  }

  // selection: explicit REFS, else top-N by achat (high value = high risk) + spread sample
  const explicit = (process.env.REFS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  let sel: Row[];
  if (explicit.length) {
    sel = feed.filter((r) => explicit.includes(r.ref));
  } else {
    const top = [...feed].sort((a, b) => b.achat - a.achat).slice(0, Math.floor(N * 0.7));
    const m = new Map(top.map((r) => [r.ref, r]));
    for (let i = 0; i < feed.length && m.size < N; i += Math.max(1, Math.floor(feed.length / (N * 0.3))))
      m.set(feed[i].ref, feed[i]);
    sel = [...m.values()].slice(0, N);
  }
  console.log(`supplier=${cfg.supplierName} (${cfg.supplierId}) verify=${sel.length} byEan=${byEan}`);

  const connector = connectorFor(cfg);
  await connector.login({
    user: req(cfg.credEnv.userKey),
    password: req(cfg.credEnv.passKey),
  });

  console.log('REPORT\tref\tfile_achat\tportal_achat\tstock\tecart_pct\tverdict');
  let errors = 0;
  let done = 0;
  for (const r of sel) {
    const q = byEan && r.ean ? r.ean : r.ref;
    let achat: number | null = null;
    let stock: boolean | null = null;
    try {
      const obs = await connector.fetchAvailability([q]);
      const hit = obs.find((o) => o.rawRef === q) ?? obs[0];
      if (hit) {
        achat = hit.priceBuyHt ?? null;
        stock = hit.available;
      }
    } catch {
      errors++;
    }
    done++;
    if (done >= 20 && errors / done > 0.1) {
      console.log(`STOP: portal error-rate ${errors}/${done} > 10%`);
      break;
    }
    let verdict = 'REVIEW';
    if (achat == null) verdict = 'REVIEW';
    else if (stock === false) verdict = 'BLOCK';
    else verdict = Math.abs(achat - r.achat) / achat <= 0.02 ? 'CONFIRMED' : 'FIX_FEED';
    const pct = achat ? (((r.achat - achat) / achat) * 100).toFixed(1) : '';
    console.log(`REPORT\t${r.ref}\t${r.achat}\t${achat ?? ''}\t${stock ?? ''}\t${pct}\t${verdict}`);
    await new Promise((res) => setTimeout(res, 250)); // anti-ban spacing
  }
  await connector.close();
  console.log(`DONE: ${done} verified, ${errors} errors`);
  process.exit(0);
}

main().catch((e) => {
  console.error('supplier-price-verify failed:', e);
  process.exit(1);
});
