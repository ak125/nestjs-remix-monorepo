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
// Passages de livraison (étape 6 du contrat), avec `--journal <flux natif>`. Le contrat : une fois
// l'entrée acceptée, la passer encore deux fois au contrôle sans --emit, par deux commandes
// séparées lancées l'une après l'autre ; livrer si au moins un des deux passages est reçu et si
// aucun ne rend REJETEE. Codex ne donne pas de transcript au hook (transcript_path null) ; son flux
// `codex exec --json`, copié au fil de l'eau par le lanceur editorial-review-native.sh, porte
// chaque commande avec un événement item.started puis item.completed (sortie complète dans
// aggregated_output). Un rapport est lié à la réponse si sa sortie montre « editorial-review
// <version> — <ÉTAT> » puis « entrée : <n> o, sha256 <empreinte> » égales à la réponse ; il compte
// pour l'acceptation ou un passage reçu seulement si la commande rend le code du contrôle pour cet
// état (0 APPLIQUEE, 3 PARTIELLE). La garde exige, dans cet ordre relevé (jamais déduit) :
//   1. l'acceptation : la première commande du contrôle avec --emit et un tel rapport de la version
//      courante, démarrée après la fin du dernier REJETEE lié à ces octets (un REJETEE se corrige
//      et se repasse en entier, puis les passages reprennent : il n'est pas définitif) ;
//   2. au moins deux commandes du contrôle sans --emit (aide et usage exclus), terminées en code 0
//      ou 3, démarrées après la fin de l'acceptation, aucune avant la fin d'une précédente ;
//   3. au moins une d'entre elles reçue (même rapport lié, sans --emit) ;
//   4. aucun REJETEE lié à ces octets après l'acceptation (conséquence du point 1).
// Preuve incomplète (ligne illisible, commande du contrôle sans son couple started/completed
// identifié) : refus, pas de déduction. Sinon : reprise, dans la même borne.
// Limites déclarées. Plus conservateur que le contrat : sans passage reçu, le contrat livre en
// « relecture partielle » (cause « sortie du contrôle non capturée »), la garde refuse ; une
// commande terminée en échec (code autre que 0 ou 3) n'est pas comptée, et un rapport dont le code
// diffère (contrôle passé dans un tube, par exemple) n'est pas reçu. Une commande non reçue n'est
// pas prouvée porter cette réponse (le contrat ne le peut pas non plus).
// Le journal est une preuve des passages, pas la réponse : la réponse contrôlée reste
// `last_assistant_message`. Une commande forgée pour imiter un rapport n'est pas exclue : le
// contrôle strict de la réponse par la garde reste indépendant de ces passages.
//
// `--extraire <claude|codex> <flux>` écrit sur stdout, à l'octet, la réponse finale native du flux
// (champ result du dernier événement result ; texte du dernier agent_message terminé), ou sort en 1.
//
// Sortie du hook, identique pour les deux CLI : code 0 avec un objet JSON sur stdout, toujours
// ({"decision":"block","reason":…} pour une reprise, {"continue":true} sinon) ; code 1, stdout
// vide et cause sur stderr si l'entrée n'est pas contrôlable (arrêt laissé, trace « non_controlee ») ;
// jamais 2, qu'un hook Stop lit comme un blocage.
//
// Usage :
//   editorial-review-stop-gate.mjs --traces <dossier> --root <dossier>... [--journal <flux>]   (hook)
//   editorial-review-stop-gate.mjs --env                         (hook, paramètres du lanceur)
//   editorial-review-stop-gate.mjs --traces <dossier> --root <dossier>... [--journal <flux>] --verifier <fichier>
//   editorial-review-stop-gate.mjs --extraire <claude|codex> <flux>
// --env lit EDITORIAL_REVIEW_TRACES, EDITORIAL_REVIEW_ROOTS (dossiers séparés par « : ») et, s'il
// est défini, EDITORIAL_REVIEW_JOURNAL : la commande du hook reste la même d'une session à l'autre.
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
const REPORT_RE = /^editorial-review (\S+) — ([A-Z]+)\r?\nentrée : (\d+) o, sha256 ([0-9a-f]{64})$/gm;

