const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cp = require("node:child_process");
const { createHash } = require("node:crypto");
const { probeFixture } = require("./probe-fixture.cjs");
const { inspectVideo } = require("../src/lib/media-inspection.ts");
const { verifyRenderManifest } = require("../src/lib/render-manifest.ts");
const realRead = fs.readFileSync;
const realStat = fs.statSync;
const file = "/tmp/media-fixture.mp4";
const bytes = Buffer.from("fixture");
const digest = createHash("sha256").update(bytes).digest("hex");
let data, read;
beforeEach(() => {
  data = probeFixture();
  read = mock.method(fs, "readFileSync", (p, ...args) =>
    p === file ? bytes : realRead(p, ...args),
  );
  mock.method(fs, "statSync", (p, ...args) =>
    p === file ? { size: bytes.length } : realStat(p, ...args),
  );
  mock.method(cp, "execFileSync", () => Buffer.from(JSON.stringify(data)));
  require("./probe-fixture.cjs").mockMediaDescriptors(mock);
});
afterEach(() => mock.restoreAll());
const manifest = () => ({
  manifestVersion: "1.0.0",
  briefId: "test",
  voice: false,
  composition: {
    id: "TestCard",
    engine: "remotion",
    resolution: { width: 1080, height: 1920 },
    fps: 30,
    durationFrames: 30,
    durationSecs: 1,
    codec: "h264",
    muted: true,
  },
  artifact: { sha256: digest, bytes: bytes.length },
  approvalBinding: { boundSha256: digest },
});
test("inspection binds measured streams to the exact bytes", () => {
  assert.deepEqual(inspectVideo(file), {
    checksumSha256: digest,
    fileSizeBytes: 7,
    durationSecs: 1,
    video: {
      codec: "h264",
      width: 1080,
      height: 1920,
      fps: 30,
      frames: 30,
      durationSecs: 1,
    },
    audio: [],
  });
});
test("media changing during probe is rejected even if byte count is unchanged", () => {
  let reads = 0;
  read.mock.mockImplementation((p) => {
    assert.equal(p, file);
    return reads++ ? Buffer.from("changed") : bytes;
  });
  assert.throws(() => inspectVideo(file), /changed during inspection/);
});
test("HEVC is reported as the existing h265 contract value", () => {
  data.streams[0].codec_name = "hevc";
  assert.equal(inspectVideo(file, { codec: "h265" }).video.codec, "h265");
  assert.throws(() => inspectVideo(file, { codec: "h264" }), /expected render/);
});
test("fractional frame rates are measured as a ratio", () => {
  data.streams[0].avg_frame_rate = "30000/1001";
  data.streams[0].duration = "1.001";
  data.format.duration = "1.001";
  assert.equal(
    inspectVideo(file, { fps: 30000 / 1001 }).video.fps,
    30000 / 1001,
  );
});
test("matching manifest produces only a technical match and never mutates approvals", () => {
  const m = manifest();
  m.publication = { publish_approved: false };
  const before = JSON.stringify(m);
  const result = verifyRenderManifest(m, file);
  assert.equal(result.status, "TECHNICAL_MATCH");
  assert.equal(result.humanReview, "NOT_ASSESSED");
  assert.equal(result.inspection.checksumSha256, m.artifact.sha256);
  assert.equal(JSON.stringify(m), before);
});
for (const [label, change] of [
  [
    "artifact hash",
    (m) => {
      m.artifact.sha256 = "0".repeat(64);
    },
  ],
  [
    "byte count",
    (m) => {
      m.artifact.bytes = 8;
    },
  ],
  [
    "review binding",
    (m) => {
      m.approvalBinding.boundSha256 = "0".repeat(64);
    },
  ],
  [
    "resolution",
    (m) => {
      m.composition.resolution.width = 720;
    },
  ],
  [
    "codec",
    (m) => {
      m.composition.codec = "h265";
    },
  ],
  [
    "fps",
    (m) => {
      m.composition.fps = 25;
      m.composition.durationFrames = 25;
    },
  ],
  [
    "duration",
    (m) => {
      m.composition.durationSecs = 2;
      m.composition.durationFrames = 60;
    },
  ],
  [
    "frame count contradiction",
    (m) => {
      m.composition.durationFrames = 31;
    },
  ],
  [
    "required audio",
    (m) => {
      m.composition.muted = false;
    },
  ],
  [
    "voice with muted video",
    (m) => {
      m.voice = true;
    },
  ],
  [
    "missing audio intent",
    (m) => {
      delete m.composition.muted;
    },
  ],
]) {
  test(`manifest rejects mismatched ${label}`, () => {
    const m = manifest();
    change(m);
    assert.throws(() => verifyRenderManifest(m, file));
  });
}
test("manifest silent declaration rejects an actual audio stream", () => {
  data = probeFixture({ audio: true });
  assert.throws(() => verifyRenderManifest(manifest(), file), /audio presence/);
});

for (const invalid of [false, true]) {
  test(`inspection closes its descriptor on ${invalid ? "failure" : "success"}`, () => {
    if (invalid) data.streams[0].codec_name = "vp9";
    if (invalid) assert.throws(() => inspectVideo(file));
    else inspectVideo(file);
    assert.equal(fs.openSync.mock.callCount(), 1);
    assert.equal(fs.closeSync.mock.callCount(), 1);
    assert.equal(
      fs.closeSync.mock.calls[0].arguments[0],
      fs.openSync.mock.calls[0].result,
    );
  });
}
