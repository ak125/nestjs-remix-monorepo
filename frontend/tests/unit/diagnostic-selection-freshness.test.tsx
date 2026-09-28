import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagnosticVehicleSelector } from "~/components/diagnostic-wizard/hooks/use-diagnostic-vehicle-selector";
import { StepSymptom } from "~/components/diagnostic-wizard/steps/StepSymptom";
import  { type WizardState } from "~/components/diagnostic-wizard/types";
import { enhancedVehicleApi } from "~/services/api/enhanced-vehicle.api";

vi.mock("~/services/api/enhanced-vehicle.api", () => ({
  enhancedVehicleApi: { getBrands: vi.fn(), getModels: vi.fn() },
}));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const response = (data: unknown, ok = true) =>
  ({ ok, json: async () => data }) as Response;
const systemList = [
  { slug: "freinage", label: "Freinage", description: null },
  { slug: "moteur", label: "Moteur", description: "Moteur" },
];
const symptom = (slug: string) => ({
  slug,
  label: slug,
  description: null,
  urgency: "moyenne",
});
const base: WizardState = {
  step: 2,
  vehicle: { brand: "", model: "" },
  systemScope: "freinage",
  symptomSlugs: [],
  result: null,
  loading: false,
  error: null,
};
beforeEach(() => {
  vi.mocked(enhancedVehicleApi.getBrands).mockResolvedValue([]);
  vi.mocked(enhancedVehicleApi.getModels).mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("diagnostic model requests follow the current selection", () => {
  it.each(["resolve", "reject"] as const)(
    "ignores an old model request that later %s",
    async (outcome) => {
      const old = deferred<never>();
      const current = deferred<never>();
      vi.mocked(enhancedVehicleApi.getModels)
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(current.promise);
      const { result } = renderHook(() => useDiagnosticVehicleSelector());
      act(() => result.current.fetchModels(1));
      act(() => result.current.fetchModels(2));
      await act(async () =>
        current.resolve([{ modele_id: 22, modele_name: "Actuel" }] as never),
      );
      expect(result.current.models).toEqual([{ value: "22", label: "Actuel" }]);
      await act(async () => {
        if (outcome === "resolve")
          old.resolve([{ modele_id: 11, modele_name: "Ancien" }] as never);
        else old.reject(new Error("old request failed"));
      });
      expect(result.current.models).toEqual([{ value: "22", label: "Actuel" }]);
      expect(result.current.loadingModels).toBe(false);
    },
  );
  it("keeps the latest request loading when an older one finishes first", async () => {
    const old = deferred<never>();
    const current = deferred<never>();
    vi.mocked(enhancedVehicleApi.getModels)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    const { result } = renderHook(() => useDiagnosticVehicleSelector());
    act(() => {
      result.current.fetchModels(1);
      result.current.fetchModels(2);
    });
    await act(async () =>
      old.resolve([{ modele_id: 11, modele_name: "Ancien" }] as never),
    );
    expect(result.current.models).toEqual([]);
    expect(result.current.loadingModels).toBe(true);
    await act(async () => current.resolve([] as never));
    expect(result.current.loadingModels).toBe(false);
  });
  it("invalidates a pending request when the brand is cleared", async () => {
    const pending = deferred<never>();
    vi.mocked(enhancedVehicleApi.getModels).mockReturnValue(pending.promise);
    const { result } = renderHook(() => useDiagnosticVehicleSelector());
    act(() => result.current.fetchModels(1));
    act(() => result.current.clearModels());
    expect(result.current.loadingModels).toBe(false);
    await act(async () =>
      pending.resolve([{ modele_id: 11, modele_name: "Ancien" }] as never),
    );
    expect(result.current.models).toEqual([]);
  });
  it("distinguishes successive requests even when a brand is selected again", async () => {
    const first = deferred<never>();
    const second = deferred<never>();
    const third = deferred<never>();
    vi.mocked(enhancedVehicleApi.getModels)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise);
    const { result } = renderHook(() => useDiagnosticVehicleSelector());
    act(() => {
      result.current.fetchModels(1);
      result.current.fetchModels(2);
      result.current.fetchModels(1);
    });
    await act(async () =>
      third.resolve([{ modele_id: 13, modele_name: "Dernier" }] as never),
    );
    await act(async () => {
      first.resolve([] as never);
      second.resolve([] as never);
    });
    expect(result.current.models).toEqual([{ value: "13", label: "Dernier" }]);
  });
});

describe("diagnostic symptoms belong to the current system", () => {
  it.each(["resolve", "reject"] as const)(
    "ignores a previous system response that later %s",
    async (outcome) => {
      const old = deferred<Response>();
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (url.endsWith("/systems"))
            return Promise.resolve(
              response({ success: true, systems: systemList }),
            );
          if (url.endsWith("system=freinage")) return old.promise;
          return Promise.resolve(
            response({ success: true, symptoms: [symptom("Moteur actuel")] }),
          );
        }),
      );
      const props = {
        state: base,
        dispatch: vi.fn(),
        onAvailabilityChange: vi.fn(),
      };
      const { rerender } = render(<StepSymptom {...props} />);
      await screen.findByRole("radio", { name: /Moteur/ });
      rerender(
        <StepSymptom {...props} state={{ ...base, systemScope: "moteur" }} />,
      );
      await screen.findByRole("checkbox", { name: /Moteur actuel/ });
      await act(async () => {
        if (outcome === "resolve")
          old.resolve(
            response({ success: true, symptoms: [symptom("Frein ancien")] }),
          );
        else old.reject(new Error("old request failed"));
      });
      expect(
        screen.queryByRole("checkbox", { name: /Moteur actuel/ }),
      ).not.toBeNull();
      expect(
        screen.queryByRole("checkbox", { name: /Frein ancien/ }),
      ).toBeNull();
      expect(
        screen.queryByText(
          "Impossible de charger les symptômes pour ce système.",
        ),
      ).toBeNull();
    },
  );
  it("does not expose old symptoms while the new list is pending", async () => {
    const old = deferred<Response>();
    const current = deferred<Response>();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("/systems")
          ? Promise.resolve(response({ success: true, systems: systemList }))
          : url.endsWith("system=freinage")
            ? old.promise
            : current.promise,
      ),
    );
    const props = {
      state: base,
      dispatch: vi.fn(),
      onAvailabilityChange: vi.fn(),
    };
    const { rerender } = render(<StepSymptom {...props} />);
    rerender(
      <StepSymptom {...props} state={{ ...base, systemScope: "moteur" }} />,
    );
    await act(async () =>
      old.resolve(
        response({ success: true, symptoms: [symptom("Frein ancien")] }),
      ),
    );
    expect(screen.queryByRole("checkbox", { name: /Frein ancien/ })).toBeNull();
    await act(async () =>
      current.resolve(response({ success: true, symptoms: [] })),
    );
  });
  it.each([
    { data: { success: true, symptoms: [symptom("noise")] }, ok: false },
    {
      data: { success: true, symptoms: [symptom("noise"), symptom("noise")] },
      ok: true,
    },
    {
      data: {
        success: true,
        symptoms: [{ ...symptom("noise"), urgency: "unknown" }],
      },
      ok: true,
    },
    {
      data: { success: true, symptoms: [{ ...symptom("noise"), slug: "" }] },
      ok: true,
    },
  ])(
    "rejects unavailable or malformed symptom catalogs: %j",
    async ({ data, ok }) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) =>
          url.endsWith("/systems")
            ? response({ success: true, systems: systemList })
            : response(data, ok),
        ),
      );
      render(<StepSymptom state={base} dispatch={vi.fn()} />);
      expect(
        await screen.findByText(
          "Impossible de charger les symptômes pour ce système.",
        ),
      ).not.toBeNull();
      expect(screen.queryByRole("checkbox")).toBeNull();
    },
  );
  it("rejects HTTP failure of the system catalog even with a plausible JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/systems")
          ? response({ success: true, systems: systemList }, false)
          : response({ success: true, symptoms: [] }),
      ),
    );
    render(<StepSymptom state={base} dispatch={vi.fn()} />);
    expect(
      await screen.findByText(
        "Impossible de charger les systèmes disponibles.",
      ),
    ).not.toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
  });
  it("accepts nullable descriptions from the real API contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/systems")
          ? response({ success: true, systems: systemList })
          : response({ success: true, symptoms: [symptom("noise")] }),
      ),
    );
    render(<StepSymptom state={base} dispatch={vi.fn()} />);
    expect(
      await screen.findByRole("checkbox", { name: /noise/ }),
    ).not.toBeNull();
  });
});
