#!/usr/bin/env node
// Classe une PR dans l'un des trois circuits de fusion (décision 72 de l'owner).
//
//   faible : fusion automatique, CI verte ;
//   moyen  : CI verte et verdict GO de la revue Claude (décision 91), puis fusion automatique ;
//   eleve  : approbation de l'owner (CODEOWNERS).
//
//   node scripts/ci/merge-circuit.mjs --files <chemin>...   classe des chemins (arbre courant)
//   node scripts/ci/merge-circuit.mjs --pr <n>              classe une PR (gh, lecture seule)
//
// Sources réutilisées, sans copie : le risque par chemin vient de
// `.spec/00-canon/repository-registry/ownership.yaml` (résolution par `findOwnershipMatch`
// de `scripts/registry/check-new-files.js`), les zones réservées viennent de `.github/CODEOWNERS`.
// Tout doute vaut le circuit élevé : chemin non classé, domaine inconnu, risque illisible.
// Ce script ne fusionne rien et n'arme aucune fusion : il imprime un verdict JSON.
// Le workflow qui le lit est préparé à part et appliqué par l'owner.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const micromatch = require("micromatch");
const yaml = require("js-yaml");
const { findOwnershipMatch } = require("../registry/check-new-files.js");

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OWNERSHIP_PATH = ".spec/00-canon/repository-registry/ownership.yaml";
const CODEOWNERS_PATH = ".github/CODEOWNERS";

export const CIRCUITS = ["faible", "moyen", "eleve"];
const RISK_TO_CIRCUIT = { low: "faible", medium: "moyen", high: "eleve", critical: "eleve" };

/**
 * Motifs CODEOWNERS → globs micromatch. Couvre les formes du fichier du dépôt :
 * `/chemin/` (dossier ancré), `/fichier` (fichier ancré), `/dossier/prefixe-*`.
 * Un motif sans `/` initial s'applique à tout niveau (`**\/motif`).
 */
export function parseCodeowners(text) {
  const globs = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const [pattern, ...owners] = line.split(/\s+/);
    if (owners.length === 0) continue;
    let glob = pattern.startsWith("/") ? pattern.slice(1) : `**/${pattern}`;
    if (glob.endsWith("/")) glob += "**";
    globs.push({ pattern, glob });
  }
  return globs;
}

/**
 * Verdict pur : { circuit, reasons[] }. Le circuit est le plus élevé des chemins.
 * `paths` inclut l'ancien nom d'un fichier renommé.
 */
export function classifyCircuit(paths, ownershipEntries, codeownerGlobs) {
  const reasons = [];
  let level = 0;
  const raise = (circuit, reason) => {
    level = Math.max(level, CIRCUITS.indexOf(circuit));
    reasons.push({ circuit, ...reason });
  };
  if (paths.length === 0) raise("eleve", { code: "NO_FILES", path: null });
  for (const path of paths) {
    const zone = codeownerGlobs.find((c) => micromatch.isMatch(path, c.glob, { dot: true }));
    if (zone) {
      raise("eleve", { code: "CODEOWNERS_ZONE", path, detail: zone.pattern });
      continue;
    }
    const entry = findOwnershipMatch(path, ownershipEntries);
    if (!entry || entry.owner === "__unassigned__" || entry.domain === "UNKNOWN") {
      raise("eleve", { code: "UNCLASSIFIED", path });
      continue;
    }
    const circuit = RISK_TO_CIRCUIT[entry.risk];
    if (!circuit) {
      raise("eleve", { code: "RISK_UNREADABLE", path, detail: String(entry.risk) });
      continue;
    }
    raise(circuit, { code: `RISK_${entry.risk.toUpperCase()}`, path, detail: entry.glob });
  }
  return { circuit: CIRCUITS[level], reasons };
}

function readLocal(rel) {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

function prFiles(number) {
  const out = execFileSync(
    "gh",
    ["api", "--paginate", `repos/{owner}/{repo}/pulls/${number}/files`, "--jq", ".[] | [.filename, (.previous_filename // \"\")] | @tsv"],
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => line.split("\t"))
    .filter(Boolean);
}

function main(argv) {
  const pr = argv.indexOf("--pr");
  const files = argv.indexOf("--files");
  let paths;
  if (pr !== -1 && argv[pr + 1]) paths = prFiles(argv[pr + 1]);
  else if (files !== -1) paths = argv.slice(files + 1);
  else {
    console.error("usage: merge-circuit.mjs --pr <n> | --files <chemin>...");
    process.exit(2);
  }
  const ownership = yaml.load(readLocal(OWNERSHIP_PATH));
  if (!Array.isArray(ownership?.entries)) {
    console.error(`classification illisible : ${OWNERSHIP_PATH}`);
    process.exit(2);
  }
  const verdict = classifyCircuit([...new Set(paths)], ownership.entries, parseCodeowners(readLocal(CODEOWNERS_PATH)));
  console.log(JSON.stringify(verdict, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
