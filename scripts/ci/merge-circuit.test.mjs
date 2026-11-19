import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { classifyCircuit, parseCodeowners } from "./merge-circuit.mjs";

const entries = [
  { glob: "docs/**", domain: "D12", owner: "x", sourceConfidence: "high", risk: "low" },
  { glob: "backend/src/modules/seo/**", domain: "D3", owner: "x", sourceConfidence: "high", risk: "medium" },
  { glob: "backend/src/modules/payments/**", domain: "D7", owner: "x", sourceConfidence: "high", risk: "critical" },
  { glob: "backend/src/modules/pricing/**", domain: "D7", owner: "x", sourceConfidence: "high", risk: "high" },
  { glob: "backend/supabase/migrations/*seo_event_log*", domain: "D3", owner: "x", sourceConfidence: "high", risk: "low" },
  { glob: "tmp/**", domain: "UNKNOWN", owner: "__unassigned__", sourceConfidence: "low", risk: "low" },
];
const codeowners = parseCodeowners(`
# commentaire
/backend/supabase/migrations/   @owner
/scripts/ci/prod-*              @owner
/.github/CODEOWNERS             @owner
`);

test("CODEOWNERS : dossier, préfixe et fichier ancrés deviennent des globs", () => {
  assert.deepEqual(
    codeowners.map((c) => c.glob),
    ["backend/supabase/migrations/**", "scripts/ci/prod-*", ".github/CODEOWNERS"],
  );
});

test("tout en risque faible → circuit faible", () => {
  assert.equal(classifyCircuit(["docs/a.md", "docs/b.md"], entries, codeowners).circuit, "faible");
});

test("un chemin moyen relève toute la PR au circuit moyen", () => {
  assert.equal(classifyCircuit(["docs/a.md", "backend/src/modules/seo/x.ts"], entries, codeowners).circuit, "moyen");
});

test("risque élevé ou critique → circuit élevé", () => {
  assert.equal(classifyCircuit(["backend/src/modules/pricing/p.ts"], entries, codeowners).circuit, "eleve");
  assert.equal(classifyCircuit(["backend/src/modules/payments/p.ts"], entries, codeowners).circuit, "eleve");
});

test("une zone CODEOWNERS l'emporte sur un risque faible de la classification", () => {
  const v = classifyCircuit(["backend/supabase/migrations/20261116_seo_event_log_x.sql"], entries, codeowners);
  assert.equal(v.circuit, "eleve");
  assert.equal(v.reasons[0].code, "CODEOWNERS_ZONE");
  assert.equal(classifyCircuit(["scripts/ci/prod-rollback.sh"], entries, codeowners).circuit, "eleve");
});

test("tout doute vaut le circuit élevé : non classé, domaine inconnu, aucune modification", () => {
  assert.equal(classifyCircuit(["nowhere/x.ts"], entries, codeowners).reasons[0].code, "UNCLASSIFIED");
  assert.equal(classifyCircuit(["tmp/x.ts"], entries, codeowners).circuit, "eleve");
  assert.equal(classifyCircuit([], entries, codeowners).circuit, "eleve");
});

// ─── Workflow merge-circuits.yml : ses étapes shell sont exécutées telles quelles, avec un `gh`
// factice. Les conditions `if:` sont comparées au texte exact, puis rejouées ici (mandat BH).
const yaml = createRequire(import.meta.url)("js-yaml");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflow = yaml.load(readFileSync(join(ROOT, ".github/workflows/merge-circuits.yml"), "utf8"));
const circuitJob = workflow.jobs.circuit;
const armJob = workflow.jobs.arm;
const stepOf = (job, id) => job.steps.find((s) => s.id === id);

const HEAD = "a".repeat(40);
const OWNER = circuitJob.env.OWNER_LOGIN;
const review = (state, sha = HEAD, login = OWNER) => ({ state, commit_id: sha, user: { login } });

