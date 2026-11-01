#!/usr/bin/env node
//
// Contrôle mécanique d'une relecture française (editorial-review.md, « Contrôle mécanique »).
//
// Confronte le bloc ```json « "contrat": "editorial-review" » d'une sortie à ce qu'il déclare,
// sans se fier à l'auto-évaluation du modèle : empreinte de l'original recalculée, avant/après
// retrouvés, changements rejoués jusqu'à la proposition, faits protégés comparés règle par
// règle, plages de lecture confrontées aux fichiers, conditions C1–C7 recalculées, mentions de
// la relecture dans la prose comparées à l'état déclaré, original sans fichier confronté au
// texte que la réponse affiche (typographie et balisage Markdown), positions RE-T1 restées en
// espace ordinaire dans la proposition, champ structuré (YAML, JSON, frontmatter) reproduit avec
// son chemin de clés, plage de l'original rendue par une lecture déclarée.
//
// Il ne juge ni la pertinence d'une règle RE ni la fidélité de sens, et ne voit pas la trace
// de la session : ces points sortent en « à vérifier sur le contenu ».
//
// Usage :
//   node scripts/agents/check-editorial-review.mjs [--root <dossier>]... [--json | --emit] [fichier]
//   Sans fichier : entrée standard. --root est répétable (défaut : dossier courant) ; les
//   chemins relatifs du bloc sont cherchés sous chaque racine, dans l'ordre.
//   --emit : réponse acceptée inchangée sur stdout, rapport sur stderr ; rien sur stdout
//   en cas de rejet. Aucun caractère ni champ n'est corrigé par ce mode.
//
// Codes de sortie :
//   0 — appliquee : bloc conforme, « relecture appliquée » justifiée
//   3 — partielle : « relecture partielle », chaque condition manquante déclarée et nommée
//   1 — rejetee ou absente : surdéclaration, champ contredit, bloc illisible ou absent
//   2 — erreur d'usage

import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const CONTRACT_PATH = fileURLToPath(
  new URL("../../.claude/prompts/_shared/editorial-review.md", import.meta.url),
);

// Sections que le point 1 du contrat exige en entier (titres sans numéro).
export const REQUIRED_SECTIONS = [
  "Ce que fait la relecture",
  "Ordre de priorité",
  "Faits protégés",
  "Champs modifiables et champs protégés",
  "Ce que la relecture corrige",
  "Typographie française",
  "Ton par format",
  "Sortie attendue",
  "Règles de Humanizer écartées ou adaptées",
];
export const SCRIPT_SECTION = "Fafa, vidéo et social : aucune invention";

export const FIDELITY_KEYS = [
  "references_identifiants",
  "nombres_unites",
  "normes_intervalles_commerce",
  "provenance_certitude",
  "conditions_negations",
];
export const STEP_KEYS = [
  "identifier_original",
  "delimiter_champs",
  "appliquer_regles",
  "relever_signalements",
  "controle_fidelite",
  "rendre_verdict",
];
const CONDITIONS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"];
const BLOCKED = new Set(["BLOQUÉ_SOURCE", "HORS_PÉRIMÈTRE"]);
// Signalements dont l'extrait peut quitter la proposition (§3 « Suppression permise ») ;
// les autres restent en phrase gelée.
const REMOVABLE_FLAGS = new Set(["F-2", "F-5"]);
// Règles de retrait d'un segment de style : un fait protégé retiré avec le segment n'est pas
// rejeté d'office, il part en vérification de contenu.
const SEGMENT_REMOVAL_RULES = new Set(["RE-02", "RE-03", "RE-04", "RE-19", "RE-20", "RE-22"]);

// Raison, trace ou raison d'une liste vide : remplie par un contenu écrit, quelle que soit sa
// longueur. Une valeur vide, faite de ponctuation (« … » du modèle) ou réduite au nom du champ ou
// au code ne remplit rien (« Le nom d'un champ ne remplit aucune condition »).
function written(value, ...names) {
  const v = typeof value === "string" ? value.trim() : "";
  return /[\p{L}\p{N}]/u.test(v) && !names.some((n) => typeof n === "string" && v.toLowerCase() === n.toLowerCase());
}

// ---------------------------------------------------------------------------------------------
// Contrat
// ---------------------------------------------------------------------------------------------

export function parseContract(text) {
  const lines = text.split("\n");
  const version = (text.match(/Version (\d+\.\d+\.\d+)/) || [])[1] || null;
  const rules = new Set([...text.matchAll(/^- \*\*(RE-(?:\d{2}|T\d))\b/gm)].map((m) => m[1]));
  const flags = new Set([...text.matchAll(/^\s+- (F-\d) /gm)].map((m) => m[1]));
  const verdictLine = (text.match(/\*\*`verdict`\*\*\s*:([^\n]*)/) || [])[1] || "";
  const verdicts = new Set([...verdictLine.matchAll(/`([A-ZÉÈ_]{4,})`/g)].map((m) => m[1]));

  const headings = [];
  let fenced = false;
  lines.forEach((line, i) => {
    if (line.startsWith("```")) fenced = !fenced;
    const m = !fenced && line.match(/^(#{2,3}) (?:[\d.]+ )?(.+?)\s*$/);
    if (m) headings.push({ level: m[1].length, title: m[2], start: i + 1 });
  });
  const nLines = countLines(text);
  const sections = headings.map((h, idx) => {
    const next = headings.slice(idx + 1).find((o) => o.level <= h.level);
    return { title: h.title, start: h.start, end: next ? next.start - 1 : nLines };
  });
  return { version, rules, flags, verdicts, sections, nLines };
}

export function sectionRange(contract, title) {
  return contract.sections.find((s) => s.title === title || s.title.startsWith(`${title} (`)) || null;
}

// ---------------------------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------------------------

function countLines(text) {
  if (text === "") return 0;
  const n = text.split("\n").length;
  return text.endsWith("\n") ? n - 1 : n;
}

// Espaces ordinaires et retours à la ligne ramenés à une espace ; insécables conservées (RE-T1).
export const norm = (s) => s.replace(/[ \t\r\n]+/g, " ").trim();
// Comme norm(), mais un saut forcé Markdown (deux espaces en fin de ligne) reste un retour à la ligne.
const keepBreaks = (s) => s.replace(/[ \t\r\n]+/g, (m) => (/ {2}\r?\n/.test(m) ? "\n" : " ")).trim();

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const words = (s) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

function occurrences(haystack, needle) {
  if (!needle) return 0;
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + 1)) n += 1;
  return n;
}

function context(s, at) {
  return JSON.stringify(s.slice(Math.max(0, at - 30), at + 30));
}

