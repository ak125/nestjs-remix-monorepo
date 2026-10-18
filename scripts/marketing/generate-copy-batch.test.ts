const plan = {
  status: "draft",
  plan_json: [{ day_of_week: 1 }],
  priority_gammes: [],
  calendar_rules: {},
};
const post = { id: 9, slot_label: "catalogue" };
const mockReadPlan = jest.fn();
const mockReadPosts = jest.fn();
const mockSave = jest.fn();
const mockGenerate = jest.fn();
const mockGate = jest.fn();
const mockClose = jest.fn();
const app = {
  get: (token: { name: string }) => {
    if (token.name === "MarketingHubDataService")
      return {
        getWeeklyPlan: mockReadPlan,
        getPostsByWeek: mockReadPosts,
        upsertWeeklyPlan: mockSave,
      };
    if (token.name === "MultiChannelCopywriterService")
      return { generateBatch: mockGenerate };
    if (token.name === "BrandComplianceGateService")
      return { evaluateAndPersist: mockGate };
    throw new Error("Unexpected service");
  },
  close: mockClose,
};
const mockBootstrap = jest.fn();
const mockLoadApplication = jest.fn();
const mockLoadServices = jest.fn();
jest.mock("@nestjs/core", () => ({
  NestFactory: { createApplicationContext: mockBootstrap },
}));
jest.mock("../../backend/src/app.module", () => {
  mockLoadApplication();
  return { AppModule: class {} };
});
jest.mock(
  "../../backend/src/modules/marketing/services/marketing-hub-data.service",
  () => {
    mockLoadServices("hub");
    return { MarketingHubDataService: class MarketingHubDataService {} };
  },
);
jest.mock(
  "../../backend/src/modules/marketing/services/multi-channel-copywriter.service",
  () => {
    mockLoadServices("copywriter");
    return {
      MultiChannelCopywriterService: class MultiChannelCopywriterService {},
    };
  },
);
jest.mock(
  "../../backend/src/modules/marketing/services/brand-compliance-gate.service",
  () => {
    mockLoadServices("gate");
    return { BrandComplianceGateService: class BrandComplianceGateService {} };
  },
);
import { main } from "./generate-copy-batch";
const importsTriggeredWork =
  mockLoadApplication.mock.calls.length +
  mockLoadServices.mock.calls.length +
  mockBootstrap.mock.calls.length;

beforeEach(() => {
  jest.clearAllMocks();
  mockBootstrap.mockReset().mockResolvedValue(app);
  mockReadPlan.mockReset().mockResolvedValue(plan);
  mockReadPosts.mockReset().mockResolvedValue([post]);
  mockSave.mockReset().mockResolvedValue({ id: 1 });
  mockGenerate.mockReset().mockResolvedValue({ generated: 1, errors: 0 });
  mockGate.mockReset().mockResolvedValue({
    brand: { level: "PASS" },
    compliance: { level: "PASS" },
    blocking_issues: [],
  });
  mockClose.mockReset().mockResolvedValue(undefined);
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

function expectNoBusinessAccess() {
  for (const mock of [
    mockLoadApplication,
    mockLoadServices,
    mockBootstrap,
    mockReadPlan,
    mockReadPosts,
    mockSave,
    mockGenerate,
    mockGate,
    mockClose,
  ]) {
    expect(mock).not.toHaveBeenCalled();
  }
}
it("importing the CLI has no application side effects", () => {
  expect(importsTriggeredWork).toBe(0);
});
it.each(["2026-W42", "2020-W53"])(
  "dry-run validates %s without business access",
  async (week) => {
    await main(["--week", week, "--dry-run"]);
    expectNoBusinessAccess();
    expect(console.log).toHaveBeenCalledWith(
      "Dry-run complete. Arguments validated only; no plan loaded, content generated, or data persisted.",
    );
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining("Plan loaded:"),
    );
  },
);
it.each(
  [
    [],
    ["--dry-run"],
    ["--week", "--dry-run"],
    ["--week", "2026-W00", "--dry-run"],
    ["--week", "2026-W54", "--dry-run"],
    ["--week", "2021-W53", "--dry-run"],
    ["--week", "2026-W42", "--dry-run=false"],
    ["--week", "2026-W42", "--dry-run=true"],
    ["--week", "2026-W42", "--dry-run", "false"],
    ["--week", "2026-W42", "--dryrun"],
    ["--week", "2026-W42", "--dry-run", "--dry-run"],
    ["--week", "2026-W42", "--week", "2026-W43"],
  ].map((args) => [args]),
)(
  "rejects ambiguous or invalid arguments %j without business access",
  async (args) => {
    await expect(main(args)).rejects.toThrow();
    expectNoBusinessAccess();
  },
);
it("preserves normal generation, gates, counters and cleanup", async () => {
  await main(["--week", "2026-W42"]);
  expect(mockBootstrap).toHaveBeenCalledTimes(1);
  expect(mockReadPlan).toHaveBeenCalledWith("2026-W42");
  expect(mockGenerate).toHaveBeenCalledWith(plan.plan_json, "2026-W42", false);
  expect(mockReadPosts).toHaveBeenCalledWith("2026-W42", "generated");
  expect(mockGate).toHaveBeenCalledWith(post);
  expect(mockSave).toHaveBeenCalledWith({
    week_iso: "2026-W42",
    priority_gammes: [],
    calendar_rules: {},
    plan_json: plan.plan_json,
    status: "in_progress",
    posts_generated: 1,
  });
  expect(mockClose).toHaveBeenCalledTimes(1);
});
it("does not run gates or write counters when no post was generated", async () => {
  mockGenerate.mockResolvedValue({ generated: 0, errors: 0 });
  await main(["--week", "2026-W42"]);
  expect(mockReadPosts).not.toHaveBeenCalled();
  expect(mockGate).not.toHaveBeenCalled();
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(1);
});
it("closes the context when no plan exists", async () => {
  mockReadPlan.mockResolvedValue(null);
  await expect(main(["--week", "2026-W42"])).rejects.toThrow("No plan found");
  expect(mockGenerate).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(1);
});
it.each([0, 1])(
  "reports batch errors after preserving %i generated posts",
  async (generated) => {
    mockGenerate.mockResolvedValue({ generated, errors: 1 });
    await expect(main(["--week", "2026-W42"])).rejects.toThrow(
      "Copy batch incomplete",
    );
    expect(mockGate).toHaveBeenCalledTimes(generated);
    expect(mockSave).toHaveBeenCalledTimes(generated);
    expect(mockClose).toHaveBeenCalledTimes(1);
    expect(console.log).not.toHaveBeenCalledWith(
      expect.stringContaining("Done!"),
    );
  },
);
it.each(["read", "generate", "gate", "save"])(
  "preserves a %s failure and closes the context",
  async (stage) => {
    const error = new Error(stage + " failed");
    const stages = {
      read: mockReadPlan,
      generate: mockGenerate,
      gate: mockGate,
      save: mockSave,
    };
    stages[stage as keyof typeof stages].mockRejectedValue(error);
    await expect(main(["--week", "2026-W42"])).rejects.toBe(error);
    expect(mockClose).toHaveBeenCalledTimes(1);
  },
);
it("surfaces bootstrap failure without reading the plan", async () => {
  const error = new Error("bootstrap failed");
  mockBootstrap.mockRejectedValue(error);
  await expect(main(["--week", "2026-W42"])).rejects.toBe(error);
  expect(mockBootstrap).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ abortOnError: false }),
  );
  expect(mockReadPlan).not.toHaveBeenCalled();
  expect(mockClose).not.toHaveBeenCalled();
});
