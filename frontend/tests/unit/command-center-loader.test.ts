import { beforeEach, afterEach, expect, it, vi } from "vitest";
import snapshot from "../../../audit/registry/command-center-snapshot.json";
import { CommandCenterResponseV2Schema } from "../../../packages/registry/src/command-center/snapshot";
import { requireAdmin } from "../../app/auth/unified.server";
import { loader } from "../../app/routes/admin.command-center";
vi.mock(
  "@repo/registry",
  async () => await import("../../../packages/registry/src/index"),
);
vi.mock("../../app/auth/unified.server", () => ({ requireAdmin: vi.fn() }));
vi.mock("../../app/utils/internal-api.server", () => ({
  getInternalApiUrlFromRequest: (path: string) =>
    `http://command-center.test${path}`,
}));
const fetchMock = vi.fn();
const args = {
  request: new Request("http://command-center.test/admin/command-center"),
  context: {},
  params: {},
} as Parameters<typeof loader>[0];
function response() {
  return {
    ...snapshot,
    departments: snapshot.departments.map((d) => ({
      ...d,
      health_score_current: d.health_score_base,
      live_caps_applied: [],
    })),
    mode: "full",
    degraded: false,
    action_queue: [],
    department_reports: [],
    generated_at: "2026-10-10T00:00:00Z",
    git_sha: null,
    stale_status: "UNKNOWN",
    validation_status: "UNKNOWN",
    global_status: { level: "WARNING", verdict: "PARTIAL_READY", reasons: [] },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(requireAdmin).mockResolvedValue({} as never);
});
afterEach(() => vi.unstubAllGlobals());
it.each(
  [
    null,
    [],
    {},
    { schema_version: "command-center.v1" },
    { schema_version: "command-center.v2" },
    { data: null },
  ].map((body) => ({ body })),
)("rejects invalid payload $body before orchestration", async ({ body }) => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 }),
  );
  const r = await loader(args);
  expect(r.cc.degraded).toBe(true);
  expect(CommandCenterResponseV2Schema.safeParse(r.cc).success).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(r.orchestration).toBeNull();
});
it.each([false, true])(
  "accepts v2 (wrapped=%s) and requests explicit version",
  async (wrapped) => {
    const cc = response();
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(wrapped ? { data: cc } : cc)),
      )
      .mockResolvedValueOnce(new Response("{}"));
    const r = await loader(args);
    expect(r.cc.degraded).toBe(false);
    expect(r.cc.departments).toHaveLength(24);
    expect(String(fetchMock.mock.calls[0][0])).toContain("contract_version=2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  },
);
it("404 is disabled and performs no orchestration request", async () => {
  fetchMock.mockResolvedValue(new Response("", { status: 404 }));
  const r = await loader(args);
  expect(r.cc.mode).toBe("disabled");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("auth rejection stays outside degradation and performs no fetch", async () => {
  const denied = new Response("", { status: 403 });
  vi.mocked(requireAdmin).mockRejectedValueOnce(denied);
  await expect(loader(args)).rejects.toBe(denied);
  expect(fetchMock).not.toHaveBeenCalled();
});
