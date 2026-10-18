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
const { probeFixture } = require("./probe-fixture.cjs");
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
    Buffer.from(JSON.stringify(probeFixture()));
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

for (const [label, mutate] of [
  ['missing video', (p) => { p.streams = []; }],
  ['wrong codec', (p) => { p.streams[0].codec_name = 'mpeg4'; }],
  ['wrong dimensions', (p) => { p.streams[0].width = 720; }],
  ['wrong fps', (p) => { p.streams[0].avg_frame_rate = '25/1'; }],
  ['invalid fps', (p) => { p.streams[0].avg_frame_rate = '0/0'; }],
  ['cover art only', (p) => { p.streams[0].disposition.attached_pic = 1; }],
  ['multiple video streams', (p) => { p.streams.push({...p.streams[0]}); }],
  ['unexpected audio', (p) => { p.streams.push(probeFixture({audio: true}).streams[1]); }],
  ['wrong container', (p) => { p.format.format_name = 'matroska,webm'; }],
  ['short video stream', (p) => { p.streams[0].duration = '0.5'; }],
  ['missing video duration', (p) => { delete p.streams[0].duration; }],
  ['wrong frame count', (p) => { p.streams[0].nb_frames = '15'; }],
]) {
  test(`rejects ${label} before returning render metadata`, async () => {
    const data = probeFixture(); mutate(data);
    probe = () => Buffer.from(JSON.stringify(data));
    await assert.rejects(renderVideo(request), { code: 'OUTPUT_INVALID' });
    assert.equal(removed.mock.callCount(), 1);
  });
}
test('audioUrl requires an audio stream', async () => {
  await assert.rejects(renderVideo({...request, compositionProps: {audioUrl: 'https://fixture.invalid/voice.wav'}}), {code: 'OUTPUT_INVALID'});
});
for (const [label, change] of [
  ['wrong audio codec', a => {a.codec_name='mp3';}],
  ['invalid sample rate', a => {a.sample_rate='N/A';}],
  ['no audio channels', a => {a.channels=0;}],
  ['truncated audio', a => {a.duration='0.2';}],
  ['delayed audio', a => {a.start_time='0.8';}],
]) {
  test(`rejects ${label}`, async () => {
    const data=probeFixture({audio:true}); change(data.streams[1]);
    probe=()=>Buffer.from(JSON.stringify(data));
    await assert.rejects(renderVideo({...request,compositionProps:{audioUrl:'https://fixture.invalid/voice.wav'}}),{code:'OUTPUT_INVALID'});
  });
}
test('HTTP wrong resolution has no uploaded artifact or metadata', async () => {
  const upload=mock.method(S3Client.prototype,'send',async()=>({}));
  mock.method(fs,'createReadStream',()=>Readable.from(['fixture']));
  const app=fastify(); await app.register(renderRoute);
  probe=()=>Buffer.from(JSON.stringify(probeFixture({width:720})));
  try {
    const response=await app.inject({method:'POST',url:'/render',payload:request});
    assert.equal(response.statusCode,500);
    assert.equal(response.json().errorCode,'OUTPUT_INVALID');
    assert.equal(response.json().metadata,null);
    assert.equal(upload.mock.callCount(),0);
  } finally {await app.close();}
});

test('HTTP successful metadata carries the same file hash and measured streams',async()=>{
  mock.method(S3Client.prototype,'send',async()=>({}));
  mock.method(fs,'createReadStream',()=>Readable.from(['fixture']));
  const app=fastify();await app.register(renderRoute);
  try{
    const response=await app.inject({method:'POST',url:'/render',payload:request});
    assert.equal(response.statusCode,200);
    const m=response.json().metadata;
    assert.equal(m.inspection.checksumSha256,m.checksumSha256);
    assert.equal(m.inspection.fileSizeBytes,m.fileSizeBytes);
    assert.equal(m.inspection.video.fps,m.fps);
  }finally{await app.close();}
});
test('HTTP refuses unsupported webm instead of silently rendering mp4',async()=>{
  const app=fastify();await app.register(renderRoute);
  try{const response=await app.inject({method:'POST',url:'/render',payload:{...request,outputFormat:'webm'}});
    assert.equal(response.statusCode,400);assert.equal(response.json().errorCode,'INVALID_REQUEST');
  }finally{await app.close();}
});
