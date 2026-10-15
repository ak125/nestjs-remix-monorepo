import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicationPreparationPanel } from "~/components/admin/marketing/PublicationPreparationPanel";

const target = {
  post_id: 7,
  channel: "facebook",
  content_revision: 2,
  review_version: 3,
};
const onReload = vi.fn();
const record = (body: any) => ({
  ...body,
  post_id: 7,
  actor: "admin-42",
  created_at: "2026-10-14T10:00:00Z",
  editorial_snapshot: {
    channels: {
      facebook: { caption: "Ancien texte conservé", format: "post" },
    },
  },
  approval_snapshot: {
    state: "approved",
    content_revision: 2,
    actor: "reviewer-42",
    decided_at: "2026-10-14T09:00:00Z",
  },
});
function success(_url: unknown, init: RequestInit) {
  return Promise.resolve(
    new Response(
      JSON.stringify({
        preparation: record(JSON.parse(String(init.body))),
        publication: {
          ready: false,
          blockers: ["publication_approval_missing"],
        },
      }),
      { status: 201 },
    ),
  );
}
function mount(canPrepare = true) {
  return render(
    <PublicationPreparationPanel
      target={target}
      canPrepare={canPrepare}
      onReload={onReload}
    />,
  );
}
async function confirm() {
  fireEvent.change(screen.getByLabelText("Nom du compte"), {
    target: { value: "Compte de test" },
  });
  fireEvent.change(
    screen.getByLabelText("Identifiant du compte sur facebook"),
    { target: { value: "fixture-page" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Relire la préparation" }),
  );
  await screen.findByRole("button", { name: "Confirmer l’enregistrement" });
}
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  onReload.mockReset();
});

