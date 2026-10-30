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

test("SRT artifacts use distinct private directories and reject traversal", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const {
    writeSrtFile,
    cleanupPostprocessFiles,
  } = require("../src/lib/ffmpeg-postprocess.ts");
  const first = writeSrtFile("first", "same-execution");
  const second = writeSrtFile("second", "same-execution");
  try {
    assert.notEqual(first, second);
    assert.equal(fs.readFileSync(first, "utf8"), "first");
    assert.equal(fs.readFileSync(second, "utf8"), "second");
    assert.equal(fs.statSync(path.dirname(first)).mode & 0o777, 0o700);
    assert.equal(fs.statSync(first).mode & 0o777, 0o600);
    assert.throws(() => writeSrtFile("escape", "../outside"), /filename/);
    assert.throws(() => writeSrtFile("escape", "..\\outside"), /filename/);
  } finally {
    cleanupPostprocessFiles([first, second]);
  }
  assert.equal(fs.existsSync(path.dirname(first)), false);
  assert.equal(fs.existsSync(path.dirname(second)), false);
});