// État d'armement dans $GH_ARMED (true/false), revues dans $GH_REVIEWS, pannes par GH_DISABLE/GH_VIEW=ko.
const GH_FACTICE = `#!/usr/bin/env bash
echo "$*" >> "$GH_LOG"
case "$1 $2" in
  "pr merge")
    case " $* " in
      *" --disable-auto "*) [ "$GH_DISABLE" = "ko" ] && exit 1; echo false > "$GH_ARMED" ;;
      *" --auto "*" --match-head-commit "*) echo true > "$GH_ARMED" ;;
      *) exit 64 ;;
    esac ;;
  "pr view") [ "$GH_VIEW" = "ko" ] && exit 1; cat "$GH_ARMED" ;;
  "api --paginate") cat "$GH_REVIEWS" ;;
  "api repos/o/r/commits/"*"/pulls") cat "$GH_COMMIT_PULLS" ;;
  "api repos/o/r/pulls/7") cat "$GH_PULL" ;;
  *) echo "gh factice : appel inattendu : $*" >&2; exit 64 ;;
esac
`;

function runStep(step, env, dir) {
  const out = join(dir, `out-${step.id}`);
  writeFileSync(out, "");
  // Même interpréteur que le runner : bash -e -o pipefail.
  const r = spawnSync("bash", ["--noprofile", "--norc", "-eo", "pipefail", "-c", step.run], {
    env: { ...env, GITHUB_OUTPUT: out },
    encoding: "utf8",
  });
  const outputs = Object.fromEntries(
    readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  return { rc: r.status, outputs, log: `${r.stdout}${r.stderr}` };
}

// Rejoue le job « 🚦 Circuit de fusion », puis le job « 🔐 Armement » si sa condition est vraie.
function runCircuit(options = {}) {
  const c = {
    classify: "success", circuit: "faible", verdict: "", draft: "false", event: "pull_request_target",
    app: "true", reviews: [], armed: false, disable: "ok", view: "ok", appDisable: "ok", ...options,
  };
  const dir = mkdtempSync(join(tmpdir(), "merge-circuit-"));
  try {
    const f = (name) => join(dir, name);
    writeFileSync(f("gh"), GH_FACTICE);
    chmodSync(f("gh"), 0o755);
    writeFileSync(f("armed"), `${c.armed}\n`);
    writeFileSync(f("reviews.json"), JSON.stringify(c.reviews));
    writeFileSync(f("gh.log"), "");
    const env = {
      PATH: `${dir}:${process.env.PATH}`, GH_TOKEN: "x", GH_REPO: "o/r", PR: "7", HEAD_SHA: HEAD,
      IS_DRAFT: c.draft, OWNER_LOGIN: OWNER, CIRCUIT: c.circuit, CLAUDE_VERDICT: c.verdict,
      HAS_ACTIONS_APP: c.app, CLASSIFY_RESULT: c.classify, EVENT_NAME: c.event,
      GH_ARMED: f("armed"), GH_REVIEWS: f("reviews.json"), GH_LOG: f("gh.log"), GH_DISABLE: c.disable, GH_VIEW: c.view,
    };
    const approval = runStep(stepOf(circuitJob, "approval"), env, dir);
    const ok = approval.outputs.ok ?? "";
    const arm = runStep(stepOf(circuitJob, "arm"), { ...env, OK: ok }, dir); // if: !cancelled()
    const stepsOk = approval.rc === 0 && arm.rc === 0;
    const verdict = stepsOk ? runStep(stepOf(circuitJob, "verdict"), { ...env, OK: ok }, dir) : null;
    const result = stepsOk && verdict.rc === 0 ? "success" : "failure";
    const armer = arm.outputs.armer === "true";
    const desarmer = arm.outputs.desarmer === "true";
    assert.ok(!(armer && desarmer), "armer et desarmer ne sont jamais vrais ensemble");

    let app = "skipped";
    if (c.event === "pull_request_target" && ((result === "success" && armer) || desarmer)) {
      const appEnv = {
        ...env, ARMER: String(result === "success" && armer), DESARMER: String(desarmer),
        GH_DISABLE: c.appDisable, GH_VIEW: "ok",
      };
      const ran = [];
      if (appEnv.ARMER === "true" && appEnv.DESARMER !== "true") ran.push(runStep(stepOf(armJob, "armer"), appEnv, dir));
      if (appEnv.DESARMER === "true") ran.push(runStep(stepOf(armJob, "desarmer"), appEnv, dir));
      app = ran.every((r) => r.rc === 0) ? "success" : "failure";
    }
    return {
      result, armer, desarmer, app,
      armed: readFileSync(f("armed"), "utf8").trim() === "true",
      log: `${approval.log}${arm.log}`,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("workflow : le job du circuit garde son nom, n'est jamais sauté et lit le résultat du calcul", () => {
  assert.equal(circuitJob.name, "🚦 Circuit de fusion");
  assert.deepEqual(circuitJob.needs, ["classify", "claude-review"]);
  assert.equal(circuitJob.if, "${{ !cancelled() }}");
  assert.equal(circuitJob.env.CLASSIFY_RESULT, "${{ needs.classify.result }}");
  assert.equal(circuitJob.env.EVENT_NAME, "${{ github.event_name }}");
  assert.deepEqual(circuitJob.outputs, {
    armer: "${{ steps.arm.outputs.armer }}",
    desarmer: "${{ steps.arm.outputs.desarmer }}",
  });
  assert.equal(stepOf(circuitJob, "arm").if, "${{ !cancelled() }}");
  assert.equal(stepOf(circuitJob, "verdict").if, undefined);
  assert.deepEqual(circuitJob.steps.slice(-3).map((s) => s.id), ["approval", "arm", "verdict"]);
});

test("workflow : l'App n'agit que sur pull_request_target, dans l'environnement app-actions", () => {
  assert.equal(armJob.environment, "app-actions");
  assert.deepEqual(armJob.permissions, {});
  assert.equal(armJob.needs, "circuit");
  assert.equal(
    armJob.if,
    "${{ !cancelled() && github.event_name == 'pull_request_target' && ((needs.circuit.result == 'success' && needs.circuit.outputs.armer == 'true') || needs.circuit.outputs.desarmer == 'true') }}",
  );
  assert.equal(armJob.env.ARMER, "${{ needs.circuit.result == 'success' && needs.circuit.outputs.armer == 'true' }}");
  assert.equal(armJob.env.DESARMER, "${{ needs.circuit.outputs.desarmer == 'true' }}");
  assert.equal(stepOf(armJob, "armer").if, "env.ARMER == 'true' && env.DESARMER != 'true'");
  assert.equal(stepOf(armJob, "desarmer").if, "env.DESARMER == 'true'");
});

test("circuit non calculé : le job échoue et désarme, quel que soit le résultat du calcul", () => {
  for (const classify of ["failure", "cancelled", "skipped", ""]) {
    for (const event of ["pull_request_target", "pull_request_review"]) {
      const r = runCircuit({ classify, circuit: "", event, armed: true });
      assert.deepEqual(
        { result: r.result, armer: r.armer, desarmer: r.desarmer, app: r.app, armed: r.armed },
        { result: "failure", armer: false, desarmer: false, app: "skipped", armed: false },
        `${classify || "absent"} / ${event}`,
      );
      assert.match(r.log, /Circuit non calculé/);
    }
  }
  // Un circuit resté d'un calcul en échec n'est pas repris.
  assert.equal(runCircuit({ classify: "failure", circuit: "faible" }).result, "failure");
  // Calcul réussi, circuit vide ou inconnu : même issue.
  for (const circuit of ["", "autre"]) {
    const r = runCircuit({ circuit, armed: true });
    assert.deepEqual([r.result, r.armer, r.armed], ["failure", false, false], `circuit « ${circuit} »`);
  }
});

test("désarmement vérifié : s'il n'est pas constaté, l'App désarme ou le job le dit", () => {
  // pull_request_target : la main passe à l'App, qui désarme et relit.
  for (const panne of [{ disable: "ko" }, { view: "ko" }]) {
    const r = runCircuit({ classify: "failure", circuit: "", armed: true, ...panne });
    assert.deepEqual([r.result, r.desarmer, r.app], ["failure", true, "success"], JSON.stringify(panne));
  }
  assert.equal(runCircuit({ classify: "failure", circuit: "", armed: true, disable: "ko" }).armed, false);
  // L'App échoue aussi : son job échoue, rien n'est dit désarmé.
  const ko = runCircuit({ circuit: "moyen", verdict: "HOLD", armed: true, disable: "ko", appDisable: "ko" });
  assert.deepEqual([ko.result, ko.app, ko.armed], ["failure", "failure", true]);
  // pull_request_review : l'App n'agit pas ; le job échoue en nommant le geste.
  const rev = runCircuit({ circuit: "moyen", verdict: "HOLD", event: "pull_request_review", armed: true, disable: "ko" });
  assert.deepEqual([rev.result, rev.desarmer, rev.app, rev.armed], ["failure", true, "skipped", true]);
  assert.match(rev.log, /désarmer à la main/);
});

test("circuit faible : admis, armé par l'App sur pull_request_target seulement", () => {
  const r = runCircuit({ circuit: "faible" });
  assert.deepEqual([r.result, r.armer, r.app, r.armed], ["success", true, "success", true]);
  const rev = runCircuit({ circuit: "faible", event: "pull_request_review" });
  assert.deepEqual([rev.result, rev.app, rev.armed], ["success", "skipped", false]);
  const draft = runCircuit({ circuit: "faible", draft: "true", armed: true });
  assert.deepEqual([draft.result, draft.armer, draft.armed], ["success", false, false]);
  const sansApp = runCircuit({ circuit: "faible", app: "false" });
  assert.deepEqual([sansApp.result, sansApp.armer, sansApp.app, sansApp.armed], ["success", false, "skipped", false]);
});

test("circuit moyen : seul le verdict GO de ce run admet", () => {
  const go = runCircuit({ circuit: "moyen", verdict: "GO" });
  assert.deepEqual([go.result, go.armer, go.armed], ["success", true, true]);
  for (const verdict of ["HOLD", "", "go"]) {
    const r = runCircuit({ circuit: "moyen", verdict, armed: true });
    assert.deepEqual([r.result, r.armer, r.armed], ["failure", false, false], `verdict « ${verdict} »`);
  }
});

test("circuit élevé : la dernière revue de l'owner sur la tête exacte décide", () => {
  const AUTRE = "b".repeat(40);
  const refus = [
    [],
    [review("APPROVED", AUTRE)],
    [review("APPROVED", HEAD, "quelqu-un-d-autre")],
    [review("COMMENTED")],
    [review("APPROVED"), review("CHANGES_REQUESTED")],
    [review("APPROVED"), review("DISMISSED")],
  ];
  for (const reviews of refus) {
    const r = runCircuit({ circuit: "eleve", reviews, armed: true });
    assert.deepEqual([r.result, r.armer, r.armed], ["failure", false, false], JSON.stringify(reviews));
  }
  for (const reviews of [[review("APPROVED")], [review("CHANGES_REQUESTED"), review("APPROVED"), review("COMMENTED")]]) {
    assert.equal(runCircuit({ circuit: "eleve", reviews }).result, "success", JSON.stringify(reviews));
  }
});

test("circuit élevé approuvé sur la tête : l'App arme, sur pull_request_target seulement", () => {
  const reviews = [review("APPROVED")];
  const cible = runCircuit({ circuit: "eleve", reviews });
  assert.deepEqual([cible.result, cible.armer, cible.app, cible.armed], ["success", true, "success", true]);
  // La revue arrive par pull_request_review : le check passe, rien n'est armé par cet événement.
  const revue = runCircuit({ circuit: "eleve", reviews, event: "pull_request_review" });
  assert.deepEqual([revue.result, revue.armer, revue.app, revue.armed], ["success", true, "skipped", false]);
  assert.match(revue.log, /ne peut pas armer/);
  // Brouillon ou App absente : check vert, rien d'armé.
  const draft = runCircuit({ circuit: "eleve", reviews, draft: "true", armed: true });
  assert.deepEqual([draft.result, draft.armer, draft.armed], ["success", false, false]);
  const sansApp = runCircuit({ circuit: "eleve", reviews, app: "false" });
  assert.deepEqual([sansApp.result, sansApp.armer, sansApp.armed], ["success", false, false]);
});

test("circuit élevé : une tête nouvelle invalide l'approbation et désarme", () => {
  // La PR était armée sur la tête approuvée ; la tête de l'événement est une autre.
  const reviews = [review("APPROVED", "b".repeat(40))];
  for (const event of ["pull_request_target", "pull_request_review"]) {
    const r = runCircuit({ circuit: "eleve", reviews, event, armed: true });
    assert.deepEqual([r.result, r.armer, r.armed], ["failure", false, false], event);
  }
  // Désarmement non constaté avec le jeton du workflow : l'App désarme.
  const r = runCircuit({ circuit: "eleve", reviews, armed: true, disable: "ko" });
  assert.deepEqual([r.result, r.desarmer, r.app, r.armed], ["failure", true, "success", false]);
});

// ─── Relais merge-circuits-relais.yml (circuit élevé, après la revue de l'owner) ───
const relais = yaml.load(readFileSync(join(ROOT, ".github/workflows/merge-circuits-relais.yml"), "utf8"));
const pull = (over = {}) => ({
  number: 7, state: "open", draft: false, auto_merge: null,
  head: { sha: HEAD, repo: { full_name: "o/r" } },
  base: { ref: "main", repo: { full_name: "o/r" } },
  ...over,
});

// Rejoue les étapes `pr` et `decide` du job de décision, puis le job d'action si sa condition est vraie.
function runRelais(options = {}) {
  const c = { sha: HEAD, pulls: [pull()], pr: pull(), circuit: "eleve", reviews: [], app: "true", appDisable: "ok", ...options };
  // Ce dossier sert aussi de RUNNER_TEMP : les fichiers donnés au gh factice (fixture-*) ne portent
  // pas le nom de ceux qu'écrivent les étapes.
  const dir = mkdtempSync(join(tmpdir(), "merge-circuit-relais-"));
  try {
    const f = (name) => join(dir, name);
    writeFileSync(f("gh"), GH_FACTICE);
    chmodSync(f("gh"), 0o755);
    writeFileSync(f("armed"), `${c.pr.auto_merge !== null}\n`);
    writeFileSync(f("fixture-reviews.json"), JSON.stringify(c.reviews));
    writeFileSync(f("fixture-pulls.json"), JSON.stringify(c.pulls));
    writeFileSync(f("fixture-pull.json"), JSON.stringify(c.pr));
    writeFileSync(f("gh.log"), "");
    const env = {
      PATH: `${dir}:${process.env.PATH}`, RUNNER_TEMP: dir, GH_TOKEN: "x", GH_REPO: "o/r", RUN_HEAD_SHA: c.sha,
      OWNER_LOGIN: relais.jobs.decide.env.OWNER_LOGIN, HAS_ACTIONS_APP: c.app,
      GH_ARMED: f("armed"), GH_REVIEWS: f("fixture-reviews.json"), GH_COMMIT_PULLS: f("fixture-pulls.json"), GH_PULL: f("fixture-pull.json"),
      GH_LOG: f("gh.log"), GH_DISABLE: c.appDisable, GH_VIEW: "ok",
    };
    const found = runStep(stepOf(relais.jobs.decide, "pr"), env, dir);
    assert.equal(found.rc, 0, found.log);
    let action = "";
    if (found.outputs.number) {
      const decide = runStep(stepOf(relais.jobs.decide, "decide"), { ...env, PR: found.outputs.number, CIRCUIT: c.circuit }, dir);
      assert.equal(decide.rc, 0, decide.log);
      action = decide.outputs.action;
    }
    let app = "skipped";
    if (action === "armer" || action === "desarmer") {
      const r = runStep(stepOf(relais.jobs.act, action), { ...env, PR: found.outputs.number, HEAD_SHA: found.outputs.head, ACTION: action }, dir);
      app = r.rc === 0 ? "success" : "failure";
    }
    return { number: found.outputs.number ?? "", action, app, armed: readFileSync(f("armed"), "utf8").trim() === "true" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("relais : part à la fin d'un run de revue, sur main, et garde la clé dans le seul job d'action", () => {
  assert.equal(workflow.name, "🚦 Circuit de fusion");
  assert.deepEqual(relais.on, { workflow_run: { workflows: [workflow.name], types: ["completed"] } });
  assert.notEqual(relais.name, workflow.name);
  const { decide, act } = relais.jobs;
  assert.equal(decide.if, "${{ github.event.workflow_run.event == 'pull_request_review' }}");
  assert.deepEqual(decide.permissions, { contents: "read", "pull-requests": "read" });
  assert.equal(decide.environment, undefined);
  assert.equal(decide.env.RUN_HEAD_SHA, "${{ github.event.workflow_run.head_sha }}");
  // Le code exécuté est celui de main : checkout par défaut, sans référence ni dépôt choisis.
  const checkouts = decide.steps.filter((s) => (s.uses ?? "").startsWith("actions/checkout@"));
  assert.deepEqual(checkouts.map((s) => s.with), [{ "persist-credentials": false }]);
  assert.equal(act.environment, "app-actions");
  assert.deepEqual(act.permissions, {});
  assert.equal(act.if, "${{ needs.decide.outputs.action == 'armer' || needs.decide.outputs.action == 'desarmer' }}");
  assert.equal(stepOf(act, "armer").if, "env.ACTION == 'armer'");
  assert.equal(stepOf(act, "desarmer").if, "env.ACTION == 'desarmer'");
  // Aucun job du relais ne porte le nom du contrôle.
  for (const job of Object.values(relais.jobs)) assert.notEqual(job.name, circuitJob.name);
  // Rien d'autre que le SHA de tête n'est repris du run déclencheur.
  const refs = readFileSync(join(ROOT, ".github/workflows/merge-circuits-relais.yml"), "utf8")
    .split("\n").filter((l) => !l.trim().startsWith("#")).join("\n").match(/github\.event\.workflow_run\.[a-z_.]+/g);
  assert.deepEqual([...new Set(refs)].sort(), ["github.event.workflow_run.event", "github.event.workflow_run.head_sha"]);
});

test("relais : la règle d'approbation est la même que dans le workflow du circuit", () => {
  const regle = [
    "add | map(select(.commit_id == $sha and .user.login == $who",
    'and (.state == "APPROVED" or .state == "CHANGES_REQUESTED" or .state == "DISMISSED")))',
    '| last | (.state // "") == "APPROVED"',
  ];
  for (const ligne of regle) {
    assert.ok(stepOf(circuitJob, "approval").run.includes(ligne), `circuit : ${ligne}`);
    assert.ok(stepOf(relais.jobs.decide, "decide").run.includes(ligne), `relais : ${ligne}`);
  }
  assert.equal(relais.jobs.decide.env.OWNER_LOGIN, OWNER);
});

test("relais : n'arme qu'une PR du dépôt, en circuit élevé, approuvée par l'owner sur la tête exacte", () => {
  const ok = runRelais({ reviews: [review("APPROVED")] });
  assert.deepEqual(ok, { number: "7", action: "armer", app: "success", armed: true });
  const AUTRE = "b".repeat(40);
  const rien = [
    { reviews: [] },
    { reviews: [review("APPROVED", AUTRE)] },
    { reviews: [review("APPROVED", HEAD, "quelqu-un-d-autre")] },
    { reviews: [review("APPROVED"), review("CHANGES_REQUESTED")] },
    { reviews: [review("APPROVED"), review("DISMISSED")] },
    { reviews: [review("APPROVED")], circuit: "faible" },
    { reviews: [review("APPROVED")], circuit: "moyen" },
    { reviews: [review("APPROVED")], circuit: "" },
    { reviews: [review("APPROVED")], pr: pull({ draft: true }) },
    { reviews: [review("APPROVED")], app: "false" },
    // Entre la recherche et la décision : fermée, tête déplacée, autre base, branche hors du dépôt.
    { reviews: [review("APPROVED")], pr: pull({ state: "closed" }) },
    { reviews: [review("APPROVED")], pr: pull({ head: { sha: AUTRE, repo: { full_name: "o/r" } } }) },
    { reviews: [review("APPROVED")], pr: pull({ base: { ref: "dev", repo: { full_name: "o/r" } } }) },
    { reviews: [review("APPROVED")], pr: pull({ head: { sha: HEAD, repo: { full_name: "ailleurs/r" } } }) },
    { reviews: [review("APPROVED")], pr: pull({ head: { sha: HEAD, repo: null } }) },
  ];
  for (const cas of rien) {
    const r = runRelais(cas);
    assert.deepEqual([r.action, r.app, r.armed], ["rien", "skipped", false], JSON.stringify(cas));
  }
});

test("relais : sans PR unique du dépôt sur ce SHA, aucune décision n'est prise", () => {
  const reviews = [review("APPROVED")];
  const sans = [
    { pulls: [] },
    { pulls: [pull(), pull({ number: 8 })] },
    { pulls: [pull({ state: "closed" })] },
    { pulls: [pull({ base: { ref: "dev", repo: { full_name: "o/r" } } })] },
    { pulls: [pull({ head: { sha: HEAD, repo: { full_name: "ailleurs/r" } } })] },
    { pulls: [pull({ head: { sha: "b".repeat(40), repo: { full_name: "o/r" } } })] },
    { sha: "main" },
    { sha: `${HEAD}\nx` },
    { sha: "" },
  ];
  for (const cas of sans) {
    const r = runRelais({ reviews, ...cas });
    assert.deepEqual(r, { number: "", action: "", app: "skipped", armed: false }, JSON.stringify(cas));
  }
});

test("relais : approbation retirée sur une PR armée → l'App désarme et relit", () => {
  const armee = pull({ auto_merge: { merge_method: "squash" } });
  const r = runRelais({ pr: armee, reviews: [review("APPROVED"), review("DISMISSED")] });
  assert.deepEqual([r.action, r.app, r.armed], ["desarmer", "success", false]);
  const brouillon = runRelais({ pr: pull({ draft: true, auto_merge: {} }), reviews: [review("APPROVED")] });
  assert.deepEqual([brouillon.action, brouillon.armed], ["desarmer", false]);
  const ko = runRelais({ pr: armee, reviews: [], appDisable: "ko" });
  assert.deepEqual([ko.action, ko.app, ko.armed], ["desarmer", "failure", true]);
  // Déjà armée et toujours approuvée : rien.
  const deja = runRelais({ pr: armee, reviews: [review("APPROVED")] });
  assert.deepEqual([deja.action, deja.app, deja.armed], ["rien", "skipped", true]);
});