describe("publication preparation form", () => {
  it("exports a selected saved preparation only after a successful server recheck", async () => {
    const createUrl = vi.fn().mockReturnValue("blob:fixture-export");
    vi.stubGlobal(
      "URL",
      class extends URL {
        static createObjectURL = createUrl;
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    let prepared: any;
    const fetchMock = vi.fn(async (_url, init) => {
      if (init.method === "POST") {
        prepared = record(JSON.parse(init.body));
        return success(_url, init);
      }
      return new Response(
        JSON.stringify({
          schema_version: 1,
          purpose: "bound_publication_preparation",
          export_id: `preparation:${prepared.request_id}`,
          preparation: prepared,
          editorial: {
            post_id: 7,
            content_revision: 2,
            content_sha256: "b".repeat(64),
            content_snapshot: { channel: "facebook" },
          },
          publication: {
            ready: false,
            blockers: ["publication_approval_missing"],
          },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await confirm();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByText(/Préparation enregistrée/);
    fireEvent.click(
      screen.getByRole("button", { name: "Exporter cette préparation (JSON)" }),
    );
    await screen.findByText(/Téléchargement préparé/);
    expect(fetchMock.mock.calls[1][0]).toBe(
      `/api/admin/marketing/social/posts/7/preparations/${prepared.request_id}/export`,
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
      `preparation_${prepared.request_id}.json`,
    );
  });
  it.each([409, 403, 503])(
    "does not download a refused export (%s)",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url, init) =>
          init.method === "POST"
            ? success(_url, init)
            : new Response("{}", { status }),
        ),
      );
      const click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {});
      mount();
      await confirm();
      fireEvent.click(
        screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
      );
      await screen.findByText(/Préparation enregistrée/);
      fireEvent.click(
        screen.getByRole("button", {
          name: "Exporter cette préparation (JSON)",
        }),
      );
      await screen.findByText(/Export refusé|Export indisponible/);
      expect(click).not.toHaveBeenCalled();
    },
  );
  it("refuses an export whose binding differs from the selected preparation", async () => {
    let prepared: any;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        if (init.method === "POST") {
          prepared = record(JSON.parse(init.body));
          return success(_url, init);
        }
        return new Response(
          JSON.stringify({
            schema_version: 1,
            purpose: "bound_publication_preparation",
            export_id: `preparation:${prepared.request_id}`,
            preparation: {
              ...prepared,
              account: { external_id: "other", label: "Wrong account" },
            },
            editorial: {
              post_id: 7,
              content_revision: 2,
              content_sha256: "b".repeat(64),
              content_snapshot: { channel: "facebook" },
            },
            publication: {
              ready: false,
              blockers: ["publication_approval_missing"],
            },
          }),
        );
      }),
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    mount();
    await confirm();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByText(/Préparation enregistrée/);
    fireEvent.click(
      screen.getByRole("button", { name: "Exporter cette préparation (JSON)" }),
    );
    await screen.findByText(/Export indisponible ou incohérent/);
    expect(click).not.toHaveBeenCalled();
  });
  it("discards a history response started before a confirmed save", async () => {
    let finishHistory!: (response: Response) => void;
    let historySignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        if (init.method === "POST") return success(_url, init);
        historySignal = init.signal;
        return new Promise<Response>((resolve) => {
          finishHistory = resolve;
        });
      }),
    );
    mount();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Charger les préparations précédentes",
      }),
    );
    await confirm();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByText(/Préparation enregistrée/);
    expect(historySignal?.aborted).toBe(true);
    await act(async () =>
      finishHistory(
        new Response(
          JSON.stringify({
            purpose: "preparation_history",
            publication_ready: false,
            data: [],
          }),
        ),
      ),
    );
    expect(screen.queryByText(/Aucune préparation/)).toBeNull();
  });
  it("requires approval and makes history available without a creation form", () => {
    mount(false);
    expect(screen.queryByLabelText("Nom du compte")).toBeNull();
    expect(screen.getByText(/Approuvez le contenu de ce réseau/)).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Charger les préparations précédentes",
      }),
    ).toBeTruthy();
  });
  it("confirms the account and exact target, then sends only the existing contract", async () => {
    const fetchMock = vi.fn(success);
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await confirm();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Post #7 · facebook · version 2/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByText(/Préparation enregistrée/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/admin/marketing/social/posts/7/preparations");
    expect(JSON.parse(String(init.body))).toEqual({
      request_id: expect.any(String),
      channel: "facebook",
      content_revision: 2,
      review_version: 3,
      account: { label: "Compte de test", external_id: "fixture-page" },
      media: [],
    });
    expect(screen.getByText(/Publication non autorisée/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Confirmer l’enregistrement" }),
    ).toBeNull();
  });
  it("keeps the same request after uncertain response and dialog remount", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("lost response"))
      .mockImplementation(success);
    vi.stubGlobal("fetch", fetchMock);
    const view = mount();
    await confirm();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByRole("button", { name: "Réessayer la même demande" });
    view.unmount();
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Réessayer la même demande" }),
    );
    await screen.findByText(/Préparation enregistrée/);
    expect(fetchMock.mock.calls[1][1].body).toBe(
      fetchMock.mock.calls[0][1].body,
    );
  });
  it("prevents duplicate clicks while a request is in flight", async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await confirm();
    const button = screen.getByRole("button", {
      name: "Confirmer l’enregistrement",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(await success("", fetchMock.mock.calls[0][1]));
    await screen.findByText(/Préparation enregistrée/);
  });
  it("blocks stale revisions and requests a fresh review without silently resubmitting", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await confirm();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByText(/Le contenu ou une décision a changé/);
    expect(
      screen.queryByRole("button", { name: "Réessayer la même demande" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Recharger le contenu" }),
    );
    expect(onReload).toHaveBeenCalledTimes(1);
  });
  it("does not claim success for a mismatched persisted target", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async (_url, init) =>
          new Response(
            JSON.stringify({
              preparation: {
                ...record(JSON.parse(init.body)),
                content_revision: 9,
              },
              publication: { ready: false },
            }),
            { status: 201 },
          ),
      ),
    );
    mount();
    await confirm();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByRole("button", { name: "Réessayer la même demande" });
    expect(screen.queryByText(/Préparation enregistrée/)).toBeNull();
  });
  it("never sends when the retry key cannot be retained", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mount();
    await confirm();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByText(/Impossible de conserver la demande/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("shows unavailable history separately from an empty history", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
    );
    mount();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Charger les préparations précédentes",
      }),
    );
    await screen.findByText(/Historique indisponible/);
    expect(screen.queryByText(/Aucune préparation/)).toBeNull();
  });
  it("reads historical content and account without treating old approval as current", async () => {
    const saved = record({
      request_id: crypto.randomUUID(),
      channel: "facebook",
      content_revision: 2,
      review_version: 3,
      account: { external_id: "old-page", label: "Ancien compte" },
      media: [],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            purpose: "preparation_history",
            publication_ready: false,
            data: [saved],
          }),
        ),
      ),
    );
    mount();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Charger les préparations précédentes",
      }),
    );
    await screen.findByText(/^Ancien compte · version/);
    expect(screen.getByText("Ancien texte conservé")).toBeTruthy();
    expect(screen.getByText(/Instantanés historiques/)).toBeTruthy();
  });
  it("requires complete media references and sends them after review", async () => {
    const fetchMock = vi.fn(success);
    vi.stubGlobal("fetch", fetchMock);
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter un média existant" }),
    );
    fireEvent.change(screen.getByLabelText("Espace de stockage · média 1"), {
      target: { value: "marketing-private" },
    });
    fireEvent.change(screen.getByLabelText("Chemin du fichier · média 1"), {
      target: { value: "approved/image.png" },
    });
    fireEvent.change(screen.getByLabelText("Empreinte SHA-256 · média 1"), {
      target: { value: "a".repeat(64) },
    });
    await confirm();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmer l’enregistrement" }),
    );
    await screen.findByText(/Préparation enregistrée/);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).media).toEqual([
      {
        bucket: "marketing-private",
        path: "approved/image.png",
        sha256: "a".repeat(64),
        role: "image",
      },
    ]);
  });
});
