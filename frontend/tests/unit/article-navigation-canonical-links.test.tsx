import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import {
  ArticleNavigation,
  articleHref,
} from "~/components/blog/ArticleNavigation";

afterEach(cleanup);

/**
 * Régression GSC 404 (2026-10-03) — les liens précédent/suivant des pages
 * /blog-pieces-auto/conseils/{pg_alias} pointaient vers /blog-pieces-auto/{ba_alias}
 * (ex. /blog-pieces-auto/comment-changer-un-thermostat), redirigé vers
 * /conseils/comment-changer-un-thermostat → 404 : la route est indexée sur pg_alias.
 */
const article = (slug: string, pg_alias: string | null) => ({
  id: `advice_${slug}`,
  title: slug,
  slug,
  pg_alias,
  excerpt: "",
  publishedAt: "2024-01-01",
});

describe("ArticleNavigation — liens vers l'URL canonique des conseils", () => {
  it("avec pg_alias → /blog-pieces-auto/conseils/{pg_alias}", () => {
    render(
      <MemoryRouter>
        <ArticleNavigation
          previous={article(
            "comment-changer-une-colonne-direction",
            "colonne-de-direction",
          )}
          next={article("comment-changer-un-thermostat", "thermostat")}
        />
      </MemoryRouter>,
    );

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      "/blog-pieces-auto/conseils/colonne-de-direction",
      "/blog-pieces-auto/conseils/thermostat",
    ]);
  });

  it("sans pg_alias → résolveur /blog-pieces-auto/article/{slug}, jamais /blog-pieces-auto/{slug}", () => {
    expect(articleHref(article("comment-changer-un-thermostat", null))).toBe(
      "/blog-pieces-auto/article/comment-changer-un-thermostat",
    );
  });
});
