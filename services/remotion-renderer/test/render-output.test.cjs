const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const childProcess = require("node:child_process");
const bundler = require("@remotion/bundler");
const renderer = require("@remotion/renderer");
const { renderVideo } = require("../src/lib/render-video.ts");
const fastify = require("fastify");
const { S3Client } = require("@aws-sdk/client-s3");
const { Readable } = require("node:stream");
const { renderRoute } = require("../src/routes/render.ts");
const realReadFile = fs.readFileSync;
const realStat = fs.statSync;
const isRenderOutput = (path) =>
  typeof path === "string" && path.startsWith("/tmp/renders/render-");

const request = {
  briefId: "test-output",
  executionLogId: 1,
  videoType: "short",
  vertical: "test",
  composition: "TestCard",
  resolution: { width: 1080, height: 1920 },
  fps: 30,
};
let probe;
let removed;
beforeEach(() => {
  mock.getter(bundler, "bundle", () => async () => "/test-bundle");
  mock.getter(renderer, "getCompositions", () => async () => [
    {
      id: "TestCard",
      durationInFrames: 30,
      fps: 30,
      width: 1080,
      height: 1920,
    },
  ]);
  mock.getter(renderer, "renderMedia", () => async () => {});
  mock.getter(renderer, "makeCancelSignal", () => () => ({
    cancelSignal: {},
    cancel() {},
  }));
  mock.method(fs, "statSync", (path, ...args) =>
    isRenderOutput(path) ? { size: 7 } : realStat(path, ...args),
  );
  mock.method(fs, "readFileSync", (path, ...args) =>
    isRenderOutput(path) ? Buffer.from("fixture") : realReadFile(path, ...args),
  );
  removed = mock.method(fs, "unlinkSync", () => {});
  probe = () =>
    Buffer.from(JSON.stringify({ format: { duration: "1.000000" } }));
  mock.method(childProcess, "execSync", (...args) => probe(...args));
  mock.method(childProcess, "execFileSync", (...args) => probe(...args));
});
afterEach(() => mock.restoreAll());

for (const [label, value] of [
  ["missing duration", { format: {} }],
  ["null duration", { format: { duration: null } }],
  ["nonnumeric duration", { format: { duration: "N/A" } }],
  ["infinite duration", { format: { duration: "Infinity" } }],
  ["partially numeric duration", { format: { duration: "1second" } }],
  ["negative duration", { format: { duration: "-1" } }],
  ["too short duration", { format: { duration: "0.1" } }],
  ["invalid root", null],
]) {
  test(`rejects ${label} and cleans the rejected output`, async () => {
    probe = () => Buffer.from(JSON.stringify(value));
    await assert.rejects(renderVideo(request), { code: "OUTPUT_INVALID" });
    assert.equal(removed.mock.callCount(), 1);
    assert.match(removed.mock.calls[0].arguments[0], /render-1-\d+\.mp4$/);
  });
}
test("rejects malformed probe JSON", async () => {
  probe = () => Buffer.from("{");
  await assert.rejects(renderVideo(request), { code: "OUTPUT_INVALID" });
  assert.equal(removed.mock.callCount(), 1);
});
for (const code of ["ENOENT", "ETIMEDOUT", "EXIT_1"]) {
  test(`probe ${code} cannot return a successful artifact`, async () => {
    probe = () => {
      throw Object.assign(new Error("probe failed"), { code });
    };
    await assert.rejects(renderVideo(request), { code: "OUTPUT_INVALID" });
    assert.equal(removed.mock.callCount(), 1);
  });
}
test("a cleanup failure preserves OUTPUT_INVALID", async () => {
  removed.mock.mockImplementation(() => {
    throw new Error("unlink refused");
  });
  probe = () => {
    throw new Error("probe failed");
  };
  await assert.rejects(renderVideo(request), { code: "OUTPUT_INVALID" });
});
test("returns measured duration and bytes only after a valid probe", async () => {
  const result = await renderVideo(request);
  assert.equal(result.durationSecs, 1);
  assert.equal(result.fileSizeBytes, 7);
  assert.match(result.checksumSha256, /^[a-f0-9]{64}$/);
  assert.equal(removed.mock.callCount(), 0);
});

test("HTTP rejects an unprobed output before upload and releases the render slot", async () => {
  const upload = mock.method(S3Client.prototype, "send", async () => ({}));
  mock.method(fs, "createReadStream", () => Readable.from(["fixture"]));
  const app = fastify();
  await app.register(renderRoute);
  try {
    probe = () => {
      throw new Error("ffprobe unavailable");
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await app.inject({
        method: "POST",
        url: "/render",
        payload: request,
      });
      assert.equal(response.statusCode, 500);
      const body = response.json();
      assert.equal(body.status, "failed");
      assert.equal(body.errorCode, "OUTPUT_INVALID");
      assert.equal(body.outputPath, null);
      assert.equal(body.metadata, null);
    }
    assert.equal(upload.mock.callCount(), 0);
    assert.equal(removed.mock.callCount(), 2);
  } finally {
    await app.close();
  }
});
