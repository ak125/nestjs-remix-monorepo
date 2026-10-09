/**
 * Renderer Markdown → HTML de la projection (ADR-106 D6).
 *
 * Centre de gravité : l'invariant de sûreté — le renderer n'émet QUE son propre vocabulaire de
 * balises ; tout HTML brut ou construct inconnu est ÉCHAPPÉ en texte, jamais passé.
 */
import { renderProjectionMarkdown } from './projection-markdown.renderer';

describe('renderProjectionMarkdown — invariant de sûreté (0 passthrough HTML)', () => {
  it('échappe un <script> brut en texte, ne l’émet jamais comme balise', () => {
    const html = renderProjectionMarkdown(
      'avant <script>alert(1)</script> après',
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
  });

  it('échappe tout HTML brut : 0 balise active, 0 handler on* dans une balise', () => {
    const html = renderProjectionMarkdown(
      '<img src=x onerror=alert(1)> <iframe src="evil"></iframe> <div onclick="x">',
    );
    expect(html).not.toMatch(/<(img|iframe|div)\b/i);
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;iframe');
    expect(html).toContain('&lt;div');
    expect(html).not.toMatch(/<[^>]*\bon(error|click)=/i);
  });

  it('échappe & < > " partout hors des balises produites', () => {
    const html = renderProjectionMarkdown('5 < 10 && "x" > 3');
    expect(html).toBe('<p>5 &lt; 10 &amp;&amp; &quot;x&quot; &gt; 3</p>');
  });

  it.each([
    ['javascript:', '[clic](javascript:alert)'],
    ['data:', '[clic](data:text/html;base64,PHNjcmlwdD4=)'],
    ['vbscript:', '[clic](vbscript:x)'],
    ['protocole-relatif', '[clic](//evil.com)'],
    ['relatif sans /', '[clic](pieces/x)'],
    ['vide', '[clic]()'],
  ])('lien %s refusé → libellé seul, aucun <a>', (_kind, md) => {
    const html = renderProjectionMarkdown(md);
    expect(html).toBe('<p>clic</p>');
  });

  it('URL à parenthèse imbriquée : coupée au premier « ) », refusée, aucun schéma rendu', () => {
    const html = renderProjectionMarkdown('[clic](javascript:alert(1))');
    expect(html).toBe('<p>clic)</p>');
    expect(html).not.toMatch(/javascript:/i);
  });

  it('lien externe http(s) → <a rel="nofollow">', () => {
    expect(renderProjectionMarkdown('[doc](https://ex.com/p)')).toBe(
      '<p><a href="https://ex.com/p" rel="nofollow">doc</a></p>',
    );
  });

  it('lien interne /… → <a> sans rel (le maillage interne reste suivi)', () => {
    expect(
      renderProjectionMarkdown('[gamme](/pieces/filtre-a-huile-7.html)'),
    ).toBe('<p><a href="/pieces/filtre-a-huile-7.html">gamme</a></p>');
  });

  it('un href porteur de guillemet est refusé (pas d’évasion d’attribut)', () => {
    const html = renderProjectionMarkdown(
      '[x](https://ex.com/"onmouseover="alert(1))',
    );
    expect(html).not.toMatch(/<a\b/);
    expect(html).not.toMatch(/<[^>]*onmouseover=/i);
  });

  it('le libellé d’un lien est rendu en inline sûr', () => {
    expect(renderProjectionMarkdown('[**a** <b>](/x)')).toBe(
      '<p><a href="/x"><strong>a</strong> &lt;b&gt;</a></p>',
    );
  });
});

describe('renderProjectionMarkdown — grammaire (vocabulaire fixe)', () => {
  it('un paragraphe → <p>', () => {
    expect(renderProjectionMarkdown('Bonjour le monde.')).toBe(
      '<p>Bonjour le monde.</p>',
    );
  });

  it('deux blocs séparés par une ligne vide → deux <p> ; lignes contiguës jointes', () => {
    expect(renderProjectionMarkdown('Un.\n\nDeux\ntrois.')).toBe(
      '<p>Un.</p><p>Deux trois.</p>',
    );
  });

  it('CRLF et CR normalisés', () => {
    expect(renderProjectionMarkdown('Un.\r\n\r\nDeux.\rTrois.')).toBe(
      '<p>Un.</p><p>Deux. Trois.</p>',
    );
  });

  it('**gras** → <strong>, *italique* → <em>', () => {
    expect(renderProjectionMarkdown('a **b** c')).toBe(
      '<p>a <strong>b</strong> c</p>',
    );
    expect(renderProjectionMarkdown('a *b* c')).toBe('<p>a <em>b</em> c</p>');
  });

  it('_x_ n’est pas une emphase : identifiants et jetons préservés', () => {
    expect(renderProjectionMarkdown('voir #LinkGamme_12# et ref_a_b')).toBe(
      '<p>voir #LinkGamme_12# et ref_a_b</p>',
    );
  });

  it('astérisques non fermés rendus en texte', () => {
    expect(renderProjectionMarkdown('a ** b * c')).toBe('<p>a ** b * c</p>');
  });

  it('`code` → <code> au contenu échappé', () => {
    expect(renderProjectionMarkdown('valeur `K9K` moteur')).toBe(
      '<p>valeur <code>K9K</code> moteur</p>',
    );
    expect(renderProjectionMarkdown('`<b>x</b>`')).toBe(
      '<p><code>&lt;b&gt;x&lt;/b&gt;</code></p>',
    );
  });

  it('liste non ordonnée (- et *) → <ul><li>', () => {
    expect(renderProjectionMarkdown('- un\n* deux')).toBe(
      '<ul><li>un</li><li>deux</li></ul>',
    );
  });

  it('liste ordonnée → <ol><li>', () => {
    expect(renderProjectionMarkdown('1. un\n2. deux')).toBe(
      '<ol><li>un</li><li>deux</li></ol>',
    );
  });

  it('une liste interrompt un paragraphe et réciproquement', () => {
    expect(renderProjectionMarkdown('Intro :\n- a\n- b\nSuite.')).toBe(
      '<p>Intro :</p><ul><li>a</li><li>b</li></ul><p>Suite.</p>',
    );
  });

  it('## → <h3>, ### → <h4> ; # n’est jamais un titre (H1 réservé à la page)', () => {
    expect(renderProjectionMarkdown('## Titre')).toBe('<h3>Titre</h3>');
    expect(renderProjectionMarkdown('### Sous')).toBe('<h4>Sous</h4>');
    expect(renderProjectionMarkdown('# Page')).toBe('<p># Page</p>');
  });

  it('inline dans une liste : gras + code rendus, HTML brut échappé', () => {
    expect(renderProjectionMarkdown('- **a** et `b`\n- <x>')).toBe(
      '<ul><li><strong>a</strong> et <code>b</code></li><li>&lt;x&gt;</li></ul>',
    );
  });

  it('un nombre décimal en début de ligne n’ouvre pas de liste', () => {
    expect(renderProjectionMarkdown('1.5 dCi : K9K.')).toBe(
      '<p>1.5 dCi : K9K.</p>',
    );
  });
});

describe('renderProjectionMarkdown — robustesse & déterminisme', () => {
  it('entrée vide ou blanche → ""', () => {
    expect(renderProjectionMarkdown('')).toBe('');
    expect(renderProjectionMarkdown('   \n  \n')).toBe('');
  });

  it('déterministe : même entrée → même sortie', () => {
    const md = '## T\n\nprose **x** ; y — z\n\n- a\n- b';
    expect(renderProjectionMarkdown(md)).toBe(renderProjectionMarkdown(md));
  });

  it('prose WIKI réelle (filtre-a-huile, function) : rendue verbatim', () => {
    const md =
      "Le filtre à huile empêche les impuretés d'entrer dans le circuit de lubrification du moteur. Il aide ainsi à préserver la qualité de l'huile, ainsi que les performances et le rendement du moteur.";
    expect(renderProjectionMarkdown(md)).toBe(`<p>${md}</p>`);
  });

  it('coût linéaire : un bloc de 200 000 caractères se rend sans explosion', () => {
    const md = 'a *b* `c` [d](/e) '.repeat(10_000);
    const started = Date.now();
    const html = renderProjectionMarkdown(md);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(
      html.startsWith('<p>a <em>b</em> <code>c</code> <a href="/e">d</a>'),
    ).toBe(true);
  });
});