// Arguments de chaque invocation du contrôle dans une commande. Le corps d'un here-document (la
// réponse passée au contrôle) n'est pas une commande : une réponse qui cite « --emit » ne change pas
// la nature du passage.
function invocations(command) {
  let cmd = command;
  const doc = cmd.match(/<<-?\s*[\\'"]*([A-Za-z_]\w*)/);
  if (doc) {
    const start = cmd.indexOf("\n", doc.index);
    if (start !== -1) {
      const end = cmd.slice(start).search(new RegExp(`\\n${doc[1]}(?=["'\\s;|&)]|$)`));
      cmd = cmd.slice(0, start) + (end === -1 ? "" : cmd.slice(start + end + 1 + doc[1].length));
    }
  }
  return [...cmd.matchAll(/check-editorial-review\.mjs((?:[ \t]+[^\s|;&<>()]+)*)/g)].map((m) => m[1]);
}

const flag = (args, re) => args.some((a) => new RegExp(`(^|[\\s'"])(${re})(?=[\\s'"=]|$)`).test(a));

// Commandes du contrôle relevées dans le flux natif, avec la ligne de leur item.started (debut) et
// de leur item.completed (fin), liées ou non à la réponse `entree`.
export function controlCommands(journal, entree, version) {
  const seen = new Map();
  let illisibles = 0;
  journal.split("\n").forEach((line, n) => {
    if (!line.trim()) return;
    let ev = null;
    try {
      ev = JSON.parse(line);
    } catch {
      illisibles += 1;
      return;
    }
    const started = ev && ev.type === "item.started";
    const item = ev && (started || ev.type === "item.completed") && ev.item && ev.item.type === "command_execution" ? ev.item : null;
    if (!item || typeof item.command !== "string" || invocations(item.command).length === 0) return;
    const id = typeof item.id === "string" && item.id ? item.id : null;
    const key = id ?? `ligne-${n + 1}`;
    if (!seen.has(key)) seen.set(key, { id, debut: null, fin: null, doublon: false, command: item.command, item: null });
    const c = seen.get(key);
    const slot = started ? "debut" : "fin";
    if (c[slot] !== null || c.command !== item.command) c.doublon = true;
    else c[slot] = n + 1;
    if (!started) c.item = item;
  });
  const commandes = [...seen.entries()].map(([key, c]) => {
    const args = invocations(c.command);
    const code = c.item && Number.isInteger(c.item.exit_code) ? c.item.exit_code : null;
    const out = c.item && typeof c.item.aggregated_output === "string" ? c.item.aggregated_output : "";
    const lies = [...out.matchAll(REPORT_RE)]
      .map(([, v, resultat, octets, empreinte]) => ({ version: v, resultat, octets: Number(octets), sha256: empreinte }))
      .filter((r) => r.octets === entree.octets && r.sha256 === entree.sha256);
    const emit = flag(args, "--emit");
    // Code rendu par le contrôle pour l'état lu : un rapport capturé ne suffit pas si la commande
    // s'est terminée autrement (échec, interruption, tube ou enchaînement après le contrôle).
    const livrable = lies.some((r) => r.version === version && ((r.resultat === "APPLIQUEE" && code === 0) || (r.resultat === "PARTIELLE" && code === 3)));
    return {
      commande: key,
      debut: c.debut,
      fin: c.fin,
      ordre_prouve: c.id !== null && c.debut !== null && c.fin !== null && c.debut < c.fin && !c.doublon,
      emit,
      aide: flag(args, "--help|-h") || code === 2,
      code,
      echec: code !== 0 && code !== 3,
      rapports_lies: lies.map((r) => `${r.version} ${r.resultat}`),
      accepte: emit && livrable,
      recu: !emit && livrable,
      rejete: lies.some((r) => r.resultat === "REJETEE"),
    };
  });
  return { commandes, illisibles };
}

const describeCommand = (c) =>
  `${c.commande} (${c.emit ? "--emit" : c.aide ? "aide ou usage" : "sans --emit"}, code ${c.code}, lignes ${c.debut ?? "?"}–${c.fin ?? "?"}, ${c.rapports_lies.length ? `rapport lié ${c.rapports_lies.join(", ")}` : "aucun rapport lié à cette réponse"})`;

export function deliveryErrors({ commandes, illisibles }, entree) {
  const erreurs = [];
  const cible = `cette réponse (${entree.octets} o, sha256 ${entree.sha256})`;
  const vus = commandes.length ? commandes.map(describeCommand).join(" ; ") : "aucune";
  if (illisibles) erreurs.push(`étape 6 : flux natif incomplet, ${illisibles} ligne(s) illisible(s) : ordre des passages non prouvé`);
  const sansOrdre = commandes.filter((c) => !c.ordre_prouve);
  if (sansOrdre.length) erreurs.push(`étape 6 : commande(s) du contrôle sans couple item.started puis item.completed identifié : ${sansOrdre.map((c) => c.commande).join(", ")} ; ordre des passages non prouvé`);
  if (erreurs.length) return erreurs;
  // Un REJETEE n'est pas définitif : après correction, nouveau passage complet (acceptation),
  // puis les deux passages de livraison. Seule compte une acceptation démarrée après lui.
  const rejet = commandes.filter((c) => c.rejete).sort((x, y) => x.fin - y.fin).at(-1);
  const acceptation = commandes.filter((c) => c.accepte && (!rejet || c.debut > rejet.fin)).sort((x, y) => x.fin - y.fin)[0];
  if (!acceptation && rejet) {
    return [`étape 6 : la commande ${rejet.commande} rend REJETEE pour ${cible} et aucune acceptation par --emit n'a démarré après elle : correction et nouveau passage complet exigés, puis les deux passages de livraison ; commandes du contrôle relevées : ${vus}`];
  }
  if (!acceptation) return [`étape 6 : aucune acceptation par --emit de ${cible} ; commandes du contrôle relevées : ${vus}`];
  const apres = commandes.filter((c) => !c.emit && !c.aide && !c.echec && c.debut > acceptation.fin).sort((x, y) => x.debut - y.debut);
  let finMax = 0;
  for (const [i, c] of apres.entries()) {
    if (i > 0 && c.debut < finMax) erreurs.push(`étape 6 : ${c.commande} démarre avant la fin d'une commande précédente du contrôle : lancées en parallèle, « l'une après l'autre » non prouvé`);
    finMax = Math.max(finMax, c.fin);
  }
  if (apres.length < 2) {
    erreurs.push(`étape 6 : ${apres.length} commande(s) du contrôle sans --emit terminée(s) en code 0 ou 3 après l'acceptation de ${cible} par ${acceptation.commande} ; deux exigées, lancées l'une après l'autre ; commandes du contrôle relevées : ${vus}`);
  } else if (!apres.some((c) => c.recu)) {
    erreurs.push(`étape 6 : aucun passage reçu pour ${cible} parmi ${apres.map((c) => c.commande).join(", ")} (refus plus conservateur que le contrat, qui livrerait en relecture partielle) ; commandes du contrôle relevées : ${vus}`);
  }
  return erreurs;
}

// Réponse finale native d'un flux : `result` du dernier événement result (Claude Code
// stream-json), texte du dernier agent_message terminé (codex exec --json). Ligne illisible : échec.
export function finalFromStream(kind, text) {
  let last = null;
  let found = false;
  text.split("\n").forEach((line, n) => {
    if (!line.trim()) return;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      throw new Error(`ligne ${n + 1} du flux illisible`);
    }
    if (kind === "claude" && ev && ev.type === "result") {
      found = true;
      last = typeof ev.result === "string" ? ev.result : null;
    } else if (kind === "codex" && ev && ev.type === "item.completed" && ev.item && ev.item.type === "agent_message") {
      found = true;
      last = typeof ev.item.text === "string" ? ev.item.text : null;
    }
  });
  if (!found) throw new Error(kind === "claude" ? "aucun événement result dans le flux" : "aucun agent_message terminé dans le flux");
  if (last === null) throw new Error(kind === "claude" ? "dernier événement result sans champ result" : "dernier agent_message sans texte");
  return last;
}

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

export function gate(raw, { traces, roots, journal = null }) {
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
  const entree = bytes === null ? null : { octets: bytes.length, sha256: sha256(bytes) };
  let report = null;
  if (!cause) {
    try {
      report = checkOutput(message, { roots, strict: true });
    } catch (e) {
      cause = `contrôle en échec : ${e.message}`;
    }
  }
  let releves = null;
  if (!cause && journal !== null) {
    try {
      releves = controlCommands(readFileSync(journal, "utf8"), entree, report.version);
    } catch (e) {
      cause = `journal natif illisible (${journal}) : ${e.code || e.message}`;
    }
  }
  if (cause) {
    writeTrace(traces, k, bytes, { ...base, ...(journal !== null ? { journal } : {}), decision: "non_controlee", cause });
    return { code: 1, stdout: "", stderr: `editorial-review-stop-gate : ${cause} ; livraison ${k} non contrôlée, arrêt laissé\n` };
  }
  const controleOk = LIVRABLE.has(report.resultat);
  const erreursPassages = releves === null ? [] : deliveryErrors(releves, entree);
  const decision = controleOk && erreursPassages.length === 0 ? "livree" : k <= MAX_REPRISES ? "reprise" : "borne_atteinte";
  const releve = releves === null ? {} : { journal, commandes: releves.commandes, lignes_illisibles: releves.illisibles, erreurs_passages: erreursPassages };
  writeTrace(traces, k, bytes, { ...base, entree, resultat: report.resultat, erreurs: report.erreurs, ...releve, decision });
  if (decision === "livree") return { code: 0, stdout: ALLOW, stderr: "" };
  const motif = controleOk ? `contrôle ${report.resultat.toUpperCase()} en mode strict, passages de livraison manquants` : `contrôle ${report.resultat.toUpperCase()} en mode strict`;
  const head = `editorial-review-stop-gate : réponse finale refusée, livraison ${k} (${entree.octets} o, sha256 ${entree.sha256}), ${motif}`;
  if (decision === "borne_atteinte") {
    return { code: 0, stdout: ALLOW, stderr: `${head} ; borne de ${MAX_REPRISES} reprises atteinte : arrêt laissé, réponse non livrée\n` };
  }
  const etape6 = "étape 6 du contrat : entrée acceptée par --emit, puis deux passages sans --emit, par deux commandes séparées lancées l'une après l'autre";
  const suite = controleOk
    ? `Cette réponse n'est pas livrée ; elle reste conservée en trace. Suivre pour cette même réponse l'${etape6}, puis la redonner comme dernier message, à l'octet près.`
    : `Cette réponse n'est pas livrée ; elle reste conservée en trace. Redonner comme dernier message la réponse entière corrigée, prose et bloc final compris, sans renvoyer à la version refusée.${releves === null ? "" : ` Avant de la redonner, suivre l'${etape6}.`}`;
  const reason = [
    `${head} ; reprise ${k} sur ${MAX_REPRISES}.`,
    ...(report.erreurs.length ? ["Erreurs du contrôle :", ...report.erreurs.map((e) => `  - ${e}`)] : []),
    ...(erreursPassages.length ? ["Passages de livraison, relevés dans le journal natif de la session :", ...erreursPassages.map((e) => `  - ${e}`)] : []),
    suite,
  ].join("\n");
  return { code: 0, stdout: `${JSON.stringify({ decision: "block", reason })}\n`, stderr: "" };
}

export function verify(finalBytes, { traces, roots, journal = null }) {
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
  // Passages recomptés sur le flux natif complet, hors de l'agent ; une livraison décidée sans
  // journal n'a pas exigé ces passages pendant la session.
  let releves = null;
  if (journal !== null) {
    const last = records.at(-1);
    if (last && last.decision === "livree" && !Array.isArray(last.commandes)) {
      erreurs.push(`livraison ${last.livraison} décidée sans journal natif : passages de livraison non exigés pendant la session`);
    }
    try {
      releves = controlCommands(readFileSync(journal, "utf8"), reponse, check.version);
      erreurs.push(...deliveryErrors(releves, reponse));
    } catch (e) {
      erreurs.push(`journal natif illisible (${journal}) : ${e.code || e.message}`);
    }
  }
  const verdict = erreurs.length ? "non_livree" : check.resultat;
  const report = { verdict, reponse_finale: reponse, livraisons, recontrole: { resultat: check.resultat, erreurs: check.erreurs }, ...(journal !== null ? { journal, commandes: releves && releves.commandes } : {}), erreurs };
  return { code: erreurs.length ? 1 : check.resultat === "appliquee" ? 0 : 3, report };
}

const USAGE = "usage : editorial-review-stop-gate.mjs (--traces <dossier> --root <dossier>... [--journal <flux natif>] [--verifier <réponse finale>] | --env | --extraire <claude|codex> <flux>)\n";

function main(argv) {
  if (argv[0] === "--extraire") {
    if (argv.length !== 3 || !["claude", "codex"].includes(argv[1])) {
      process.stderr.write(USAGE);
      return 1;
    }
    try {
      process.stdout.write(Buffer.from(finalFromStream(argv[1], readFileSync(argv[2], "utf8")), "utf8"));
      return 0;
    } catch (e) {
      process.stderr.write(`editorial-review-stop-gate : réponse finale non extraite de ${argv[2]} : ${e.code || e.message}\n`);
      return 1;
    }
  }
  let roots = [];
  let traces = null;
  let journal = null;
  let final = null;
  let env = false;
  let usage = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) roots.push(resolve(argv[(i += 1)]));
    else if (a === "--traces" && argv[i + 1] && traces === null) traces = resolve(argv[(i += 1)]);
    else if (a === "--journal" && argv[i + 1] && journal === null) journal = resolve(argv[(i += 1)]);
    else if (a === "--verifier" && argv[i + 1] && final === null) final = resolve(argv[(i += 1)]);
    else if (a === "--env" && !env) env = true;
    else usage = true;
  }
  if (env && (usage || traces || roots.length || journal || final)) usage = true;
  else if (env) {
    // Paramètres exportés par editorial-review-native.sh ; sans eux, aucune trace possible : la
    // vérification après la fin constate l'absence de garde.
    const { EDITORIAL_REVIEW_TRACES: t, EDITORIAL_REVIEW_ROOTS: r, EDITORIAL_REVIEW_JOURNAL: j } = process.env;
    roots = (r || "").split(":").filter(Boolean).map((p) => resolve(p));
    if (!t || roots.length === 0) {
      process.stderr.write("editorial-review-stop-gate : --env sans EDITORIAL_REVIEW_TRACES ou EDITORIAL_REVIEW_ROOTS (lanceur editorial-review-native.sh) ; aucune trace, arrêt laissé\n");
      return 1;
    }
    traces = resolve(t);
    journal = j ? resolve(j) : null;
  }
  if (usage || !traces || roots.length === 0) {
    process.stderr.write(USAGE);
    return 1;
  }
  if (final !== null) {
    const { code, report } = verify(readFileSync(final), { traces, roots, journal });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return code;
  }
  const { code, stdout, stderr } = gate(readFileSync(0, "utf8"), { traces, roots, journal });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return code;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  process.exitCode = main(process.argv.slice(2));
}
