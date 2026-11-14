import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PiecesRelatedArticles } from "~/components/pieces/PiecesRelatedArticles";
import { fetchBlogArticleWithRelated } from "~/services/pieces/pieces-route.service";
import {
  type BlogArticle,
  type GammeData,
  type VehicleData,
} from "~/types/pieces-route.types";

/**
 * Pages pièces par véhicule (R2), bloc « Articles & Conseils ».
 *
 * Défaut relevé le 2026-11-11 : chaque carte pointait vers
 * `/blog-pieces-auto/article/{slug}`, qui répond 301 vers
 * `/blog-pieces-auto/conseils/{pg_alias}` pour un conseil rattaché à une
 * gamme. La réponse de l'API porte déjà `pg_alias` : la carte pointe
 * directement vers la page servie.
 */
vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const trackClick = vi.fn();
vi.mock("~/hooks/useSeoLinkTracking", () => ({
  useSeoLinkTracking: () => ({ trackClick, trackImpression: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  trackClick.mockClear();
});

const gamme = { id: 2, name: "Démarreur", alias: "demarreur" } as GammeData;
const vehicle = {} as VehicleData;

/** Réponse de `/api/blog/article/by-gamme/{alias}`, réduite aux champs lus. */
const byGammeResponse = (related: Record<string, unknown>[] = []) => ({
  success: true,
  data: {
    id: "advice-20",
    type: "advice",
    legacy_table: "__blog_advice",
    slug: "comment-changer-un-demarreur",
    pg_alias: "demarreur",
    h1: "Comment changer un démarreur",
    excerpt: "Les étapes du remplacement.",
    readingTime: 7,
    relatedArticles: related,
  },
});

const stubFetch = (handler: (url: string) => Response | Promise<Response>) => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
    handler(String(input)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("fetchBlogArticleWithRelated — alias de gamme des conseils", () => {
  it("conseil rattaché à une gamme → `pg_alias` porté par l'article et ses articles liés", async () => {
    stubFetch(() =>
      json(
        byGammeResponse([
          {
            id: "advice-31",
            type: "advice",
            slug: "comment-changer-votre-alternateur",
            pg_alias: "alternateur",
            title: "Changer votre alternateur",
          },
        ]),
      ),
    );

    const { article, relatedArticles } = await fetchBlogArticleWithRelated(
      gamme,
      vehicle,
    );

    expect(article?.pg_alias).toBe("demarreur");
    expect(relatedArticles.map((a) => [a.slug, a.pg_alias])).toEqual([
      ["comment-changer-un-demarreur", "demarreur"],
      ["comment-changer-votre-alternateur", "alternateur"],
    ]);
  });

  it("article sans gamme, ou qui n'est pas un conseil → pas de `pg_alias`", async () => {
    stubFetch(() =>
      json(
        byGammeResponse([
          { id: "a", type: "advice", slug: "conseil-sans-gamme", title: "A" },
          {
            id: "b",
            type: "advice",
            slug: "conseil-alias-vide",
            pg_alias: "",
            title: "B",
          },
          {
            id: "c",
            type: "guide",
            legacy_table: "__blog_guide",
            slug: "guide-achat-demarreur",
            pg_alias: "demarreur",
            title: "C",
          },
        ]),
      ),
    );

    const { relatedArticles } = await fetchBlogArticleWithRelated(
      gamme,
      vehicle,
    );

    expect(relatedArticles.slice(1).map((a) => a.pg_alias)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("réponse en liste d'un point d'accès de repli → même règle", async () => {
    stubFetch((url) =>
      url.includes("/by-gamme/")
        ? json({ success: false }, 404)
        : json({
            data: [
              {
                id: "advice-31",
                type: "advice",
                slug: "comment-changer-votre-alternateur",
                pg_alias: "alternateur",
                title: "Changer votre alternateur",
              },
            ],
          }),
    );

    const { article } = await fetchBlogArticleWithRelated(gamme, vehicle);

    expect(article?.slug).toBe("comment-changer-votre-alternateur");
    expect(article?.pg_alias).toBe("alternateur");
  });

  it("aucun point d'accès ne répond → aucun article, aucun lien fabriqué", async () => {
    const fetchMock = stubFetch(() => {
      throw new TypeError("fetch failed");
    });

    expect(await fetchBlogArticleWithRelated(gamme, vehicle)).toEqual({
      article: null,
      relatedArticles: [],
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});

const card = (overrides: Partial<BlogArticle>): BlogArticle => ({
  id: "advice-20",
  title: "Comment changer un démarreur",
  excerpt: "Les étapes du remplacement.",
  slug: "comment-changer-un-demarreur",
  date: "2026-01-15T00:00:00.000Z",
  readTime: 7,
  ...overrides,
});

const renderCards = (articles: BlogArticle[]) =>
  render(
    <MemoryRouter>
      <PiecesRelatedArticles articles={articles} gammeName="démarreur" />
    </MemoryRouter>,
  );

/** Liens des cartes, sans le lien « Tous nos guides » du bas de bloc. */
const cardHrefs = () =>
  screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"))
    .filter((href) => href !== "/blog-pieces-auto");

describe("PiecesRelatedArticles — cible des cartes d'articles", () => {
  it("conseil rattaché à une gamme → les deux liens de la carte visent la page conseil", () => {
    renderCards([card({ pg_alias: "demarreur" })]);

    expect(cardHrefs()).toEqual([
      "/blog-pieces-auto/conseils/demarreur",
      "/blog-pieces-auto/conseils/demarreur",
    ]);
  });

  it("article sans alias de gamme → route article, inchangée", () => {
    renderCards([
      card({ id: "g", slug: "guide-achat-demarreur", pg_alias: undefined }),
      card({ id: "n", slug: "conseil-sans-gamme", pg_alias: null }),
    ]);

    expect(cardHrefs()).toEqual([
      "/blog-pieces-auto/article/guide-achat-demarreur",
      "/blog-pieces-auto/article/guide-achat-demarreur",
      "/blog-pieces-auto/article/conseil-sans-gamme",
      "/blog-pieces-auto/article/conseil-sans-gamme",
    ]);
  });

  it("le clic est mesuré sur la destination réelle de la carte", () => {
    renderCards([card({ pg_alias: "demarreur" })]);

    fireEvent.click(
      screen.getByLabelText(/Guide complet: Comment changer un démarreur/),
    );

    expect(trackClick).toHaveBeenCalledTimes(1);
    expect(trackClick.mock.calls[0][1]).toBe(
      "/blog-pieces-auto/conseils/demarreur",
    );
  });

  it("aucun article → bloc absent", () => {
    const { container } = renderCards([]);

    expect(container.innerHTML).toBe("");
  });
});
