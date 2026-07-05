import { describe, it, expect } from "vitest";

import { addGammeLinks, type GammeLink } from "~/lib/gamme-autolink";

/**
 * Tests for the shared gamme auto-linker that replaced the two byte-identical
 * `addGammeLinksToHtml` / `addGammeLinksToText` functions whose regex lookbehind
 * crashed WebKit < Safari 16.4 (iOS 16.0–16.3) — the reported Sentry PROD error
 * "Invalid regular expression: invalid group specifier name".
 *
 * Two things are asserted:
 *  1. The adversarial edge cases (anchor/attribute/tag safety), matching the
 *     preserved GLOBAL (all-occurrences) behaviour of the original code.
 *  2. Byte-for-byte PARITY with a faithful re-implementation of the original
 *     lookbehind algorithm on "clean" inputs (the original ran fine under Node
 *     V8; only WebKit rejected the lookbehind). This proves the refactor did not
 *     change observable behaviour where the original was already correct.
 */

const CLS = "cls"; // stand-in for the real Tailwind class strings

/** Build the exact anchor the helper injects, for readable expectations. */
const a = (href: string, name: string, text: string) =>
  `<a href="${href}" class="${CLS}" title="Voir nos ${name}">${text}</a>`;

describe("addGammeLinks — anchor/attribute/tag safety (GLOBAL parity)", () => {
  it("does not link a keyword that only appears inside an existing anchor", () => {
    const html = `Les <a href="/x">plaquettes</a> sont importantes.`;
    expect(
      addGammeLinks(html, [{ name: "plaquettes", link: "/p.html" }], CLS),
    ).toBe(html); // never produce a nested <a>
  });

  it("skips a keyword at the start of an anchor followed by a nested inline tag (old lookahead bug)", () => {
    const html = `<a href="/x">disque <b>de frein</b></a>`;
    // The original's `(?![^<]*</a>)` lookahead wrongly wrapped 'disque' here
    // (nested <b> blocks the lookahead) → invalid nested anchor. Depth-gating fixes it.
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(html);
  });

  it("links the outside occurrence but not the one nested inside an anchor", () => {
    const html = `<a href="/x"><b>disque</b></a> et disque libre`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(
      `<a href="/x"><b>disque</b></a> et ${a("/d.html", "disque", "disque")} libre`,
    );
  });

  it("never matches inside a tag attribute (links the later visible occurrence)", () => {
    const html = `<img src="/p.jpg" alt="plaquettes de frein" /> Nos plaquettes de frein sont dispo.`;
    expect(
      addGammeLinks(
        html,
        [{ name: "plaquettes de frein", link: "/pf.html" }],
        CLS,
      ),
    ).toBe(
      `<img src="/p.jpg" alt="plaquettes de frein" /> Nos ${a("/pf.html", "plaquettes de frein", "plaquettes de frein")} sont dispo.`,
    );
  });

  it("leaves markup intact when the keyword only appears inside an attribute (old code corrupts it)", () => {
    const html = `<img alt="disque" src="/d.jpg" />`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(html);
  });

  it("recognises an uppercase <A> anchor case-insensitively", () => {
    const html = `<A HREF="/x">disque</A> et disque neuf`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(
      `<A HREF="/x">disque</A> et ${a("/d.html", "disque", "disque")} neuf`,
    );
  });

  it("treats a self-closing <br/> as not opening an anchor", () => {
    const html = `Info<br/>disque neuf`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(`Info<br/>${a("/d.html", "disque", "disque")} neuf`);
  });

  it("under-links (never corrupts) when an anchor is left unclosed", () => {
    const html = `<a href="/x">disque and more disque text no close`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(html);
  });

  it("links text that follows two adjacent anchors", () => {
    const html = `<a href="/a">x</a><a href="/b">y</a> puis disque ici`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(
      `<a href="/a">x</a><a href="/b">y</a> puis ${a("/d.html", "disque", "disque")} ici`,
    );
  });

  it("wraps EVERY outside occurrence of the winning pattern (global parity)", () => {
    const html = `disque puis disque puis disque`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(
      `${a("/d.html", "disque", "disque")} puis ${a("/d.html", "disque", "disque")} puis ${a("/d.html", "disque", "disque")}`,
    );
  });

  it("does not throw and does not mis-match on a gamme name with regex metacharacters", () => {
    const html = `Comparez disque (avant) et le reste.`;
    // '(avant)' must be treated literally (not a capture group) and must not crash.
    expect(() =>
      addGammeLinks(html, [{ name: "disque (avant)", link: "/da.html" }], CLS),
    ).not.toThrow();
    expect(
      addGammeLinks(html, [{ name: "disque (avant)", link: "/da.html" }], CLS),
    ).toBe(html); // trailing \b fails after ')', so no match — parity with original
  });

  it("links an accented multi-word name with ASCII edges", () => {
    const html = `Le filtre à huile doit être changé.`;
    expect(
      addGammeLinks(html, [{ name: "filtre à huile", link: "/fah.html" }], CLS),
    ).toBe(
      `Le ${a("/fah.html", "filtre à huile", "filtre à huile")} doit être changé.`,
    );
  });

  it("does not link a name that starts with a non-ASCII letter (documented \\b limitation, parity)", () => {
    const html = `Un étrier neuf.`;
    expect(
      addGammeLinks(html, [{ name: "étrier", link: "/e.html" }], CLS),
    ).toBe(html);
  });

  it("never matches a keyword split across a tag boundary", () => {
    const html = `dis<b>que</b> de frein`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(html);
  });

  it("links visible text and leaves a truncated trailing tag untouched", () => {
    const html = `Voir nos disque et <a href="/lon`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(`Voir nos ${a("/d.html", "disque", "disque")} et <a href="/lon`);
  });

  it("preserves an HTML entity sitting next to the keyword", () => {
    const html = `Freins &amp; disque`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(`Freins &amp; ${a("/d.html", "disque", "disque")}`);
  });

  it("matches case-insensitively but keeps the source casing in the link text", () => {
    const html = `DISQUE de frein`;
    expect(
      addGammeLinks(html, [{ name: "disque", link: "/d.html" }], CLS),
    ).toBe(`${a("/d.html", "disque", "DISQUE")} de frein`);
  });

  it("links each gamme's occurrences and never inside a just-inserted link (multi-gamme)", () => {
    const html = `disque et plaquette, puis disque et plaquette`;
    const out = addGammeLinks(
      html,
      [
        { name: "disque", link: "/d.html" },
        { name: "plaquette", link: "/p.html" },
      ],
      CLS,
    );
    expect(out).toBe(
      `${a("/d.html", "disque", "disque")} et ${a("/p.html", "plaquette", "plaquette")}, ` +
        `puis ${a("/d.html", "disque", "disque")} et ${a("/p.html", "plaquette", "plaquette")}`,
    );
  });

  it("skips a gamme with no resolvable URL", () => {
    const html = `disque neuf`;
    expect(addGammeLinks(html, [{ name: "disque" }], CLS)).toBe(html);
  });

  it("builds the URL from alias + id when no explicit link", () => {
    const html = `disque neuf`;
    expect(
      addGammeLinks(
        html,
        [{ name: "disque", alias: "disque-de-frein", id: 42 }],
        CLS,
      ),
    ).toBe(`${a("/pieces/disque-de-frein-42.html", "disque", "disque")} neuf`);
  });

  it("escapes '&' in the URL into the href attribute", () => {
    const out = addGammeLinks(
      `disque neuf`,
      [{ name: "disque", link: "/pieces/d.html?ref=a&b=2" }],
      CLS,
    );
    expect(out).toContain(`href="/pieces/d.html?ref=a&amp;b=2"`);
  });

  it("returns the input unchanged for empty / missing catalogue", () => {
    expect(addGammeLinks("disque", undefined, CLS)).toBe("disque");
    expect(addGammeLinks("disque", [], CLS)).toBe("disque");
  });
});