function firstDiff(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

// Normalisation typographique : ce que RE-T1 à RE-T5 ont le droit de changer.
export function typoNorm(s) {
  return typoShape(fold(s));
}

// Même normalisation, casse et accents conservés.
function typoShape(s) {
  return s
    .replace(/[   ]/g, " ")
    .replace(/[«»“”„"]/g, '"')
    .replace(/[’‘`]/g, "'")
    .replace(/³/g, "3")
    .replace(/n·m/g, "nm")
    .replace(/\s+([;:!?])/g, "$1")
    .replace(/"\s+/g, '"')
    .replace(/\s+"/g, '"')
    .replace(/(\d)\s+(?=\d{3}\b)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Faits protégés (§3), par catégorie de controle_fidelite
// ---------------------------------------------------------------------------------------------

const COMPARATORS = ["plus de", "moins de", "au moins", "au plus", "jusqu'a", "environ", "a partir de", "minimum", "maximum"];
const COMMERCE_STEMS = ["interval", "echeanc", "periodic", "kilometr", "vidang", "garanti", "livr", "expedi", "prix", "tarif", "gratuit", "rembours", "delai", "stock", "remise", "obligatoire"];
const CERTAINTY_WORDS = new Set(["peut", "peuvent", "pourrait", "pourraient", "puisse", "puissent", "doit", "doivent", "devrait", "devraient"]);
const CERTAINTY_STEMS = ["possibl", "probabl", "hypoth", "souvent", "generalement", "parfois", "toujours", "certain", "eventuel", "susceptible", "semble"];
const CONDITION_WORDS = new Set([
  "ne", "n", "pas", "jamais", "aucun", "aucune", "ni", "sans", "non", "rien",
  "si", "s", "selon", "sauf", "seulement", "uniquement", "lorsque", "quand", "hors", "excepte",
  "condition", "cas", "avant", "apres", "abord", "puis", "ensuite", "enfin",
]);
const UNITS = "%|°C|°|µm|mm|cm³|cm3|cm|km|kg|kPa|bar|N·m|Nm|ch|kW|tr/min|trs/min|l|L|g|h|min";
const NUMBER_RE = new RegExp(String.raw`\d+(?:[ \u00a0\u202f]\d{3})*(?:[.,]\d+)?\s*(?:${UNITS})?(?![\p{L}\d])`, "gu");
const IDENT_RE = /(?<![\p{L}\d])(?:(?=[\p{L}\d\-/]*\d)(?=[\p{L}\d\-/]*\p{L})[\p{L}\d][\p{L}\d\-/]*|\p{Lu}{2,}[\p{Lu}\d]*)(?![\p{L}\d])/gu;

export function protectedTokens(s) {
  const f = fold(s);
  const ws = words(s);
  return {
    references_identifiants: [...s.matchAll(IDENT_RE)].map((m) => m[0]),
    nombres_unites: [
      ...[...s.matchAll(NUMBER_RE)].map((m) => m[0].replace(/[   ]/g, "")),
      ...COMPARATORS.filter((c) => f.replace(/[’']/g, "'").includes(c)),
    ],
    normes_intervalles_commerce: [
      ...ws.filter((w) => COMMERCE_STEMS.some((st) => w.startsWith(st))),
      ...[...s.matchAll(/€|\bTTC\b|\bHT\b|\b(?:ISO|EN|DIN|SAE|ACEA|API)\b/g)].map((m) => m[0]),
    ],
    provenance_certitude: ws.filter((w) => CERTAINTY_WORDS.has(w) || CERTAINTY_STEMS.some((st) => w.startsWith(st))),
    conditions_negations: ws.filter((w) => CONDITION_WORDS.has(w)),
  };
}

function multisetMinus(a, b) {
  const left = [...b];
  const out = [];
  for (const x of a) {
    const i = left.indexOf(x);
    if (i === -1) out.push(x);
    else left.splice(i, 1);
  }
  return out;
}

// Mots de contenu : 5 lettres ou plus, hors mots outils, comparés sur leurs 6 premières lettres.
const STOPWORDS = new Set(["entre", "toute", "toutes", "leurs", "notre", "votre", "cette", "celui", "celle", "ceux", "comme", "aussi", "alors", "encore", "autre", "autres", "elles", "chaque", "meme", "memes", "dont", "donc", "ainsi", "parce", "quelle", "quelles", "lequel", "laquelle"]);
const stems = (s) => words(s).filter((w) => w.length >= 5 && !/^\d+$/.test(w) && !STOPWORDS.has(w)).map((w) => w.slice(0, 6));

// Sans pliage des accents : « à » n'est pas « a ».
const ETRE_AVOIR = new Set(["est", "sont", "était", "étaient", "sera", "seront", "soit", "soient", "être", "a", "ont", "avait", "avaient", "aura", "auront", "ait", "aient", "avoir"]);
const rawWords = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const DETOUR_STEMS = new Set(["positi", "impose", "consti", "dispos", "repres", "avere", "possed", "compor", "presen", "figure", "office", "demeur", "revele", "agisse", "retrou"]);

// ---------------------------------------------------------------------------------------------
// Typographie et balisage
// ---------------------------------------------------------------------------------------------

// Positions RE-T1 (§6) restées en espace ordinaire : devant « ; : ! ? », à l'intérieur des
// guillemets français, entre un nombre et son unité, entre les tranches de milliers.
const RE_T1_POSITIONS = [
  /(?<=\S) (?=[;:?]|!(?!\[))/gu,
  /(?<=«) | (?=»)/gu,
  new RegExp(String.raw`(?<=(?<![\p{L}\d])\d+(?:[.,]\d+)?) (?=(?:${UNITS})(?![\p{L}\d'’]))`, "gu"),
  /(?<=(?<![\p{L}\d.,])\d{1,3}(?: \d{3})*) (?=\d{3}(?!\d))/gu,
];

// Intertitres, tableaux, code et URL gardent leur typographie (§6) : ils ne sont pas relevés.
function reT1Leftovers(text) {
  const found = [];
  let fenced = false;
  for (const line of text.split("\n")) {
    if (/^\s{0,3}(?:```|~~~)/.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced || /^\s{0,3}#{1,6}(?:\s|$)/.test(line) || /^\s*\|/.test(line)) continue;
    const masked = line.replace(/`[^`]*`|https?:\/\/[^\s<>()\]]+|\]\([^)]*\)/g, (m) => "_".repeat(m.length));
    for (const re of RE_T1_POSITIONS) {
      for (const m of masked.matchAll(re)) found.push(JSON.stringify(line.slice(Math.max(0, m.index - 12), m.index + 12)));
    }
  }
  return found;
}

// Balisage Markdown d'une ligne retiré : titre, citation, puce, gras, italique, code, lien.
const stripMarkdown = (s) =>
  s
    .split("\n")
    .map((l) =>
      l
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*>\s?/, "")
        .replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\*|__|`/g, ""),
    )
    .join("\n");

// ---------------------------------------------------------------------------------------------
// Fichiers et lectures
// ---------------------------------------------------------------------------------------------

function resolvePath(p, roots) {
  if (typeof p !== "string" || !p) return null;
  const candidates = isAbsolute(p) ? [p] : roots.map((r) => resolve(r, p));
  return candidates.find((c) => existsSync(c) && statSync(c).isFile()) || null;
}

// Un outil qui découpe le fichier sur « \n » rend après le dernier saut une ligne vide
// numérotée N+1 (Read de Claude Code) : la citer ne sort pas du fichier et n'ajoute rien.
function parseRange(r, text) {
  const nLines = countLines(text);
  const m = typeof r === "string" && r.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return { error: `plage illisible ${JSON.stringify(r)} (attendu "a-b")` };
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const last = text.endsWith("\n") ? nLines + 1 : nLines;
  if (a < 1 || b < a || b > last) return { error: `plage ${r} hors du fichier (${nLines} lignes)` };
  return { a, b: Math.min(b, nLines) };
}

// Zone structurée d'un fichier : un YAML ou un JSON entier, ou le frontmatter d'un Markdown. Un
// champ s'y reproduit avec son chemin de clés (§10, `original`) ; une plage n'y désigne que la
// syntaxe du document.
function structuredZone(abs, file) {
  if (/\.(?:ya?ml|json)$/i.test(abs)) return { a: 1, b: countLines(file), json: /\.json$/i.test(abs), frontmatter: false };
  const lines = file.split("\n");
  if (!/\.mdx?$/i.test(abs) || lines[0].trimEnd() !== "---") return null;
  const end = lines.findIndex((l, i) => i > 0 && /^(?:---|\.\.\.)\s*$/.test(l));
  return end > 0 ? { a: 1, b: end + 1, json: false, frontmatter: true } : null;
}

const YAML_KEY = /^(?<ind>\s*)(?<dash>-\s+)?(?<q>["']?)(?<key>[^"'\s#][^"'#]*?)\k<q>\s*:(?:\s+(?<value>.*))?$/;
const JSON_KEY = /^(?<ind>\s*)"(?<key>(?:[^"\\]|\\.)*)"\s*:\s*(?<value>.*)$/;

// Chemins de clés (indices de liste omis) des lignes a à b d'une zone structurée, lus par
// l'indentation : un scalaire écrit après sa clé se poursuit sur les lignes plus indentées.
function fieldPaths(file, zone, a, b) {
  const lines = file.split("\n");
  const stack = [];
  const paths = new Set();
  const pathOf = () => stack.map((s) => s.key).join(".");
  let scalar = null;
  const last = Math.min(b, zone.frontmatter ? zone.b - 1 : zone.b);
  for (let n = zone.frontmatter ? zone.a + 1 : zone.a; n <= last; n += 1) {
    const line = lines[n - 1];
    const indent = line.length - line.trimStart().length;
    let path = null;
    if (scalar && (line.trim() === "" || indent > scalar.indent)) path = scalar.path;
    else {
      scalar = null;
      const m = line.match(zone.json ? JSON_KEY : YAML_KEY);
      if (m) {
        const keyIndent = m.groups.ind.length + (m.groups.dash || "").length;
        while (stack.length && stack[stack.length - 1].indent >= keyIndent) stack.pop();
        stack.push({ indent: keyIndent, key: m.groups.key.trim() });
        path = pathOf();
        const value = (m.groups.value || "").replace(/^(?:[&!]\S*\s*)+/, "").trim();
        if (!zone.json && value && !value.startsWith("#")) scalar = { indent: keyIndent, path };
      } else if (line.trim() && !/^\s*#/.test(line)) {
        const itemIndent = indent + (/^\s*-(?:\s|$)/.test(line) ? 1 : 0);
        while (stack.length && stack[stack.length - 1].indent >= itemIndent) stack.pop();
        path = pathOf();
      }
    }
    if (n >= a && path) paths.add(path);
  }
  return paths;
}

function coveredLines(entry, text, errors, where) {
  const covered = new Set();
  const plages = Array.isArray(entry.plages) ? entry.plages : [];
  if (plages.length === 0) errors.push(`${where} : aucune plage déclarée`);
  for (const r of plages) {
    const p = parseRange(r, text);
    if (p.error) errors.push(`${where} : ${p.error}`);
    else for (let i = p.a; i <= p.b; i += 1) covered.add(i);
  }
  const masked = Array.isArray(entry.masquees) ? entry.masquees : [];
  if (entry.tronque === true && masked.length === 0) {
    errors.push(`${where} : troncature déclarée sans les plages masquées ; rien n'est compté comme lu`);
    covered.clear();
  }
  for (const r of masked) {
    const p = parseRange(r, text);
    if (p.error) errors.push(`${where} : ${p.error}`);
    else for (let i = p.a; i <= p.b; i += 1) covered.delete(i);
  }
  return covered;
}

function missingRanges(covered, a, b) {
  const out = [];
  let start = null;
  for (let i = a; i <= b + 1; i += 1) {
    const miss = i <= b && !covered.has(i);
    if (miss && start === null) start = i;
    if (!miss && start !== null) {
      out.push(start === i - 1 ? `${start}` : `${start}-${i - 1}`);
      start = null;
    }
  }
  return out;
}

function checkReadings(block, relectures, roots, contract) {
  const errors = [];
  const reads = [];
  const lectures = Array.isArray(block.lectures) ? block.lectures : [];
  if (lectures.length === 0) errors.push("lectures : liste absente ou vide");
  lectures.forEach((entry, i) => {
    const where = `lectures[${i}] ${entry && entry.chemin}`;
    const abs = resolvePath(entry && entry.chemin, roots);
    if (!abs) {
      errors.push(`${where} : fichier introuvable sous les racines`);
      return;
    }
    const text = readFileSync(abs, "utf8");
    const nLines = countLines(text);
    reads.push({ abs, real: realpathSync(abs), text, nLines, covered: coveredLines(entry, text, errors, where) });
  });
  // Un même fichier atteint par deux racines ou par un lien symbolique reste un seul fichier.
  const readsOf = (abs) => {
    const real = realpathSync(abs);
    return reads.filter((r) => r.real === real);
  };
  const unionCovered = (abs) => new Set(readsOf(abs).flatMap((r) => [...r.covered]));
  // Ce qui manque aux lectures déclarées pour couvrir les lignes a à b d'un fichier, ou null.
  const uncovered = (abs, a, b) => {
    const rs = readsOf(abs);
    if (rs.length === 0) return "aucune lecture déclarée";
    const miss = missingRanges(unionCovered(abs), a || 1, b || rs[0].nLines);
    return miss.length ? `lignes non rendues ${miss.join(", ")}` : null;
  };
  const requireFile = (label, abs, a, b) => {
    const gap = uncovered(abs, a, b);
    if (gap) errors.push(`${label} : ${gap}`);
  };

  // Les chemins résolus utilisent « \\ » sous Windows : comparer la même représentation
  // sur les trois entrées natives, sans changer les chemins utilisés pour lire les fichiers.
  const hasSuffix = (r, suffix) => r.abs.split(sep).join("/").endsWith(suffix);
  const contractRead = reads.find((r) => hasSuffix(r, "/.claude/prompts/_shared/editorial-review.md"));
  if (!contractRead) {
    errors.push("contrat editorial-review.md : aucune lecture déclarée");
  } else {
    const read = parseContract(contractRead.text);
    if (read.version !== contract.version) {
      errors.push(`contrat lu en version ${read.version}, contrôle en version ${contract.version}`);
    }
    const needsScript = relectures.some((r) => r && (r.format === "script" || r.format === "social"));
    for (const title of [...REQUIRED_SECTIONS, ...(needsScript ? [SCRIPT_SECTION] : [])]) {
      const s = sectionRange(read, title);
      if (!s) errors.push(`contrat : section « ${title} » introuvable`);
      else requireFile(`contrat, section « ${title} » (${s.start}-${s.end})`, contractRead.abs, s.start, s.end);
    }
  }
  const voice = reads.find((r) => hasSuffix(r, "/canon-mirrors/marketing-voice.md"));
  if (!voice) errors.push("référence marketing-voice.md : aucune lecture déclarée");
  else requireFile("référence marketing-voice.md", voice.abs);
  if (relectures.some((r) => r && r.format === "script")) {
    const persona = reads.find((r) => hasSuffix(r, "/fafa-persona-canon/SKILL.md"));
    if (!persona) errors.push("référence fafa-persona-canon/SKILL.md : aucune lecture déclarée (script Fafa)");
    else requireFile("référence fafa-persona-canon/SKILL.md", persona.abs);
  }
  relectures.forEach((rel) => {
    if (!rel) return;
    const sources = Array.isArray(rel.sources) ? rel.sources : [];
    if (sources.length === 0 && rel.verdict !== "BLOQUÉ_SOURCE") {
      errors.push(`relecture ${rel.id} : aucune source déclarée, verdict ${rel.verdict} au lieu de BLOQUÉ_SOURCE`);
    }
    for (const src of sources) {
      const m = String(src).match(/^(.*?)(?::(\d+(?:-\d+)?))?$/);
      const abs = resolvePath(m[1], roots);
      if (!abs) {
        errors.push(`relecture ${rel.id}, source ${src} : fichier introuvable sous les racines`);
        continue;
      }
      const file = readFileSync(abs, "utf8");
      const range = m[2] ? parseRange(m[2], file) : { a: 1, b: countLines(file) };
      if (range.error) errors.push(`relecture ${rel.id}, source ${src} : ${range.error}`);
      else requireFile(`relecture ${rel.id}, source ${src}`, abs, range.a, range.b);
    }
  });
  return { errors, uncovered };
}

// ---------------------------------------------------------------------------------------------
// Une relecture
// ---------------------------------------------------------------------------------------------

function originalText(orig, roots, errors, uncovered) {
  if (!orig || typeof orig !== "object") {
    errors.C2.push("original absent");
    return null;
  }
  // Une référence fausse rejette même en « partielle » : c'est un champ inexact, pas un manque.
  const inexact = (msg) => {
    errors.C2.push(msg);
    errors.referenceInexacte = [...(errors.referenceInexacte || []), msg];
  };
  const unread = (label, abs, range) => {
    const gap = uncovered(abs, range.a, range.b);
    if (gap) errors.C2.push(`${label} : plage non rendue par une lecture déclarée (${gap})`);
  };
  let text;
  let bytes;
  if (typeof orig.texte === "string") {
    text = orig.texte;
    if (text.includes("\r")) errors.C2.push("original.texte contient \\r : déclarer la convention par fins_de_ligne");
    if (!["LF", "CRLF"].includes(orig.fins_de_ligne)) errors.C2.push("original.fins_de_ligne absent (LF ou CRLF)");
    if (typeof orig.saut_final !== "boolean") errors.C2.push("original.saut_final absent (true ou false)");
    else if (orig.saut_final !== text.endsWith("\n")) {
      errors.C2.push(`original.saut_final=${orig.saut_final} contredit le texte reproduit`);
    }
    bytes = Buffer.from(orig.fins_de_ligne === "CRLF" ? text.replace(/\n/g, "\r\n") : text, "utf8");
    // Provenance facultative (§10) : sans chemin, l'original est un brouillon de la session.
    if (orig.provenance && orig.provenance.chemin !== undefined) {
      const p = orig.provenance;
      const abs = resolvePath(p.chemin, roots);
      if (!abs) errors.C2.push(`original.provenance ${p.chemin} : fichier introuvable`);
      else {
        const file = readFileSync(abs, "utf8");
        const range = parseRange(p.lignes, file);
        if (range.error) errors.C2.push(`original.provenance : ${range.error}`);
        else {
          const where = `${p.chemin}:${p.lignes}`;
          unread(`original.provenance ${where}`, abs, range);
          const extract = file.split("\n").slice(range.a - 1, range.b).join("\n");
          // Champ YAML entre apostrophes : « '' » s'y écrit pour « ' ».
          if (![extract, extract.replace(/''/g, "'")].some((e) => norm(e).includes(norm(text)))) {
            inexact(`original.provenance : texte non retrouvé dans ${where}`);
          }
          const zone = structuredZone(abs, file);
          if (zone && range.a <= zone.b && range.b >= zone.a) {
            const fields = fieldPaths(file, zone, range.a, range.b);
            const champ = written(p.champ, "champ") ? p.champ.trim().replace(/\[\d+\]|\.\d+(?=\.|$)/g, "") : null;
            if (champ === null) {
              errors.C2.push(`original.provenance ${where} : champ structuré sans provenance.champ, son chemin de clés depuis la racine du document (§10)`);
            } else if (!fields.has(champ)) {
              inexact(`original.provenance.champ ${JSON.stringify(p.champ)} : aucun champ de ce chemin aux lignes ${where} (champs : ${[...fields].join(", ") || "aucun"})`);
            }
          }
        }
      }
    }
  } else if (typeof orig.chemin === "string") {
    const abs = resolvePath(orig.chemin, roots);
    if (!abs) {
      errors.C2.push(`original ${orig.chemin} : fichier introuvable`);
      return null;
    }
    const raw = readFileSync(abs);
    const file = raw.toString("utf8");
    const all = file.split(/(?<=\n)/);
    const range = parseRange(orig.lignes, file);
    if (range.error) {
      errors.C2.push(`original : ${range.error}`);
      return null;
    }
    const where = `${orig.chemin}:${orig.lignes}`;
    unread(`original ${where}`, abs, range);
    const zone = structuredZone(abs, file);
    if (zone && range.a <= zone.b && range.b >= zone.a) {
      inexact(`original ${where} : champ structuré seulement désigné ; les lignes désignées portent la syntaxe du document, pas le texte du champ : le reproduire avec sa provenance (chemin, lignes, champ) (§10)`);
    }
    text = all.slice(range.a - 1, range.b).join("");
    bytes = Buffer.from(text, "utf8");
  } else {
    errors.C2.push("original : ni texte reproduit ni chemin désigné");
    return null;
  }
  if (typeof orig.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(orig.sha256)) {
    errors.C2.push("original.sha256 absent ou mal formé");
  } else {
    const actual = sha256(bytes);
    if (orig.sha256 !== actual) {
      const toggled = text.endsWith("\n") ? bytes.subarray(0, bytes.length - (orig.fins_de_ligne === "CRLF" ? 2 : 1)) : Buffer.concat([bytes, Buffer.from(orig.fins_de_ligne === "CRLF" ? "\r\n" : "\n")]);
      const hint = sha256(toggled) === orig.sha256 ? " (calculée avec l'autre convention de saut final)" : " (calculée sur une autre représentation du texte)";
      const msg = `original.sha256 faux : déclaré ${orig.sha256.slice(0, 12)}…, octets désignés ${actual.slice(0, 12)}…${hint}`;
      errors.C2.push(msg);
      errors.empreinteFausse = [...(errors.empreinteFausse || []), msg];
    }
  }
  return text;
}

function checkChange(ch, i, ctx) {
  const { contract, O, P, errors, soft, id, fidelityDeclared } = ctx;
  const where = `relecture ${id}, changements[${i}]`;
  const avant = typeof ch.avant === "string" ? ch.avant : null;
  const apres = typeof ch.apres === "string" ? ch.apres : typeof ch["après"] === "string" ? ch["après"] : null;
  const regle = ch.regle ?? ch["règle"];
  if (avant === null || avant.trim() === "") errors.C3.push(`${where} : avant absent`);
  else if (!norm(O).includes(norm(avant))) errors.C3.push(`${where} : avant non retrouvé dans l'original : ${JSON.stringify(avant)}`);
  if (apres === null) errors.C3.push(`${where} : après absent (chaîne vide pour une suppression)`);
  else if (apres.trim() !== "" && !norm(P).includes(norm(apres))) errors.C3.push(`${where} : après non retrouvé dans la proposition : ${JSON.stringify(apres)}`);
  if (!contract.rules.has(regle)) errors.C3.push(`${where} : règle ${JSON.stringify(regle)} absente du contrat`);
  if (!written(ch.raison, regle, "raison")) errors.C3.push(`${where} : raison absente ou réduite au code`);
  if (avant === null || apres === null || !contract.rules.has(regle)) return;

  if (/^RE-T\d$/.test(regle)) {
    if (typoNorm(avant) !== typoNorm(apres)) errors.C3.push(`${where} : ${regle} change autre chose que la typographie`);
    return;
  }
  const ta = protectedTokens(avant);
  const tb = protectedTokens(apres);
  const tp = protectedTokens(P);
  const attributionMove = /d[ée]plac/i.test(String(fidelityDeclared.provenance_certitude ?? ""));
  for (const key of FIDELITY_KEYS) {
    const removed = multisetMinus(ta[key], tb[key]);
    const added = multisetMinus(tb[key], ta[key]);
    const kept = regle === "RE-23" ? removed.filter((t) => !tp[key].includes(t)) : removed;
    if (kept.length === 0 && added.length === 0) continue;
    const detail = `${where} (${regle}) : ${key} — ${kept.length ? `retiré ${JSON.stringify(kept)}` : ""}${kept.length && added.length ? ", " : ""}${added.length ? `ajouté ${JSON.stringify(added)}` : ""}`;
    const deletion = apres.trim() === "";
    if (added.length === 0 && deletion && SEGMENT_REMOVAL_RULES.has(regle)) {
      soft.push(`${detail} : retrait d'un segment de style, à vérifier sur le contenu`);
    } else if (added.length === 0 && regle === "RE-15" && attributionMove && ["references_identifiants", "conditions_negations"].includes(key)) {
      soft.push(`${detail} : déplacement d'attribution déclaré (§4.1), à vérifier sur le contenu`);
    } else {
      ctx.ecarts.push({ key, detail });
    }
  }

  const sa = stems(avant);
  const sb = stems(apres);
  const addedStems = multisetMinus(sb, sa);
  const removedStems = multisetMinus(sa, sb);
  if (regle === "RE-16") {
    const addedWords = multisetMinus(rawWords(apres), rawWords(avant)).filter((w) => !ETRE_AVOIR.has(w)).map(fold);
    const addedContent = addedStems.filter((s) => addedWords.some((w) => w.startsWith(s)));
    if (addedContent.length) errors.C3.push(`${where} : RE-16 ajoute de l'information ${JSON.stringify(addedContent)}`);
    const be = (s) => rawWords(s).filter((w) => ETRE_AVOIR.has(w)).length;
    if (be(apres) <= be(avant)) errors.C3.push(`${where} : RE-16 sans retour à « est » ou « a »`);
    const otherRemoved = removedStems.filter((s) => !DETOUR_STEMS.has(s));
    if (otherRemoved.length) soft.push(`${where} : RE-16 retire ${JSON.stringify(otherRemoved)}, à vérifier sur le contenu`);
  } else if (regle === "RE-23") {
    const lost = removedStems.filter((s) => !stems(P).includes(s));
    if (lost.length) errors.C3.push(`${where} : RE-23 retire de l'information absente ailleurs dans la proposition ${JSON.stringify(lost)}`);
    if (addedStems.length) soft.push(`${where} : RE-23 ajoute ${JSON.stringify(addedStems)}, à vérifier sur le contenu`);
  } else if (addedStems.length) {
    soft.push(`${where} (${regle}) : mots ajoutés ${JSON.stringify(addedStems)}, à vérifier sur le contenu`);
  }
}

function replay(O, changes, id, errors) {
  let current = norm(O);
  changes.forEach((ch, i) => {
    const avant = typeof ch.avant === "string" ? norm(ch.avant) : "";
    const apres = typeof ch.apres === "string" ? ch.apres : typeof ch["après"] === "string" ? ch["après"] : null;
    if (!avant || apres === null) return;
    const n = occurrences(current, avant);
    if (n === 0) errors.C3.push(`relecture ${id}, changements[${i}] : avant introuvable au moment de l'appliquer (chevauchement ou ordre)`);
    else if (n > 1) errors.C3.push(`relecture ${id}, changements[${i}] : avant présent ${n} fois, ambigu ; citer un extrait plus long`);
    else current = norm(current.replace(avant, norm(apres)));
  });
  return current;
}

function checkRelecture(rel, ctx) {
  const { contract, roots, uncovered } = ctx;
  const id = rel && rel.id ? rel.id : "?";
  const errors = { C2: [], C3: [], C4: [], C5: [], C6: [], C7: [] };
  const soft = [];
  const blocked = BLOCKED.has(rel && rel.verdict);

  if (!contract.verdicts.has(rel.verdict)) errors.C6.push(`relecture ${id} : verdict ${JSON.stringify(rel.verdict)} hors des valeurs du contrat`);
  // Un verdict bloqué n'a aucun changement : sa cause est la raison de la liste vide (§10,
  // `changements`), le seul champ que le contrat lui donne dans la relecture.
  if (blocked && !written(rel.raison_aucun_changement, rel.verdict, "raison_aucun_changement")) {
    errors.C6.push(`relecture ${id} : ${rel.verdict} sans cause dans raison_aucun_changement`);
  }

  const O = originalText(rel.original, roots, errors, uncovered);
  const steps = rel.etapes && typeof rel.etapes === "object" ? rel.etapes : {};
  for (const k of STEP_KEYS) {
    const s = steps[k];
    if (!s || typeof s !== "object") errors.C7.push(`relecture ${id} : étape ${k} absente`);
    else if (s.executee === true) {
      if (!written(s.trace, k, "trace")) errors.C7.push(`relecture ${id} : étape ${k} sans trace`);
    } else if (!(typeof s.cause === "string" && s.cause.trim())) errors.C7.push(`relecture ${id} : étape ${k} non exécutée sans cause`);
    else if (!(blocked && k !== "identifier_original" && k !== "rendre_verdict")) errors.C7.push(`relecture ${id} : étape ${k} non exécutée (${s.cause.trim()})`);
  }

  if (blocked) return { id, errors, soft, blocked };
  if (O === null) {
    for (const c of ["C3", "C4", "C5"]) errors[c].push(`relecture ${id} : original non établi, rien à confronter`);
    return { id, errors, soft, blocked };
  }

  // Contrôles qui ne dépendent pas de la proposition : une proposition absente ne les masque pas.
  const changes = Array.isArray(rel.changements) ? rel.changements : null;
  if (changes === null) errors.C3.push(`relecture ${id} : changements absent (liste, éventuellement vide)`);
  else if (changes.length === 0) {
    if (rel.verdict !== "AUCUN_CHANGEMENT_UTILE") errors.C3.push(`relecture ${id} : liste vide avec le verdict ${rel.verdict}`);
    if (!written(rel.raison_aucun_changement, "AUCUN_CHANGEMENT_UTILE", "raison_aucun_changement")) {
      errors.C3.push(`relecture ${id} : liste vide sans raison_aucun_changement`);
    }
  } else if (rel.verdict === "AUCUN_CHANGEMENT_UTILE") {
    errors.C3.push(`relecture ${id} : AUCUN_CHANGEMENT_UTILE avec ${changes.length} changement(s)`);
  }
  const fidelity = rel.controle_fidelite && typeof rel.controle_fidelite === "object" ? rel.controle_fidelite : {};
  const declaredOk = (k) => /^inchang/i.test(String(fidelity[k] ?? "").trim());
  for (const k of FIDELITY_KEYS) {
    if (!(k in fidelity)) errors.C5.push(`relecture ${id} : controle_fidelite.${k} absent`);
    else if (!declaredOk(k) && !(k === "provenance_certitude" && /d[ée]plac/i.test(String(fidelity[k])))) {
      errors.C5.push(`relecture ${id} : écart déclaré sur ${k} = altération critique, proposition rejetée (§10)`);
    }
  }

  const P = typeof rel.proposition === "string" ? rel.proposition : null;
  if (P === null) {
    errors.C3.push(`relecture ${id} : proposition absente`);
    return { id, errors, soft, blocked };
  }
  // Une correction RE-T1 nécessaire et non faite laisse C3 non remplie, liste vide comprise (§1, C3).
  const leftovers = reT1Leftovers(P);
  if (leftovers.length) {
    errors.C3.push(`relecture ${id} : ${leftovers.length} position(s) RE-T1 avec une espace ordinaire dans la proposition (§6), par exemple ${leftovers.slice(0, 3).join(", ")}. Pour corriger : conserver original.texte et son sha256 à l'identique, guillemets compris ; corriger proposition avec les échappements JSON \\u00a0 ou \\u202f et déclarer chaque changement RE-T1 dans changements. Ne pas régénérer l'original ni supprimer sa ponctuation pour faire disparaître ces positions`);
  }

  if (changes) {
    const sub = { contract, O, P, errors, soft, id, fidelityDeclared: fidelity, ecarts: [] };
    changes.forEach((ch, i) => checkChange(ch || {}, i, sub));
    for (const e of sub.ecarts) {
      errors.C5.push(declaredOk(e.key) ? `fidélité contredite — ${e.detail}` : `altération critique — ${e.detail}`);
    }
    // Une suppression laisse une espace devant la ponctuation qui la suivait.
    const tidy = (t) => t.replace(/ ([.,)])/g, "$1");
    const replayed = tidy(replay(O, changes, id, errors));
    const target = tidy(norm(P));
    if (replayed !== target) {
      const at = firstDiff(replayed, target);
      errors.C3.push(`relecture ${id} : différences non déclarées entre l'original rejoué et la proposition, à partir de ${context(replayed, at)} / ${context(target, at)}`);
    }
  }

  const flags = Array.isArray(rel.signalements_de_fond) ? rel.signalements_de_fond : null;
  if (flags === null) errors.C4.push(`relecture ${id} : signalements_de_fond absent ([] s'il n'y en a aucun)`);
  else flags.forEach((f, i) => {
    const where = `relecture ${id}, signalements_de_fond[${i}]`;
    if (!f || typeof f !== "object") return errors.C4.push(`${where} : entrée illisible`);
    if (!contract.flags.has(f.type)) errors.C4.push(`${where} : type ${JSON.stringify(f.type)} absent du contrat`);
    if (f.extrait === null) {
      if (f.type !== "F-4") errors.C4.push(`${where} : extrait null réservé à une mention manquante (F-4)`);
    } else if (typeof f.extrait !== "string" || !norm(O).includes(norm(f.extrait))) {
      errors.C4.push(`${where} : extrait non retrouvé dans l'original`);
    } else if (!norm(P).includes(norm(f.extrait))) {
      if (!REMOVABLE_FLAGS.has(f.type)) errors.C4.push(`${where} : ${f.type} appliqué dans la proposition au lieu d'une phrase gelée`);
      else soft.push(`${where} : extrait ${f.type} retiré ; permis seulement pour une expérience, un essai, un client, un témoignage ou un superlatif inventés (§3), à vérifier sur le contenu`);
    }
    if (!(typeof f.source === "string" && f.source.trim())) errors.C4.push(`${where} : source absente (« aucune » si aucune)`);
    if (!("formulation" in f)) errors.C4.push(`${where} : formulation absente (texte sourcé ou null)`);
  });
  return { id, errors, soft, blocked };
}

// ---------------------------------------------------------------------------------------------
// Sortie complète
// ---------------------------------------------------------------------------------------------

// Un original reproduit sans fichier de provenance n'existe que dans la réponse (brouillon de la
// session). Une entrée réduite au bloc final ne permet pas de l'y confronter : ce n'est pas la
// sortie livrée. Si la réponse n'affiche ni lui ni la proposition tels quels, mais l'un des deux
// à la typographie près, l'écart cache un changement RE-Tx non déclaré ; d'un seul tenant ou ligne
// à ligne, un écart de typographie ou de balisage Markdown montre que l'original n'est pas le
// brouillon livré tel qu'il est affiché (§10). Sans aucun écart trouvé, l'original reste à
// vérifier sur le contenu. Un chemin de provenance qui ne désigne aucun fichier laisse l'original
// dans ce cas.
function displayCheck(rel, prose, roots) {
  const o = rel.original;
  if (!o || typeof o !== "object" || typeof o.texte !== "string" || !o.texte.trim()) return {};
  if (o.provenance && resolvePath(o.provenance.chemin, roots)) return {};
  const id = rel.id || "?";
  if (!prose.trim()) {
    return { entree: `relecture ${id} : original reproduit sans fichier de provenance, mais l'entrée ne contient que le bloc final : passer au contrôle la réponse entière telle qu'elle est livrée, prose comprise, où le brouillon de la session est affiché (§10)` };
  }
  const texts = [["l'original", o.texte], ["la proposition", rel.proposition]].filter(([, t]) => typeof t === "string" && t.trim());
  const shown = norm(prose);
  // Repli YAML d'un champ ou retours à la ligne restent admis ; les espaces d'un saut forcé Markdown
  // sont du texte livré, que norm() effacerait.
  if (texts.some(([, t]) => keepBreaks(prose).includes(keepBreaks(t)))) return {};
  // Le bloc suit le livrable (§10) : la proposition non plus ne perd ni ne gagne ces espaces.
  const forced = texts.find(([, t]) => shown.includes(norm(t)));
  if (forced) {
    const which = forced[0] === "l'original" ? "l'original n'est pas le brouillon livré" : "la proposition n'est pas le texte livré";
    return { ecart: `relecture ${id} : la réponse affiche ${forced[0]} du bloc aux espaces de fin de ligne près seulement (saut forcé Markdown) : ${which} tel qu'il est affiché (§10)` };
  }
  const shownTypo = typoShape(shown);
  const match = texts.find(([, t]) => shownTypo.includes(typoShape(norm(t))));
  if (match) {
    return { ecart: `relecture ${id} : la réponse affiche ${match[0]} du bloc à la typographie près seulement (espaces insécables, guillemets ou apostrophes) : changement RE-Tx non déclaré, ou original qui n'est pas le texte livré` };
  }
  // D'un seul tenant : chaque ligne d'une version en texte brut peut être courte ou figurer telle
  // quelle dans le brouillon affiché, seul le texte entier montre le balisage retiré.
  const shownPlain = typoShape(norm(stripMarkdown(prose)));
  const plainMatch = texts.find(([, t]) => {
    const plain = typoShape(norm(stripMarkdown(t)));
    return plain.length >= 20 && shownPlain.includes(plain);
  });
  if (plainMatch) {
    return { ecart: `relecture ${id} : la réponse affiche ${plainMatch[0]} du bloc au balisage Markdown près seulement (titres, listes, gras, code ou liens) : une version en texte brut d'un brouillon affiché en Markdown n'est pas le brouillon livré tel qu'il est affiché (§10)` };
  }
  // Une ligne affichée telle quelle dans l'un des deux textes explique l'écart de l'autre (changement déclaré).
  const lines = texts.flatMap(([label, t]) => t.split("\n").map((line) => ({ label, line, l: norm(line) })));
  const shownAsIs = new Set(lines.filter((x) => shown.includes(x.l)).map((x) => typoShape(x.l)));
  for (const { label, line, l } of lines) {
    if (l.length < 20 || words(l).length < 3 || shownAsIs.has(typoShape(l))) continue;
    if (shownTypo.includes(typoShape(l))) {
      return { ecart: `relecture ${id} : la réponse affiche la ligne ${JSON.stringify(l)} de ${label} à la typographie près seulement (espaces insécables, guillemets ou apostrophes) : changement RE-Tx non déclaré, ou original qui n'est pas le texte livré` };
    }
    const plain = typoShape(norm(stripMarkdown(line)));
    if (plain.length >= 20 && shownPlain.includes(plain)) {
      return { ecart: `relecture ${id} : la réponse affiche la ligne ${JSON.stringify(l)} de ${label} au balisage Markdown près (titre, puce, gras, code ou lien) : l'original n'est pas le brouillon livré tel qu'il est affiché (§10)` };
    }
  }
  return { soft: `relecture ${id} : original reproduit sans fichier de provenance, que la réponse n'affiche pas d'un seul tenant : vérifier qu'il reproduit en entier le brouillon livré (§10)` };
}

const STATE_RE = /relecture(?:\s+[ée]ditoriale)?(?:\s+fran[çc]aise)?\s*[:\-–]?\s*(appliqu[ée]e?s?|partielle)/giu;
const stateOf = (s) => (/^appliqu/i.test(s) ? "appliquée" : "partielle");
const ETATS = new Map([["appliquée", "appliquée"], ["appliquee", "appliquée"], ["partielle", "partielle"]]);

function findBlocks(text) {
  const blocks = [];
  for (const m of text.matchAll(/```json[^\n]*\n([\s\S]*?)\n```/g)) {
    if (!/"contrat"\s*:\s*"editorial-review"/.test(m[1])) continue;
    let value = null;
    let error = null;
    try {
      value = JSON.parse(m[1]);
    } catch (e) {
      error = e.message;
    }
    blocks.push({ value, error, start: m.index, end: m.index + m[0].length });
  }
  return blocks;
}

export function checkOutput(text, { roots = [process.cwd()], contractText } = {}) {
  const contract = parseContract(contractText ?? readFileSync(CONTRACT_PATH, "utf8"));
  const report = { resultat: null, etat_declare: null, version: contract.version, conditions: {}, erreurs: [], a_verifier: [] };
  const blocks = findBlocks(text);
  const prose = blocks.reduceRight((t, b) => t.slice(0, b.start) + t.slice(b.end), text);
  // Une mention entre guillemets cite la règle, elle ne déclare rien.
  const proseStates = [...prose.matchAll(STATE_RE)]
    .filter((m) => !/[«"“`]\s*$/u.test(prose.slice(Math.max(0, m.index - 3), m.index)))
    .map((m) => stateOf(m[1]));

  if (blocks.length === 0) {
    report.resultat = proseStates.includes("appliquée") ? "rejetee" : "absente";
    report.erreurs.push(proseStates.includes("appliquée") ? "« relecture appliquée » sans bloc contrôlable" : "aucun bloc editorial-review");
    return report;
  }
  if (blocks.length > 1) {
    report.resultat = "rejetee";
    report.erreurs.push(`${blocks.length} blocs editorial-review : un seul bloc final est contrôlé`);
    return report;
  }
  const [{ value: block, error }] = blocks;
  if (error || !block || typeof block !== "object") {
    report.resultat = "rejetee";
    report.erreurs.push(`bloc illisible : ${error || "objet attendu"}`);
    return report;
  }
  report.etat_declare = block.etat_declare ?? null;
  // « appliquee » est la graphie que le contrat donne au résultat du contrôle (point 5) : même état.
  const etat = ETATS.get(block.etat_declare) ?? null;
  if (!etat) report.erreurs.push(`etat_declare ${JSON.stringify(block.etat_declare)} : « appliquée » ou « partielle »`);
  if (block.version !== contract.version) report.erreurs.push(`version du bloc ${JSON.stringify(block.version)} ≠ contrat ${contract.version}`);
  for (const s of proseStates) {
    if (s !== etat) report.erreurs.push(`la prose dit « relecture ${s} », le bloc déclare ${JSON.stringify(block.etat_declare)}`);
  }

  const relectures = Array.isArray(block.relectures) ? block.relectures : [];
  if (relectures.length === 0) report.erreurs.push("relectures : liste absente ou vide");
  const computed = Object.fromEntries(CONDITIONS.map((c) => [c, []]));
  const readings = checkReadings(block, relectures, roots, contract);
  computed.C1 = readings.errors;
  const results = relectures.map((rel) => checkRelecture(rel || {}, { contract, roots, uncovered: readings.uncovered }));
  const empreintesFausses = [];
  const referencesInexactes = [];
  for (const r of results) {
    for (const c of Object.keys(r.errors)) if (c !== "empreinteFausse" && c !== "referenceInexacte") computed[c].push(...r.errors[c]);
    empreintesFausses.push(...(r.errors.empreinteFausse || []));
    referencesInexactes.push(...(r.errors.referenceInexacte || []));
    report.a_verifier.push(...r.soft);
  }
  const allBlocked = results.length > 0 && results.every((r) => r.blocked);
  const displays = relectures.map((rel) => displayCheck(rel || {}, prose, roots));
  const displayEcarts = displays.map((d) => d.ecart).filter(Boolean);
  const entreesIncompletes = displays.map((d) => d.entree).filter(Boolean);
  computed.C2.push(...displayEcarts, ...entreesIncompletes);
  report.a_verifier.push(...displays.map((d) => d.soft).filter(Boolean));

  const declared = block.conditions && typeof block.conditions === "object" ? block.conditions : {};
  for (const c of CONDITIONS) {
    const d = declared[c];
    const sansObjet = allBlocked && ["C3", "C4", "C5"].includes(c);
    const ok = computed[c].length === 0;
    const entry = { calculee: sansObjet ? "sans_objet" : ok ? "remplie" : "non_remplie", declaree: d && d.etat, raisons: computed[c] };
    report.conditions[c] = entry;
    if (!d || typeof d !== "object") {
      report.erreurs.push(`${c} non déclarée`);
      continue;
    }
    if (d.etat === "remplie" && !ok && !sansObjet) report.erreurs.push(`${c} déclarée remplie, contredite : ${computed[c].join(" ; ")}`);
    else if (d.etat === "non_remplie" && !(typeof d.manque === "string" && d.manque.trim())) report.erreurs.push(`${c} non remplie sans manque nommé`);
    else if (d.etat === "sans_objet" && !(sansObjet && typeof d.cause === "string" && d.cause.trim())) report.erreurs.push(`${c} « sans objet » hors BLOQUÉ_SOURCE / HORS_PÉRIMÈTRE ou sans cause`);
    else if (!["remplie", "non_remplie", "sans_objet"].includes(d.etat)) report.erreurs.push(`${c} : état ${JSON.stringify(d.etat)} inconnu`);
    // Un manque reprend le dernier rapport du contrôle ou une limite réelle (§1) ; le contrôle ne le voit pas.
    if (d.etat === "non_remplie" && ok && !sansObjet && typeof d.manque === "string" && d.manque.trim()) {
      report.a_verifier.push(`${c} déclarée non remplie (manque ${JSON.stringify(d.manque.trim())}) alors que le contrôle la calcule remplie : vérifier que le manque vient du dernier rapport du contrôle ou d'une limite réelle (outil absent, commande interdite, échec de l'outil)`);
    }
  }
  // Rejet même en « partielle » : une empreinte fausse est un champ fabriqué, pas un manque.
  for (const msg of empreintesFausses) {
    report.erreurs.push(`empreinte fausse — ${msg} ; une empreinte ne se recopie ni ne s'estime : laisser sha256 à null et nommer le manque`);
  }
  // Même règle : un original qui n'est pas le texte livré est un champ inexact, pas un manque.
  for (const msg of displayEcarts) report.erreurs.push(`original inexact — ${msg}`);
  // Même règle : un contrôle passé sur le seul bloc ne porte pas sur la sortie livrée.
  for (const msg of entreesIncompletes) report.erreurs.push(`entrée incomplète — ${msg}`);
  // Même règle quelle que soit la provenance de l'original : la prose qui précède le bloc
  // (brouillon, tableaux, limites) fait partie de la sortie livrée.
  if (!prose.trim() && !entreesIncompletes.length) {
    report.erreurs.push("entrée incomplète — l'entrée ne contient que le bloc final : passer au contrôle la réponse entière telle qu'elle est livrée, prose comprise (§10)");
  }
  // Même règle : une référence qui ne désigne pas le texte reproduit, ou un champ structuré désigné
  // par la seule syntaxe du document, est inexacte, même quand la relecture sort du périmètre.
  for (const msg of referencesInexactes) report.erreurs.push(`référence inexacte — ${msg}`);

  const allMet = CONDITIONS.every((c) => report.conditions[c].calculee !== "non_remplie" && declared[c] && declared[c].etat !== "non_remplie");
  if (etat === "appliquée" && !allMet) {
    const missing = CONDITIONS.filter((c) => report.conditions[c].calculee === "non_remplie" || (declared[c] && declared[c].etat === "non_remplie"));
    report.erreurs.push(`« relecture appliquée » avec ${missing.join(", ")} non remplie(s)`);
  }
  report.a_verifier.push(
    "pertinence de chaque règle RE et fidélité de sens : à vérifier sur le contenu par le validateur du circuit (§1)",
    "lectures : plages confrontées aux fichiers, pas à la trace de la session ; une empreinte juste ne prouve pas qu'un outil l'a calculée",
  );
  report.resultat = report.erreurs.length ? "rejetee" : etat === "appliquée" ? "appliquee" : "partielle";
  return report;
}

function render(report) {
  const lines = [`editorial-review ${report.version} — ${report.resultat.toUpperCase()}`];
  if (report.etat_declare) lines.push(`état déclaré : ${report.etat_declare}`);
  for (const [c, e] of Object.entries(report.conditions)) {
    lines.push(`${c} calculée ${e.calculee}, déclarée ${e.declaree ?? "—"}`);
    for (const r of e.raisons) lines.push(`  - ${r}`);
  }
  if (report.erreurs.length) lines.push("Erreurs :", ...report.erreurs.map((e) => `  - ${e}`));
  if (report.a_verifier.length) lines.push("À vérifier sur le contenu :", ...report.a_verifier.map((e) => `  - ${e}`));
  return `${lines.join("\n")}\n`;
}

function main(argv) {
  const roots = [];
  let json = false;
  let emit = false;
  let file = null;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--root" && argv[i + 1]) roots.push(resolve(argv[(i += 1)]));
    else if (a === "--json") json = true;
    else if (a === "--emit") emit = true;
    else if (!a.startsWith("--") && file === null) file = a;
    else {
      process.stderr.write("usage : check-editorial-review.mjs [--root <dossier>]... [--json | --emit] [fichier]\n");
      return 2;
    }
  }
  if (json && emit) {
    process.stderr.write("--emit et --json sont exclusifs : la réponse et le rapport ont des sorties distinctes\n");
    return 2;
  }
  const text = readFileSync(file ?? 0, "utf8");
  const report = checkOutput(text, { roots: roots.length ? roots : [process.cwd()] });
  if (emit) {
    process.stderr.write(render(report));
    if (report.resultat === "appliquee" || report.resultat === "partielle") process.stdout.write(text);
  } else process.stdout.write(json ? `${JSON.stringify(report, null, 2)}\n` : render(report));
  return report.resultat === "appliquee" ? 0 : report.resultat === "partielle" ? 3 : 1;
}

// Comparaison sur chemins réels : un lien symbolique ou un caractère encodé ne doit
// pas faire sortir le script en 0 sans contrôle.
if (process.argv[1] && fileURLToPath(import.meta.url) === realpathSync(process.argv[1])) {
  // Laisser stdout/stderr se vider : process.exit() peut tronquer une réponse longue
  // écrite dans un pipe, ce qui invaliderait la garantie de livraison de --emit.
  process.exitCode = main(process.argv.slice(2));
}
