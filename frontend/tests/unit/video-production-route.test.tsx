import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  createMemoryRouter,
  data,
  RouterContextProvider,
  RouterProvider,
  type ActionFunction,
  type ActionFunctionArgs,
} from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProductionDetail, {
  action,
  loader,
} from "../../app/routes/admin.video-hub.productions.$briefId";

vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://backend",
}));

type RouteData = Awaited<ReturnType<typeof loader>>["data"];
type Production = NonNullable<RouteData["production"]>;
const url = new URL(
  "http://frontend/admin/video-hub/productions/synthetic-brief",
);
const cookie = "session=synthetic-test-only";
let fetchMock: ReturnType<typeof vi.fn>;
const routers: ReturnType<typeof createMemoryRouter>[] = [];

beforeEach(() => {
  fetchMock = vi
    .fn()
    .mockRejectedValue(new Error("Unexpected offline request"));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  routers.splice(0).forEach((router) => router.dispose());
  vi.unstubAllGlobals();
});

function args(
  fields?: Record<string, string>,
  withCookie = true,
): ActionFunctionArgs {
  return {
    request: new Request(url, {
      headers: withCookie ? { Cookie: cookie } : {},
      ...(fields ? { method: "POST", body: new URLSearchParams(fields) } : {}),
    }),
    params: { briefId: "synthetic-brief" },
    context: new RouterContextProvider(),
    url,
    pattern: "/admin/video-hub/productions/:briefId",
  };
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function production(overrides: Partial<Production> = {}): Production {
  return {
    id: 1,
    briefId: "synthetic-brief",
    videoType: "short",
    vertical: "freinage",
    status: "draft",
    qualityScore: null,
    qualityFlags: [],
    gateResults: null,
    claimTable: null,
    evidencePack: null,
    disclaimerPlan: null,
    approvalRecord: null,
    knowledgeContract: null,
    scriptText: null,
    scriptGeneratedAt: null,
    scriptModel: null,
    masterAudioUrl: null,
    ttsVoice: null,
    parentBriefId: null,
    contentRole: "socle",
    derivativePolicy: null,
    createdBy: "synthetic-editor",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
function execution(executionOutcome?: string, id = 1) {
  return {
    id,
    status: "completed",
    executionOutcome,
    engineName: "remotion",
    renderErrorCode: null,
    renderOutputPath: "s3://synthetic/master.mp4",
    durationMs: 65000,
    attemptNumber: 1,
    createdAt: "2026-01-01T00:00:00Z",
    retryable: false,
  };
}
const gates = ["PASS", "WARN", "FAIL"].map((verdict, index) => ({
  gate: ["truth", "brand", "custom_gate"][index],
  verdict: verdict as "PASS" | "WARN" | "FAIL",
  measured: index === 1 ? null : 0,
  details: [],
  warnThreshold: 1,
  failThreshold: 2,
}));

async function show(
  page: Partial<RouteData> = {},
  handle: ActionFunction = vi.fn(async () => data({ ok: true })),
) {
  const router = createMemoryRouter(
    [
      {
        path: "/admin/video-hub/productions/:briefId",
        loader: () => ({
          production: production(),
          executions: [],
          derivatives: [],
          error: null,
          ...page,
        }),
        action: handle,
        Component: ProductionDetail,
        HydrateFallback: () => null,
      },
    ],
    { initialEntries: [url.pathname] },
  );
  routers.push(router);
  const view = render(<RouterProvider router={router} />);
  await screen.findByText(
    page.production === null
      ? page.error || "Production introuvable"
      : "synthetic-brief",
  );
  return { ...view, handle, router };
}

describe("production route loading", () => {
  it("loads the three existing resources with the session cookie and preserves their data", async () => {
    const prod = production();
    const exec = execution("rendered_unverified");
    const derivative = { brief_id: "synthetic-child" };
    for (const value of [prod, [exec], [derivative]])
      fetchMock.mockResolvedValueOnce(response({ data: value }));
    const result = await loader(args());
    expect(result.data).toEqual({
      production: prod,
      executions: [exec],
      derivatives: [derivative],
      error: null,
    });
    expect(fetchMock.mock.calls.map(([target]) => target)).toEqual([
      "http://backend/api/admin/video/productions/synthetic-brief",
      "http://backend/api/admin/video/productions/synthetic-brief/executions",
      "http://backend/api/admin/video/productions/synthetic-brief/derivatives",
    ]);
    for (const [, init] of fetchMock.mock.calls)
      expect(init.headers.Cookie).toBe(cookie);
  });
  it("accepts genuinely empty optional collections without inventing an execution", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ data: production() }))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response({}));
    expect((await loader(args(undefined, false))).data).toMatchObject({
      executions: [],
      derivatives: [],
      error: null,
    });
    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe("");
  });
  it.each([401, 403, 404, 500])(
    "preserves denial/not-found/unavailability for HTTP %s",
    async (status) => {
      fetchMock
        .mockResolvedValueOnce(response({}, status))
        .mockResolvedValue(response({ data: [] }));
      const result = await loader(args());
      expect(result.data.production).toBeNull();
      expect(result.init?.status).toBe(status === 500 ? 503 : status);
      expect(result.data.error).toBe(
        status === 404
          ? "Production introuvable"
          : status === 500
            ? "Erreur chargement"
            : "Accès refusé",
      );
    },
  );
  it.each([1, 2])(
    "does not describe unavailable collection %s as an empty history",
    async (failedIndex) => {
      [production(), [], []].forEach((value, index) =>
        fetchMock.mockResolvedValueOnce(
          response({ data: value }, index === failedIndex ? 503 : 200),
        ),
      );
      const result = await loader(args());
      expect(result.init?.status).toBe(503);
      expect(result.data.error).toBe("Historique vidéo indisponible");
    },
  );
  it.each(["network", "invalid-json"])(
    "reports %s failures",
    async (failure) => {
      if (failure === "invalid-json")
        fetchMock.mockResolvedValue(new Response("not json"));
      const result = await loader(args());
      expect(result.data).toMatchObject({
        production: null,
        error: "Erreur chargement",
      });
      expect(result.init?.status).toBe(503);
    },
  );
});

