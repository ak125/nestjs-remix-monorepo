import { afterEach, describe, expect, it, vi } from "vitest";
import { action } from "~/routes/admin.video-hub.executions.$executionLogId";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createRoutesStub, data, useLoaderData } from "react-router";
import {
  RenderReviewPanel,
  type RenderReview,
} from "~/components/video/RenderReviewPanel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const run = (extra: Record<string, string> = {}) =>
  action({
    params: { executionLogId: "12" },
    context: {},
    request: new Request("http://127.0.0.1/admin/video-hub/executions/12", {
      method: "POST",
      headers: { Cookie: "session=local" },
      body: new URLSearchParams({
        _intent: "render-review",
        action: "add",
        expectedReviewRevision: "0",
        expectedRenderHash: "a".repeat(64),
        expectedProductionVersion: "2026-10-14T10:00:00Z",
        startFrame: "30",
        endFrame: "90",
        target: "CTA",
        preserve: "Logo",
        request: "Lire plus longtemps",
        ...extra,
      }),
    }),
  } as never);
describe("execution review action", () => {
  it("sends a pinned render, version and frame interval with the session", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: {} })),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await run()).toMatchObject({ data: { ok: true } });
    expect(fetch.mock.calls[0][0]).toContain("/executions/12/review");
    const init = fetch.mock.calls[0][1];
    expect(init.headers.Cookie).toBe("session=local");
    expect(JSON.parse(init.body)).toMatchObject({
      expectedReviewRevision: 0,
      startFrame: 30,
      endFrame: 90,
      expectedRenderHash: "a".repeat(64),
    });
    expect(JSON.parse(init.body)).not.toHaveProperty("authorId");
  });
  it("preserves conflict status and tells the user how to recover", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Conflict" }), {
          status: 409,
        }),
      ),
    );
    expect(await run()).toMatchObject({
      data: { ok: false, error: expect.stringMatching(/conserv|recharg/i) },
      init: { status: 409 },
    });
  });
  it("does not convert a missing frame into zero", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await run({ startFrame: "" })).toMatchObject({
      data: { ok: false },
      init: { status: 400 },
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("persistent review editor", () => {
  it.each([
    "current",
    "unavailable",
    "different-render",
    "different-execution",
    "different-version",
    "different-timing",
  ])(
    "recovers from an actual 409 without discarding the draft (%s)",
    async (reloadOutcome) => {
      let review: RenderReview = {
        binding: {
          executionLogId: 12,
          renderHash: "a".repeat(64),
          productionVersion: "2026-10-14T10:00:00Z",
          fps: 30,
          totalFrames: 1140,
        },
        revision: 0,
        comments: [],
      };
      let loads = 0;
      let unavailable = reloadOutcome === "unavailable";
      const submissions: FormData[] = [];
      const Stub = createRoutesStub([
        {
          path: "/",
          HydrateFallback: () => null,
          loader: () => {
            loads++;
            return {
              review: unavailable && loads > 1 ? null : review,
              error: "Revue indisponible.",
            };
          },
          Component: () => (
            <RenderReviewPanel
              {...(useLoaderData() as {
                review: RenderReview | null;
                error: string;
              })}
            />
          ),
          action: async ({ request }) => {
            submissions.push(await request.formData());
            if (submissions.length === 1) {
              review = {
                ...review,
                revision: 1,
                comments: [
                  {
                    id: "remote-comment",
                    authorId: "other-reviewer",
                    createdAt: "2026-10-14T11:00:00Z",
                    status: "open",
                    startFrame: 990,
                    endFrame: 1140,
                    target: "CTA concurrent",
                    preserve: "Essieu",
                    request: "Demande distante à comparer",
                  },
                ],
                binding: {
                  ...review.binding,
                  ...(reloadOutcome === "different-render"
                    ? { renderHash: "b".repeat(64) }
                    : {}),
                  ...(reloadOutcome === "different-execution"
                    ? { executionLogId: 13 }
                    : {}),
                  ...(reloadOutcome === "different-version"
                    ? { productionVersion: "2026-10-14T11:00:00Z" }
                    : {}),
                  ...(reloadOutcome === "different-timing"
                    ? { fps: 25, totalFrames: 950 }
                    : {}),
                },
              };
              return data(
                { ok: false, error: "Conflit : texte conservé." },
                { status: 409 },
              );
            }
            return data({ ok: true });
          },
        },
      ]);
      render(<Stub initialEntries={["/"]} />);
      fireEvent.click(
        await screen.findByRole("button", { name: "Ajouter un commentaire" }),
      );
      for (const [label, value] of Object.entries({
        "Début (frame)": "990",
        "Fin exclue (frame)": "1140",
        Cible: "CTA Fafa",
        "Éléments à préserver": "Véhicule puis essieu",
        "Changement demandé": "Conserver la lisibilité du CTA",
      }))
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
      fireEvent.click(
        screen.getByRole("button", { name: "Enregistrer le commentaire" }),
      );
      await screen.findByRole("alert");
      // Real error responses do not automatically revalidate loaders.
      expect(loads).toBe(1);
      fireEvent.click(
        screen.getByRole("button", {
          name: "Actualiser la revue sans effacer la saisie",
        }),
      );
      await waitFor(() => expect(loads).toBe(2));
      expect(
        (screen.getByLabelText("Changement demandé") as HTMLTextAreaElement)
          .value,
      ).toBe("Conserver la lisibilité du CTA");
      if (reloadOutcome !== "current") {
        await waitFor(() =>
          expect(
            (
              screen.getByRole("button", {
                name: "Enregistrer le commentaire",
              }) as HTMLButtonElement
            ).disabled,
          ).toBe(true),
        );
        expect(
          screen.queryByRole("button", {
            name: "Utiliser cette révision en conservant ma saisie",
          }),
        ).toBeNull();
        expect(submissions).toHaveLength(1);
        if (reloadOutcome !== "unavailable") return;
        unavailable = false;
        fireEvent.click(
          screen.getByRole("button", {
            name: "Actualiser la revue sans effacer la saisie",
          }),
        );
        await waitFor(() => expect(loads).toBe(3));
      }
      expect(
        await screen.findByText("Demande : Demande distante à comparer"),
      ).toBeTruthy();
      fireEvent.click(
        await screen.findByRole("button", {
          name: "Utiliser cette révision en conservant ma saisie",
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Enregistrer le commentaire" }),
      );
      await waitFor(() => expect(submissions).toHaveLength(2));
      expect(Object.fromEntries(submissions[1])).toMatchObject({
        expectedReviewRevision: "1",
        expectedRenderHash: "a".repeat(64),
        startFrame: "990",
        endFrame: "1140",
        target: "CTA Fafa",
        preserve: "Véhicule puis essieu",
        request: "Conserver la lisibilité du CTA",
      });
      await waitFor(() =>
        expect(screen.queryByLabelText("Changement demandé")).toBeNull(),
      );
      // A previous success must not close a later draft during a read refresh.
      fireEvent.click(
        screen.getByRole("button", { name: "Ajouter un commentaire" }),
      );
      fireEvent.change(screen.getByLabelText("Changement demandé"), {
        target: { value: "Deuxième brouillon" },
      });
      const previousLoads = loads;
      fireEvent.click(
        screen.getByRole("button", {
          name: "Actualiser la revue sans effacer la saisie",
        }),
      );
      await waitFor(() => expect(loads).toBe(previousLoads + 1));
      expect(
        (screen.getByLabelText("Changement demandé") as HTMLTextAreaElement)
          .value,
      ).toBe("Deuxième brouillon");
    },
  );

  it("pins an open draft through conflict revalidation, then deliberately reconciles", async () => {
    let review: RenderReview = {
      binding: {
        executionLogId: 12,
        renderHash: "a".repeat(64),
        productionVersion: "2026-10-14T10:00:00Z",
        fps: 30,
        totalFrames: 1140,
      },
      revision: 0,
      comments: [],
    };
    const submissions: FormData[] = [];
    const Stub = createRoutesStub([
      {
        path: "/",
        loader: () => review,
        HydrateFallback: () => null,
        Component: () => (
          <RenderReviewPanel review={useLoaderData() as RenderReview} />
        ),
        action: async ({ request }) => {
          submissions.push(await request.formData());
          review = { ...review, revision: review.revision + 1 };
          return submissions.length === 1
            ? { ok: false, error: "Conflit : texte conservé." }
            : { ok: true };
        },
      },
    ]);
    render(<Stub initialEntries={["/"]} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Ajouter un commentaire" }),
    );
    fireEvent.change(screen.getByLabelText("Début (frame)"), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByLabelText("Fin exclue (frame)"), {
      target: { value: "990" },
    });
    fireEvent.change(screen.getByLabelText("Cible"), {
      target: { value: "CTA" },
    });
    fireEvent.change(screen.getByLabelText("Changement demandé"), {
      target: { value: "Conserver ma correction" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le commentaire" }),
    );
    await screen.findByRole("alert");
    expect(
      (screen.getByLabelText("Changement demandé") as HTMLTextAreaElement)
        .value,
    ).toBe("Conserver ma correction");
    expect(
      document.querySelector<HTMLInputElement>(
        'input[name="expectedReviewRevision"]',
      )?.value,
    ).toBe("0");
    fireEvent.click(screen.getByRole("button", { name: "Annuler la saisie" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Ajouter un commentaire" }),
    );
    expect(
      document.querySelector<HTMLInputElement>(
        'input[name="expectedReviewRevision"]',
      )?.value,
    ).toBe("1");
    fireEvent.change(screen.getByLabelText("Début (frame)"), {
      target: { value: "900" },
    });
    fireEvent.change(screen.getByLabelText("Fin exclue (frame)"), {
      target: { value: "990" },
    });
    fireEvent.change(screen.getByLabelText("Cible"), {
      target: { value: "CTA" },
    });
    fireEvent.change(screen.getByLabelText("Changement demandé"), {
      target: { value: "Correction réconciliée" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enregistrer le commentaire" }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText("Changement demandé")).toBeNull(),
    );
    expect(submissions[1].get("expectedReviewRevision")).toBe("1");
  });
});
