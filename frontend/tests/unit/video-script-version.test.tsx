import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createRoutesStub, data, Link } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VideoProductionDetail, {
  action,
  loader,
} from "~/routes/admin.video-hub.productions.$briefId";

const version = "2026-10-14T10:00:00.000Z";
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const request = (fields: Record<string, string>) =>
  new Request("http://127.0.0.1/admin/video-hub/productions/local-pilot", {
    method: "POST",
    body: new URLSearchParams({
      _intent: "save-script",
      scriptText: "Correction locale",
      ...fields,
    }),
    headers: { Cookie: "session=local-test" },
  });
const run = (fields: Record<string, string>) =>
  action({
    request: request(fields),
    params: { briefId: "local-pilot" },
    context: {},
  } as never);

function navigationFixture(otherVersion = version) {
  const submitted: FormData[] = [];
  const Stub = createRoutesStub([{
    path: "/admin/video-hub/productions/:briefId",
    HydrateFallback: () => null,
    Component: () => <>
      <Link to="/admin/video-hub/productions/other-pilot">Autre production de test</Link>
      <VideoProductionDetail />
    </>,
    loader: ({ params }) => ({
      production: {
        briefId: params.briefId,
        videoType: "short", vertical: "test", status: "draft",
        updatedAt: params.briefId === "other-pilot" ? otherVersion : version,
        createdAt: version, contentRole: "standalone", createdBy: "local-reviewer",
        qualityScore: null, claimTable: [], evidencePack: [], qualityFlags: [],
        scriptText: params.briefId === "other-pilot" ? "Script autre production" : "Original",
      },
      executions: [], derivatives: [], error: null,
    }),
    action: async ({ request: incoming }) => {
      submitted.push(await incoming.formData());
      return data({ _intent: "save-script", ok: false, error: "Conflit de version" }, { status: 409 });
    },
  }]);
  render(<Stub initialEntries={["/admin/video-hub/productions/local-pilot"]} />);
  return submitted;
}

