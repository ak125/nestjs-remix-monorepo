import { test, expect } from "@playwright/test";

// Run only after the application, DB, Redis, queues, storage and test account
// isolation has been documented. No default localhost server is reused.
const baseURL = process.env.COMMAND_CENTER_L1_URL;
const adminState = process.env.COMMAND_CENTER_L1_ADMIN_STATE;
test.skip(
  !baseURL || !adminState,
  "Requires an isolated application URL and an admin test session",
);
test.use({ baseURL, storageState: adminState });

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`24 responsibilities, human card and keyboard navigation at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().includes("/command-center") &&
        request.method() !== "GET"
      )
        writes.push(request.method());
    });
    await page.goto("/admin/command-center");
    await page.getByRole("tab", { name: /Départements/ }).click();
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(24);
    const legal = page.getByRole("article", {
      name: "Juridique & Assurances",
      exact: true,
    });
    await expect(legal.getByText("Responsable non nommé")).toBeVisible();
    await expect(legal.getByText(/activité humaine non évaluée/)).toBeVisible();
    await expect(legal.getByRole("progressbar")).toHaveCount(0);
    await expect(
      page
        .getByRole("article", { name: "People, Formation & Doc", exact: true })
        .getByText("staff", { exact: true }),
    ).toBeVisible();
    // A published revision with the profile anchors is a separate prerequisite.
    const links = cards.getByRole("link");
    if (await links.count()) {
      await links.first().focus();
      await expect(links.first()).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(links.nth(1)).toBeFocused();
      await expect(links.first()).toHaveAttribute(
        "href",
        /^https:\/\/github\.com\/ak125\/nestjs-remix-monorepo\/blob\/[a-f0-9]{40}\/audit\/automecanik-departments-map\.md#department-direction$/i,
      );
    } else {
      await expect(
        page.getByText("Fiche indisponible pour cette révision"),
      ).toHaveCount(24);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
    expect(writes).toEqual([]);
  });
}
