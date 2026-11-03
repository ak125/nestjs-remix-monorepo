#!/usr/bin/env node
// =============================================================================
// Garde de sortie editorial-review : hook Stop (Codex, Claude Code), puis vérification après la fin.
//
// Frontière. Le hook Stop reçoit sur l'entrée standard le dernier message généré par l'agent
// (`last_assistant_message`), à la fin de son tour : la réponse finale, pas une sortie d'outil ni
// un fichier. La garde la contrôle avec check-editorial-review.mjs en mode strict, sans la
// normaliser, et en écrit les octets exacts dans une trace. Refusée, elle répond
// {"decision":"block","reason":…} : l'agent reprend dans la même session, la version refusée reste
// en trace. Après MAX_REPRISES refus, la garde laisse la session finir sur un refus tracé.
// L'agent ne reçoit aucun outil, mais rien ne confine les traces : elles sont écrites sous le même
// utilisateur que l'agent. Elles sont des preuves conservées, pas une enceinte ; la preuve de
// livraison se recalcule depuis le flux natif, hors de l'agent.
//
// La garde ne remplace pas la réponse : la sortie native (`codex exec -o` et dernier
// `agent_message` du flux --json ; `result` du flux stream-json de Claude Code) reste la
// livraison. Un plafond natif de reprises peut clore la session sans nouvelle décision de la
// garde : `--verifier <réponse finale extraite du flux natif>` recontrôle donc cette réponse en
// mode strict et la confronte à la dernière trace (mêmes octets, décision « livree »).
//
// Sortie du hook, identique pour les deux CLI : code 0 avec un objet JSON sur stdout, toujours
// ({"decision":"block","reason":…} pour une reprise, {"continue":true} sinon) ; code 1, stdout
// vide et cause sur stderr si l'entrée n'est pas contrôlable (arrêt laissé, trace « non_controlee ») ;
// jamais 2, qu'un hook Stop lit comme un blocage.
//
// Usage :
//   editorial-review-stop-gate.mjs --traces <dossier> --root <dossier>...                    (hook)
//   editorial-review-stop-gate.mjs --traces <dossier> --root <dossier>... --verifier <fichier>
// Un dossier de traces par exécution native. Vérification : 0 appliquee, 3 partielle, 1 sinon.
// =============================================================================
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkOutput } from "./check-editorial-review.mjs";

export const MAX_REPRISES = 2;
const LIVRABLE = new Set(["appliquee", "partielle"]);
const ALLOW = `${JSON.stringify({ continue: true })}\n`;
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

function deliveries(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((f) => f.match(/^livraison-(\d+)\.json$/))
    .filter(Boolean)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
}