describe("production form actions", () => {
  it.each<Record<string, string>>([{}, { _intent: "unexpected" }])(
    "rejects an absent/unknown intent without executing a render",
    async (fields) => {
      const result = await action(args(fields));
      expect(result).not.toBeInstanceOf(Response);
      if (result instanceof Response) throw new Error("Unexpected redirect");
      expect(result.data).toMatchObject({
        ok: false,
        error: "Action inconnue",
      });
      expect(result.init?.status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  const cases: Array<{
    intent: string;
    suffix: string;
    method: string;
    fields: Record<string, string>;
    body: Record<string, unknown> | undefined;
    fallback: string;
  }> = [
    {
      intent: "save-script",
      suffix: "",
      method: "PATCH",
      fields: { scriptText: "Texte conservé" },
      body: { scriptText: "Texte conservé" },
      fallback: "Erreur sauvegarde",
    },
    {
      intent: "generate-script",
      suffix: "/generate-script",
      method: "POST",
      fields: { regenerate: "true" },
      body: { regenerate: true },
      fallback: "Erreur generation",
    },
    {
      intent: "generate-audio",
      suffix: "/generate-audio",
      method: "POST",
      fields: { voice: "synthetic-voice" },
      body: { voice: "synthetic-voice" },
      fallback: "Erreur TTS",
    },
    {
      intent: "derive",
      suffix: "/derive",
      method: "POST",
      fields: {},
      body: {},
      fallback: "Erreur derivation",
    },
    {
      intent: "batch-execute",
      suffix: "/batch-execute",
      method: "POST",
      fields: { briefIds: "child-a,child-b" },
      body: { briefIds: ["child-a", "child-b"] },
      fallback: "Erreur batch",
    },
    {
      intent: "execute",
      suffix: "/execute",
      method: "POST",
      fields: {},
      body: undefined,
      fallback: "Erreur execution",
    },
  ];
  cases.forEach((row) => {
    it(`submits ${row.intent} exactly and returns its success contract`, async () => {
      const saved = { id: 41, synthetic: true };
      fetchMock.mockResolvedValue(response({ success: true, data: saved }));
      const result = await action(args({ ...row.fields, _intent: row.intent }));
      const [target, init] = fetchMock.mock.calls[0];
      expect(target).toBe(
        `http://backend/api/admin/video${row.intent === "batch-execute" ? "" : "/productions/synthetic-brief"}${row.suffix}`,
      );
      expect(init.method).toBe(row.method);
      expect(init.headers.Cookie).toBe(cookie);
      expect(init.body ? JSON.parse(init.body) : undefined).toEqual(row.body);
      if (row.intent === "save-script") {
        expect(result).toBeInstanceOf(Response);
        expect((result as Response).status).toBe(302);
        expect((result as Response).headers.get("Location")).toBe(url.pathname);
      } else {
        expect(result).toHaveProperty("data", {
          _intent: row.intent,
          ok: true,
          ...(row.intent === "execute" ? { executionId: 41 } : { data: saved }),
        });
      }
    });
    it.each(["http", "business", "network", "invalid-json", "fallback"])(
      `${row.intent} reports %s failures`,
      async (failure) => {
        if (failure === "http")
          fetchMock.mockResolvedValue(
            response({ success: true, error: "Refus synthétique" }, 403),
          );
        if (failure === "business")
          fetchMock.mockResolvedValue(
            response({ success: false, error: "Refus synthétique" }),
          );
        if (failure === "fallback")
          fetchMock.mockResolvedValue(response({ success: false }));
        if (failure === "invalid-json")
          fetchMock.mockResolvedValue(new Response("not json"));
        const result = await action(
          args({ ...row.fields, _intent: row.intent } as Record<
            string,
            string
          >),
        );
        expect(result).toHaveProperty("data", {
          _intent: row.intent,
          ok: false,
          error:
            failure === "network" || failure === "invalid-json"
              ? "Erreur reseau"
              : failure === "fallback"
                ? row.fallback
                : "Refus synthétique",
        });
      },
    );
  });
  it.each([
    ["generate-script", { regenerate: false }],
    ["generate-audio", { voice: "onyx" }],
    ["batch-execute", { briefIds: [] }],
  ])("preserves existing defaults for %s", async (intent, body) => {
    fetchMock.mockResolvedValue(response({ success: true }));
    await action(args({ _intent: intent as string }, false));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(body);
    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe("");
  });
  it("does not fabricate an execution id when the API omits it", async () => {
    fetchMock.mockResolvedValue(response({ success: true }));
    expect(await action(args({ _intent: "execute" }))).toHaveProperty(
      "data.executionId",
      null,
    );
  });
  it.each(["generate-script", "generate-audio", "derive", "batch-execute"])(
    "preserves backend messages for %s",
    async (intent) => {
      fetchMock.mockResolvedValue(
        response({ success: false, message: "Bloqué par validation" }),
      );
      expect(await action(args({ _intent: intent }))).toHaveProperty(
        "data.error",
        "Bloqué par validation",
      );
    },
  );
  it("passes the stored evidence and script to gates without manufacturing measurements", async () => {
    const prod = production({
      claimTable: [],
      evidencePack: [{ source: "synthetic" }],
      disclaimerPlan: { disclaimers: [] },
      approvalRecord: { briefId: "synthetic-brief", stages: [] },
      scriptText: "Texte enregistré",
    });
    fetchMock
      .mockResolvedValueOnce(response({ data: prod }))
      .mockResolvedValueOnce(response({ canPublish: false, gates }));
    expect(await action(args({ _intent: "dry-run" }))).toHaveProperty("data", {
      _intent: "dry-run",
      ok: true,
      result: { canPublish: false, gates },
    });
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toMatchObject({
      claims: prod.claimTable,
      evidencePack: prod.evidencePack,
      disclaimerPlan: prod.disclaimerPlan,
      approvalRecord: prod.approvalRecord,
      scriptText: prod.scriptText,
    });
    expect(body).not.toHaveProperty("actualDurationSec");
    expect(fetchMock.mock.calls[1][1].headers.Cookie).toBe(cookie);
  });
  it.each(["missing", "http", "business", "network", "fallback"])(
    "dry-run refuses %s failures",
    async (failure) => {
      if (failure === "missing") fetchMock.mockResolvedValue(response({}, 404));
      if (failure === "http" || failure === "business")
        fetchMock
          .mockResolvedValueOnce(response({ data: production() }))
          .mockResolvedValueOnce(
            response(
              { success: false, message: "Validation indisponible" },
              failure === "http" ? 503 : 200,
            ),
          );
      if (failure === "fallback")
        fetchMock
          .mockResolvedValueOnce(response({ data: production() }))
          .mockResolvedValueOnce(response({ success: false }));
      const result = await action(args({ _intent: "dry-run" }));
      expect(result).toHaveProperty("data.ok", false);
      expect(result).toHaveProperty(
        "data.error",
        failure === "missing"
          ? "Production introuvable"
          : failure === "network"
            ? "Erreur reseau"
            : failure === "fallback"
              ? "Erreur validation"
              : "Validation indisponible",
      );
    },
  );
});

describe("production detail user journey", () => {
  it.each([undefined, "Erreur chargement"])(
    "shows unavailable production without action controls: %s",
    async (error) => {
      await show({ production: null, error });
      expect(
        screen
          .getByRole("link", { name: "Retour aux productions" })
          .getAttribute("href"),
      ).toBe("/admin/video-hub/productions");
      expect(screen.queryByRole("button", { name: "RENDER" })).toBeNull();
    },
  );
  it("shows the initial pipeline and each empty inspector", async () => {
    await show();
    expect(screen.getByText("Pipeline non demarre")).toBeTruthy();
    expect(screen.getByText("0/5")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "GEN AUDIO" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "DERIVE" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    for (const [tab, message] of [
      ["Script", "Aucun script"],
      ["Claims", "Aucun claim"],
      ["Gates", "Aucun gate execute"],
      ["Exec", "Aucune execution"],
      ["Deriv", "Aucune derivee"],
    ]) {
      fireEvent.click(screen.getByRole("button", { name: tab }));
      expect(screen.getByText(message)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: tab }));
      expect(screen.getByText("0/5")).toBeTruthy();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each([undefined, "simulated", "disabled", "skipped", "failed", "unknown"])(
    "does not offer a rendered preview/derivation for completed %s",
    async (outcome) => {
      await show({ executions: [execution(outcome)] });
      expect(screen.queryByText("Cliquer pour charger la video")).toBeNull();
      expect(screen.getByText("0/5")).toBeTruthy();
      expect(
        (screen.getByRole("button", { name: "DERIVE" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      fireEvent.click(screen.getByRole("button", { name: "Exec" }));
      expect(
        screen.getByText(
          outcome === "simulated"
            ? "Simulation"
            : outcome === "disabled"
              ? "Pipeline désactivé"
              : outcome === "skipped"
                ? "Rendu ignoré"
                : outcome === "failed"
                  ? "Échec"
                  : "Résultat indéterminé",
        ),
      ).toBeTruthy();
    },
  );
  it.each(["rendered_unverified", "rendered_checked"])(
    "selects the actual %s artifact after a simulation",
    async (outcome) => {
      const view = await show({
        executions: [execution("simulated", 1), execution(outcome, 2)],
      });
      expect(screen.getByText("Execution #2")).toBeTruthy();
      expect(screen.getByText("1:05")).toBeTruthy();
      expect(
        (screen.getByRole("button", { name: "DERIVE" }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
      fireEvent.click(screen.getByRole("button", { name: "Lire le rendu" }));
      expect(view.container.querySelector("video")?.getAttribute("src")).toBe(
        "/api/admin/video/executions/2/stream",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("offers script editing, cancellation, blank protection and the real form payload", async () => {
    const handle = vi.fn(async ({ request }: ActionFunctionArgs) => {
      const form = await request.formData();
      expect(Object.fromEntries(form)).toEqual({
        _intent: "save-script",
        scriptText: "Texte modifié",
      });
      return data({ ok: false, error: "Sauvegarde refusée" });
    });
    await show(
      {
        production: production({
          scriptText: "Texte initial",
          scriptModel: "synthetic-model",
          scriptGeneratedAt: "2026-01-01T00:00:00Z",
          disclaimerPlan: {
            disclaimers: [
              { type: "safety", text: "Notice synthétique", position: "end" },
            ],
          },
        }),
      },
      handle,
    );
    expect(screen.getByText("Script genere")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    expect(screen.getByText("Notice synthétique")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    expect(
      (screen.getByRole("button", { name: "SAUVEGARDER" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText("vide")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ANNULER" }));
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Texte initial",
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Texte modifié" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SAUVEGARDER" }));
    expect(await screen.findByText("Sauvegarde refusée")).toBeTruthy();
    expect(handle).toHaveBeenCalledTimes(1);
  });
  it.each(["draft", "processing", "completed", "failed", "archived"])(
    "shows metadata and actual audio for status %s",
    async (status) => {
      const view = await show({
        production: production({
          status,
          masterAudioUrl: "/synthetic/audio.wav",
          scriptText: "Script",
          qualityScore: 0,
          qualityFlags: ["OBSERVATION_MISSING"],
          parentBriefId: "synthetic-parent",
          knowledgeContract: {},
          claimTable: [],
          evidencePack: [],
          approvalRecord: { briefId: "synthetic-brief", stages: [] },
        }),
      });
      expect(screen.getByText("Audio pret")).toBeTruthy();
      expect(view.container.querySelector("audio")?.getAttribute("src")).toBe(
        "/synthetic/audio.wav",
      );
      expect(screen.getByText("OBSERVATION_MISSING")).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: "synthetic-parent" })
          .getAttribute("href"),
      ).toBe("/admin/video-hub/productions/synthetic-parent");
      expect(screen.getByText("2/5")).toBeTruthy();
    },
  );
  it("shows claim states, gate verdicts, execution durations/errors and derivative links", async () => {
    const rows = [null, 900, 9000, 65000].map((durationMs, index) => ({
      ...execution("rendered_unverified", index + 1),
      durationMs,
      status: ["completed", "failed", "processing", "queued"][index],
      engineName: index === 0 ? null : "remotion",
      renderErrorCode: index === 1 ? "RENDER_FAILED" : null,
    }));
    const derivatives = ["completed", "failed", "draft"].map(
      (status, index) => ({
        brief_id: `child-${index}`,
        video_type: "short",
        status,
        derivative_index: index,
        script_text: null,
        created_at: "2026-01-01T00:00:00Z",
      }),
    );
    await show({
      production: production({
        gateResults: gates,
        claimTable: ["verified", "blocked", "unverified"].map(
          (status, index) => ({
            id: `claim-${index}`,
            kind: "fact",
            rawText: `Synthetic claim ${index}`,
            value: "0",
            unit: "",
            sectionKey: "test",
            sourceRef: index === 0 ? "synthetic-source" : null,
            status: status as "verified" | "blocked" | "unverified",
            requiresHumanValidation: true,
          }),
        ),
      }),
      executions: rows,
      derivatives,
    });
    fireEvent.click(screen.getByRole("button", { name: "Claims" }));
    for (const status of ["verified", "blocked", "unverified"])
      expect(screen.getByText(status)).toBeTruthy();
    expect(screen.getByText("synthetic-source")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Gates" }));
    for (const verdict of ["PASS", "WARN", "FAIL"])
      expect(screen.getByText(verdict)).toBeTruthy();
    expect(screen.getByText("custom_gate")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exec" }));
    for (const duration of ["--:--", "0.9s", "9s", "1:05"])
      expect(screen.getAllByText(duration).length).toBeGreaterThan(0);
    expect(screen.getByText("RENDER_FAILED")).toBeTruthy();
    expect(screen.getByRole("link", { name: /#2/ }).getAttribute("href")).toBe(
      "/admin/video-hub/executions/2",
    );
    fireEvent.click(screen.getByRole("button", { name: "Deriv" }));
    expect(
      screen.getByRole("link", { name: /child-1/ }).getAttribute("href"),
    ).toBe("/admin/video-hub/productions/child-1");
    const batch = screen
      .getByRole("button", { name: "BATCH (3)" })
      .closest("form")!;
    expect(Object.fromEntries(new FormData(batch))).toEqual({
      _intent: "batch-execute",
      briefIds: "child-0,child-1,child-2",
    });
  });
});

describe("production form feedback through the real router", () => {
  const forms = [
    {
      intent: "generate-script",
      button: "RE-SCR",
      pending: "GEN...",
      payload: { claimCount: 3, estimatedDurationSecs: 120 },
      message: "Script: 3 claims, ~2min",
      fallback: "Erreur script",
    },
    {
      intent: "generate-audio",
      button: "GEN AUDIO",
      pending: "TTS...",
      payload: { durationSecs: 12.34, cached: true },
      message: "Audio: 12.3s (cache)",
      fallback: "Erreur TTS",
    },
    {
      intent: "execute",
      button: "RENDER",
      pending: "RENDER...",
      payload: {},
      message: "Execution soumise",
      fallback: "Erreur execution",
    },
    {
      intent: "derive",
      button: "DERIVE",
      pending: "DERIV...",
      payload: { derivativesCreated: 1 },
      message: "1 derivees creees",
      fallback: "Erreur derivation",
    },
    {
      intent: "batch-execute",
      button: "BATCH (1)",
      pending: "BATCH (1)",
      payload: { submitted: ["synthetic-child"] },
      message: "Batch: 1 soumises",
      fallback: "Erreur batch",
    },
    {
      intent: "dry-run",
      button: "GATES",
      pending: "GATES",
      payload: {},
      message: "",
      fallback: "Erreur dry-run",
    },
  ];
  const page = () => ({
    production: production({ scriptText: "Synthetic script" }),
    executions: [execution("rendered_unverified")],
    derivatives: [
      {
        brief_id: "synthetic-child",
        video_type: "short",
        status: "draft",
        derivative_index: 0,
        script_text: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
  });
  forms.forEach((row) => {
    it(`${row.intent} disables repeat submission while pending and displays its result`, async () => {
      let finish!: () => void;
      const pending = new Promise<void>((resolve) => {
        finish = resolve;
      });
      const handle = vi.fn(async ({ request }: ActionFunctionArgs) => {
        const form = await request.formData();
        expect(form.get("_intent")).toBe(row.intent);
        await pending;
        return data({
          ok: true,
          data: row.payload,
          result: { canPublish: false, gates: [gates[2]] },
        });
      });
      await show(page(), handle);
      fireEvent.click(screen.getByRole("button", { name: row.button }));
      const busy = await screen.findByRole("button", {
        name: row.pending,
      });
      expect((busy as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(busy);
      await act(async () => {
        finish();
      });
      expect(handle).toHaveBeenCalledTimes(1);
      expect(
        (
          screen.getByRole("button", {
            name: row.button,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
      if (row.message)
        expect(await screen.findByText(row.message)).toBeTruthy();
      else {
        fireEvent.click(screen.getByRole("button", { name: "Gates" }));
        expect(await screen.findByText("BLOCKED")).toBeTruthy();
        expect(screen.getByText("DRY-RUN")).toBeTruthy();
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });
    it.each([undefined, "Refus synthétique"])(
      `${row.intent} displays fallback or explicit failure: %s`,
      async (error) => {
        await show(page(), async () => data({ ok: false, error }));
        fireEvent.click(screen.getByRole("button", { name: row.button }));
        expect(await screen.findByText(error ?? row.fallback)).toBeTruthy();
        expect(screen.queryByText("Execution soumise")).toBeNull();
      },
    );
  });
  it("saves a new script through the real action and reloads its persisted text after redirect", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const prod = production();
    fetchMock.mockImplementationOnce(async (_target, init) => {
      await pending;
      prod.scriptText = JSON.parse(init.body).scriptText;
      return response({ success: true });
    });
    const { router } = await show({ production: prod }, action);
    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Nouveau script synthétique" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SAUVEGARDER" }));
    expect(
      (
        (await screen.findByRole("button", {
          name: "SAUVEGARDE...",
        })) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () => {
      finish();
    });
    expect(await screen.findByText("Script genere")).toBeTruthy();
    expect(router.state.location.pathname).toBe(url.pathname);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scriptText: "Nouveau script synthétique",
    });
    fireEvent.click(screen.getByRole("button", { name: "ANNULER" }));
    expect(
      screen.getAllByText("Nouveau script synthétique").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Script sauvegarde")).toBeNull();
  });
  it("shows returned gates separately from stored verdicts without changing approval evidence", async () => {
    const prod = production({ gateResults: [gates[2]] });
    await show({ production: prod }, async () =>
      data({ ok: true, result: { canPublish: true, gates: [gates[0]] } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Gates" }));
    expect(screen.getByText("FAIL")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "GATES" }));
    expect(await screen.findByText("PUBLISHABLE")).toBeTruthy();
    expect(screen.getByText("PASS")).toBeTruthy();
    expect(screen.queryByText("FAIL")).toBeNull();
    expect(prod.gateResults).toEqual([gates[2]]);
    expect(prod.approvalRecord).toBeNull();
  });
  it("shows fresh audio without a cache claim and defaults a missing estimated script duration", async () => {
    await show(
      {
        production: production({
          scriptText: "Script",
          masterAudioUrl: "/synthetic/audio.wav",
          ttsVoice: "synthetic-voice",
        }),
      },
      async ({ request }) => {
        const form = await request.formData();
        return data({
          ok: true,
          data:
            form.get("_intent") === "generate-audio"
              ? { durationSecs: 10, cached: false }
              : { claimCount: 1 },
        });
      },
    );
    expect(screen.getByText(/Voix: synthetic-voice/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RE-TTS" }));
    expect(await screen.findByText("Audio: 10.0s")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "RE-SCR" }));
    expect(await screen.findByText("Script: 1 claims, ~0min")).toBeTruthy();
  });
});
