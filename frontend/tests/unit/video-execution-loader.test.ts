import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loader } from "../../app/routes/admin.video-hub.executions.$executionLogId";
vi.mock("~/utils/internal-api.server", () => ({
  getInternalApiUrl: () => "http://backend",
}));
describe("execution detail artifact loading", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([undefined, "simulated", "disabled", "skipped", "unknown"])(
    "does not fetch variants for legacy completed with %s",
    async (executionOutcome) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { status: "completed", executionOutcome } }),
          ),
        );
      vi.stubGlobal("fetch", fetchMock);
      await loader({
        request: new Request("http://frontend/admin/video-hub/executions/1"),
        params: { executionLogId: "1" },
        context: new RouterContextProvider(),
        url: new URL("http://frontend/admin/video-hub/executions/1"),
        pattern: "/admin/video-hub/executions/:executionLogId",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it("loads variants for a real but still unchecked render", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              status: "completed",
              executionOutcome: "rendered_unverified",
            },
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await loader({
      request: new Request("http://frontend/admin/video-hub/executions/1"),
      params: { executionLogId: "1" },
      context: new RouterContextProvider(),
      url: new URL("http://frontend/admin/video-hub/executions/1"),
      pattern: "/admin/video-hub/executions/:executionLogId",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain("/1/variants");
  });
});
