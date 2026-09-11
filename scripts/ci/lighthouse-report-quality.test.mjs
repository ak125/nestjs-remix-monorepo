import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReports, renderSummary } from './lighthouse-report-quality.mjs';

const require = createRequire(import.meta.url);
const config = require('./lighthouserc.cjs');
const budgets = require('../../frontend/lighthouse-budget.json');
const metrics = budgets.flatMap((b) => b.timings.map((t) => t.metric));
const urls = ['http://localhost:3200/', 'http://localhost:3200/search?q=plaquette'];
const script = join(dirname(fileURLToPath(import.meta.url)), 'lighthouse-report-quality.mjs');

function fixture() {
  return {
    urls, runs: 3, metrics,
    reports: urls.flatMap((url) => [0, 1, 2].map((i) => ({
      requestedUrl: url, finalDisplayedUrl: url, fetchTime: `2026-09-11T01:0${i}:00.000Z`,
      runWarnings: [], audits: Object.fromEntries(metrics.map((metric) => [metric, { numericValue: 0 }])),
    }))),
    assertions: urls.flatMap((url) => metrics.map((auditId) => ({
      url, auditId, name: 'maxNumericValue', passed: true, actual: 0, expected: 100,
    }))),
  };
}

test('native config keeps the existing budgets and includes passed assertions', () => {
  assert.equal(config.ci.assert.includePassedAssertions, true);
  assert.equal(budgets[0].timings.find((t) => t.metric === 'largest-contentful-paint').budget, 11100);
  assert.deepEqual(config.ci.assert.assertions['largest-contentful-paint'], ['error', { maxNumericValue: 11100 }]);
  assert.equal(config.ci.assert.budgetsFile, undefined);
});

test('complete collection with all native assertions is valid', () => {
  assert.equal(checkReports(fixture()).valid, true);
});

for (const [name, mutate] of [
  ['missing run', (f) => f.reports.pop()],
  ['extra run', (f) => f.reports.push(structuredClone(f.reports[0]))],
  ['duplicate timestamp', (f) => { f.reports[1].fetchTime = f.reports[0].fetchTime; }],
  ['redirect to home with healthy scores', (f) => { f.reports[3].finalDisplayedUrl = urls[0]; }],
  ['missing final URL', (f) => { delete f.reports[0].finalDisplayedUrl; }],
  ['runtime error', (f) => { f.reports[0].runtimeError = { code: 'NO_FCP' }; }],
  ['incomplete search warning', (f) => { f.reports[3].runWarnings = ['The page loaded too slowly to finish within the time limit. Results may be incomplete.']; }],
  ['missing warning status', (f) => { delete f.reports[0].runWarnings; }],
  ['missing measurement', (f) => { delete f.reports[0].audits[metrics[0]]; }],
  ['null measurement', (f) => { f.reports[0].audits[metrics[0]].numericValue = null; }],
  ['non-finite measurement', (f) => { f.reports[0].audits[metrics[0]].numericValue = Infinity; }],
  ['unrequested page', (f) => { f.reports[0].requestedUrl = 'http://localhost:3200/unexpected'; }],
  ['empty native assertions', (f) => { f.assertions = []; }],
  ['missing assertion for a timing', (f) => { f.assertions.pop(); }],
  ['missing collection time', (f) => { delete f.reports[0].fetchTime; }],
]) {
  test(`rejects ${name}`, () => {
    const f = fixture(); mutate(f);
    assert.equal(checkReports(f).valid, false);
  });
}

test('native budget failure remains visible, separate from evidence completeness', () => {
  const f = fixture();
  f.assertions[0] = { ...f.assertions[0], passed: false, actual: 99999, level: 'error' };
  assert.equal(checkReports(f).valid, true);
  assert.equal(f.assertions[0].passed, false); // The native action enforces this failure.
});

test('summary uses configured budgets and escapes untrusted markdown', () => {
  const result = checkReports(fixture());
  result.pages[0].issues.push('<SCRIPT>|\n`unsafe`');
  const summary = renderSummary(result, budgets);
  assert.match(summary, /11100/);
  assert.equal(summary.includes('<'), false);
  assert.equal(summary.includes('>'), false);
  assert.equal(summary.includes('1.8s'), false);
});

test('invalid declared scope fails rather than validating zero pages', () => {
  assert.throws(() => checkReports({ ...fixture(), urls: [] }));
  assert.throws(() => checkReports({ ...fixture(), urls: [urls[0], urls[0]] }));
  assert.throws(() => checkReports({ ...fixture(), runs: 0 }));
});

test('CLI produces evidence and fails closed for incomplete or unreadable files', () => {
  const temp = mkdtempSync(join(tmpdir(), 'lhci-quality-'));
  try {
    mkdirSync(join(temp, 'frontend'));
    writeFileSync(join(temp, 'frontend/lighthouse-budget.json'), JSON.stringify(budgets));
    const results = join(temp, '.lighthouseci'); mkdirSync(results);
    const f = fixture();
    f.reports.forEach((r, i) => writeFileSync(join(results, `lhr-${i}.json`), JSON.stringify(r)));
    writeFileSync(join(results, 'assertion-results.json'), JSON.stringify(f.assertions));
    const options = { cwd: temp, encoding: 'utf8', env: { ...process.env,
      LIGHTHOUSE_URLS: urls.join('\n'), LIGHTHOUSE_RUNS: '3', GITHUB_STEP_SUMMARY: join(temp, 'summary.md') } };
    execFileSync(process.execPath, [script], options);
    assert.equal(JSON.parse(readFileSync(join(results, 'collection-quality.json'))).valid, true);
    writeFileSync(join(results, 'lhr-0.json'), '{bad JSON');
    assert.equal(spawnSync(process.execPath, [script], options).status, 1);
    assert.equal(JSON.parse(readFileSync(join(results, 'collection-quality.json'))).valid, false);
    f.reports[0].runWarnings = ['incomplete'];
    writeFileSync(join(results, 'lhr-0.json'), JSON.stringify(f.reports[0]));
    assert.equal(spawnSync(process.execPath, [script], options).status, 1);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});
