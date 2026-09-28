import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  StepMaintenance,
  type MaintenanceRecord,
} from "~/components/diagnostic-wizard/steps/StepMaintenance";

const operations = [
  { slug: "oil", label: "Vidange", description: "Huile moteur" },
  { slug: "brakes", label: "Freins", description: null },
];
const response = (items = operations) =>
  new Response(JSON.stringify({ success: true, operations: items }), {
    status: 200,
  });

function Harness({ initial = [] }: { initial?: MaintenanceRecord[] }) {
  const [records, setRecords] = useState(initial);
  const [ready, setReady] = useState(false);
  return (
    <>
      <StepMaintenance
        records={records}
        onChange={setRecords}
        onAvailabilityChange={setReady}
      />
      <output aria-label="Historique transmis">
        {JSON.stringify(records)}
      </output>
      <output aria-label="Disponibilité">{ready ? "prêt" : "bloqué"}</output>
    </>
  );
}
const saved = () =>
  JSON.parse(screen.getByLabelText("Historique transmis").textContent!);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StepMaintenance", () => {
  it("ignores a response arriving after unmount even if fetch ignores abort", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const availability = vi.fn();
    const { unmount } = render(
      <StepMaintenance
        records={[]}
        onChange={vi.fn()}
        onAvailabilityChange={availability}
      />,
    );
    unmount();
    await act(async () => {
      resolve(response());
    });
    expect(availability.mock.calls).toEqual([[false]]);
  });

  it("keeps loading blocked until a valid list arrives and aborts on unmount", async () => {
    let resolve!: (value: Response) => void;
    const fetchMock = vi.fn(
      (_url: string, _init?: RequestInit) =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { unmount } = render(<Harness />);
    expect(screen.getByText(/Chargement des opérations/)).toBeTruthy();
    expect(screen.getByLabelText("Disponibilité").textContent).toBe("bloqué");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/diagnostic-engine/maintenance-operations",
    );
    await act(async () => {
      resolve(response());
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Disponibilité").textContent).toBe("prêt"),
    );
    const signal = fetchMock.mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("shows an error and retries without discarding existing history", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce(response()),
    );
    render(
      <Harness initial={[{ operation_slug: "oil", last_service_km: 0 }]} />,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByLabelText("Disponibilité").textContent).toBe("bloqué");
    expect(saved()).toEqual([{ operation_slug: "oil", last_service_km: 0 }]);
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await screen.findByRole("checkbox", { name: "Vidange" });
    await waitFor(() =>
      expect(screen.getByLabelText("Disponibilité").textContent).toBe("prêt"),
    );
    expect(saved()).toEqual([{ operation_slug: "oil", last_service_km: 0 }]);
  });

  it.each(["HTTP", "malformed"])(
    "rejects %s responses instead of declaring readiness",
    async (kind) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          kind === "HTTP"
            ? new Response(null, { status: 503 })
            : new Response(
                JSON.stringify({
                  success: true,
                  operations: [{ slug: "oil" }],
                }),
              ),
        ),
      );
      render(<Harness />);
      expect(await screen.findByRole("alert")).toBeTruthy();
      expect(screen.getByLabelText("Disponibilité").textContent).toBe("bloqué");
    },
  );

  it("distinguishes a valid empty list and allows retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([])));
    render(<Harness />);
    expect(await screen.findByText(/Aucune opération disponible/)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Réessayer" })).toBeTruthy();
    expect(screen.getByLabelText("Disponibilité").textContent).toBe("bloqué");
  });

  it("starts with unknown history, preserves zero and dates, and clears inputs to undefined", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    render(<Harness />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Vidange" }));
    expect(saved()).toEqual([{ operation_slug: "oil" }]);
    expect(screen.getByText(/Historique inconnu/)).toBeTruthy();
    const km = screen.getByLabelText(
      "Kilométrage du dernier entretien — Vidange",
    );
    const date = screen.getByLabelText("Date du dernier entretien — Vidange");
    expect(date.getAttribute("max")).toBe(
      new Date().toISOString().slice(0, 10),
    );
    fireEvent.change(km, { target: { value: "0" } });
    fireEvent.change(date, { target: { value: "2025-04-12" } });
    expect(saved()).toEqual([
      {
        operation_slug: "oil",
        last_service_km: 0,
        last_service_date: "2025-04-12",
      },
    ]);
    fireEvent.change(km, { target: { value: "" } });
    fireEvent.change(date, { target: { value: "" } });
    expect(saved()).toEqual([{ operation_slug: "oil" }]);
  });

  it("isolates two operation histories and removes only the deselected operation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    render(<Harness />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Vidange" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Freins" }));
    fireEvent.change(
      screen.getByLabelText("Kilométrage du dernier entretien — Vidange"),
      { target: { value: "10000" } },
    );
    fireEvent.change(
      screen.getByLabelText("Kilométrage du dernier entretien — Freins"),
      { target: { value: "20000" } },
    );
    expect(saved()).toEqual([
      { operation_slug: "oil", last_service_km: 10000 },
      { operation_slug: "brakes", last_service_km: 20000 },
    ]);
    fireEvent.click(screen.getByRole("checkbox", { name: "Vidange" }));
    expect(saved()).toEqual([
      { operation_slug: "brakes", last_service_km: 20000 },
    ]);
  });

  it("blocks obsolete operations while preserving their history until explicit removal", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response()));
    render(
      <Harness
        initial={[{ operation_slug: "old-operation", last_service_km: 42000 }]}
      />,
    );
    await screen.findByRole("checkbox", { name: "Vidange" });
    expect(
      screen.getByText(/Opération indisponible : old-operation/),
    ).toBeTruthy();
    expect(screen.getByLabelText("Disponibilité").textContent).toBe("bloqué");
    expect(saved()).toEqual([
      { operation_slug: "old-operation", last_service_km: 42000 },
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Retirer old-operation" }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Disponibilité").textContent).toBe("prêt"),
    );
    expect(saved()).toEqual([]);
  });
});
