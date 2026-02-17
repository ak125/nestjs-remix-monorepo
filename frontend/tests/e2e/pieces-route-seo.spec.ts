import { expect, test } from "@playwright/test";

const VALID_PIECE_URL = "/pieces/kit-d-embrayage-479.html";
const NOT_FOUND_PIECE_URL = "/pieces/suspension";
const GONE_PIECE_URL = "/pieces/catalogue";

test.describe("Pieces Route SEO/HTTP Contract", () => {
  test("returns 410 + noindex for deleted catalogue route", async ({
    request,
  }) => {
    const response = await request.get(GONE_PIECE_URL);
    const headers = response.headers();

    expect(response.status()).toBe(410);
    expect(headers["x-robots-tag"] || "").toContain("noindex");
    expect(headers["location"]).toBeUndefined();
  });

  test("returns 404 + noindex for unknown piece slug", async ({ request }) => {
    const response = await request.get(NOT_FOUND_PIECE_URL);
    const headers = response.headers();

    expect(response.status()).toBe(404);
    expect(headers["x-robots-tag"] || "").toContain("noindex");
  });

  test("returns 200 + index for valid piece slug", async ({ request }) => {
    const response = await request.get(VALID_PIECE_URL);
    const headers = response.headers();

    expect(response.status()).toBe(200);
    expect(headers["x-robots-tag"] || "").toContain("index");
  });

  test("renders coherent meta tags for deleted and valid pages", async ({
    page,
  }) => {
    const deletedResponse = await page.goto(GONE_PIECE_URL);
    await page.waitForLoadState("domcontentloaded");

    expect(deletedResponse?.status()).toBe(410);
    await expect(page).toHaveTitle(/page non trouvée/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex,\s*follow/i,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

    const validResponse = await page.goto(VALID_PIECE_URL);
    await page.waitForLoadState("domcontentloaded");

    expect(validResponse?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /index,\s*follow/i,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://www.automecanik.com/pieces/kit-d-embrayage-479.html",
    );
  });

  test("hides buying-guide sections when guide is absent", async ({ page }) => {
    const response = await page.goto(
      `${VALID_PIECE_URL}?__e2eBuyingGuide=absent`,
    );
    await page.waitForLoadState("domcontentloaded");

    expect(response?.status()).toBe(200);
    await expect(page.locator("#quick-guide")).toHaveCount(0);
    await expect(page.locator("#symptoms")).toHaveCount(0);
    await expect(page.locator("#faq")).toHaveCount(0);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("hides buying-guide sections when source is unverified", async ({
    page,
  }) => {
    const response = await page.goto(
      `${VALID_PIECE_URL}?__e2eBuyingGuide=unverified`,
    );
    await page.waitForLoadState("domcontentloaded");

    expect(response?.status()).toBe(200);
    await expect(page.locator("#quick-guide")).toHaveCount(0);
    await expect(page.locator("#symptoms")).toHaveCount(0);
    await expect(page.locator("#faq")).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /index,\s*follow/i,
    );
  });
});
