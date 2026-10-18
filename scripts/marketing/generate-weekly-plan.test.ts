const plan = {
  status: "draft",
  plan_json: [],
  priority_gammes: [],
};
const gamme = {
  pg_id: 402,
  pg_alias: "plaquette-frein",
  pg_name: "Plaquettes de frein",
  reason: "manual",
};
const mockGenerate = jest.fn();
const mockResolve = jest.fn();
const mockClose = jest.fn();
const app = {
  get: (token: { name: string }) =>
    token.name === "WeeklyPlanGeneratorService"
      ? { generatePlan: mockGenerate }
      : { resolveGammeAlias: mockResolve },
  close: mockClose,
};
const mockBootstrap = jest.fn();
const mockLoadApplication = jest.fn();
jest.mock("@nestjs/core", () => ({
  NestFactory: { createApplicationContext: mockBootstrap },
}));
jest.mock("../../backend/src/app.module", () => {
  mockLoadApplication();
  return { AppModule: class {} };
});
import { main } from "./generate-weekly-plan";

beforeEach(() => {
  jest.clearAllMocks();
  mockBootstrap.mockReset().mockResolvedValue(app);
  mockGenerate.mockReset().mockResolvedValue(plan);
  mockResolve.mockReset().mockResolvedValue(gamme);
  mockClose.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it.each(
  [
    [],
    ["--week"],
    ["--week", "2026-W00"],
    ["--week", "2026-W54"],
    ["--week", "2021-W53"],
    ["--week", "2026-W42", "--gammes"],
    ["--week", "2026-W42", "--gammes", ""],
    ["--week", "2026-W42", "--gammes", "a,,b"],
    ["--week", "2026-W42", "--gammes", "  "],
    ["--week", "2026-W42", "--gammess", "a"],
    ["--week", "2026-W42", "extra"],
    ["--week", "2026-W42", "--week", "2026-W43"],
    ["--week", "2026-W42", "--gammes", "a", "--gammes", "b"],
  ].map((args) => [args]),
)("rejects %j before loading the application", async (args) => {
  await expect(main(args)).rejects.toThrow();
  expect(mockLoadApplication).not.toHaveBeenCalled();
  expect(mockBootstrap).not.toHaveBeenCalled();
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockGenerate).not.toHaveBeenCalled();
});

it("passes the catalogue identity to the planner instead of the alias position", async () => {
  await main(["--week", "2026-W42", "--gammes", "plaquette-frein"]);
  expect(mockGenerate).toHaveBeenCalledWith({
    week_iso: "2026-W42",
    priority_gammes: [
      {
        pg_id: 402,
        pg_alias: "plaquette-frein",
        pg_name: "Plaquettes de frein",
        reason: "manual",
      },
    ],
  });
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it("normalizes aliases and keeps catalogue order with a valid week 53", async () => {
  const second = { ...gamme, pg_id: 911, pg_alias: "disque-frein" };
  mockResolve.mockResolvedValueOnce(gamme).mockResolvedValueOnce(second);
  await main([
    "--week=2020-W53",
    "--gammes= plaquette-frein ,disque-frein,plaquette-frein",
  ]);
  expect(mockResolve.mock.calls).toEqual([
    ["plaquette-frein"],
    ["disque-frein"],
  ]);
  expect(mockGenerate).toHaveBeenCalledWith({
    week_iso: "2020-W53",
    priority_gammes: [gamme, second],
  });
});

it("retains automatic selection when no alias is requested", async () => {
  await main(["--week", "2026-W42"]);
  expect(mockResolve).not.toHaveBeenCalled();
  expect(mockGenerate).toHaveBeenCalledWith({
    week_iso: "2026-W42",
    priority_gammes: undefined,
  });
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it("rejects an unknown member of the selection before generation and closes the context", async () => {
  mockResolve.mockResolvedValueOnce(gamme).mockResolvedValueOnce(null);
  await expect(
    main(["--week", "2026-W42", "--gammes", "plaquette-frein,unknown"]),
  ).rejects.toThrow("Unknown gamme alias");
  expect(mockGenerate).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it("preserves catalogue failures and closes the context", async () => {
  const error = new Error("catalogue unavailable");
  mockResolve.mockRejectedValue(error);
  await expect(
    main(["--week", "2026-W42", "--gammes", "plaquette-frein"]),
  ).rejects.toBe(error);
  expect(mockGenerate).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it("preserves planning failures and closes the context", async () => {
  const error = new Error("plan write rejected");
  mockGenerate.mockRejectedValue(error);
  await expect(main(["--week", "2026-W42"])).rejects.toBe(error);
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it("rejects an unconfirmed plan without bypassing context cleanup", async () => {
  mockGenerate.mockResolvedValue(null);
  await expect(main(["--week", "2026-W42"])).rejects.toThrow(
    "Failed to generate plan",
  );
  expect(mockClose).toHaveBeenCalledTimes(1);
});

it("surfaces bootstrap failure without generating", async () => {
  const error = new Error("bootstrap failed");
  mockBootstrap.mockRejectedValue(error);
  await expect(main(["--week", "2026-W42"])).rejects.toBe(error);
  expect(mockBootstrap).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ abortOnError: false }),
  );
  expect(mockGenerate).not.toHaveBeenCalled();
  expect(mockClose).not.toHaveBeenCalled();
});
