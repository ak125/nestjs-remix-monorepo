/**
 * P1.5 — Tests frontend OG meta fallback + section rendering conditions.
 *
 * Teste la logique de sélection OG image telle qu'implémentée dans
 * pieces.$slug.tsx meta(), sans monter le composant Remix.
 */
import { describe, it, expect } from "vitest";
import { getOgImageUrl } from "~/utils/og-image.utils";
import type { R1ImagesBySlot } from "~/types/r1-images.types";

// Helper: simule la logique OG du meta() de pieces.$slug.tsx (contrat map)
function resolveOgImage(
  r1Images: R1ImagesBySlot,
  pgPic: string | undefined,
): string {
  const r1OgSlot = r1Images?.OG;
  const r1HeroSlot = r1Images?.HERO;
  const ogSourcePath = r1OgSlot?.path ?? r1HeroSlot?.path ?? null;
  return ogSourcePath
    ? getOgImageUrl(`/img/uploads/${ogSourcePath}`, null)
    : getOgImageUrl(pgPic, "transaction");
}

function resolveOgAlt(
  r1Images: R1ImagesBySlot,
  title: string,
): string {
  const r1OgSlot = r1Images?.OG;
  const r1HeroSlot = r1Images?.HERO;
  return r1OgSlot?.alt ?? r1HeroSlot?.alt ?? title;
}

const OG_IMG = {
  slot: "OG" as const,
  path: "articles/gammes-produits/r1/filtre-og.webp",
  alt: "Filtre OG alt",
  caption: null,
  aspect: "1200:630",
};

const HERO_IMG = {
  slot: "HERO" as const,
  path: "articles/gammes-produits/r1/filtre-hero.webp",
  alt: "Filtre HERO alt",
  caption: null,
  aspect: "16:9",
};

describe("R1 OG meta fallback", () => {
  it("1. OG slot present → ogImage uses OG path", () => {
    const ogImage = resolveOgImage({ OG: OG_IMG, HERO: HERO_IMG }, "/img/pg.webp");
    expect(ogImage).toContain("filtre-og.webp");
    expect(ogImage).toContain("imgproxy");
    expect(ogImage).not.toContain("filtre-hero.webp");
  });

  it("2. No OG, HERO present → ogImage uses HERO path", () => {
    const ogImage = resolveOgImage({ HERO: HERO_IMG }, "/img/pg.webp");
    expect(ogImage).toContain("filtre-hero.webp");
    expect(ogImage).toContain("imgproxy");
  });

  it("3. No OG, no HERO, pg_pic present → ogImage uses pg_pic", () => {
    const ogImage = resolveOgImage({}, "/img/uploads/articles/gammes-produits/catalogue/disque-frein.webp");
    expect(ogImage).toContain("disque-frein.webp");
    expect(ogImage).toContain("imgproxy");
  });

  it("4. Nothing → ogImage uses transaction fallback", () => {
    const ogImage = resolveOgImage({}, undefined);
    expect(ogImage).toContain("/images/og/transaction.webp");
  });

  it("5. og:image:alt uses slot alt, not title", () => {
    const alt = resolveOgAlt({ OG: OG_IMG }, "Generic Page Title");
    expect(alt).toBe("Filtre OG alt");

    const altHero = resolveOgAlt({ HERO: HERO_IMG }, "Generic Page Title");
    expect(altHero).toBe("Filtre HERO alt");

    const altFallback = resolveOgAlt({}, "Generic Page Title");
    expect(altFallback).toBe("Generic Page Title");
  });
});
