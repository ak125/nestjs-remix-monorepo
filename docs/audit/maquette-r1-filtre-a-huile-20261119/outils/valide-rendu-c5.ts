// Complément n° 5 au mandat DS : validateur R1 sur le texte affiché des cartes (<dossier>/<avant|apres>-pg<7|402>-cartes.json).
// Usage (depuis backend/) : npx tsx --tsconfig tsconfig.json valide-rendu-c5.ts <dossier>
import * as fs from 'node:fs';
import { PageRoleValidatorService } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/backend/src/modules/seo/validation/page-role-validator.service';
import { isR3R5Content } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/frontend/app/utils/r1-copy-gate';
import { RoleId, getForbiddenOverlap, normalizePhrase } from '/home/deploy/worktrees/claude-ds-maquette-r1-20261119/packages/seo-roles/dist/index.js';
const E = process.argv[2];
const v = new PageRoleValidatorService();
const canon = getForbiddenOverlap(RoleId.R1_ROUTER).map((t) => normalizePhrase(t)).filter(Boolean);
const MANDATE = /prix|achat|achetez|stock|livraison|promo|pas cher|€|montage|installation/i;
const out: any = { source: 'texte affiché dans les cartes, captures Playwright 390 px (apres-pg*-cartes.json)', outils: ['PageRoleValidatorService.validateR1Router', 'getForbiddenOverlap(R1_ROUTER) de @repo/seo-roles', 'mots du complément n° 5 (+ montage, installation)', 'isR3R5Content (r1-copy-gate, frontend)'], pages: {} };
for (const label of ['avant-pg7', 'apres-pg7', 'avant-pg402', 'apres-pg402']) {
  const d = JSON.parse(fs.readFileSync(`${E}/${label}-cartes.json`, 'utf8'));
  const phrases = d.cartes.map((c: any) => c.paragraphes.length > 1 ? c.paragraphes[c.paragraphes.length - 1] : '');
  const cartes = d.cartes.map((c: any, i: number) => {
    const all = [c.titre, ...c.paragraphes].join(' ');
    return { n: i + 1, titre: c.titre, phrase: phrases[i],
      validateR1Router: v.validateR1Router(all).map((x: any) => x.details?.keyword || x.type),
      canonR1: canon.filter((t) => (' ' + normalizePhrase(all)).includes(' ' + t)),
      motsMandat: all.match(MANDATE)?.[0] || null, r1CopyGateFront: isR3R5Content(phrases[i]) };
  });
  const cnt: Record<string, number> = {}; phrases.forEach((p: string) => (cnt[p] = (cnt[p] || 0) + 1));
  out.pages[label] = { cartes: cartes.length, phrasesDistinctes: Object.keys(cnt).length, repetitionMax: Math.max(...Object.values(cnt)),
    cartesEnViolation: cartes.filter((c: any) => c.validateR1Router.length || c.canonR1.length || c.motsMandat).length,
    cartesSignaleesGateFront: cartes.filter((c: any) => c.r1CopyGateFront).map((c: any) => c.n), detail: cartes };
  const p = out.pages[label];
  console.log(`${label.padEnd(12)} cartes=${p.cartes} distinctes=${p.phrasesDistinctes} répétitionMax=${p.repetitionMax} violationsValidateur+canon+mandat=${p.cartesEnViolation} gateFront=${JSON.stringify(p.cartesSignaleesGateFront)}`);
}
fs.writeFileSync(`${E}/validateur-r1-rendu.json`, JSON.stringify(out, null, 2));
