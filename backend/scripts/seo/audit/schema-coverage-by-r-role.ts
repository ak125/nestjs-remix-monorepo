#!/usr/bin/env ts-node
/**
 * Audit schema coverage by R-role for AI citation readiness.
 *
 * Static analysis of dynamic-seo-v4-ultimate.service.ts.
 * Output: docs/audit/2026-05-schema-coverage-by-r-role.md
 *
 * Cf. plan: docs/superpowers/plans/2026-05-23-ai-additive-layer-phase-0-and-1.md
 * Cf. spec: docs/superpowers/specs/2026-05-23-ai-additive-layer-phase-0-and-1-design.md §4.2
 */
import * as fs from 'fs';
import * as path from 'path';

const SERVICE_PATH = path.resolve(__dirname, '../../../src/modules/seo/dynamic-seo-v4-ultimate.service.ts');
const REPORT_PATH  = path.resolve(__dirname, '../../../../docs/audit/2026-05-schema-coverage-by-r-role.md');

const EXPECTED: Record<string, string[]> = {
  R2: ['Product'],
  R5: ['FAQPage'],
  R3: ['HowTo', 'FAQPage'],
  R8: ['Vehicle', 'FAQPage'],
  Local: ['LocalBusiness'],
  Comparatif: ['ItemList'],
};

const source = fs.readFileSync(SERVICE_PATH, 'utf-8');

/**
 * Heuristique : pour chaque rôle, scanner les blocs de code (fenêtre de 2000 chars autour
 * d'une mention du rôle, case-insensitive) et collecter les `@type` y apparaissant.
 * Si le rôle n'est jamais mentionné explicitement dans le code, found = []  → report missing.
 */
function findSchemaTypesForRole(role: string): string[] {
  const roleRegex = new RegExp(role, 'gi');
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = roleRegex.exec(source)) !== null) {
    const start = Math.max(0, m.index - 1000);
    const end   = Math.min(source.length, m.index + 1000);
    const block = source.slice(start, end);
    for (const t of block.matchAll(/['"]\s*@type\s*['"]\s*:\s*['"]\s*(\w+)\s*['"]/g)) {
      found.add(t[1]);
    }
  }
  return [...found].sort();
}

const lines: string[] = [
  '# Schema coverage by R-role — audit 2026-05-23',
  '',
  `Source : \`${path.relative(process.cwd(), SERVICE_PATH)}\``,
  '',
  '> Static analysis. Heuristique : fenêtre de ±1000 chars autour de chaque mention du rôle.',
  '> Note : faux positifs possibles si un `@type` apparaît dans un commentaire ou est partagé entre rôles.',
  '',
];

for (const role of Object.keys(EXPECTED)) {
  const expected = EXPECTED[role];
  const actual = findSchemaTypesForRole(role);
  const missing = expected.filter(e => !actual.includes(e));
  const surplus = actual.filter(a => !expected.includes(a));
  lines.push(`## ${role}`);
  lines.push(`- **Expected** : ${expected.join(', ')}`);
  lines.push(`- **Found**    : ${actual.length ? actual.join(', ') : '(aucun)'}`);
  lines.push(`- **Missing**  : ${missing.length ? `⚠️ **${missing.join(', ')}**` : '✅ (aucun)'}`);
  if (surplus.length) lines.push(`- **Surplus**  : ${surplus.join(', ')} (non listé dans EXPECTED — vérifier)`);
  lines.push('');
}

lines.push('## Next steps (pour chaque Missing)');
lines.push('- Ouvrir une PR fill schema séparée par R-role (out-of-scope de ce plan).');
lines.push('- Respecter `feedback_no_touch_meta_h1_if_optimized` : ne pas toucher les meta optimisées existantes.');
lines.push('');

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, lines.join('\n'));
console.log(`✓ Report written: ${path.relative(process.cwd(), REPORT_PATH)}`);
