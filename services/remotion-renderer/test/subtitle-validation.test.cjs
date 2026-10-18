const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const { Readable } = require('node:stream');
const { S3Client } = require('@aws-sdk/client-s3');
const fastify = require('fastify');
const { generateSrt } = require('../src/lib/ffmpeg-postprocess.ts');
const { postprocessRoute } = require('../src/routes/postprocess.ts');

const cue = (startSecs = 0, endSecs = 1, text = 'Bonjour') => ({ startSecs, endSecs, text });
const invalidCases = [
  ['negative time', [cue(-1)]],
  ['reversed interval', [cue(2, 1)]],
  ['empty interval', [cue(1, 1)]],
  ['collapsed millisecond interval', [cue(1, 1.0001)]],
  ['overlap', [cue(0, 2), cue(1, 3)]],
  ['out of order', [cue(2, 3), cue(0, 1)]],
  ['blank text', [cue(0, 1, ' \t\n ')]],
  ['embedded block separator', [cue(0, 1, 'Bonjour\n \n2\n00:00:00,000 --> 00:00:01,000\nAutre')]],
  ['control character', [cue(0, 1, 'Bon\u0000jour')]],
  ['unsafe milliseconds', [cue(1e15, 1e15 + 1)]],
];
for (const [label, segments] of [...invalidCases,
  ['NaN', [cue(NaN)]], ['Infinity', [cue(0, Infinity)]],
]) {
  test(`SRT rejects ${label}`, () => assert.throws(() => generateSrt(segments), /subtitle/i));
}
test('SRT keeps adjacent cues and normalizes multiline CRLF without an empty block', () => {
  assert.equal(generateSrt([cue(0, 1, ' Première\r\nligne '), cue(1, 2, 'Suite')]),
    '1\n00:00:00,000 --> 00:00:01,000\nPremière\nligne\n\n2\n00:00:01,000 --> 00:00:02,000\nSuite\n');
});

const request = {
  briefId: 'subtitle-test', executionLogId: 42, inputS3Key: 's3://test/input.mp4',
  normalizeLoudness: false,
  variants: [{ name: 'portrait', width: 1080, height: 1920 }, { name: 'square', width: 1080, height: 1080 }],
  subtitleSegments: [cue(0, 2)],
};
const realStat = fs.statSync;
const realExists = fs.existsSync;
const output = (p) => typeof p === 'string' && p.startsWith('/tmp/postprocess/');
let durationFor, commands, uploads, removed, writes, events;
beforeEach(() => {
  durationFor = () => '2.000000';
  events = [];
  commands = [];
  const execute = (name, args) => {
    const command = [name, ...(Array.isArray(args) ? args : [])].join(' ');
    commands.push(command);
    if (command.includes('ffprobe')) {
      events.push('probe');
      return Buffer.from(JSON.stringify({ format: { duration: durationFor(command) } }));
    }
    return Buffer.from('');
  };
  mock.method(cp, 'execSync', execute);
  mock.method(cp, 'execFileSync', execute);
  mock.method(fs, 'statSync', (p, ...args) => output(p) ? { size: 7 } : realStat(p, ...args));
  mock.method(fs, 'existsSync', (p) => output(p) || realExists(p));
  removed = mock.method(fs, 'unlinkSync', () => {});
  writes = mock.method(fs, 'writeFileSync', () => { events.push('write'); });
  mock.method(fs, 'createReadStream', () => Readable.from(['fixture']));
  uploads = mock.method(S3Client.prototype, 'send', async () => { events.push('upload'); return {}; });
});
afterEach(() => mock.restoreAll());
async function post(payload) {
  const app = fastify();
  await app.register(postprocessRoute);
  try { return await app.inject({ method: 'POST', url: '/postprocess', payload }); }
  finally { await app.close(); }
}
for (const [label, segments] of invalidCases) {
  test(`HTTP rejects ${label} before any processing`, async () => {
    const response = await post({ ...request, subtitleSegments: segments });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().status, 'failed');
    assert.deepEqual(response.json().variants, []);
    assert.equal(response.json().srtS3Path, null);
    assert.equal(commands.length, 0);
    assert.equal(uploads.mock.callCount(), 0);
  });
}
for (const [label, duration] of [
  ['shorter final variant', '1.5'], ['missing duration', undefined],
  ['unparseable duration', 'N/A'], ['partially numeric duration', '2seconds'],
  ['infinite duration', 'Infinity'], ['negative duration', '-2'], ['zero duration', '0'],
]) {
  test(`HTTP refuses ${label} before uploading even the first variant`, async () => {
    durationFor = (command) => command.includes('square.mp4') ? duration : '2';
    const response = await post(request);
    assert.equal(response.statusCode, 500);
    assert.equal(response.json().status, 'failed');
    assert.deepEqual(response.json().variants, []);
    assert.equal(response.json().srtS3Path, null);
    assert.equal(uploads.mock.callCount(), 0);
    assert.equal(writes.mock.callCount(), 0);
    assert.equal(removed.mock.callCount(), 3);
  });
}
test('HTTP rejects SRT rounding beyond the measured file end', async () => {
  durationFor = () => '2.0006';
  const response = await post({ ...request, subtitleSegments: [cue(0, 2.0006)] });
  assert.equal(response.statusCode, 500);
  assert.equal(uploads.mock.callCount(), 0);
});
test('HTTP refuses a failed final probe and cleans every completed local file', async () => {
  durationFor = (command) => {
    if (command.includes('square.mp4')) throw new Error('ffprobe timed out');
    return '2';
  };
  const response = await post(request);
  assert.equal(response.statusCode, 500);
  assert.equal(uploads.mock.callCount(), 0);
  assert.equal(removed.mock.callCount(), 3);
});
test('HTTP does not upload videos when subtitle file creation fails', async () => {
  writes.mock.mockImplementation(() => { throw new Error('disk full'); });
  const response = await post(request);
  assert.equal(response.statusCode, 500);
  assert.equal(uploads.mock.callCount(), 0);
  assert.equal(removed.mock.callCount(), 3);
});
test('HTTP exports exact-bound subtitles only after checking every variant', async () => {
  const response = await post(request);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().variants.length, 2);
  assert.ok(response.json().variants.every((v) => v.durationSecs === 2));
  assert.match(response.json().srtS3Path, /subtitles\.srt$/);
  assert.equal(uploads.mock.callCount(), 3);
  assert.equal(removed.mock.callCount(), 4);
  assert.deepEqual(events, ['probe', 'probe', 'write', 'upload', 'upload', 'upload']);
  assert.equal(writes.mock.calls[0].arguments[1], '1\n00:00:00,000 --> 00:00:02,000\nBonjour\n');
});
for (const subtitleSegments of [undefined, null, []]) {
  test(`HTTP preserves video-only requests (${JSON.stringify(subtitleSegments)})`, async () => {
    const response = await post({ ...request, subtitleSegments });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().srtS3Path, null);
    assert.equal(uploads.mock.callCount(), 2);
    assert.equal(writes.mock.callCount(), 0);
  });
}
