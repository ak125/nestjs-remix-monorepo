import { describe, it, expect } from "vitest";

import { extractEditorialBlocks } from "~/utils/editorial-parser";
import { sanitizeEditorialHtml } from "~/utils/sanitize-editorial-html";

/**
 * A1d — sanitisation du HTML éditorial sg_content (latent stored-XSS).
 *
 * `sanitizeEditorialHtml` est la source unique réutilisée par `HtmlContent` ET
 * les sinks `dangerouslySetInnerHTML` (pieces.$slug via extractEditorialBlocks,
 * GammeContent). On vérifie : (1) XSS strippé, (2) HTML éditorial légitime +
 * accents FR préservés (0 changement visible sur contenu réel), (3) le chokepoint
 * `extractEditorialBlocks` sanitise tout en gardant le split/downgrade H2→H3.
 */
describe("sanitizeEditorialHtml — XSS stripping (fail-closed)", () => {
  it("supprime les <script>", () => {
    const out = sanitizeEditorialHtml(
      "<p>Avant</p><script>alert('xss')</script><p>Après</p>",
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert(");
    expect(out).toContain("<p>Avant</p>");
    expect(out).toContain("<p>Après</p>");
  });

  it("supprime les handlers d'événements inline (onerror/onclick)", () => {
    const out = sanitizeEditorialHtml(
      '<img src="x" onerror="alert(1)"><a href="#" onclick="steal()">lien</a>',
    );
    expect(out.toLowerCase()).not.toContain("onerror");
    expect(out.toLowerCase()).not.toContain("onclick");
  });

  it("supprime les <iframe>", () => {
    const out = sanitizeEditorialHtml('<iframe src="//evil.tld"></iframe><p>ok</p>');
    expect(out.toLowerCase()).not.toContain("<iframe");
    expect(out).toContain("<p>ok</p>");
  });

  it("neutralise un href à schéma dangereux (javascript)", () => {
    // eslint-disable-next-line no-script-url -- vecteur XSS volontaire à neutraliser
    const out = sanitizeEditorialHtml('<a href="javascript:alert(1)">clic</a>');
    // eslint-disable-next-line no-script-url -- on vérifie l'absence du schéma
    expect(out.toLowerCase()).not.toContain("javascript:");
    // le texte du lien reste, seul le vecteur est neutralisé
    expect(out).toContain("clic");
  });

  it("supprime les attributs style inline (SSR-safe)", () => {
    const out = sanitizeEditorialHtml('<p style="color:red">texte</p>');
    expect(out).not.toContain("style=");
    expect(out).toContain("texte");
  });
});

describe("sanitizeEditorialHtml — préservation du contenu légitime", () => {
  it("préserve les balises éditoriales (h2/h3/p/table/ul/li/a/strong)", () => {
    const html =
      '<h2>Titre</h2><p>Para <strong>gras</strong></p>' +
      '<ul><li>item</li></ul>' +
      '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>' +
      '<a href="/pieces/filtre" class="lien">interne</a>';
    const out = sanitizeEditorialHtml(html);
    for (const tag of ["<h2>", "<p>", "<strong>", "<ul>", "<li>", "<table>", "<th>", "<td>"]) {
      expect(out).toContain(tag);
    }
    expect(out).toContain('href="/pieces/filtre"');
    expect(out).toContain('class="lien"');
  });

  it("préserve <b class=...> (cas FAMILY_TIPS de GammeContent)", () => {
    const tip = '<b class="font-semibold">Conseil freinage :</b> vérifiez le diamètre.';
    const out = sanitizeEditorialHtml(tip);
    expect(out).toContain('<b class="font-semibold">');
    expect(out).toContain("Conseil freinage");
  });

  it("préserve les accents français (pas de strip lossy)", () => {
    const out = sanitizeEditorialHtml(
      "<p>Référence d'équipementier — qualité éprouvée à l'usage çà et là</p>",
    );
    expect(out).toContain("Référence");
    expect(out).toContain("équipementier");
    expect(out).toContain("qualité éprouvée");
    expect(out).toContain("çà et là");
  });

  it("entrée vide / non-string → chaîne vide", () => {
    expect(sanitizeEditorialHtml("")).toBe("");
    // @ts-expect-error — robustesse runtime sur entrée non conforme
    expect(sanitizeEditorialHtml(null)).toBe("");
    // @ts-expect-error — robustesse runtime sur entrée non conforme
    expect(sanitizeEditorialHtml(undefined)).toBe("");
  });
});

describe("extractEditorialBlocks — chokepoint de sanitisation", () => {
  it("strippe un <script> injecté dans sg_content tout en classant les blocs", () => {
    const malicious =
      "<h2>Bien choisir</h2><p>Texte</p><script>alert('xss')</script>" +
      '<h2>Prix et marques</h2><p>Budget</p>';
    const blocks = extractEditorialBlocks(malicious);
    const all = [
      ...blocks.chooseSection,
      ...blocks.priceSection,
      ...blocks.locationSection,
      ...blocks.referenceSection,
      ...blocks.unmatched,
      ...blocks.faqSection,
    ].join("");
    expect(all.toLowerCase()).not.toContain("<script");
    expect(all.toLowerCase()).not.toContain("alert(");
    // le contenu légitime survit et reste classé
    expect(all).toContain("Budget");
    expect(blocks.priceSection.length).toBeGreaterThan(0);
  });

  it("conserve le downgrade H2→H3 après sanitisation (DOMPurify garde <h2>)", () => {
    const blocks = extractEditorialBlocks(
      "<h2>Bien choisir votre filtre</h2><p>contenu de choix suffisamment long pour être classé correctement dans la bonne section éditoriale narrative</p>",
    );
    const joined = [...blocks.chooseSection, ...blocks.unmatched].join("");
    expect(joined).toContain("<h3>");
    expect(joined).not.toContain("<h2>");
  });

  it("contenu sans H2 → poussé sanitisé dans chooseSection", () => {
    const blocks = extractEditorialBlocks(
      "<p>Bloc simple sans titre</p><script>bad()</script>",
    );
    const joined = blocks.chooseSection.join("");
    expect(joined).toContain("Bloc simple");
    expect(joined.toLowerCase()).not.toContain("<script");
  });
});
