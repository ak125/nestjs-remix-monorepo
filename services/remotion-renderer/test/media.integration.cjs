const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const { inspectVideo } = require("../src/lib/media-inspection.ts");
const { verifyRenderManifest } = require("../src/lib/render-manifest.ts");
let dir, silent, audible, hevc;
before(() => {
  dir = mkdtempSync(join(tmpdir(), "renderer-media-test-"));
  silent = join(dir, "silent.mp4");
  audible = join(dir, "audio.mp4");
  hevc = join(dir, "hevc.mp4");
  for (const [path, audio, codec] of [
    [silent, false, "libx264"],
    [audible, true, "libx264"],
    [hevc, false, "libx265"],
  ]) {
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=blue:s=64x48:r=25",
        ...(audio
          ? ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"]
          : []),
        "-t",
        "1",
        "-c:v",
        codec,
        "-threads",
        "1",
        ...(codec === "libx265"
          ? ["-x265-params", "pools=1:frame-threads=1:log-level=error"]
          : []),
        "-pix_fmt",
        "yuv420p",
        ...(audio ? ["-c:a", "aac"] : ["-an"]),
        path,
      ],
      { timeout: 30000, stdio: "pipe" },
    );
  }
});
after(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});
const expected = {
  codec: "h264",
  width: 64,
  height: 48,
  fps: 25,
  frames: 25,
  durationSecs: 1,
  audio: "forbidden",
};
function manifest(path, muted = true) {
  const bytes = readFileSync(path);
  return {
    manifestVersion: "1.0.0",
    briefId: "synthetic-only",
    voice: false,
    composition: {
      id: "SyntheticFixture",
      engine: "remotion",
      resolution: { width: 64, height: 48 },
      fps: 25,
      durationFrames: 25,
      durationSecs: 1,
      codec: "h264",
      muted,
    },
    artifact: {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    },
  };
}
test("real ffprobe validates a silent H264 MP4 and its manifest", () => {
  const result = inspectVideo(silent, expected);
  assert.equal(result.video.frames, 25);
  assert.equal(result.audio.length, 0);
  assert.equal(
    verifyRenderManifest(manifest(silent), silent).status,
    "TECHNICAL_MATCH",
  );
});
test("real AAC track is detected and duration checked", () => {
  const result = inspectVideo(audible, {
    ...expected,
    audio: "required",
    audioCodec: "aac",
  });
  assert.equal(result.audio[0].codec, "aac");
  assert.equal(result.audio[0].sampleRate, 48000);
  assert.equal(
    verifyRenderManifest(manifest(audible, false), audible).status,
    "TECHNICAL_MATCH",
  );
  assert.throws(() => inspectVideo(audible, expected), /audio presence/);
  assert.throws(
    () => inspectVideo(silent, { ...expected, audio: "required" }),
    /audio presence/,
  );
});
test("real HEVC maps to h265 and cannot masquerade as h264", () => {
  assert.equal(
    inspectVideo(hevc, { ...expected, codec: "h265" }).video.codec,
    "h265",
  );
  assert.throws(() => inspectVideo(hevc, expected), /expected render/);
});
test("actual dimensions and fps reject mismatched expectations", () => {
  assert.throws(
    () => inspectVideo(silent, { ...expected, width: 128 }),
    /expected render/,
  );
  assert.throws(
    () => inspectVideo(silent, { ...expected, fps: 30 }),
    /expected render/,
  );
});
test("truncated MP4 cannot validate", () => {
  const path = join(dir, "truncated.mp4");
  const bytes = readFileSync(silent);
  writeFileSync(path, bytes.subarray(0, Math.floor(bytes.length / 2)));
  assert.throws(() => inspectVideo(path, expected));
});
test("CLI is read-only and exits nonzero when the manifest binds other bytes", () => {
  const path = join(dir, "manifest.json");
  writeFileSync(path, JSON.stringify(manifest(silent)));
  const run = () =>
    spawnSync(
      process.execPath,
      ["--require", "tsx/cjs", "src/cli/verify-manifest.ts", path, silent],
      { encoding: "utf8", timeout: 15000 },
    );
  const before = readFileSync(path);
  const valid = run();
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).humanReview, "NOT_ASSESSED");
  assert.deepEqual(readFileSync(path), before);
  const wrong = manifest(silent);
  wrong.artifact.sha256 = "0".repeat(64);
  writeFileSync(path, JSON.stringify(wrong));
  const invalid = run();
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stderr).status, "TECHNICAL_MISMATCH");
});

test("real resize preserves the AAC track, frames and duration", () => {
  const {
    resizeVideo,
    cleanupPostprocessFiles,
  } = require("../src/lib/ffmpeg-postprocess.ts");
  let result;
  try {
    result = resizeVideo(
      audible,
      { name: "synthetic", width: 128, height: 96, codec: "h264" },
      `media-test-${process.pid}-${Date.now()}`,
      true,
    );
    assert.equal(result.resolution, "128x96");
    assert.equal(result.inspection.video.frames, 25);
    assert.equal(result.inspection.audio[0].codec, "aac");
    assert.equal(
      result.inspection.checksumSha256,
      createHash("sha256").update(readFileSync(result.localPath)).digest("hex"),
    );
  } finally {
    if (result) cleanupPostprocessFiles([result.localPath]);
  }
});

test("probe and hash stay bound to the opened file if its path is replaced", (t) => {
  const fs = require("node:fs");
  const cp = require("node:child_process");
  const saved = join(dir, "saved-original.mp4");
  t.mock.method(cp, "execFileSync", (command, args, options) => {
    if (command !== "ffprobe") return execFileSync(command, args, options);
    fs.renameSync(silent, saved);
    fs.copyFileSync(audible, silent);
    try {
      return execFileSync(command, args, options);
    } finally {
      fs.renameSync(saved, silent);
    }
  });
  assert.equal(inspectVideo(silent, expected).audio.length, 0);
});

test("inspection rejects a symlink instead of following it", () => {
  const fs = require("node:fs");
  const link = join(dir, "link.mp4");
  fs.symlinkSync(silent, link);
  assert.throws(() => inspectVideo(link, expected));
});
test("inspection rejects permanent replacement even with identical bytes", (t) => {
  const fs = require("node:fs");
  const cp = require("node:child_process");
  const original = join(dir, "replaced-original.mp4");
  t.mock.method(cp, "execFileSync", (command, args, options) => {
    const result = execFileSync(command, args, options);
    if (command === "ffprobe") {
      fs.renameSync(silent, original);
      fs.copyFileSync(original, silent);
    }
    return result;
  });
  try {
    assert.throws(
      () => inspectVideo(silent, expected),
      /changed during inspection/,
    );
  } finally {
    fs.renameSync(original, silent);
  }
});
