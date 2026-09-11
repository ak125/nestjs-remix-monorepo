import { appendFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Validate evidence, not performance thresholds (those belong to native LHCI). */
export function checkReports({ reports, assertions, urls, runs, metrics }) {
  const issues = [];
  if (!Array.isArray(urls) || urls.length === 0 || new Set(urls).size !== urls.length) {
    throw new Error('Expected URLs must be a non-empty unique list');
  }
  for (const url of urls) {
    if (!['http:', 'https:'].includes(new URL(url).protocol)) throw new Error('Expected HTTP URLs');
  }
  if (!Number.isInteger(runs) || runs < 1) throw new Error('Expected a positive run count');
  if (!Array.isArray(metrics) || metrics.length === 0) throw new Error('Missing timing metrics');
  if (!Array.isArray(assertions) || assertions.length === 0) issues.push('Missing native assertion evidence');

  const pages = urls.map((url) => {
    const selected = reports.filter((report) => report?.requestedUrl === url);
    const pageIssues = [];
    if (selected.length !== runs) pageIssues.push(`Expected ${runs} reports, found ${selected.length}`);
    const seen = new Set();
    for (const report of selected) {
      if (typeof report.fetchTime !== 'string' || !Number.isFinite(Date.parse(report.fetchTime))) {
        pageIssues.push('Missing or invalid collection time');
      } else if (seen.has(report.fetchTime)) {
        pageIssues.push('Duplicate collection time');
      }
      seen.add(report.fetchTime);
      const finalUrl = report.finalDisplayedUrl ?? report.finalUrl;
      if (finalUrl !== url) pageIssues.push(`Unexpected final URL: ${finalUrl ?? 'missing'}`);
      if (report.runtimeError) pageIssues.push(`Runtime error: ${report.runtimeError.code ?? 'unknown'}`);
      if (!Array.isArray(report.runWarnings)) pageIssues.push('Missing collection warning status');
      else for (const warning of report.runWarnings) pageIssues.push(`Collection warning: ${warning}`);
      for (const metric of metrics) {
        const value = report.audits?.[metric]?.numericValue;
        if (typeof value !== 'number' || !Number.isFinite(value)) pageIssues.push(`Missing measurement: ${metric}`);
      }
    }
    // With includePassedAssertions, every declared timing must have native evidence.
    for (const metric of metrics) {
      if (!Array.isArray(assertions) || !assertions.some((a) =>
        a?.url === url && a.auditId === metric && a.name === 'maxNumericValue' &&
        typeof a.passed === 'boolean' && Number.isFinite(a.actual) && Number.isFinite(a.expected))) {
        pageIssues.push(`Missing native assertion: ${metric}`);
      }
    }
    const uniqueIssues = [...new Set(pageIssues)];
    if (uniqueIssues.length) issues.push(`${url}: invalid evidence`);
    return { url, count: selected.length, valid: uniqueIssues.length === 0, issues: uniqueIssues };
  });
  for (const report of reports) {
    if (!urls.includes(report?.requestedUrl)) issues.push(`Unexpected report URL: ${report?.requestedUrl ?? 'missing'}`);
  }
  return { valid: issues.length === 0, expectedRuns: runs, pages, issues };
}

const markdown = (value) => String(value).replace(/[\r\n|`<>]/g, ' ');

export function renderSummary(result, budgets) {
  const lines = [
    '## Lighthouse — qualité des mesures', '',
    `**${result.valid ? 'Collecte exploitable' : 'Collecte non exploitable'}** — la réussite du job exige des preuves complètes.`, '',
    '| URL demandée | Rapports | Qualité |', '|---|---:|---|',
    ...result.pages.map((p) => `| ${markdown(p.url)} | ${p.count}/${result.expectedRuns} | ${p.valid ? 'Valide' : 'Invalide'} |`), '',
    ...result.pages.flatMap((p) => p.issues.map((issue) => `- ${markdown(p.url)} : ${markdown(issue)}`)),
    ...result.issues.filter((issue) => !issue.endsWith(': invalid evidence')).map((issue) => `- ${markdown(issue)}`), '',
    '### Budgets configurés', '',
    'Seuils lus dans frontend/lighthouse-budget.json ; verdicts dans assertion-results.json.', '',
    '| Périmètre | Métrique | Budget natif |', '|---|---|---:|',
    ...budgets.flatMap((b) => b.timings.map((t) => `| ${markdown(b.path)} | ${markdown(t.metric)} | ${t.budget} |`)), '',
    'Une collecte invalide ne valide aucune performance. Aucun budget ni niveau de sévérité n’est abaissé.', '',
  ];
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const directory = resolve(process.argv[2] ?? '.lighthouseci');
  try {
    const urls = (process.env.LIGHTHOUSE_URLS ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const budgets = JSON.parse(readFileSync('frontend/lighthouse-budget.json', 'utf8'));
    const reports = readdirSync(directory).filter((f) => /^lhr-.*\.json$/.test(f))
      .map((f) => JSON.parse(readFileSync(resolve(directory, f), 'utf8')));
    const assertions = JSON.parse(readFileSync(resolve(directory, 'assertion-results.json'), 'utf8'));
    const result = checkReports({ reports, assertions, urls, runs: Number(process.env.LIGHTHOUSE_RUNS),
      metrics: [...new Set(budgets.flatMap((b) => b.timings.map((t) => t.metric)))] });
    writeFileSync(resolve(directory, 'collection-quality.json'), JSON.stringify(result, null, 2) + '\n');
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderSummary(result, budgets));
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
  } catch (error) {
    // Never leave a previous successful verdict beside unreadable/new evidence.
    mkdirSync(directory, { recursive: true });
    writeFileSync(resolve(directory, 'collection-quality.json'), JSON.stringify({
      valid: false, issues: [`Evidence unavailable: ${error.message}`], pages: [],
    }, null, 2) + '\n');
    console.error(`Lighthouse evidence unavailable: ${error.message}`);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `\n## Lighthouse — collecte non exploitable\n\n${markdown(error.message)}\n`);
    process.exitCode = 1;
  }
}
