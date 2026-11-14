/**
 * stripHtmlForMeta (miroir backend de frontend/app/utils/seo-clean.utils.ts) —
 * le nettoyage d'une meta description ne retire que du balisage, jamais du texte.
 *
 * L'étape qui visait un résidu d'attribut de style (`Calibri","sans-serif""`)
 * prenait aussi l'apostrophe et la virgule pour des délimiteurs : tout le texte
 * compris entre deux élisions disparaissait de la description rendue.
 */

import { stripHtmlForMeta } from '../../src/utils/html-entities';

describe('stripHtmlForMeta — texte français conservé', () => {
  it('garde le texte entre deux élisions', () => {
    const description =
      "Pédale d'embrayage molle ou fuite de liquide ? Diagnostic, étapes de remplacement, purge et pièces associées. Guide complet émetteur d'embrayage.";

    expect(description.length).toBeLessThanOrEqual(160);
    expect(stripHtmlForMeta(description)).toBe(description);
  });

  it('garde le texte entre une virgule et une élision', () => {
    const description =
      "Bruit au ralenti, vibrations dans l'habitacle : les signes d'un support usé.";

    expect(stripHtmlForMeta(description)).toBe(description);
  });

  it('garde une citation entre guillemets doubles', () => {
    const description = 'Le témoin "moteur" s\'allume : que vérifier ?';

    expect(stripHtmlForMeta(description)).toBe(description);
  });

  it('garde les élisions écrites en entités HTML', () => {
    expect(
      stripHtmlForMeta(
        'Kit d&#39;embrayage, but&eacute;e d&rsquo;embrayage et volant d&apos;inertie',
      ),
    ).toBe("Kit d'embrayage, butée d'embrayage et volant d'inertie");
  });
});

describe('stripHtmlForMeta — balisage retiré', () => {
  it('retire les balises, y compris encodées en entités', () => {
    expect(
      stripHtmlForMeta('<span>Kit <strong>embrayage</strong></span>'),
    ).toBe('Kit embrayage');
    expect(
      stripHtmlForMeta("&lt;strong&gt;Alternateur&lt;/strong&gt; d'origine"),
    ).toBe("Alternateur d'origine");
  });

  it('retire une balise malformée portant un résidu de style', () => {
    expect(
      stripHtmlForMeta(
        'Le <strong><spanCalibri","sans-serif"">radiateur de chauffage</span></strong> amène l\'air chaud dans l\'habitacle.',
      ),
    ).toBe("Le radiateur de chauffage amène l'air chaud dans l'habitacle.");
  });

  it('retire le résidu de style resté hors balise', () => {
    expect(
      stripHtmlForMeta('Le Calibri","sans-serif"" radiateur de chauffage'),
    ).toBe('Le radiateur de chauffage');
  });

  it('normalise les espaces', () => {
    expect(stripHtmlForMeta('  Disque\n de&nbsp;&nbsp;frein  ')).toBe(
      'Disque de frein',
    );
  });
});

describe('stripHtmlForMeta — bornes', () => {
  it('rend une chaîne vide pour une entrée absente ou non textuelle', () => {
    expect(stripHtmlForMeta('')).toBe('');
    expect(stripHtmlForMeta(undefined)).toBe('');
    expect(stripHtmlForMeta(null)).toBe('');
    expect(stripHtmlForMeta(42 as unknown as string)).toBe('');
  });

  it('tronque à 160 caractères sur une frontière de mot', () => {
    const description =
      "L'émetteur d'embrayage transmet l'effort de la pédale au récepteur. " +
      'Quand il fuit, la pédale devient molle et les vitesses passent mal : ' +
      'voici comment le diagnostiquer et le remplacer sans erreur.';

    const result = stripHtmlForMeta(description);

    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith('...')).toBe(true);
    expect(description.startsWith(result.slice(0, -3))).toBe(true);
  });

  it('respecte une longueur maximale explicite', () => {
    expect(
      stripHtmlForMeta(
        "Symptômes d'usure, contrôle et remplacement d'un câble d'embrayage",
        40,
      ),
    ).toBe("Symptômes d'usure, contrôle et...");
  });
});
