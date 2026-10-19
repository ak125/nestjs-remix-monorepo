const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateSrt } = require("../src/lib/ffmpeg-postprocess.ts");

for (const [startSecs, endSecs, expected] of [
  [0, 1.234, "00:00:00,000 --> 00:00:01,234"],
  [59.9996, 61, "00:01:00,000 --> 00:01:01,000"],
  [3599.9996, 3601, "01:00:00,000 --> 01:00:01,000"],
  [86399.9996, 86401, "24:00:00,000 --> 24:00:01,000"],
]) {
  test(`formats SRT interval ${startSecs} to ${endSecs}`, () => {
    assert.equal(
      generateSrt([{ startSecs, endSecs, text: "Bonjour" }]),
      `1\n${expected}\nBonjour\n`,
    );
  });
}