// « wx » : une trace écrite n'est jamais remplacée par la garde.
function writeTrace(dir, k, bytes, record) {
  mkdirSync(dir, { recursive: true });
  if (bytes) writeFileSync(join(dir, `livraison-${k}.txt`), bytes, { flag: "wx" });
  writeFileSync(join(dir, `livraison-${k}.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
}

export function gate(raw, { traces, roots }) {
  const k = (deliveries(traces).at(-1) ?? 0) + 1;
  let input = null;
  try {
    input = JSON.parse(raw);
  } catch {
    input = null;
  }
  const ok = input !== null && typeof input === "object" && !Array.isArray(input);
  const field = (name) => (ok && name in input ? input[name] : null);
  const base = {
    livraison: k,
    horodatage: new Date().toISOString(),
    session_id: field("session_id"),
    hook_event_name: field("hook_event_name"),
    stop_hook_active: field("stop_hook_active"),
    transcript_path: field("transcript_path"),
  };
  const message = typeof field("last_assistant_message") === "string" ? input.last_assistant_message : null;
  let cause = null;
  if (!ok) cause = "entrée du hook illisible (objet JSON attendu)";
  else if (input.hook_event_name !== "Stop") cause = `événement ${JSON.stringify(input.hook_event_name)} au lieu de Stop`;
  else if (message === null) cause = "last_assistant_message absent : le dernier message n'est pas contrôlable";
  const bytes = message === null ? null : Buffer.from(message, "utf8");
  let report = null;
  if (!cause) {
    try {
      report = checkOutput(message, { roots, strict: true });
    } catch (e) {
      cause = `contrôle en échec : ${e.message}`;
    }
  }
  if (cause) {
    writeTrace(traces, k, bytes, { ...base, decision: "non_controlee", cause });
    return { code: 1, stdout: "", stderr: `editorial-review-stop-gate : ${cause} ; livraison ${k} non contrôlée, arrêt laissé\n` };
  }
  const entree = { octets: bytes.length, sha256: sha256(bytes) };
  const decision = LIVRABLE.has(report.resultat) ? "livree" : k <= MAX_REPRISES ? "reprise" : "borne_atteinte";
  writeTrace(traces, k, bytes, { ...base, entree, resultat: report.resultat, erreurs: report.erreurs, decision });
  if (decision === "livree") return { code: 0, stdout: ALLOW, stderr: "" };
  const head = `editorial-review-stop-gate : réponse finale refusée, livraison ${k} (${entree.octets} o, sha256 ${entree.sha256}), contrôle ${report.resultat.toUpperCase()} en mode strict`;
  if (decision === "borne_atteinte") {
    return { code: 0, stdout: ALLOW, stderr: `${head} ; borne de ${MAX_REPRISES} reprises atteinte : arrêt laissé, réponse non livrée\n` };
  }
  const reason = [
    `${head} ; reprise ${k} sur ${MAX_REPRISES}.`,
    "Erreurs du contrôle :",
    ...report.erreurs.map((e) => `  - ${e}`),
    "Cette réponse n'est pas livrée ; elle reste conservée en trace. Redonner comme dernier message la réponse entière corrigée, prose et bloc final compris, sans renvoyer à la version refusée.",
  ].join("\n");
  return { code: 0, stdout: `${JSON.stringify({ decision: "block", reason })}\n`, stderr: "" };
}

export function verify(finalBytes, { traces, roots }) {
  const erreurs = [];
  const records = deliveries(traces).map((k) => JSON.parse(readFileSync(join(traces, `livraison-${k}.json`), "utf8")));
  const reponse = { octets: finalBytes.length, sha256: sha256(finalBytes) };
  const livraisons = records.map((r) => ({ livraison: r.livraison, decision: r.decision, resultat: r.resultat ?? null, entree: r.entree ?? null }));
  if (records.length === 0) erreurs.push("aucune trace de la garde : hook Stop non exécuté, réponse finale non contrôlée à la livraison");
  else {
    const sessions = new Set(records.map((r) => r.session_id));
    if (sessions.size > 1) erreurs.push(`traces de ${sessions.size} sessions dans le même dossier : une exécution par dossier`);
    const last = records.at(-1);
    if (last.decision !== "livree") erreurs.push(`dernière décision de la garde « ${last.decision} » (livraison ${last.livraison}) : réponse finale non livrée`);
    const txt = join(traces, `livraison-${last.livraison}.txt`);
    if (!existsSync(txt) || !readFileSync(txt).equals(finalBytes)) {
      const seen = last.entree ? `${last.entree.octets} o, sha256 ${last.entree.sha256}` : "aucun octet tracé";
      erreurs.push(`réponse finale native (${reponse.octets} o, sha256 ${reponse.sha256}) ≠ dernière livraison contrôlée (${seen}) : octets différents, comparés sans normalisation`);
    }
  }
  // La trace ne suffit pas : la réponse native est recontrôlée elle-même, hors de l'agent.
  const check = checkOutput(finalBytes.toString("utf8"), { roots, strict: true });
  if (!LIVRABLE.has(check.resultat)) erreurs.push(`recontrôle de la réponse finale native en mode strict : ${check.resultat}`);
  const verdict = erreurs.length ? "non_livree" : check.resultat;
  const report = { verdict, reponse_finale: reponse, livraisons, recontrole: { resultat: check.resultat, erreurs: check.erreurs }, erreurs };
  return { code: erreurs.length ? 1 : check.resultat === "appliquee" ? 0 : 3, report };
}

function main(argv) {
  const roots = [];
  let traces = null;
  let final = null;
  let usage = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) roots.push(resolve(argv[(i += 1)]));
    else if (a === "--traces" && argv[i + 1] && traces === null) traces = resolve(argv[(i += 1)]);
    else if (a === "--verifier" && argv[i + 1] && final === null) final = resolve(argv[(i += 1)]);
    else usage = true;
  }
  if (usage || !traces || roots.length === 0) {
    process.stderr.write("usage : editorial-review-stop-gate.mjs --traces <dossier> --root <dossier>... [--verifier <réponse finale>]\n");
    return 1;
  }
  if (final !== null) {
    const { code, report } = verify(readFileSync(final), { traces, roots });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return code;
  }
  const { code, stdout, stderr } = gate(readFileSync(0, "utf8"), { traces, roots });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
