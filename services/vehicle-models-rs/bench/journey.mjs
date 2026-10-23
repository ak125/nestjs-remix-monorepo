// Parcours réel du sélecteur de véhicule de la page d'accueil, dans Chrome :
// marque → année → modèle (sans choisir de motorisation, qui quitte la page).
// Forme « diagnostic » : assistant /diagnostic-auto, marque → modèle sans année
// (appel includeAll=true, page 0, limite 500) ; l'année est alors « - ».
// Chaque requête du navigateur est consignée (méthode, URL, statut, en-têtes
// utiles) ; les en-têtes X-Request-ID permettent ensuite de retrouver, dans les
// journaux d'A2 et de R2, quel processus a servi chaque appel.
//
// La liste des modèles affichée est résumée par son empreinte SHA-256 (valeur et
// libellé de chaque entrée, dans l'ordre), comparable d'une sélection à l'autre.
//
//   node journey.mjs <base_url> <sortie.json> <marque_id> <année|-> [desktop|mobile|diagnostic]
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const [base, out, brand, year, form = "desktop"] = process.argv.slice(2);
if (!base || !out || !brand || !year) {
  console.error("usage: node journey.mjs <base_url> <sortie.json> <marque_id> <année|-> [desktop|mobile|diagnostic]");
  process.exit(2);
}
const LABELS = {
  desktop: ["Sélectionner la marque", "Sélectionner l'année", "Sélectionner le modèle"],
  mobile: ["Marque", "Année", "Modèle"],
  diagnostic: ["Sélectionner une marque", null, "Sélectionner un modèle"],
}[form];
if (!LABELS) throw new Error(`forme inconnue : ${form}`);

