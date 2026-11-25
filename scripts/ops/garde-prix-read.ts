/**
 * garde-prix-read.ts — producteur de l'entrée GARDE_PRIX_JSON du rapport du matin
 * (mandat EI, décisions 51 et 67), format garde-prix.v1.
 *
 * Lit les états persistés par le module pricing (price_import_batches,
 * pieces_price) par PricingRepository et assemble le fichier par
 * readGardePrix (backend/src/modules/pricing/services/price-guard-signal.core.ts) :
 * aucune règle n'est réécrite ici.
 *
 * Usage (depuis backend/, pour ses alias et ses paquets) :
 *   ../node_modules/.bin/tsx ../scripts/ops/garde-prix-read.ts <sortie.json>
 * Env : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, lus par le dépôt, jamais écrits
 * dans la sortie ni dans le journal.
 *
 * Lecture impossible ⇒ aucun fichier écrit, code 1 et une ligne
 * « garde-prix-read : échec (<nom> [code] [paquet]) » : le rapport écrit alors
 * « indisponible » et garde les incidents déjà ouverts. Jamais un fichier vide
 * ou « aucun déclenchement » à la place d'une lecture ratée.
 * Le parcours de pieces_price compte ~426 pages (2026-11-20) : une fois par jour.
 */
import { renameSync, writeFileSync } from 'node:fs';

/**
 * Raison sûre d'une erreur : nom, code système et, pour un module introuvable,
 * le seul nom du paquet ; jamais le message brut (URL, clé, chemin possibles).
 * Même règle que safeReason de scripts/governance/registry-threshold-read.ts,
 * qui ne s'importe pas sans lancer son propre main().
 */
function safeReason(e: unknown): string {
  if (!(e instanceof Error)) return typeof e;
  const parts = [/^[A-Za-z]{1,40}$/.test(e.name) ? e.name : 'Error'];
  const code = (e as { code?: unknown }).code;
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{1,40}$/.test(code)) parts.push(code);
  if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
    const pkg = /node_modules\/((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)/i.exec(e.message);
    if (pkg) parts.push(pkg[1]);
  }
  return parts.join(' ');
}

async function main(): Promise<void> {
  const out = process.argv[2];
  if (!out) throw new Error('usage : garde-prix-read.ts <sortie.json>');
  const [{ ConfigService }, { PricingRepository }, { readGardePrix }] = await Promise.all([
    import('@nestjs/config'),
    import('../../backend/src/modules/pricing/services/pricing.repository'),
    import('../../backend/src/modules/pricing/services/price-guard-signal.core'),
  ]);
  const repo = new PricingRepository(new ConfigService());
  const garde = await readGardePrix(repo);
  // Écriture atomique : un lecteur ne voit jamais un fichier à moitié écrit.
  writeFileSync(`${out}.tmp`, JSON.stringify(garde));
  renameSync(`${out}.tmp`, out);
  console.log(`garde-prix-read : ${garde.declenchements.length} déclenchement(s), ${garde.generated_at}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(`garde-prix-read : échec (${safeReason(e)})`);
    process.exit(1);
  },
);
