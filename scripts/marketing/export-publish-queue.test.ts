import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../..");
const script = join(root, "scripts/marketing/export-publish-queue.ts");
const filename = "manifest_2026-W42_facebook.json";
const args = ["--week", "2026-W42", "--channel", "facebook"];
let directory: string;

// Only the external application/DB boundary is replaced. Argument parsing,
// process exit, filesystem writes and finally cleanup execute in a real process.
const fixture = `
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const load = Module._load;
const mark = name => fs.appendFileSync(path.join(process.cwd(), 'events.txt'), name + '\\n');
Module._load = function(request, parent, isMain) {
  if (request.endsWith('/backend/src/app.module')) {
    mark('load-application');
    return { AppModule: class AppModule {} };
  }
  if (request.endsWith('/marketing/services/publish-queue.service')) {
    mark('load-service');
    return { PublishQueueService: class PublishQueueService {} };
  }
  if (request === '@nestjs/core') {
    mark('load-nest');
    return { NestFactory: { createApplicationContext: async () => {
      mark('bootstrap');
      if (process.env.EXPORT_FIXTURE_MODE === 'bootstrap-error') throw new Error('fixture bootstrap failure');
      return {
        get: () => ({ exportManifest: async (week, channel) => {
          mark('read');
          if (process.env.EXPORT_FIXTURE_MODE === 'read-error') throw new Error('fixture read failure');
          return { week_iso: week, channel, generated_at: '2026-10-17T00:00:00Z', timezone: 'Europe/Paris',
            posts: process.env.EXPORT_FIXTURE_MODE === 'empty' ? [] : [{
              post_id: 42, content_revision: 3, review_version: 7,
              approved_content_hash: 'a'.repeat(64), approval_scope: 'editorial',
              approval: { actor: 'admin:42', decided_at: '2026-10-17T00:00:00Z' },
              scheduled_date: '2026-10-14', scheduled_time: '12:00',
              caption: 'Fixture', hashtags: [], format: 'post', link: 'https://example.invalid', visual_brief: ''
            }] };
        } }),
        close: async () => { mark('close'); if (process.env.EXPORT_FIXTURE_MODE === 'close-error') throw new Error('fixture close failure'); }
      };
    } } };
  }
  return load.apply(this, arguments);
};
`;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "marketing-export-test-"));
  writeFileSync(join(directory, "fixture.cjs"), fixture);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function run(cliArgs = args, mode = "populated", importOnly = false) {
  return spawnSync(
    process.execPath,
    [
      "-r",
      join(root, "scripts/marketing/simulation-no-network.cjs"),
      "-r",
      join(directory, "fixture.cjs"),
      "-r",
      require.resolve("ts-node/register"),
      "-r",
      require.resolve("tsconfig-paths/register"),
      ...(importOnly
        ? ["-e", `require(${JSON.stringify(script)})`]
        : [script, ...cliArgs]),
    ],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 20000,
      env: {
        ...process.env,
        TS_NODE_PROJECT: join(root, "backend/tsconfig.json"),
        TS_NODE_TRANSPILE_ONLY: "true",
        EXPORT_FIXTURE_MODE: mode,
      },
    },
  );
}
const events = () =>
  existsSync(join(directory, "events.txt"))
    ? readFileSync(join(directory, "events.txt"), "utf8").trim().split("\n")
    : [];

test("empty current queue replaces an earlier approved export and closes the application", () => {
  writeFileSync(
    join(directory, filename),
    JSON.stringify({ posts: [{ post_id: 999, content_revision: 1 }] }),
  );
  const result = run(args, "empty");
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(
    JSON.parse(readFileSync(join(directory, filename), "utf8")),
  ).toMatchObject({ week_iso: "2026-W42", channel: "facebook", posts: [] });
  expect(events().at(-1)).toBe("close");
});

test("importing the CLI does not load the application, read data or write a manifest", () => {
  const result = run([], "populated", true);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(events()).toEqual([]);
  expect(existsSync(join(directory, filename))).toBe(false);
});

test.each([
  [],
  ["--week", "2026-W00", "--channel", "facebook"],
  ["--week", "2025-W53", "--channel", "facebook"],
  ["--week", "../../2026-W42", "--channel", "facebook"],
  ["--week", "2026-W42", "--channel", "unknown"],
  [...args, "--channel", "youtube"],
  [...args, "--week", "2026-W43"],
  [...args, "--unknown"],
  [...args, "unexpected"],
])(
  "rejects invalid or ambiguous arguments before loading business dependencies: %j",
  (...cliArgs) => {
    const result = run(cliArgs);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(events()).toEqual([]);
    expect(existsSync(join(directory, filename))).toBe(false);
  },
);

test("successful export preserves exact approved revision and hash then closes", () => {
  const result = run();
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  const manifest = JSON.parse(readFileSync(join(directory, filename), "utf8"));
  expect(manifest.posts).toHaveLength(1);
  expect(manifest.posts[0]).toMatchObject({
    post_id: 42,
    content_revision: 3,
    review_version: 7,
    approved_content_hash: "a".repeat(64),
  });
  expect(events().filter((event) => event === "close")).toHaveLength(1);
});

test.each(["read-error", "close-error", "bootstrap-error"])(
  "%s exits unsuccessfully and closes an acquired context",
  (mode) => {
    const result = run(args, mode);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("fixture");
    expect(events().filter((event) => event === "close")).toHaveLength(
      mode === "bootstrap-error" ? 0 : 1,
    );
    if (mode !== "close-error")
      expect(existsSync(join(directory, filename))).toBe(false);
  },
);

test("filesystem write failure is unsuccessful and still closes the application", () => {
  mkdirSync(join(directory, filename));
  const result = run();
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(events().at(-1)).toBe("close");
});