const KEPT = [
  "content-type", "content-encoding", "content-length", "cache-control", "etag", "vary",
  "x-request-id", "x-cache-source", "x-filter-year", "x-robots-tag", "set-cookie",
  "x-ratelimit-limit-short", "x-ratelimit-remaining-short",
];
const pick = (headers) =>
  Object.fromEntries(KEPT.filter((k) => k in headers).map((k) => [k, headers[k]]));

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || "/opt/google/chrome/chrome", headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: form === "mobile" ? { width: 390, height: 844 } : { width: 1366, height: 900 },
});
const page = await context.newPage();
const calls = [];
page.on("response", async (response) => {
  const request = response.request();
  const url = new URL(request.url());
  if (!url.pathname.startsWith("/api/")) return;
  calls.push({
    at: new Date().toISOString(),
    method: request.method(),
    path: url.pathname + url.search,
    status: response.status(),
    request: pick(await request.allHeaders()),
    response: pick(await response.allHeaders()),
  });
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const result = { base, form, brand: Number(brand), year: year === "-" ? null : Number(year), steps: [] };
const step = (name, extra = {}) => result.steps.push({ name, at: new Date().toISOString(), ...extra });
const digest = (entries) => createHash("sha256").update(JSON.stringify(entries)).digest("hex");
const MODELS = /\/api\/vehicles\/brands\/\d+\/models/;
// Banc : les images absentes du rejeu font servir par Node ~30 requêtes en une
// seconde au chargement, au-delà du palier short (15/s) de l'IP de boucle partagée
// par tout le navigateur. On laisse la rafale et son blocage (1 s) s'écouler avant
// d'interagir ; aucune réponse n'est rejouée ni ignorée.
const settle = async () => {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  step("rafale de chargement écoulée");
};
const modelsStep = async (models) => {
  const body = await models.json().catch(() => null);
  step("modèles reçus", {
    status: models.status(),
    models: Array.isArray(body?.data) ? body.data.length : null,
    total: body?.total ?? null,
  });
};
try {
  if (form === "diagnostic") {
    const brandsResponse = page.waitForResponse(
      (r) => /\/api\/vehicles\/brands\?/.test(r.url()), { timeout: 60000 });
    const nav = await page.goto(`${base}/diagnostic-auto`, { waitUntil: "load", timeout: 60000 });
    step("page diagnostic", { status: nav?.status() });
    const brands = await brandsResponse;
    const list = (await brands.json().catch(() => null))?.data;
    step("marques reçues", { status: brands.status(), brands: Array.isArray(list) ? list.length : null });
    const row = Array.isArray(list) ? list.find((b) => String(b.marque_id) === String(brand)) : null;
    if (!row) throw new Error(`marque ${brand} absente de la liste reçue`);
    await settle();
    const dropdown = page.locator("div.absolute.top-full");
    await page.getByRole("button", { name: LABELS[0], exact: true }).click();
    const modelsResponse = page.waitForResponse((r) => MODELS.test(r.url()), { timeout: 30000 });
    await dropdown.getByRole("button", { name: row.marque_name, exact: true }).click();
    await modelsStep(await modelsResponse);
    const trigger = page.getByRole("button", { name: LABELS[2], exact: true });
    await page.waitForFunction(
      (label) => [...document.querySelectorAll("button")]
        .some((b) => b.textContent.trim() === label && !b.disabled), LABELS[2], { timeout: 30000 });
    await trigger.click();
    await dropdown.getByRole("button").first().waitFor({ timeout: 30000 });
    const labels = (await dropdown.getByRole("button").allTextContents()).map((t) => t.trim());
    step("liste des modèles affichée", { options: labels.length, digest: digest(labels) });
    result.ok = true;
  } else {
  const nav = await page.goto(`${base}/`, { waitUntil: "load", timeout: 60000 });
  step("accueil", { status: nav?.status() });
  await settle();
  const select = (label) => page.locator(`select[aria-label="${label}"]:visible`).first();

  const brandSelect = select(LABELS[0]);
  await brandSelect.focus();
  await page.waitForFunction(
    ([label, id]) => [...document.querySelectorAll(`select[aria-label="${label}"]`)]
      .some((s) => [...s.options].some((o) => o.value === id)),
    [LABELS[0], String(brand)], { timeout: 30000 });
  step("marques chargées");

  await brandSelect.selectOption(String(brand));
  const yearSelect = select(LABELS[1]);
  await page.waitForFunction(
    ([label, y]) => [...document.querySelectorAll(`select[aria-label="${label}"]`)]
      .some((s) => !s.disabled && [...s.options].some((o) => o.value === y)),
    [LABELS[1], String(year)], { timeout: 30000 });
  step("années chargées");

  const modelsResponse = page.waitForResponse((r) => MODELS.test(r.url()), { timeout: 30000 });
  await yearSelect.selectOption(String(year));
  await modelsStep(await modelsResponse);

  const modelSelect = select(LABELS[2]);
  await page.waitForFunction(
    (label) => [...document.querySelectorAll(`select[aria-label="${label}"]`)]
      .some((s) => !s.disabled && s.options.length > 1),
    LABELS[2], { timeout: 30000 });
  const entries = await modelSelect.locator("option").evaluateAll(
    (os) => os.filter((o) => o.value !== "").map((o) => [o.value, o.textContent.trim()]));
  const options = entries.map(([v]) => v);
  step("liste des modèles affichée", { options: options.length, digest: digest(entries) });
  if (options.length > 0) {
    const typesResponse = page.waitForResponse(
      (r) => /\/api\/vehicles\/models\/\d+\/types/.test(r.url()), { timeout: 30000 });
    await modelSelect.selectOption(options[0]);
    const types = await typesResponse;
    step("motorisations reçues", { status: types.status(), model: Number(options[0]) });
  }
  result.ok = true;
  }
} catch (e) {
  result.ok = false;
  result.error = String(e);
} finally {
  await page.waitForTimeout(500);
  result.calls = calls;
  result.page_errors = errors;
  writeFileSync(out, JSON.stringify(result, null, 2) + "\n", { mode: 0o600 });
  await browser.close();
}
console.log(JSON.stringify({ ok: result.ok, error: result.error, steps: result.steps.map((s) => s.name) }));
process.exit(result.ok ? 0 : 1);
