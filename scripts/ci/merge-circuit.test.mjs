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

test("circuit élevé approuvé : le check passe, la fusion reste à l'owner (rien n'est armé)", () => {
  for (const event of ["pull_request_target", "pull_request_review"]) {
    const r = runCircuit({ circuit: "eleve", reviews: [review("APPROVED")], event, armed: true });
    assert.deepEqual([r.result, r.armer, r.app, r.armed], ["success", false, "skipped", false], event);
  }
});