describe("Video Hub versioned script correction", () => {
  it.each(["same-version", "new-version", "locked"])("preserves a draft through a failed refresh and recovers safely (%s)", async (recovery) => {
    let available = true;
    let current = version;
    let status = "draft";
    const Stub = createRoutesStub([{
      path: "/admin/video-hub/productions/:briefId",
      Component: VideoProductionDetail,
      HydrateFallback: () => null,
      loader: () => ({
        production: available ? {
          briefId: "local-pilot", videoType: "short", vertical: "test", status,
          updatedAt: current, createdAt: version, contentRole: "standalone",
          createdBy: "local-reviewer", qualityScore: null, claimTable: [],
          evidencePack: [], qualityFlags: [], scriptText: "Script enregistré",
        } : null,
        executions: [], derivatives: [], error: available ? null : "Service temporairement indisponible",
      }),
    }]);
    render(<Stub initialEntries={["/admin/video-hub/productions/local-pilot"]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Script" }));
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Brouillon à préserver pendant la panne" } });
    available = false;
    fireEvent.click(screen.getByRole("button", { name: "Actualiser le script sans effacer mon brouillon" }));
    await screen.findByText("Service temporairement indisponible");
    const retained = screen.getByRole("textbox", { name: "Brouillon non enregistré" }) as HTMLTextAreaElement;
    expect(retained.value).toBe("Brouillon à préserver pendant la panne");
    expect(retained.readOnly).toBe(true);
    expect(screen.queryByRole("button", { name: "SAUVEGARDER" })).toBeNull();
    expect(screen.queryByRole("button", { name: "RENDER" })).toBeNull();
    available = true;
    if (recovery === "new-version") current = "2026-10-14T12:00:00.000Z";
    if (recovery === "locked") status = "approved";
    fireEvent.click(screen.getByRole("button", { name: "Réessayer le chargement" }));
    const save = await screen.findByRole("button", { name: "SAUVEGARDER" }) as HTMLButtonElement;
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Brouillon à préserver pendant la panne");
    expect(save.disabled).toBe(recovery !== "same-version");
    expect((screen.getByRole("textbox").closest("form")!.querySelector('input[name="expectedUpdatedAt"]') as HTMLInputElement).value).toBe(version);
    if (recovery === "new-version") {
      fireEvent.click(screen.getByRole("button", { name: "Utiliser cette version en conservant mon brouillon" }));
      expect(save.disabled).toBe(false);
    }
  });

  it("distinguishes an unavailable production from a missing one", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    const result = await loader({request: new Request("http://127.0.0.1/admin/video-hub/productions/local-pilot"), params: {briefId: "local-pilot"}, context: {}} as never);
    expect(result.data.error).toMatch(/indisponible/i);
  });

  it.each(["Claims", "Script"])("keeps the unsaved draft and pinned version after visiting %s", async (tab) => {
    const submitted = navigationFixture();
    fireEvent.click(await screen.findByRole("button", { name: "Script" }));
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Brouillon non enregistré" } });
    fireEvent.click(screen.getByRole("button", { name: tab }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "SAUVEGARDER" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Script" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Brouillon non enregistré");
    fireEvent.click(screen.getByRole("button", { name: "SAUVEGARDER" }));
    await waitFor(() => expect(submitted).toHaveLength(1));
    expect(submitted[0].get("expectedUpdatedAt")).toBe(version);
    expect(submitted[0].get("scriptText")).toBe("Brouillon non enregistré");
  });

  it.each([version, "2026-10-14T11:00:00.000Z"])("never carries an editor into a different production (version %s)", async (otherVersion) => {
    navigationFixture(otherVersion);
    fireEvent.click(await screen.findByRole("button", { name: "Script" }));
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Brouillon réservé au premier brief" } });
    fireEvent.click(screen.getByRole("link", { name: "Autre production de test" }));
    await screen.findAllByText("Script autre production");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Script autre production");
    expect((screen.getByRole("textbox").closest("form")!.querySelector('input[name="expectedUpdatedAt"]') as HTMLInputElement).value).toBe(otherVersion);
  });

  it.each(["generate-script", "generate-audio", "derive"])(
    "pins %s to the displayed production version",
    async (intent) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: {} })),
      );
      await run({ _intent: intent, expectedUpdatedAt: version });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
        expectedUpdatedAt: version,
      });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).voice).not.toBe(
        "onyx",
      );
    },
  );
  it.each(["generate-script", "generate-audio", "derive"])(
    "rejects unversioned %s before API work",
    async (intent) => {
      expect(await run({ _intent: intent })).toMatchObject({
        init: { status: 400 },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("passes the viewed revision with the script and session", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    const result = await run({ expectedUpdatedAt: version });
    expect(result).toMatchObject({ data: { ok: true } });
    expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe(
      "session=local-test",
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scriptText: "Correction locale",
      expectedUpdatedAt: version,
    });
  });
  it("rejects an unversioned form before contacting the API", async () => {
    expect(await run({})).toMatchObject({
      data: { ok: false },
      init: { status: 400 },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("retains the conflict status and explains recovery", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Script revision conflict" }), {
        status: 409,
      }),
    );
    expect(await run({ expectedUpdatedAt: version })).toMatchObject({
      data: { ok: false, error: expect.stringMatching(/version.*conserv/i) },
      init: { status: 409 },
    });
  });
  it("recovers from HTTP 409 by refreshing and explicitly adopting the version without losing the draft", async () => {
    let current = version;
    let currentText = "Original";
    const submitted: FormData[] = [];
    const Stub = createRoutesStub([
      {
        path: "/admin/video-hub/productions/:briefId",
        Component: VideoProductionDetail,
        HydrateFallback: () => null,
        loader: () => ({
          production: {
            briefId: "local-pilot",
            videoType: "short",
            vertical: "test",
            status: "draft",
            updatedAt: current,
            createdAt: version,
            contentRole: "standalone",
            createdBy: "local-reviewer",
            qualityScore: null,
            claimTable: [],
            evidencePack: [],
            qualityFlags: [],
            scriptText: currentText,
          },
          executions: [],
          derivatives: [],
          error: null,
        }),
        action: async ({ request: incoming }) => {
          submitted.push(await incoming.formData());
          if (submitted.length === 2) {
            currentText = String(submitted[1].get("scriptText"));
            current = "2026-10-14T10:02:00.000Z";
            return { _intent: "save-script", ok: true };
          }
          current = "2026-10-14T10:01:00.000Z";
          currentText = "Correction concurrente";
          return data({
            _intent: "save-script",
            ok: false,
            error: "Conflit de version : texte conservé.",
          }, { status: 409 });
        },
      },
    ]);
    render(
      <Stub initialEntries={["/admin/video-hub/productions/local-pilot"]} />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Script" }, { timeout: 5000 }),
    );
    expect(document.querySelector('input[name="voice"][value="onyx"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    expect(screen.queryByText(/L’audio et les contrôles qualité/)).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Mon texte à conserver" },
    });
    expect(screen.getByText(/L’audio et les contrôles qualité/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "SAUVEGARDER" }));
    await waitFor(() => expect(submitted).toHaveLength(1));
    await screen.findByText("Conflit de version : texte conservé.");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Mon texte à conserver",
    );
    expect(submitted[0].get("expectedUpdatedAt")).toBe(version);
    const hidden = screen
      .getByRole("textbox")
      .closest("form")!
      .querySelector('input[name="expectedUpdatedAt"]') as HTMLInputElement;
    expect(hidden.value).toBe(version);
    fireEvent.click(screen.getByRole("button", { name: "Actualiser le script sans effacer mon brouillon" }));
    await within(screen.getByRole("textbox").closest("form")!).findByText("Correction concurrente");
    expect(hidden.value).toBe(version);
    expect((screen.getByRole("button", { name: "SAUVEGARDER" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Mon texte à conserver",
    );
    fireEvent.click(screen.getByRole("button", { name: "Utiliser cette version en conservant mon brouillon" }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Correction réconciliée" },
    });
    fireEvent.click(screen.getByRole("button", { name: "SAUVEGARDER" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(submitted[1].get("expectedUpdatedAt")).toBe(
      "2026-10-14T10:01:00.000Z",
    );
    expect(
      screen.getAllByText("Correction réconciliée").length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "EDITER" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Nouveau brouillon" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualiser le script sans effacer mon brouillon" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "SAUVEGARDER" }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Nouveau brouillon");
  });
});
