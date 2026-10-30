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

describe("production gate simulation", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each([
    ["short", "short"],
    ["film_socle", "socle"],
    ["film_gamme", "socle"],
  ])(
    "transmits actual %s production content and mode without invented measurements",
    async (videoType, mode) => {
      const { action } =
        await import("../../app/routes/admin.video-hub.productions.$briefId");
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                briefId: "brief-test",
                videoType,
                vertical: "freinage",
                scriptText: "Texte réel enregistré",
              },
            }),
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ canPublish: false, gates: [] })),
        );
      vi.stubGlobal("fetch", fetchMock);
      const url = new URL(
        "http://frontend/admin/video-hub/productions/brief-test",
      );
      await action({
        request: new Request(url, {
          method: "POST",
          body: new URLSearchParams({ _intent: "dry-run" }),
        }),
        params: { briefId: "brief-test" },
        context: new RouterContextProvider(),
        url,
        pattern: "/admin/video-hub/productions/:briefId",
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [target, init] = fetchMock.mock.calls[1];
      expect(target).toContain("/validate-gates");
      const body = JSON.parse(init.body);
      expect(body.brief).toEqual({
        briefId: "brief-test",
        type: videoType,
        mode,
        vertical: "freinage",
      });
      expect(body.scriptText).toBe("Texte réel enregistré");
      for (const key of [
        "actualDurationSec",
        "similarityScore",
        "visualRoleViolations",
      ]) {
        expect(body).not.toHaveProperty(key);
      }
    },
  );
});