// --- Byte-for-byte parity with the original lookbehind algorithm --------------

/**
 * Faithful re-implementation of the ORIGINAL `addGammeLinksToHtml` — including
 * its crashing regex lookbehind, which runs fine under Node V8 (only WebKit
 * < 16.4 rejects it). Used purely as a behavioural oracle on clean inputs.
 */
function originalImpl(
  html: string,
  catalogueFamille: GammeLink[] | undefined,
  cls: string,
): string {
  if (
    !catalogueFamille ||
    !Array.isArray(catalogueFamille) ||
    catalogueFamille.length === 0
  )
    return html;

  const uniqueGammes = catalogueFamille.filter(
    (gamme, index, self) =>
      index === self.findIndex((g) => g.name === gamme.name),
  );

  let result = html;
  const linkedGammes = new Set<string>();

  for (const gamme of uniqueGammes) {
    if (!gamme || !gamme.name) continue;

    const gammeUrl =
      gamme.link ||
      (gamme.alias && gamme.id
        ? `/pieces/${gamme.alias}-${gamme.id}.html`
        : null);
    if (!gammeUrl) continue;
    if (linkedGammes.has(gamme.name)) continue;

    const name = (gamme.name || "").toLowerCase();
    const patterns = [
      name,
      name + "s",
      name.replace("é", "e"),
      (name + "s").replace("é", "e"),
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(
        `(?<!<a[^>]*>)\\b(${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b(?![^<]*<\\/a>)`,
        "gi",
      );

      if (regex.test(result) && !linkedGammes.has(gamme.name)) {
        result = result.replace(regex, (match) => {
          linkedGammes.add(gamme.name);
          return `<a href="${gammeUrl}" class="${cls}" title="Voir nos ${gamme.name}">${match}</a>`;
        });
        break;
      }
    }
  }

  return result;
}

describe("addGammeLinks — parity with the original algorithm on clean inputs", () => {
  const gammes: GammeLink[] = [
    { name: "disque de frein", link: "/pieces/disque-de-frein-1.html" },
    { name: "plaquette", alias: "plaquette-de-frein", id: 2 },
  ];

  const cleanInputs = [
    "Changez le disque de frein puis vérifiez la plaquette.",
    "Le disque de frein s'use ; un disque de frein voilé vibre.",
    `Guide: <strong>plaquette</strong> et disque de frein neufs.`,
    `<a href="/y">Voir le guide</a> puis un disque de frein neuf.`,
    "Rien à lier ici du tout.",
    "",
  ];

  for (const input of cleanInputs) {
    it(`matches the original on: ${JSON.stringify(input).slice(0, 48)}`, () => {
      expect(addGammeLinks(input, gammes, CLS)).toBe(
        originalImpl(input, gammes, CLS),
      );
    });
  }
});
