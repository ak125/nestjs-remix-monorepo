import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Complément BK n° 4 : la PROD ne se connecte à aucun portail fournisseur. Le
 * module commandes (servi en PROD) lit les relevés datés et n'a accès à aucun
 * lecteur de portail ni connecteur. Les tests restent hors de ce balayage.
 */
const RACINE = join(__dirname, '..');
const INTERDITS = [
  /SupplierLiveQuoteService/,
  /\bCalConnector\b/,
  /\bInoshopConnector\b/,
  /supplier-truth\/connectors\//,
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((nom) => {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return nom.endsWith('.ts') && !nom.endsWith('.test.ts') ? [chemin] : [];
  });
}

describe('module commandes : aucun accès à un portail fournisseur', () => {
  const fichiers = sources(RACINE);

  it('balaye bien le module', () => {
    expect(fichiers.some((f) => f.endsWith('orders.module.ts'))).toBe(true);
    expect(
      fichiers.some((f) => f.endsWith('supplier-order-preparation.service.ts')),
    ).toBe(true);
  });

  it.each(INTERDITS.map((m) => [m.source, m]))(
    'aucune source ne référence %s',
    (_n, motif) => {
      const fautifs = fichiers.filter((f) =>
        (motif as RegExp).test(readFileSync(f, 'utf8')),
      );
      expect(fautifs).toEqual([]);
    },
  );
});
