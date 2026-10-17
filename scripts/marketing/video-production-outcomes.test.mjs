// Actual compiled SSR routes; all session/API boundaries stay in memory.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { createRequestHandler, RouterContextProvider } from "react-router";

const originalFetch = globalThis.fetch;
const requests = [];
let outcome = "simulated";
let statsUnavailable = false;
const execution = () => ({
  id: 1,
  briefId: "pilot",
  videoType: "short",
  vertical: "freinage",
  status: "completed",
  outcome,
  engineName: outcome === "simulated" ? "stub" : "remotion",
  renderStatus: "success",
  renderOutputPath: "s3://private/historical.mp4",
  qualityScore: null,
  qualityFlags: [],
  gateResults: [],
  durationMs: 10,
  attemptNumber: 1,
  canPublish: false,
  createdAt: "2026-10-13T07:00:00Z",
  retryable: false,
});
const production = {
  briefId: "pilot",
  videoType: "short",
  vertical: "freinage",
  status: "draft",
  qualityScore: 100,
  qualityFlags: [],
  gateResults: [],
  claimTable: [],
  evidencePack: [],
  disclaimerPlan: null,
  approvalRecord: null,
  knowledgeContract: null,
  scriptText: null,
  scriptGeneratedAt: null,
  scriptModel: null,
  masterAudioUrl: null,
  ttsVoice: null,
  parentBriefId: null,
  contentRole: "master",
  derivativePolicy: null,
  createdBy: "admin@example.invalid",
  createdAt: "2026-10-13T07:00:00Z",
  updatedAt: "2026-10-13T07:00:00Z",
};
globalThis.fetch = async (input) => {
  const url = new URL(
    typeof input === "string" ? input : (input.url ?? String(input)),
  );
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  requests.push(url.pathname);
  let data = null;
  let status = 200;
  if (url.pathname === "/api/admin/video/dashboard")
    data = { total: 1, byStatus: { draft: 1 } };
  else if (url.pathname === "/api/admin/video/executions/stats") {
    status = statsUnavailable ? 503 : 200;
    data = {
      total: 1,
      byStatus: { completed: 1 },
      byOutcome: { simulated: 1 },
      engineDistribution: { stub: 1 },
      canary: { totalCanary: 0, topErrorCodes: {} },
      renderPerformance: { byEngine: {} },
    };
  } else if (url.pathname === "/api/admin/video/executions/1")
    data = execution();
  else if (
    url.pathname === "/api/admin/video/executions" ||
    url.pathname.endsWith("/pilot/executions")
  )
    data = [execution()];
  else if (url.pathname === "/api/admin/video/productions/pilot")
    data = production;
  else if (
    url.pathname.endsWith("/variants") ||
    url.pathname.endsWith("/derivatives")
  )
    data = [];
  return new Response(
    JSON.stringify({ success: status === 200, data, total: 1 }),
    { status, headers: { "Content-Type": "application/json" } },
  );
};
after(() => {
  globalThis.fetch = originalFetch;
});
const build = await import("../../frontend/build/server/index.js");
const handler = createRequestHandler(build, "production");
async function render(path) {
  requests.length = 0;
  const context = build.entry.module.createAppLoadContext(
    {
      user: {
        id: "synthetic-admin",
        email: "admin@example.invalid",
        isAdmin: true,
        level: 7,
      },
      remixService: null,
      remixIntegration: null,
      cspNonce: "",
      serverObservability: null,
      remixApplicationPort: null,
    },
    () => new RouterContextProvider(),
  );
  const response = await handler(
    new Request(`http://127.0.0.1${path}`, {
      headers: { "User-Agent": "video-outcome-contract-test" },
    }),
    context,
  );
  assert.equal(response.status, 200);
  return response.text();
}

test("compiled execution list labels historical completed stubs as simulation", async () => {
  const html = await render("/admin/video-hub/executions");
  assert.match(html, /Simulation — aucun livrable/);
});
test("compiled execution detail does not offer a simulated historical file", async () => {
  const html = await render("/admin/video-hub/executions/1");
  assert.match(html, /Simulation — aucun livrable/);
  assert.doesNotMatch(html, /Charger la video/);
  assert.ok(!requests.some((path) => path.endsWith("/variants")));
});
test("compiled production does not expose a video player for completed simulation", async () => {
  const html = await render("/admin/video-hub/productions/pilot");
  assert.doesNotMatch(html, /Cliquer pour charger la video/);
  assert.doesNotMatch(html, /<video\b/);
});
test("compiled dashboard distinguishes unavailable execution statistics", async () => {
  statsUnavailable = true;
  try {
    assert.match(
      await render("/admin/video-hub"),
      /Statistiques d’exécution indisponibles/,
    );
  } finally {
    statsUnavailable = false;
  }
});
test("compiled real-render declaration permits preview without claiming verified delivery", async () => {
  outcome = "rendered_unverified";
  try {
    const html = await render("/admin/video-hub/executions/1");
    assert.match(html, /Rendu déclaré — fichier à vérifier/);
    assert.match(html, /Charger la video/);
    assert.ok(requests.some((path) => path.endsWith("/variants")));
    assert.match(
      await render("/admin/video-hub/productions/pilot"),
      /Cliquer pour charger la video/,
    );
  } finally {
    outcome = "simulated";
  }
});
