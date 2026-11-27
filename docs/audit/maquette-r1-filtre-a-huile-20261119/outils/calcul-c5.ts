// Complément n° 5 au mandat DS : phrase R1 de chaque carte calculée par la méthode du builder,
// à partir des réponses GET /api/gamme-rest/<pg>/page-data-rpc-v2 enregistrées (API_DIR/api-<pg>-avant.json).
// Usage (depuis backend/) : API_DIR=<dossier> OUT=<sortie.json> npx tsx --tsconfig tsconfig.json calcul-c5.ts
import * as fs from 'node:fs';
import { GammeResponseBuilderService } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/backend/src/modules/gamme-rest/services/gamme-response-builder.service';
import { GammeDataTransformerService } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/backend/src/modules/gamme-rest/services/gamme-data-transformer.service';
import { GammeRpcService } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/backend/src/modules/gamme-rest/services/gamme-rpc.service';
import { PageRoleValidatorService } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/backend/src/modules/seo/validation/page-role-validator.service';
import { isR3R5Content } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/frontend/app/utils/r1-copy-gate';
import { RoleId, getForbiddenOverlap, normalizePhrase } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/packages/seo-roles/dist/index.js';
const v = new PageRoleValidatorService();
const d = {} as never;
const svc = new GammeResponseBuilderService(new GammeDataTransformerService(), { getSeoFragmentsByTypeId: GammeRpcService.prototype.getSeoFragmentsByTypeId } as never, d,d,d,d,d,d,d,d, v);
const build = (svc as any).buildR1MotorisationDescription.bind(svc);
const canon = getForbiddenOverlap(RoleId.R1_ROUTER).map((t) => normalizePhrase(t));
const MANDATE = /prix|achat|achetez|stock|livraison|promo|pas cher|€|montage|installation/i;
const out: any = {};
for (const g of ['7', '402']) {
  const api = JSON.parse(fs.readFileSync(`${process.env.API_DIR}/api-${g}-avant.json`, 'utf8'));
  const rows = api.seoSwitches.nouns.map((n: any) => ({ sis_id: n.id, sis_content: n.content }));
  const rejected = new Set<string>();
  const cards = api.motorisations.items.map((m: any) => {
    const s = build({ type_id: Number(m.cgc_type_id), marque_name: m.marque_name, modele_name: m.modele_name, type_name: m.type_name, type_power_ps: m.type_power_ps }, api.hero.pg_name, rows, rejected);
    return { type_id: m.cgc_type_id, vehicule: [m.marque_name, m.modele_name, m.type_name, m.puissance, m.periode].join(' | '), avant_servi: 'Sélectionnez cette motorisation pour afficher les références compatibles.', avant_description_masquee: m.description, apres: s,
      validateR1Router: v.validateR1Router(s).map((x: any) => x.details?.keyword || x.type), canonR1: canon.filter((t) => (' ' + normalizePhrase(s)).includes(' ' + t)), motsMandat: (s.match(MANDATE) || []).slice(0, 1), r1CopyGateFront: isR3R5Content(s) };
  });
  const counts: Record<string, number> = {}; cards.forEach((c: any) => (counts[c.apres] = (counts[c.apres] || 0) + 1));
  const fr: Record<string, number> = {}; cards.forEach((c: any) => { const b = c.apres.split(', pour ')[1]; fr[b] = (fr[b] || 0) + 1; });
  out[g] = { pg_name: api.hero.pg_name, cartes: cards.length, phrasesDistinctes: Object.keys(counts).length, repetitionMax: Math.max(...Object.values(counts)), fragmentsAdmis: rows.length - rejected.size, fragmentsEcartes: [...rejected], usageParFragment: fr, cards };
}
fs.writeFileSync(String(process.env.OUT), JSON.stringify(out, null, 2));
for (const g of ['7', '402']) { const o = out[g]; console.log(g, o.pg_name, 'cartes', o.cartes, 'distinctes', o.phrasesDistinctes, 'max', o.repetitionMax, 'écartés', o.fragmentsEcartes.join(','), 'violations', o.cards.filter((c: any) => c.validateR1Router.length || c.canonR1.length || c.motsMandat.length).length, 'gateFront', o.cards.filter((c: any) => c.r1CopyGateFront).length); console.log(JSON.stringify(o.usageParFragment)); o.cards.forEach((c: any, i: number) => console.log(' ', i + 1, c.apres)); }
