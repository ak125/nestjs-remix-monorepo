/**
 * P1.5 — Tests frontend OG meta fallback + section rendering conditions.
 *
 * Teste la logique de sélection OG image telle qu'implémentée dans
 * pieces.$slug.tsx meta(), sans monter le composant Remix.
 *
 * ⚠️ Les assertions sur l'URL émise vérifient que la SOURCE passée à imgproxy
 * appartient à `IMGPROXY_ALLOWED_SOURCES`, lue dans docker-compose.imgproxy.yml.
 * Historique : ces tests assertaient `toContain("imgproxy")`, vrai aussi bien de
 * l'URL correcte que de l'URL 404 — une garde verte sur la sortie défectueuse.
 * Ne jamais recopier l'allowlist en dur ici : elle doit être lue à sa source,
 * sinon la garde survit à un changement de configuration qui la rend fausse.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import yaml from "js-yaml";
import { describe, it, expect } from "vitest";

import type { R1ImagesBySlot } from "~/types/r1-images.types";
import { ImageOptimizer } from "~/utils/image-optimizer";
import { getOgImageUrl } from "~/utils/og-image.utils";

// vitest cwd = frontend/ (cf. tests/unit/no-ios16-incompatible-regex.test.ts)
const COMPOSE_PATH = resolve(process.cwd(), "..", "docker-compose.imgproxy.yml");

/**
 * Lit l'allowlist imgproxy à sa source unique. Échoue — jamais ne skippe — si
 * la clé disparaît : un renommage silencieux désarmerait sinon la garde.
 */
function readAllowedSources(): string[] {
  const compose = yaml.load(readFileSync(COMPOSE_PATH, "utf8")) as {
    services?: Record<string, { environment?: Record<string, unknown> }>;
  };
  const raw = compose?.services?.imgproxy?.environment?.IMGPROXY_ALLOWED_SOURCES;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error(
      `IMGPROXY_ALLOWED_SOURCES introuvable ou vide dans ${COMPOSE_PATH}. ` +
        "Si la clé a été renommée ou déplacée, mettre à jour cette garde — " +
        "ne pas la neutraliser.",
    );
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const ALLOWED_SOURCES = readAllowedSources();

/** Extrait la source réelle transmise à imgproxy (segment après /plain/). */
function imgproxySourceOf(url: string): string {
  const marker = "/plain/";
  const at = url.indexOf(marker);
  expect(at, `URL sans segment /plain/ : ${url}`).toBeGreaterThan(-1);
  return url.slice(at + marker.length).replace(/@[a-z]+$/, "");
}

/**
 * L'assertion que `toContain("imgproxy")` ne faisait pas : la source doit
 * appartenir à une origine autorisée, sinon imgproxy répond 404
 * `Invalid source URL` et l'aperçu social est vide.
 */
function expectAllowedImgproxySource(url: string): void {
  const source = imgproxySourceOf(url);
  const allowed = ALLOWED_SOURCES.some((prefix) => source.startsWith(prefix));
  expect(
    allowed,
    `source hors IMGPROXY_ALLOWED_SOURCES (${ALLOWED_SOURCES.join(", ")}) : ${source}`,
  ).toBe(true);
}

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
    expectAllowedImgproxySource(ogImage);
    expect(ogImage).not.toContain("filtre-hero.webp");
  });

  it("2. No OG, HERO present → ogImage uses HERO path", () => {
    const ogImage = resolveOgImage({ HERO: HERO_IMG }, "/img/pg.webp");
    expect(ogImage).toContain("filtre-hero.webp");
    expectAllowedImgproxySource(ogImage);
  });

  it("3. No OG, no HERO, pg_pic present → ogImage uses pg_pic", () => {
    const ogImage = resolveOgImage({}, "/img/uploads/articles/gammes-produits/catalogue/disque-frein.webp");
    expect(ogImage).toContain("disque-frein.webp");
    expectAllowedImgproxySource(ogImage);
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

/**
 * Formes d'entrée réellement émises vers imgproxy — une par émetteur vivant.
 * Chaque cas vérifie la source EXACTE (suffixe de clé d'objet), pas seulement
 * son origine : une source autorisée mais mal réécrite est aussi un 404.
 */
describe("Source imgproxy — formes d'entrée réelles", () => {
  const PUBLIC = "/storage/v1/object/public/";
  // Construit depuis l'allowlist, jamais recopié en dur
  const ABSOLUTE_SUPABASE = `${ALLOWED_SOURCES[0].replace(/\/$/, "")}${PUBLIC}uploads/articles/gammes-produits/generated/d444250580ab051a.png`;

  it("route proxy /img/{bucket}/… (pieces pg_pic, conseils) → réécrite comme Caddy", () => {
    const ogImage = getOgImageUrl(
      "/img/uploads/articles/gammes-produits/catalogue/alternateur.webp",
      "blog-conseil",
    );
    expectAllowedImgproxySource(ogImage);
    const source = imgproxySourceOf(ogImage);
    expect(source.endsWith(`${PUBLIC}uploads/articles/gammes-produits/catalogue/alternateur.webp`)).toBe(true);
    expect(source).not.toContain("/img/");
  });

  it("route proxy : le 1er segment est le bucket, quel qu'il soit", () => {
    const source = imgproxySourceOf(getOgImageUrl("/img/rack-images/260/6216001.JPG", null));
    expect(source.endsWith(`${PUBLIC}rack-images/260/6216001.JPG`)).toBe(true);
  });

  it("URL Supabase absolue (conseils heroImg) → transmise intacte", () => {
    const ogImage = getOgImageUrl(ABSOLUTE_SUPABASE, "blog-conseil");
    expectAllowedImgproxySource(ogImage);
    expect(imgproxySourceOf(ogImage)).toBe(ABSOLUTE_SUPABASE);
  });

  it("URL OG inchangée hors source (pas de churn des URL déjà partagées)", () => {
    expect(getOgImageUrl("/img/uploads/a.webp", null)).toMatch(
      /^https:\/\/www\.automecanik\.com\/imgproxy\/rs:fit:1200:630\/q:85\/plain\/.+@webp$/,
    );
  });

  it.each([
    ["rack-images/101/image.jpg", "rack-images/101/image.jpg"],
    ["rack-images//6216001.JPG", "rack-images/6216001.JPG"],
    ["uploads/articles/x.webp", "uploads/articles/x.webp"],
    ["/uploads/articles/x.webp", "uploads/articles/x.webp"],
    ["articles/x.webp", "uploads/articles/x.webp"],
    ["/img/uploads/articles/x.webp", "uploads/articles/x.webp"],
  ])("ImageOptimizer.getOptimizedUrl(%s) → source …/public/%s", (input, key) => {
    const url = ImageOptimizer.getOptimizedUrl(input, { width: 800 });
    expectAllowedImgproxySource(url);
    expect(imgproxySourceOf(url).endsWith(`${PUBLIC}${key}`)).toBe(true);
  });

  it("ImageOptimizer.getOptimizedUrl(URL absolue) → pas d'écrasement `https:/`", () => {
    const url = ImageOptimizer.getOptimizedUrl(ABSOLUTE_SUPABASE, { width: 800 });
    expect(imgproxySourceOf(url)).toBe(ABSOLUTE_SUPABASE);
  });
});
