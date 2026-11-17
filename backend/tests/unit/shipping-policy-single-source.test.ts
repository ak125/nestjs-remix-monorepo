/**
 * Mandat BJ — une seule source pour le forfait et le seuil de gratuité :
 * `src/modules/cart/config/shipping-policy.config.ts`.
 *
 * Ce test relit le code servi (backend/src et frontend/app) et échoue si un seuil
 * de gratuité y est réécrit en dur — une promesse « Livraison gratuite dès 150€ »
 * dans un composant, ou une constante `FREE_SHIPPING_THRESHOLD = 50`. Avant ce
 * mandat, quatre valeurs différentes cohabitaient (150, 50, 15,90, 6,90).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO = resolve(__dirname, '../../..');
const RACINES = ['backend/src', 'frontend/app'];
const SOURCE_UNIQUE =
  'backend/src/modules/cart/config/shipping-policy.config.ts';

const INTERDITS: Array<[string, RegExp]> = [
  [
    'promesse de gratuité avec un montant écrit en dur',
    /(livraison|port)\s+(gratuite?|offerte?)s?\s+(d(è|e|\\u00e8)s|à partir de)\s*\d/i,
  ],
  [
    'constante de seuil de gratuité',
    /free[_]?shipping[_]?threshold\w*\s*[:=]\s*\d/i,
  ],
];

function fichiers(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      return entree.name === 'node_modules' ? [] : fichiers(chemin);
    }
    return /\.(ts|tsx)$/.test(entree.name) &&
      !/\.(test|spec)\.tsx?$/.test(entree.name)
      ? [chemin]
      : [];
  });
}

describe('Port — aucune valeur de seuil hors de la source unique', () => {
  it('ni promesse chiffrée ni constante de seuil dans le code servi', () => {
    const ecarts: string[] = [];

    for (const racine of RACINES) {
      for (const chemin of fichiers(join(REPO, racine))) {
        const nom = relative(REPO, chemin);
        if (nom === SOURCE_UNIQUE) continue;

        readFileSync(chemin, 'utf8')
          .split('\n')
          .forEach((ligne, i) => {
            for (const [motif, regex] of INTERDITS) {
              if (regex.test(ligne)) {
                ecarts.push(`${nom}:${i + 1} — ${motif} : ${ligne.trim()}`);
              }
            }
          });
      }
    }

    expect(ecarts).toEqual([]);
  });
});
