import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect, vi, beforeEach } from "vitest";

import GammeGuideCTA from "~/components/gamme/GammeGuideCTA";
import { loader } from "~/routes/pieces.$slug";

/**
 * R1 — liens vers la page conseils de la gamme.
 *
 * `/blog-pieces-auto/conseils/:pg_alias` répond 404 quand la gamme n'a pas
 * d'article (`getArticleByGamme`, __blog_advice). Le backend n'émet
 * `guideAchat` que si cet article existe (même source) : la page R1 ne lie
 * la page conseils (« Liens utiles » + bloc « Guide complet ») que via
 * `guideAchat.link`, jamais en reconstruisant l'URL depuis `pg_alias`.
 * Mesuré 2026-10-04 : 40/123 gammes du sitemap liaient une page conseils 404.
 */
const api = vi.hoisted(() => ({
  guideAchat: undefined as Record<string, unknown> | undefined,
}));

vi.mock("~/utils/logger", () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://internal-api",
}));

vi.mock("~/services/api/gamme-api.service", () => ({
  fetchGammePageData: vi.fn(async () => ({
    hero: {
      pg_name: "Filtre à huile",
      pg_alias: "filtre-a-huile",
      h1: "Filtre à huile pas cher",
      content: "",
    },
    meta: {
      title: "Filtre à huile",
      description: "Filtre à huile neuf pour votre véhicule.",
      keywords: "filtre a huile",
      robots: "index,follow",
      canonical: "/pieces/filtre-a-huile-7.html",
    },
    guideAchat: api.guideAchat,
  })),
}));

async function loadContent() {
  const result = (await loader({
    params: { slug: "filtre-a-huile-7.html" },
    request: new Request(
      "https://www.automecanik.com/pieces/filtre-a-huile-7.html",
    ),
    context: {},
  } as never)) as {
    data: Record<string, unknown> & {
      content: { conseilsHref: string | null };
    };
  };
  return result.data;
}

describe("pieces.$slug loader — lien conseils décidé par guideAchat", () => {
  beforeEach(() => {
    global.fetch = vi.fn(
      async () =>
        new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as unknown as typeof fetch;
  });

  it("gamme avec article : conseilsHref = guideAchat.link", async () => {
    api.guideAchat = {
      id: 1,
      title: "Comment changer un filtre à huile",
      alias: "comment-changer-un-filtre-a-huile",
      link: "/blog-pieces-auto/conseils/filtre-a-huile",
      updated: "2026-10-04",
    };
    const data = await loadContent();
    expect(data.content.conseilsHref).toBe(
      "/blog-pieces-auto/conseils/filtre-a-huile",
    );
  });

  it("gamme sans article : conseilsHref = null (pas de lien vers un 404)", async () => {
    api.guideAchat = undefined;
    const data = await loadContent();
    expect(data.content.conseilsHref).toBeNull();
  });

  it("le bloc guide jamais rendu n'est plus sérialisé vers le client", async () => {
    api.guideAchat = {
      link: "/blog-pieces-auto/conseils/filtre-a-huile",
    };
    const data = await loadContent();
    expect(data).not.toHaveProperty("guide");
  });
});

describe("GammeGuideCTA", () => {
  it("sans href : aucun bloc", () => {
    const { container } = render(
      <MemoryRouter>
        <GammeGuideCTA gammeName="Filtre à huile" href={null} />
      </MemoryRouter>,
    );
    expect(container.querySelector("a")).toBeNull();
  });

  it("avec href : lien vers la cible reçue", () => {
    const { container } = render(
      <MemoryRouter>
        <GammeGuideCTA
          gammeName="Filtre à huile"
          href="/blog-pieces-auto/conseils/filtre-a-huile"
        />
      </MemoryRouter>,
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "/blog-pieces-auto/conseils/filtre-a-huile",
    );
  });
});
