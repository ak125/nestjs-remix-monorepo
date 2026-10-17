// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canPreviewExecution } from "../../app/utils/video-execution";

describe("Video preview eligibility", () => {
  it.each(["simulated", "disabled", "unknown", undefined])(
    "does not offer a file for %s, even with a historical path",
    (outcome) => {
      expect(
        canPreviewExecution({ outcome, renderOutputPath: "/historical.mp4" }),
      ).toBe(false);
    },
  );
  it("requires both a declared render and a usable reference", () => {
    expect(
      canPreviewExecution({
        outcome: "rendered_unverified",
        renderOutputPath: " ",
      }),
    ).toBe(false);
    expect(
      canPreviewExecution({
        outcome: "rendered_unverified",
        renderOutputPath: "s3://private/video.mp4",
      }),
    ).toBe(true);
  });
});
