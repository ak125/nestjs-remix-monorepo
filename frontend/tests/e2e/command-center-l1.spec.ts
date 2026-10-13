import { test, expect } from "@playwright/test";
import {
  CommandCenterDigestSchema,
  CommandCenterResponseSchema,
  CommandCenterResponseV2Schema,
  DIGEST_MAX_OWNER_GO_ACTIONS,
} from "../../../packages/registry/src/command-center/snapshot";

// Run only after the application, DB, Redis, queues, storage and test account
// isolation has been documented. No default localhost server is reused.
const baseURL = process.env.COMMAND_CENTER_L1_URL;
const adminState = process.env.COMMAND_CENTER_L1_ADMIN_STATE;
test.skip(
  !baseURL || !adminState,
  "Requires an isolated application URL and an admin test session",
);
test.use({ baseURL, storageState: adminState });

test("cockpit still redirects anonymous visitors to login", async ({
  page,
}) => {
  await page.context().clearCookies();
  const response = await page.request.get("/admin/command-center", {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe("/login");
});

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
    const response = await page.goto("/admin/command-center");
    expect(response?.status()).toBe(200);
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

test("tabs wait for hydration before accepting the first click", async ({
  page,
}) => {
  let releaseScripts!: () => void;
  const scriptsReady = new Promise<void>((resolve) => {
    releaseScripts = resolve;
  });
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "script") await scriptsReady;
    await route.continue();
  });
  const tabs = page.getByRole("tab");
  try {
    const response = await page.goto("/admin/command-center", {
      waitUntil: "commit",
    });
    expect(response?.status()).toBe(200);
    await expect(tabs).toHaveCount(6);
    for (const tab of await tabs.all()) await expect(tab).toBeDisabled();
  } finally {
    releaseScripts();
  }
  const departments = page.getByRole("tab", {
    name: "Départements",
    exact: true,
  });
  await expect(departments).toBeEnabled();
  await departments.click();
  await expect(departments).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("article")).toHaveCount(24);
});

test("admin v1/v2, human report and machine digest remain consistent", async ({
  page,
}) => {
  const internalKey = process.env.COMMAND_CENTER_L1_INTERNAL_KEY;
  const expectedSha = process.env.COMMAND_CENTER_L1_EXPECTED_SHA;
  test.skip(
    !internalKey || !expectedSha,
    "Requires the isolated target's internal test key and expected revision",
  );
  expect(expectedSha).toMatch(/^[a-f0-9]{40}$/);

  // Native Node fetch keeps the machine credential out of the browser and
  // Playwright request traces. Do not follow redirects with this credential.
  const digestURL = new URL("/api/internal/command-center/digest", baseURL);
  const denied = await fetch(digestURL, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  expect(denied.status).toBe(403);
  await denied.body?.cancel();

  async function readGeneration() {
    const admin = await page.request.get(
      "/api/admin/command-center?contract_version=2",
      { maxRedirects: 0 },
    );
    expect(admin.status()).toBe(200);
    const adminBody = await admin.json();
    const cc = CommandCenterResponseV2Schema.parse(adminBody.data ?? adminBody);
    const legacy = await page.request.get("/api/admin/command-center", {
      maxRedirects: 0,
    });
    expect(legacy.status()).toBe(200);
    const legacyBody = await legacy.json();
    const v1 = CommandCenterResponseSchema.parse(legacyBody.data ?? legacyBody);
    const machine = await fetch(digestURL, {
      headers: { "X-Internal-Key": internalKey! },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    expect(machine.status).toBe(200);
    const digest = CommandCenterDigestSchema.parse(await machine.json());
    return { cc, v1, digest };
  }
  let generation = await readGeneration();
  if (
    generation.cc.generated_at !== generation.v1.generated_at ||
    generation.cc.generated_at !== generation.digest.generated_at
  ) {
    // A read may straddle the 60s TTL. Retry the sequence once, without flushing
    // the cache; never retry divergent content within an unchanged generation.
    generation = await readGeneration();
  }
  const { cc, v1, digest } = generation;
  expect(cc.mode).toBe("full");
  expect(cc.degraded).toBe(false);
  // This checks declared provenance; deployment metadata must corroborate it.
  expect(cc.git_sha).toBe(expectedSha);
  expect(cc.departments).toHaveLength(24);
  expect(cc.department_reports).toHaveLength(24);
  expect(new Set(cc.department_reports.map((r) => r.department))).toEqual(
    new Set(cc.departments.map((d) => d.id)),
  );
  expect(v1.departments.map((d) => d.id)).toEqual(
    cc.departments.map((d) => d.id),
  );
  expect(v1.department_reports).toEqual(cc.department_reports);
  expect(v1.generated_at).toBe(cc.generated_at);
  const waiting = cc.action_queue.filter((action) => action.owner_go_required);
  expect(digest).toEqual({
    schema_version: "command-center-digest.v1",
    generated_at: cc.generated_at,
    git_sha: cc.git_sha,
    mode: cc.mode,
    degraded: cc.degraded,
    stale_status: cc.stale_status,
    global_status: cc.global_status,
    department_reports: cc.department_reports,
    owner_go_actions_total: waiting.length,
    owner_go_actions: waiting
      .slice(0, DIGEST_MAX_OWNER_GO_ACTIONS)
      .map(({ details: _details, ...action }) => action),
  });

  const response = await page.goto("/admin/command-center");
  expect(response?.status()).toBe(200);
  await page.getByRole("tab", { name: "Rapports", exact: true }).click();
  const reports = page.getByRole("tabpanel", { name: "Rapports", exact: true });
  await expect(
    reports.getByText("Rapports des départements (24)"),
  ).toBeVisible();
  await expect(
    reports.getByRole("list").first().locator(":scope > li"),
  ).toHaveCount(24);
  const legal = cc.department_reports.find((r) => r.department === "legal");
  expect(legal).toBeDefined();
  expect(legal!.score).toBe("NON_MESURE");
  expect(legal!.kpi.measure).toBe("SANS_PRODUCTEUR");
  const legalReport = reports
    .getByRole("list")
    .first()
    .locator(":scope > li")
    .filter({ has: page.getByText(legal!.label, { exact: true }) });
  await expect(legalReport).toHaveCount(1);
  await expect(
    legalReport.getByText(legal!.next_evidence, { exact: true }),
  ).toBeVisible();
});
