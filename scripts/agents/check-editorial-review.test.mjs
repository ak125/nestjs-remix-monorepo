// =============================================================================
// Tests de check-editorial-review.mjs — fixtures synthétiques minimales.
// Chaque cas rejeté reproduit, sur un texte inventé, un défaut observé en recette
// (empreinte sur une autre représentation, liste vide sans raison, RE-16/RE-23 qui
// changent l'information, conditions non nommées, lecture tronquée comptée, espace ordinaire
// restée aux positions RE-T1, original en texte brut d'un brouillon affiché en Markdown, champ
// structuré désigné par une plage ou sans son chemin de clés, plage d'original non lue, contrôle
// passé sur le seul bloc final, sections déclarées sans les titres rendus ou avec un titre
// seulement atteint, original dont la réponse affiche les lignes sous d'autres intertitres,
// `format` hors du contrat, script Fafa sans la persona). Recette R26 : en mode strict, plage
// au-delà de la dernière ligne (N+1) et proposition absente de la prose ou affichée à une forme
// voisine ; garde de sortie (hook Stop) qui bloque une réponse recomposée après le contrôle.
// Lot R27 : étape 6 relevée dans le flux natif de Codex (acceptation par --emit, puis deux
// passages sans --emit l'un après l'autre) ; lanceur opt-in qui extrait et vérifie la réponse.
// Run: node --test scripts/agents/check-editorial-review.test.mjs
// =============================================================================
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONTRACT_PATH,
  REQUIRED_SECTIONS,
  SCRIPT_SECTION,
  STEP_KEYS,
  checkOutput,
  parseContract,
  renderedSections,
  sectionRange,
} from "./check-editorial-review.mjs";

const SCRIPT = fileURLToPath(new URL("./check-editorial-review.mjs", import.meta.url));
const REPO = resolve(dirname(SCRIPT), "..", "..");
const CONTRACT = parseContract(readFileSync(CONTRACT_PATH, "utf8"));
const VOICE = ".claude/canon-mirrors/marketing-voice.md";
const lineCount = (p) => readFileSync(p, "utf8").replace(/\n$/, "").split("\n").length;
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

// Insécables aux positions RE-T1 (§6) ; O_PLAIN est le même texte en espaces ordinaires.
const NB = "\u00a0";
const O = `Le filtre à huile est une pièce essentielle qui retient les impuretés du circuit. Ne le remplacez pas moteur chaud${NB}: selon le moteur, l'huile peut dépasser 100${NB}°C.`;
const P = `Le filtre à huile retient les impuretés du circuit. Ne le remplacez pas moteur chaud${NB}: selon le moteur, l'huile peut dépasser 100${NB}°C.`;
const O_PLAIN = O.replace(/\u00a0/g, " ");

let dir;
let source;
before(() => {
  dir = mkdtempSync(join(tmpdir(), "editorial-review-"));
  source = join(dir, "source.md");
  writeFileSync(source, "# Filtre à huile\n\nRetient les impuretés.\nNe pas remplacer moteur chaud ; huile au-delà de 100 °C selon le moteur.\n");
});
after(() => rmSync(dir, { recursive: true, force: true }));

const fidelity = () => ({
  references_identifiants: "inchangé",
  nombres_unites: "inchangé",
  normes_intervalles_commerce: "inchangé",
  provenance_certitude: "inchangé",
  conditions_negations: "inchangé",
});
const steps = () => Object.fromEntries(STEP_KEYS.map((k) => [k, { executee: true, trace: `étape ${k} tracée dans la sortie` }]));
const allMet = () => Object.fromEntries(["C1", "C2", "C3", "C4", "C5", "C6", "C7"].map((c) => [c, { etat: "remplie" }]));

function block({ original = O, proposition = P, changements, etat = "appliquée" } = {}) {
  return {
    contrat: "editorial-review",
    version: CONTRACT.version,
    etat_declare: etat,
    lectures: [
      { chemin: ".claude/prompts/_shared/editorial-review.md", plages: [`1-${CONTRACT.nLines}`], masquees: [], sections: ["toutes"], tronque: false },
      { chemin: VOICE, plages: [`1-${lineCount(join(REPO, VOICE))}`], masquees: [], sections: ["toutes"], tronque: false },
      { chemin: source, plages: [`1-${lineCount(source)}`], masquees: [], sections: ["toutes"], tronque: false },
    ],
    relectures: [
      {
        id: "r1",
        format: "prose",
        sources: [source],
        original: { texte: original, fins_de_ligne: "LF", saut_final: false, sha256: sha(original) },
        proposition,
        changements: changements ?? [
          { avant: "est une pièce essentielle qui retient", apres: "retient", regle: "RE-10", raison: "mot d'apparat sans information, supprimé" },
        ],
        raison_aucun_changement: null,
        signalements_de_fond: [],
        controle_fidelite: fidelity(),
        verdict: "PROPOSITION",
        etapes: steps(),
      },
    ],
    conditions: allMet(),
  };
}

// Champ structuré déclaré hors périmètre : aucune règle appliquée, C3 à C5 sans objet.
function blockedBlock() {
  const b = block({ proposition: O, changements: [], etat: "partielle" });
  const rel = b.relectures[0];
  rel.verdict = "HORS_PÉRIMÈTRE";
  rel.raison_aucun_changement = "champ structuré protégé (§4), aucune règle RE appliquée";
  rel.etapes.appliquer_regles = { executee: false, cause: "champ hors périmètre de la relecture" };
  rel.etapes.controle_fidelite = { executee: false, cause: "aucun changement à confronter" };
  for (const c of ["C3", "C4", "C5"]) b.conditions[c] = { etat: "sans_objet", cause: "verdict HORS_PÉRIMÈTRE : champ structuré protégé" };
  return b;
}

// Aucun changement : la proposition reprend l'original.
function unchangedBlock(text, etat = "appliquée") {
  const b = block({ original: text, proposition: text, changements: [], etat });
  b.relectures[0].verdict = "AUCUN_CHANGEMENT_UTILE";
  b.relectures[0].raison_aucun_changement = "texte déjà direct, positions RE-T1 relevées une par une";
  return b;
}

// Fiche à frontmatter imbriqué, lue en entier : le champ est en ligne 5, sous trois clés.
function nestedFiche(b, name) {
  const fiche = join(dir, name);
  writeFileSync(fiche, `---\nentity_data:\n  editorial:\n    selection_criteria:\n      content_md: '${O.replace(/'/g, "''")}'\n    status: draft\n---\n\n# Corps\n`);
  b.lectures.push({ chemin: fiche, plages: [`1-${lineCount(fiche)}`], masquees: [], sections: ["toutes"], tronque: false });
  return fiche;
}
const FIELD = "entity_data.editorial.selection_criteria.content_md";
const MD = `## Filtre à huile\n\n- **Rôle**${NB}: retient les impuretés du circuit.\n- **Précaution**${NB}: ne le remplacez pas moteur chaud.`;
// Deux espaces en fin de ligne : saut forcé en Markdown, à reproduire dans l'original.
const MD_BR = `**Scène 1 — Ouverture**  \nLe filtre retient les impuretés du circuit de lubrification.  \nNe le remplacez pas moteur chaud${NB}: l'huile peut être brûlante.`;
// Script dont la réponse affiche les lignes sous un autre intertitre (recette R18, Codex seo-batch).
const SCRIPT_LINES = ["**Accroche** — Un filtre à huile colmaté ne prévient pas toujours.", "**Corps** — Il retient les impuretés du circuit de lubrification."];
const SCRIPT_MD = ["## Script vidéo candidat", "", ...SCRIPT_LINES].join("\n");
const SCRIPT_SHOWN = ["### Script vidéo, format pièce expliquée", "", ...SCRIPT_LINES].join("\n");
// Script Fafa : le skill persona et la persona elle-même, lus en entier (§1, point 2).
const PERSONA_SKILL = "workspaces/marketing/.claude/skills/fafa-persona-canon/SKILL.md";
const PERSONA = "workspaces/marketing/fafa-media-factory/personas/fafa.md";
function scriptBlock(paths = [PERSONA_SKILL, PERSONA]) {
  const b = block();
  b.relectures[0].format = "script";
  for (const p of paths) b.lectures.push({ chemin: p, plages: [`1-${lineCount(join(REPO, p))}`], masquees: [], sections: ["toutes"], tronque: false });
  return b;
}

// Fiche Markdown à trois niveaux de titres, frontmatter et bloc de code compris (§10, `sections`).
const SECTIONS_MD = [
  "---", "title: Filtre à huile", "---",
  "# Filtre à huile", "",
  "## Rôle", "Retient les impuretés du circuit.",
  "### Formes", "Vissé ou cartouche.",
  "```md", "# pas un titre", "```",
  "## Symptômes & diagnostic", "Pression d'huile basse.",
  "## 3. Marques & qualité", "Équivalence constructeur.",
].join("\n") + "\n";
// Lignes 1-13 rendues : « Symptômes & diagnostic » n'est atteinte que par son titre (l. 13).
const SECTIONS_1_13 = ["frontmatter", "Filtre à huile (partielle)", "Rôle", "Formes", "Symptômes & diagnostic (titre seul)"];
function sectionsFiche(b, sections, plages = ["1-13"]) {
  const fiche = join(dir, "sections.md");
  writeFileSync(fiche, SECTIONS_MD);
  b.lectures.push({ chemin: fiche, plages, masquees: [], sections, tronque: false });
  return b;
}

const output = (b, prose = "Relecture : voir le bloc final.") => `${prose}\n\n\`\`\`json\n${JSON.stringify(b, null, 2)}\n\`\`\`\n`;
const run = (text) => checkOutput(text, { roots: [REPO, dir] });
const errors = (r) => r.erreurs.join("\n");

describe("contrat", () => {
  test("les sections exigées, les règles, les types et les verdicts sont lus dans le contrat", () => {
    for (const t of [...REQUIRED_SECTIONS, SCRIPT_SECTION]) assert.ok(sectionRange(CONTRACT, t), t);
    assert.ok(CONTRACT.rules.has("RE-23") && CONTRACT.rules.has("RE-T5"));
    assert.deepEqual([...CONTRACT.flags].sort(), ["F-1", "F-2", "F-3", "F-4", "F-5", "F-6"]);
    assert.ok(CONTRACT.verdicts.has("AUCUN_CHANGEMENT_UTILE") && CONTRACT.verdicts.has("BLOQUÉ_SOURCE"));
    assert.deepEqual([...CONTRACT.formats].sort(), ["prose", "script", "social"]);
  });

  test("la livraison contrôlée nomme la ligne d'entrée du rapport et les deux passages sans --emit", () => {
    const text = readFileSync(CONTRACT_PATH, "utf8");
    const steps = text.slice(text.indexOf("### Lecture, application et déclaration"), text.indexOf("### Contrôle avant déclaration"));
    assert.match(steps, /^6\. \*\*Livrer\*\*/m);
    assert.match(steps, /`entrée : <n> o, sha256 <empreinte>`/);
    assert.match(steps, /sans\s+`--emit`/);
    assert.match(steps, /deux\s+commandes\s+séparées/);
  });
});

describe("cas acceptés", () => {
  test("changement RE-10 conforme : appliquee", () => {
    const r = run(output(block()));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("aucun changement utile, avec sa raison : appliquee", () => {
    const b = block({ proposition: O, changements: [] });
    b.relectures[0].verdict = "AUCUN_CHANGEMENT_UTILE";
    b.relectures[0].raison_aucun_changement = "texte déjà direct, aucun motif RE présent";
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("RE-T2 ne change que les guillemets : appliquee", () => {
    const o = 'Le guide dit "vissé" pour ce montage.';
    const p = `Le guide dit «${NB}vissé${NB}» pour ce montage.`;
    const b = block({ original: o, proposition: p, changements: [{ avant: '"vissé"', apres: `«${NB}vissé${NB}»`, regle: "RE-T2", raison: "guillemets français dans la prose" }] });
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("partielle honnête sans outil d'empreinte : partielle", () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.sha256 = null;
    b.conditions.C2 = { etat: "non_remplie", manque: "aucun outil d'exécution pour calculer le sha256" };
    const r = run(output(b, "Je ne peux pas écrire « relecture appliquée » : relecture partielle, C2 non remplie."));
    assert.equal(r.resultat, "partielle", errors(r));
  });

  test("troncature déclarée avec ses plages et C1 non remplie : partielle", () => {
    const b = block({ etat: "partielle" });
    b.lectures[0].tronque = true;
    b.lectures[0].masquees = ["200-260"];
    const covered = new Set(Array.from({ length: CONTRACT.nLines }, (_, k) => k + 1).filter((n) => n < 200 || n > 260));
    b.lectures[0].sections = renderedSections(readFileSync(CONTRACT_PATH, "utf8"), covered).map((s) => s.title + s.suffix);
    b.conditions.C1 = { etat: "non_remplie", manque: "lignes 200-260 du contrat coupées par l'outil, non relues" };
    const r = run(output(b));
    assert.equal(r.resultat, "partielle", errors(r));
  });

  test("original reproduit d'un champ YAML entre apostrophes, avec sa provenance : appliquee", () => {
    const fiche = join(dir, "fiche.md");
    writeFileSync(fiche, `---\nchamp:\n  content_md: '${O.replace(/'/g, "''").replace(" selon le moteur", "\n    selon le moteur")}'\n---\n`);
    const b = block();
    b.lectures.push({ chemin: fiche, plages: ["1-5"], masquees: [], sections: ["toutes"], tronque: false });
    b.relectures[0].original.provenance = { chemin: fiche, lignes: "2-4", champ: "champ.content_md" };
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("plage qui inclut la ligne vide rendue après le dernier saut (N+1) : appliquee", () => {
    const b = block();
    b.lectures[0].plages = [`1-${CONTRACT.nLines + 1}`];
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("insécable posée par un RE-T1 déclaré, proposition affichée : appliquee", () => {
    const o = O.replace(`${NB}:`, " :");
    const b = block({ original: o, proposition: O, changements: [{ avant: "chaud : selon", apres: `chaud${NB}: selon`, regle: "RE-T1", raison: "espace insécable avant les deux-points" }] });
    const r = run(output(b, `Proposition :\n\n${O}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("trace et raison courtes mais écrites (« aucun », « doublon ») : appliquee", () => {
    const b = block({ changements: [{ avant: "est une pièce essentielle qui retient", apres: "retient", regle: "RE-10", raison: "doublon" }] });
    b.relectures[0].etapes.relever_signalements.trace = "aucun";
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("etat_declare « appliquee », graphie du résultat du contrôle (point 5) : appliquee", () => {
    const r = run(output(block({ etat: "appliquee" }), "Relecture appliquée : voir le bloc final."));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("brouillon de la session reproduit, provenance sans chemin : appliquee", () => {
    const b = block();
    b.relectures[0].original.provenance = { champ: "brouillon rédigé dans cette réponse" };
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("HORS_PÉRIMÈTRE avec sa cause dans raison_aucun_changement : C6 remplie", () => {
    const b = blockedBlock();
    const r = run(output(b));
    assert.equal(r.conditions.C6.calculee, "remplie", errors(r));
    assert.equal(r.resultat, "partielle", errors(r));
  });

  test("brouillon Markdown reproduit tel qu'affiché, intertitre et puces compris : appliquee", () => {
    const r = run(output(unchangedBlock(MD), `Brouillon :\n\n${MD}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("brouillon Markdown à sauts forcés reproduit avec ses espaces de fin de ligne : appliquee", () => {
    const r = run(output(unchangedBlock(MD_BR), `Brouillon :\n\n${MD_BR}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("proposition à sauts forcés affichée telle quelle, insécable déclarée en RE-T1 : appliquee", () => {
    const b = block({ original: MD_BR.replace(NB, " "), proposition: MD_BR, changements: [{ avant: "chaud : l'huile", apres: `chaud${NB}: l'huile`, regle: "RE-T1", raison: "espace insécable avant les deux-points" }] });
    const r = run(output(b, `Proposition :\n\n${MD_BR}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("champ affiché dans sa source YAML repliée (>-), original = valeur du champ : appliquee", () => {
    const value = "Choisissez la forme prévue pour le moteur, filtre vissé complet ou cartouche pour boîtier démontable. Ne vous fiez pas à l'apparence.";
    const yaml = ["```yaml", "selection_criteria:", "  content_md: >-", "    Choisissez la forme prévue pour le moteur, filtre vissé complet ou", "    cartouche pour boîtier démontable. Ne vous fiez pas à l'apparence.", "```"].join("\n");
    const r = run(output(unchangedBlock(value), `Bloc proposé :\n\n${yaml}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("intertitre, tableau, code et URL gardent leur typographie : positions non relevées", () => {
    const t = ["## Vidange : étapes", "", "| Couple | 25 Nm |", "|---|---|", "", `Serrez \`vis : M6\` sans forcer, voir https://exemple.fr/guide${NB}: détail.`, "", "```", "couple : 25 Nm", "```"].join("\n");
    const r = run(output(unchangedBlock(t)));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("reliquat RE-T1 déclaré par C3 non remplie, avec son manque : partielle", () => {
    const b = unchangedBlock(O_PLAIN, "partielle");
    b.conditions.C3 = { etat: "non_remplie", manque: "deux positions RE-T1 en espace ordinaire relevées par le contrôle, non corrigées" };
    const r = run(output(b));
    assert.equal(r.resultat, "partielle", errors(r));
  });

  test("champ de frontmatter reproduit avec son chemin de clés depuis la racine : appliquee", () => {
    const b = block();
    b.relectures[0].original.provenance = { chemin: nestedFiche(b, "fiche-cles.md"), lignes: "5", champ: FIELD };
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("condition déclarée non remplie que le contrôle calcule remplie : point à vérifier", () => {
    const b = block({ etat: "partielle" });
    b.conditions.C4 = { etat: "non_remplie", manque: "signalements non relus" };
    const r = run(output(b, "Relecture partielle : C4 non remplie."));
    assert.equal(r.resultat, "partielle", errors(r));
    assert.ok(r.a_verifier.some((s) => /C4 déclarée non remplie .* calcule remplie/.test(s)), r.a_verifier.join("\n"));
  });

  test("sections relevées dans les lignes rendues, suffixes compris : appliquee", () => {
    const r = run(output(sectionsFiche(block(), SECTIONS_1_13)));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("lecture arrêtée avant le titre suivant : sections partielles, fin non observée", () => {
    const b = sectionsFiche(block(), ["frontmatter", "Filtre à huile (partielle)", "Rôle (partielle)", "Formes (partielle)"], ["1-12"]);
    const r = run(output(b));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("fichier entier déclaré titre par titre, numéro de section omis : appliquee", () => {
    const all = ["frontmatter", "Filtre à huile", "Rôle", "Formes", "Symptômes & diagnostic", "Marques & qualité"];
    const r = run(output(sectionsFiche(block(), all, ["1-16"])));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("une seule ligne de l'original citée dans la prose : point à vérifier, pas un rejet", () => {
    const r = run(output(unchangedBlock(SCRIPT_MD), `Accroche retenue :\n\n${SCRIPT_LINES[0]}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
    assert.ok(r.a_verifier.some((s) => /pas d'un seul tenant/.test(s)), r.a_verifier.join("\n"));
  });

  // La règle des lignes affichées sans l'original entier (§10) ne vise pas une citation : le
  // brouillon affiché entier, ou la proposition affichée entière, laisse citer ses lignes.
  test("lignes de l'original citées, répétées comprises, après le brouillon affiché entier : appliquee", () => {
    const quotes = [SCRIPT_LINES[1], SCRIPT_LINES[0], SCRIPT_LINES[1]].join("\n");
    const r = run(output(unchangedBlock(SCRIPT_MD), `Brouillon :\n\n${SCRIPT_MD}\n\nLignes discutées :\n\n${quotes}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("lignes de l'original citées, proposition affichée entière : appliquee", () => {
    const o = SCRIPT_MD.replace("les impuretés du circuit", "les impuretés essentielles du circuit");
    const b = block({ original: o, proposition: SCRIPT_MD, changements: [{ avant: "les impuretés essentielles du circuit", apres: "les impuretés du circuit", regle: "RE-10", raison: "mot d'apparat sans information, supprimé" }] });
    const quotes = o.split("\n").slice(2).join("\n");
    const r = run(output(b, `Proposition :\n\n${SCRIPT_MD}\n\nLignes de l'original discutées :\n\n${quotes}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("script Fafa avec le skill persona et la persona lus en entier : appliquee", () => {
    const r = run(output(scriptBlock()));
    assert.equal(r.resultat, "appliquee", errors(r));
  });
});

describe("cas rejetés", () => {
  test("original dont la réponse affiche les lignes sous un autre intertitre", () => {
    const r = run(output(unchangedBlock(SCRIPT_MD), `Brouillon :\n\n${SCRIPT_SHOWN}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /original inexact.*2 lignes de l'original.*pas sa ligne "## Script vidéo candidat"/);
  });

  test("original dont chaque ligne est affichée, mais pas d'un seul tenant (ligne ajoutée)", () => {
    const shown = [SCRIPT_MD.split("\n")[0], "", SCRIPT_LINES[0], "**Plan** — Gros plan sur la cartouche usagée.", SCRIPT_LINES[1]].join("\n");
    const r = run(output(unchangedBlock(SCRIPT_MD), `Brouillon :\n\n${shown}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /original inexact.*chaque ligne de l'original, mais pas d'un seul tenant/);
  });

  test("script Fafa sans la persona : fafa-persona-canon n'en dispense pas", () => {
    const r = run(output(scriptBlock([PERSONA_SKILL])));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /C1 déclarée remplie, contredite.*personas\/fafa\.md : aucune lecture déclarée/);
  });

  test("persona d'un script lue en partie", () => {
    const b = scriptBlock();
    b.lectures.at(-1).plages = ["1-20"];
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /persona fafa-media-factory\/personas\/fafa\.md : lignes non rendues 21-/);
  });

  test("format hors des valeurs du contrat, qui contournerait les lectures du script", () => {
    const b = block();
    b.relectures[0].format = "prose-et-script-fafa";
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /format "prose-et-script-fafa" hors des valeurs du contrat \(prose, script, social\)/);
  });

  test("original du bloc qui ne diffère du brouillon affiché que par des insécables, même en partielle", () => {
    const o = O;
    const b = block({ original: o, proposition: o, changements: [], etat: "partielle" });
    b.relectures[0].verdict = "AUCUN_CHANGEMENT_UTILE";
    b.relectures[0].raison_aucun_changement = "insécables déjà posées, rien à changer";
    b.relectures[0].original.sha256 = null;
    b.conditions.C2 = { etat: "non_remplie", manque: "aucun outil d'exécution pour calculer le sha256" };
    const r = run(output(b, `Brouillon :\n\n${O_PLAIN}\n\nRelecture partielle : C2 non remplie.`));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /original inexact.*typographie près/);
  });

  test("empreinte calculée sur une autre représentation du texte", () => {
    const b = block();
    b.relectures[0].original.sha256 = sha(`**${O}**`);
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /sha256 faux.*autre représentation/);
  });

  test("empreinte calculée avec des espaces ordinaires à la place des insécables", () => {
    const b = block();
    b.relectures[0].original.sha256 = sha(O_PLAIN);
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /sha256 faux.*espaces ordinaires à la place des insécables/);
  });

  test("le rapport d'une empreinte fausse n'affiche pas l'empreinte attendue", () => {
    const b = block();
    const attendue = sha(O);
    b.relectures[0].original.sha256 = `${attendue.slice(0, 12)}${"0".repeat(52)}`;
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), new RegExp(`octets désignés : ${Buffer.byteLength(O, "utf8")} o`));
    assert.doesNotMatch(errors(r).replace(/déclaré [0-9a-f]{12}…/g, ""), new RegExp(attendue.slice(0, 12)));
  });

  test("empreinte calculée avec un saut final non déclaré, même en partielle", () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.sha256 = sha(`${O}\n`);
    b.conditions.C2 = { etat: "non_remplie", manque: "empreinte non vérifiée" };
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /autre convention de saut final/);
    assert.match(errors(r), /empreinte fausse/);
  });

  test("provenance désignée qui ne contient pas le texte reproduit", () => {
    const b = block();
    b.relectures[0].original.provenance = { chemin: source, lignes: "1-4", champ: "corps" };
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /C2 déclarée remplie, contredite.*texte non retrouvé/);
  });

  test("provenance dont le chemin ne désigne aucun fichier : le brouillon reste confronté au texte affiché", () => {
    const o = O;
    const b = block({ original: o, proposition: o, changements: [], etat: "partielle" });
    b.relectures[0].verdict = "AUCUN_CHANGEMENT_UTILE";
    b.relectures[0].raison_aucun_changement = "insécable déjà posée, rien à changer";
    b.relectures[0].original.sha256 = null;
    b.relectures[0].original.provenance = { chemin: "réponse finale de cette session, section b", lignes: "1-2", champ: "texte" };
    b.conditions.C2 = { etat: "non_remplie", manque: "aucun outil d'exécution pour calculer le sha256" };
    const r = run(output(b, `Brouillon :\n\n${O_PLAIN}\n\nRelecture partielle : C2 non remplie.`));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /original inexact.*typographie près/);
  });

  test("etat_declare hors des deux valeurs", () => {
    for (const etat of ["terminée", "constructor"]) {
      const r = run(output(block({ etat })));
      assert.equal(r.resultat, "rejetee", etat);
      assert.match(errors(r), /etat_declare .* : « appliquée » ou « partielle »/);
    }
  });

  test("HORS_PÉRIMÈTRE sans raison écrite, C3 à C5 « sans objet » sans cause", () => {
    const b = blockedBlock();
    b.relectures[0].raison_aucun_changement = "HORS_PÉRIMÈTRE";
    for (const c of ["C3", "C4", "C5"]) b.conditions[c] = { etat: "sans_objet" };
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /HORS_PÉRIMÈTRE sans cause dans raison_aucun_changement/);
    assert.match(errors(r), /C3 « sans objet » hors BLOQUÉ_SOURCE \/ HORS_PÉRIMÈTRE ou sans cause/);
  });

  test("liste de changements vide sans raison", () => {
    const b = block({ proposition: O, changements: [] });
    b.relectures[0].verdict = "AUCUN_CHANGEMENT_UTILE";
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /C3 déclarée remplie, contredite.*sans raison_aucun_changement/);
  });

  test("proposition absente : la liste vide sans raison reste nommée", () => {
    const b = block({ changements: [] });
    delete b.relectures[0].proposition;
    b.relectures[0].verdict = "AUCUN_CHANGEMENT_UTILE";
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /proposition absente/);
    assert.match(errors(r), /sans raison_aucun_changement/);
  });

  test("« appliquée » avec signalements, fidélité et étapes absents", () => {
    const b = block();
    delete b.relectures[0].signalements_de_fond;
    delete b.relectures[0].controle_fidelite;
    delete b.relectures[0].etapes;
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    for (const c of ["C4", "C5", "C7"]) assert.match(errors(r), new RegExp(`${c} déclarée remplie, contredite`));
  });

  test("« relecture appliquée » sans bloc, et sortie sans bloc ni déclaration", () => {
    assert.equal(run("Relecture appliquée. Elle ne vaut ni validation ni promotion.").resultat, "rejetee");
    assert.equal(run("Brouillon sans relecture.").resultat, "absente");
  });

  test("partielle qui ne nomme pas C4 à C7", () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.sha256 = null;
    b.conditions = { C1: { etat: "remplie" }, C2: { etat: "non_remplie", manque: "pas d'outil d'empreinte" }, C3: { etat: "remplie" } };
    const r = run(output(b, "Relecture partielle."));
    assert.equal(r.resultat, "rejetee");
    for (const c of ["C4", "C5", "C6", "C7"]) assert.match(errors(r), new RegExp(`${c} non déclarée`));
  });

  test("RE-23 retire une information sous une fidélité « inchangé »", () => {
    const o = "Selon le moteur, des filtres semblables diffèrent par leur clapet anti-retour présent ou non, leur filetage et la surpression admissible.";
    const p = "Selon le moteur, des filtres semblables diffèrent par leurs clapets, leur filetage.";
    const b = block({
      original: o,
      proposition: p,
      changements: [
        { avant: "leur clapet anti-retour présent ou non", apres: "leurs clapets", regle: "RE-23", raison: "concision, la variabilité reste" },
        { avant: "et la surpression admissible", apres: "", regle: "RE-23", raison: "raccourcissement du bloc" },
      ],
    });
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /RE-23 retire de l'information/);
    assert.match(errors(r), /fidélité contredite.*conditions_negations/);
  });

  test("RE-16 ajoute une information et ne revient pas à « est » ou « a »", () => {
    const o = "Le choix part du véhicule, jamais de l'apparence.";
    const p = "Choisissez le filtre prévu pour le véhicule et la forme attendue, vissée ou cartouche. Ne vous fiez pas à l'apparence.";
    const b = block({
      original: o,
      proposition: p,
      changements: [{ avant: o, apres: p, regle: "RE-16", raison: "formulation plus directe et distinction vissé/cartouche" }],
    });
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /RE-16 ajoute de l'information/);
    assert.match(errors(r), /RE-16 sans retour/);
    assert.match(errors(r), /fidélité contredite.*conditions_negations/);
  });

  test("négation retirée sous une règle de style, fidélité déclarée « inchangé »", () => {
    const o = "Un filtre essentiel ne se monte pas sans joint neuf.";
    const p = "Un filtre se monte sans joint neuf.";
    const b = block({ original: o, proposition: p, changements: [{ avant: "Un filtre essentiel ne se monte pas", apres: "Un filtre se monte", regle: "RE-10", raison: "mot d'apparat supprimé" }] });
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /fidélité contredite.*conditions_negations.*retiré \["ne","pas"\]/);
  });

  test("écart déclaré : altération critique, proposition rejetée", () => {
    const b = block();
    b.relectures[0].controle_fidelite.nombres_unites = "100 °C devient 120 °C";
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /altération critique/);
  });

  test("différence entre la proposition et les changements déclarés", () => {
    const b = block({ proposition: P.replace(`100${NB}°C`, `120${NB}°C`) });
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /différences non déclarées/);
  });

  test("avant absent de l'original, règle inconnue, raison réduite au code", () => {
    const b = block({ changements: [{ avant: "phrase qui n'existe pas", apres: "retient", regle: "RE-99", raison: "RE-99" }] });
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /avant non retrouvé/);
    assert.match(errors(r), /RE-99.*absente du contrat/);
    assert.match(errors(r), /raison absente ou réduite au code/);
  });

  test("trace vide, ponctuation du modèle ou nom de l'étape ; raison de liste vide réduite au verdict", () => {
    const b = block({ proposition: O, changements: [] });
    b.relectures[0].verdict = "AUCUN_CHANGEMENT_UTILE";
    b.relectures[0].raison_aucun_changement = "AUCUN_CHANGEMENT_UTILE";
    b.relectures[0].etapes.relever_signalements.trace = " ";
    b.relectures[0].etapes.controle_fidelite.trace = "…";
    b.relectures[0].etapes.rendre_verdict.trace = "rendre_verdict";
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    for (const k of ["relever_signalements", "controle_fidelite", "rendre_verdict"]) assert.match(errors(r), new RegExp(`étape ${k} sans trace`));
    assert.match(errors(r), /sans raison_aucun_changement/);
  });

  test("lecture tronquée comptée comme lue", () => {
    const b = block();
    b.lectures[0].tronque = true;
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /C1 déclarée remplie, contredite.*troncature déclarée sans les plages masquées/);
  });

  test("lecture partielle du contrat déclarée complète", () => {
    const end = sectionRange(CONTRACT, "Sortie attendue").start - 1;
    const b = block();
    b.lectures[0].plages = [`1-${end}`];
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /section « Sortie attendue ».*lignes non rendues/);
  });

  test("plage au-delà de la ligne vide finale", () => {
    const b = block();
    b.lectures[0].plages = [`1-${CONTRACT.nLines + 2}`];
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /C1 déclarée remplie, contredite.*hors du fichier/);
  });

  test("prose qui déclare « appliquée » contre un bloc « partielle »", () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.sha256 = null;
    b.conditions.C2 = { etat: "non_remplie", manque: "pas d'outil d'empreinte" };
    const r = run(output(b, "Étape 9 : relecture éditoriale française appliquée au texte candidat."));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /la prose dit « relecture appliquée »/);
  });

  test("bloc d'une autre version du contrat", () => {
    const b = block();
    b.version = "1.3.0";
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /version du bloc/);
  });

  test("deux blocs editorial-review", () => {
    const text = output(block()) + output(block());
    assert.equal(run(text).resultat, "rejetee");
  });

  test("espace ordinaire restée aux positions RE-T1, liste vide comprise", () => {
    const P_PLAIN = P.replace(/ /g, " ");
    for (const b of [unchangedBlock(O_PLAIN), block({ original: O_PLAIN, proposition: P_PLAIN }), unchangedBlock(`${MD}\n- Couple : 25 Nm.`)]) {
      const r = run(output(b));
      assert.equal(r.resultat, "rejetee");
      assert.match(errors(r), /C3 déclarée remplie, contredite.*\d position\(s\) RE-T1 avec une espace ordinaire/);
    }
  });

  test("original en texte brut d'un brouillon affiché en Markdown", () => {
    const plain = MD.replace(/^## /, "").replace(/^- /gm, "").replace(/\*\*/g, "");
    const r = run(output(unchangedBlock(plain), `Brouillon :\n\n${MD}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /original inexact.*au balisage Markdown près/);
  });

  test("original privé des espaces de fin de ligne d'un brouillon à sauts forcés, même en partielle", () => {
    const amputated = MD_BR.replace(/ {2}\n/g, "\n");
    for (const etat of ["appliquée", "partielle"]) {
      const r = run(output(unchangedBlock(amputated, etat), `Brouillon :\n\n${MD_BR}\n\nRelecture ${etat}.`));
      assert.equal(r.resultat, "rejetee", errors(r));
      assert.match(errors(r), /original inexact.*l'original du bloc aux espaces de fin de ligne près seulement/);
    }
  });

  test("proposition affichée à sauts forcés que le bloc n'a pas, ou l'inverse, même en partielle", () => {
    // Script affiché avec ses sauts forcés, original et proposition du bloc sans leurs espaces de fin de ligne.
    const flat = MD_BR.replace(/ {2}\n/g, "\n");
    const ch = [{ avant: "chaud : l'huile", apres: `chaud${NB}: l'huile`, regle: "RE-T1", raison: "espace insécable avant les deux-points" }];
    for (const etat of ["appliquée", "partielle"]) {
      for (const [proposition, shown] of [[flat, MD_BR], [MD_BR, flat]]) {
        const b = block({ original: proposition.replace(NB, " "), proposition, changements: ch, etat });
        const r = run(output(b, `Proposition :\n\n${shown}\n\nRelecture ${etat}.`));
        assert.equal(r.resultat, "rejetee", errors(r));
        assert.match(errors(r), /original inexact.*la proposition du bloc aux espaces de fin de ligne près seulement/);
      }
    }
  });

  test("contrôle passé sur le seul bloc final, original désigné par un fichier de provenance", () => {
    const b = block();
    b.relectures[0].original.provenance = { chemin: nestedFiche(b, "fiche-bloc-seul.md"), lignes: "5", champ: FIELD };
    assert.equal(run(output(b)).resultat, "appliquee", errors(run(output(b))));
    const r = run(`\`\`\`json\n${JSON.stringify(b, null, 2)}\n\`\`\`\n`);
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /entrée incomplète — l'entrée ne contient que le bloc final/);
  });

  test("original en texte brut dont chaque ligne est courte ou affichée telle quelle", () => {
    const md = "### Plan\n\n1. Expliquer le rôle du filtre dans le circuit.\n\n**Scène 1 — Ouverture**\n\nLe filtre retient les impuretés du circuit de lubrification.";
    const plain = "Plan\n1. Expliquer le rôle du filtre dans le circuit.\n\nScène 1 — Ouverture\nLe filtre retient les impuretés du circuit de lubrification.";
    const r = run(output(unchangedBlock(plain), `Brouillon :\n\n${md}\n\nRelecture appliquée.`));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /original inexact.*l'original du bloc au balisage Markdown près seulement/);
  });

  test("contrôle passé sur le seul bloc final, original reproduit d'un brouillon de la session", () => {
    const b = block();
    b.relectures[0].original.provenance = { champ: "brouillon rédigé dans cette réponse" };
    const r = run(`\`\`\`json\n${JSON.stringify(b, null, 2)}\n\`\`\`\n`);
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /entrée incomplète.*l'entrée ne contient que le bloc final/);
  });

  test("champ de frontmatter reproduit sans son chemin de clés, ou sous un autre chemin, même en partielle", () => {
    const b = block();
    b.relectures[0].original.provenance = { chemin: nestedFiche(b, "fiche-sans-champ.md"), lignes: "5" };
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /C2 déclarée remplie, contredite.*champ structuré sans provenance\.champ/);

    const p = block({ etat: "partielle" });
    p.relectures[0].original.provenance = { chemin: nestedFiche(p, "fiche-champ-faux.md"), lignes: "5", champ: "entity_data.editorial.content_md" };
    p.conditions.C2 = { etat: "non_remplie", manque: "empreinte non vérifiée" };
    const rp = run(output(p));
    assert.equal(rp.resultat, "rejetee");
    assert.match(errors(rp), /référence inexacte.*aucun champ de ce chemin aux lignes/);
  });

  test("champ de frontmatter seulement désigné, même hors périmètre", () => {
    const b = blockedBlock();
    const fiche = nestedFiche(b, "fiche-designee.md");
    const line = readFileSync(fiche, "utf8").split("\n")[4];
    b.relectures[0].original = { chemin: fiche, lignes: "5", sha256: sha(`${line}\n`) };
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /référence inexacte.*champ structuré seulement désigné/);
  });

  test("original désigné sur des lignes qu'aucune lecture déclarée n'a rendues", () => {
    const brouillon = join(dir, "brouillon.md");
    writeFileSync(brouillon, `${O}\n`);
    const b = block();
    b.relectures[0].original = { chemin: brouillon, lignes: "1", sha256: sha(`${O}\n`) };
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /C2 déclarée remplie, contredite.*plage non rendue par une lecture déclarée \(aucune lecture déclarée\)/);
  });

  test("provenance qui ne contient pas le texte reproduit, en partielle", () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.provenance = { chemin: source, lignes: "1-4", champ: "corps" };
    b.conditions.C2 = { etat: "non_remplie", manque: "empreinte non vérifiée" };
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /référence inexacte.*texte non retrouvé/);
  });

  test("titre rendu absent de sections, même en partielle", () => {
    const b = sectionsFiche(block({ etat: "partielle" }), ["Filtre à huile (partielle)", "Rôle", "Symptômes & diagnostic (titre seul)"]);
    b.conditions.C4 = { etat: "non_remplie", manque: "signalements non relus" };
    const r = run(output(b, "Relecture partielle : C4 non remplie."));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /lecture inexacte.*titre rendu non déclaré « Formes » \(l\. 8\)/);
  });

  test("sections « toutes » sur une lecture incomplète", () => {
    const r = run(output(sectionsFiche(block(), ["toutes"])));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /lecture inexacte.*« toutes » sur une lecture incomplète, lignes non rendues 14-16/);
  });

  test("titre trouvé par une recherche ou dans un bloc de code, sans ligne rendue", () => {
    const r = run(output(sectionsFiche(block(), [...SECTIONS_1_13, "Marques & qualité", "pas un titre"])));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /section « Marques & qualité » sans titre rendu/);
    assert.match(errors(r), /section « pas un titre » sans titre rendu/);
  });

  test("section atteinte par son seul titre déclarée entière", () => {
    const r = run(output(sectionsFiche(block(), SECTIONS_1_13.map((s) => s.replace(" (titre seul)", "")))));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /« Symptômes & diagnostic » \(l\. 13-14\) déclarée entière, rendue « titre seul »/);
  });

  test("sections hors de l'ordre du fichier", () => {
    const r = run(output(sectionsFiche(block(), ["Rôle", ...SECTIONS_1_13.filter((s) => s !== "Rôle")])));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /sections hors de l'ordre du fichier/);
  });
});

describe("ligne de commande", () => {
  const cli = (args, input) => spawnSync(process.execPath, [SCRIPT, ...args], { input, encoding: "utf8" });

  test("--emit livre les octets contrôlés, Unicode JSON échappé compris", () => {
    const input = output(block()).replace(/\u00a0/g, "\\u00a0");
    const res = cli(["--emit", "--root", REPO, "--root", dir], input);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout, input);
    assert.match(res.stderr, /APPLIQUEE/);
    assert.equal(run(res.stdout).resultat, "appliquee");
  });

  test("--emit conserve une partielle honnête et son code 3", () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.sha256 = null;
    b.conditions.C2 = { etat: "non_remplie", manque: "outil d'empreinte indisponible" };
    const input = output(b);
    const res = cli(["--emit", "--root", REPO, "--root", dir], input);
    assert.equal(res.status, 3);
    assert.equal(res.stdout, input);
    assert.match(res.stderr, /PARTIELLE/);
  });

  test("--emit ne tronque pas une réponse dépassant la capacité du pipe", () => {
    const input = output(block(), "Dossier de test sans affirmation technique.\n".repeat(7000));
    const res = cli(["--emit", "--root", REPO, "--root", dir], input);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.stdout.length, input.length);
    assert.equal(res.stdout, input);
  });

  test("un RE-T1 doublement échappé est rejeté, pas assimilé à une insécable", () => {
    const b = block({ original: O_PLAIN, proposition: O_PLAIN.replace(/ /g, "\\u00a0"),
      changements: [{ avant: O_PLAIN, apres: O_PLAIN.replace(/ /g, "\\u00a0"), regle: "RE-T1", raison: "espaces insécables" }] });
    const r = run(output(b));
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /RE-T1 change autre chose que la typographie/);
  });

  test("--emit ne livre rien après un rejet, y compris un contrôle sur le bloc seul", () => {
    for (const input of ["Relecture appliquée.", `\`\`\`json\n${JSON.stringify(block())}\n\`\`\`\n`]) {
      const res = cli(["--emit", "--root", REPO, "--root", dir], input);
      assert.equal(res.status, 1, res.stderr);
      assert.equal(res.stdout, "");
      assert.match(res.stderr, /REJETEE/);
    }
  });

  test("chaque rapport lie l'entrée par sa taille et son empreinte, avec ou sans --emit, rejet compris", () => {
    const roots = ["--root", REPO, "--root", dir];
    const line = (s) => `entrée : ${Buffer.byteLength(s, "utf8")} o, sha256 ${sha(s)}`;
    const input = output(block());
    assert.equal(cli(roots, input).stdout.split("\n")[1], line(input));
    assert.equal(cli(["--emit", ...roots], input).stderr.split("\n")[1], line(input));
    const rejected = cli(["--emit", ...roots], "Relecture appliquée.");
    assert.equal(rejected.status, 1);
    assert.equal(rejected.stderr.split("\n")[1], line("Relecture appliquée."));
    assert.deepEqual(JSON.parse(cli(["--json", ...roots], input).stdout).entree, { octets: Buffer.byteLength(input, "utf8"), sha256: sha(input) });
  });

  test("sans --emit, le rapport seul ne réémet pas une réponse longue et en garde l'empreinte", () => {
    const input = output(block(), "Dossier de test sans affirmation technique.\n".repeat(7000));
    const res = cli(["--root", REPO, "--root", dir], input);
    assert.equal(res.status, 0, res.stderr);
    assert.ok(res.stdout.length < 2000, `${res.stdout.length} caractères`);
    assert.ok(!res.stdout.includes("Dossier de test"));
    assert.match(res.stdout, new RegExp(`^editorial-review \\S+ — APPLIQUEE\\nentrée : ${Buffer.byteLength(input, "utf8")} o, sha256 ${sha(input)}\\n`));
  });

  test("--emit et --json ne se combinent pas silencieusement", () => {
    const res = cli(["--emit", "--json"], output(block()));
    assert.equal(res.status, 2);
    assert.equal(res.stdout, "");
  });

  test("codes de sortie 0, 3, 1 et 2", () => {
    const roots = ["--root", REPO, "--root", dir];
    assert.equal(cli(roots, output(block())).status, 0);
    const partial = block({ etat: "partielle" });
    partial.relectures[0].original.sha256 = null;
    partial.conditions.C2 = { etat: "non_remplie", manque: "pas d'outil d'empreinte" };
    assert.equal(cli(roots, output(partial)).status, 3);
    assert.equal(cli(roots, "Relecture appliquée.").status, 1);
    assert.equal(cli(["--inconnu"], "").status, 2);
  });

  test("lancé par un lien symbolique, le contrôle s'exécute quand même", () => {
    const link = join(dir, "lien vers le contrôle.mjs");
    symlinkSync(SCRIPT, link);
    const res = spawnSync(process.execPath, [link], { input: "Relecture appliquée.", encoding: "utf8" });
    assert.equal(res.status, 1);
    assert.match(res.stdout, /REJETEE/);
  });

  test("--json rend le rapport complet", () => {
    const res = cli(["--json", "--root", REPO, "--root", dir], output(block()));
    const report = JSON.parse(res.stdout);
    assert.equal(report.resultat, "appliquee");
    assert.equal(report.conditions.C2.calculee, "remplie");
    assert.ok(report.a_verifier.some((s) => s.includes("à vérifier sur le contenu")));
  });
});

// =============================================================================
// Mode strict (contrôle de la livraison) et garde de sortie, recette R26.
// =============================================================================
const runStrict = (text) => checkOutput(text, { roots: [REPO, dir], strict: true });
const spawnNode = (script, args, input) => spawnSync(process.execPath, [script, ...args], { input, encoding: "utf8" });
const SHOWN = `Brouillon :\n\n${O}\n\nProposition :\n\n${P}`;
const STRICT_LINE = "mode strict : plages arrêtées à la dernière ligne réelle, proposition affichée octet pour octet";

describe("mode strict : bornes de lecture", () => {
  test("plage arrêtée à la dernière ligne (N) : appliquee dans les deux modes", () => {
    const text = output(block(), SHOWN);
    assert.equal(run(text).resultat, "appliquee", errors(run(text)));
    const r = runStrict(text);
    assert.equal(r.resultat, "appliquee", errors(r));
    assert.equal(r.mode, "strict");
  });

  test("ligne vide numérotée N+1 (contrat 1-87 sur 86, marketing-voice 1-224 sur 223) : admise par défaut, rejetée en mode strict", () => {
    for (const [i, n] of [[0, CONTRACT.nLines], [1, lineCount(join(REPO, VOICE))]]) {
      const b = block();
      b.lectures[i].plages = [`1-${n + 1}`];
      const text = output(b, SHOWN);
      assert.equal(run(text).resultat, "appliquee", errors(run(text)));
      const r = runStrict(text);
      assert.equal(r.resultat, "rejetee");
      assert.match(errors(r), new RegExp(`plage 1-${n + 1} au-delà de la dernière ligne \\(${n} lignes\\)`));
    }
  });

  test("N+2, et N+1 d'un fichier sans saut final : rejetées dans les deux modes", () => {
    const b = block();
    b.lectures[0].plages = [`1-${CONTRACT.nLines + 2}`];
    for (const r of [run(output(b, SHOWN)), runStrict(output(b, SHOWN))]) {
      assert.equal(r.resultat, "rejetee");
      assert.match(errors(r), /hors du fichier/);
    }
    const sans = join(dir, "sans-saut-final.md");
    writeFileSync(sans, "Première ligne.\nDeuxième ligne.");
    const c = block();
    c.lectures.push({ chemin: sans, plages: ["1-3"], masquees: [], sections: ["toutes"], tronque: false });
    for (const r of [run(output(c, SHOWN)), runStrict(output(c, SHOWN))]) {
      assert.equal(r.resultat, "rejetee");
      assert.match(errors(r), /plage 1-3 hors du fichier \(2 lignes\)/);
    }
  });

  test("plage de provenance à N+1 : admise par défaut, rejetée en mode strict", () => {
    const fiche = join(dir, "fiche-provenance-n1.md");
    writeFileSync(fiche, `---\nchamp:\n  content_md: '${O.replace(/'/g, "''").replace(" selon le moteur", "\n    selon le moteur")}'\n---\n`);
    const b = block();
    b.lectures.push({ chemin: fiche, plages: ["1-5"], masquees: [], sections: ["toutes"], tronque: false });
    b.relectures[0].original.provenance = { chemin: fiche, lignes: "2-6", champ: "champ.content_md" };
    const text = output(b, SHOWN);
    assert.equal(run(text).resultat, "appliquee", errors(run(text)));
    const r = runStrict(text);
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /original\.provenance : plage 2-6 au-delà de la dernière ligne \(5 lignes\)/);
  });

  test("--strict en ligne de commande : ligne de mode, N+1 en code 1 ; sans l'option, code 0", () => {
    const b = block();
    b.lectures[0].plages = [`1-${CONTRACT.nLines + 1}`];
    const roots = ["--root", REPO, "--root", dir];
    const strict = spawnNode(SCRIPT, ["--strict", ...roots], output(b, SHOWN));
    assert.equal(strict.status, 1, strict.stdout);
    assert.equal(strict.stdout.split("\n")[2], STRICT_LINE);
    assert.equal(spawnNode(SCRIPT, roots, output(b, SHOWN)).status, 0);
    assert.equal(spawnNode(SCRIPT, ["--strict", ...roots], output(block(), SHOWN)).status, 0);
  });
});

describe("proposition affichée telle que JSON.parse la décode", () => {
  test("proposition affichée octet pour octet : appliquee dans les deux modes", () => {
    for (const r of [run(output(block(), SHOWN)), runStrict(output(block(), SHOWN))]) assert.equal(r.resultat, "appliquee", errors(r));
  });

  test("proposition absente de la prose, ou texte différent : non relevé par défaut (compatibilité), rejeté en mode strict", () => {
    for (const prose of ["Relecture : voir le bloc final.", "Proposition :\n\nLe filtre à huile retient tout ce qui circule."]) {
      const text = output(block(), prose);
      assert.equal(run(text).resultat, "appliquee", errors(run(text)));
      const r = runStrict(text);
      assert.equal(r.resultat, "rejetee");
      assert.match(errors(r), /proposition non affichée telle quelle — relecture r1 : la réponse n'affiche pas la proposition du bloc : en mode strict/);
    }
  });

  test("original affiché, proposition absente : rejeté en mode strict, l'original nommé", () => {
    const text = output(block(), `Brouillon :\n\n${O}`);
    assert.equal(run(text).resultat, "appliquee", errors(run(text)));
    const r = runStrict(text);
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /elle affiche l'original, pas la proposition/);
  });

  test("proposition affichée en espaces ordinaires où le bloc a des insécables, original exact (R26 Claude wiki) : rejetée en appliquée comme en partielle, dans les deux modes", () => {
    const o = O.replace(`${NB}:`, " :");
    const prose = `Brouillon :\n\n${o}\n\nProposition :\n\n${O_PLAIN}`;
    for (const etat of ["appliquée", "partielle"]) {
      const b = block({ original: o, proposition: O, etat, changements: [{ avant: "chaud : selon", apres: `chaud${NB}: selon`, regle: "RE-T1", raison: "espace insécable avant les deux-points" }] });
      if (etat === "partielle") {
        b.relectures[0].original.sha256 = null;
        b.conditions.C2 = { etat: "non_remplie", manque: "aucun outil d'empreinte" };
      }
      for (const r of [run(output(b, prose)), runStrict(output(b, prose))]) {
        assert.equal(r.resultat, "rejetee", etat);
        assert.match(errors(r), /proposition non affichée telle quelle — .*typographie près/);
      }
    }
  });

  test("proposition affichée avec des sauts forcés, original exact : rejetée dans les deux modes", () => {
    const oMd = MD.replace("retient les impuretés", "est une pièce essentielle qui retient les impuretés");
    const b = block({ original: oMd, proposition: MD });
    const prose = `Brouillon :\n\n${oMd}\n\nProposition :\n\n${MD.replace(/\n/g, "  \n")}`;
    for (const r of [run(output(b, prose)), runStrict(output(b, prose))]) {
      assert.equal(r.resultat, "rejetee");
      assert.match(errors(r), /proposition non affichée telle quelle — .*qu'aux espaces de fin de ligne près/);
    }
  });

  test("proposition affichée aux retours à la ligne près : admise par défaut, rejetée en mode strict", () => {
    const text = output(block(), `Brouillon :\n\n${O}\n\nProposition :\n\n${P.replace("circuit. Ne", "circuit.\nNe")}`);
    assert.equal(run(text).resultat, "appliquee", errors(run(text)));
    const r = runStrict(text);
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /qu'aux blancs près/);
  });

  // QA R27 : prose vide et original désigné par un fichier de provenance. originalDisplayCheck ne
  // relève rien (provenance trouvée) ; en mode strict, l'absence de la proposition est relevée aussi.
  test("bloc seul, original désigné par un fichier de provenance : proposition absente relevée en mode strict, pas par défaut", () => {
    const b = block();
    b.relectures[0].original.provenance = { chemin: nestedFiche(b, "fiche-bloc-seul-strict.md"), lignes: "5", champ: FIELD };
    const shown = runStrict(output(b, SHOWN));
    assert.equal(shown.resultat, "appliquee", errors(shown));
    const only = `\`\`\`json\n${JSON.stringify(b, null, 2)}\n\`\`\`\n`;
    const r = runStrict(only);
    assert.equal(r.resultat, "rejetee");
    assert.match(errors(r), /entrée incomplète — l'entrée ne contient que le bloc final/);
    assert.match(errors(r), /proposition non affichée telle quelle — relecture r1 : la réponse n'affiche pas la proposition du bloc : en mode strict/);
    const d = run(only);
    assert.equal(d.resultat, "rejetee");
    assert.doesNotMatch(errors(d), /proposition non affichée/);
  });
});

// Flux natif `codex exec --json` des tests : chaque commande a un item.started puis un
// item.completed, avec la sortie réelle du contrôle (stderr puis stdout, comme aggregated_output).
const checks = new Map();
const checker = (args, text) => {
  const k = JSON.stringify([args, text]);
  if (!checks.has(k)) checks.set(k, spawnNode(SCRIPT, [...args, "--root", REPO, "--root", dir], text));
  return checks.get(k);
};
// Forme du saut final observée en R27 : réponse passée au contrôle par un here-document.
const heredoc = (text, args) => `/bin/bash -lc "python3 -c 'import sys; sys.stdout.write(sys.stdin.read().removesuffix(\\"\\\\n\\"))' <<'RESPONSE' | node scripts/agents/check-editorial-review.mjs ${args} --root ${REPO}\n${text}\nRESPONSE"`;
const cmdEvent = (type, id, command, res = null) =>
  JSON.stringify({ type, item: { id, type: "command_execution", command, aggregated_output: res ? `${res.stderr}${res.stdout}` : "", exit_code: res ? res.status : null, status: res ? (res.status === 0 ? "completed" : "failed") : "in_progress" } });
const cmd = (id, command, res) => [cmdEvent("item.started", id, command), cmdEvent("item.completed", id, command, res)];
const emitted = (id, text) => cmd(id, heredoc(text, "--emit"), checker(["--emit"], text));
const passage = (id, text) => cmd(id, heredoc(text, ""), checker([], text));
const helpCmd = (id) => cmd(id, "/bin/bash -lc 'node scripts/agents/check-editorial-review.mjs --help'", checker(["--help"], ""));
const agentMessage = (id, text) => JSON.stringify({ type: "item.completed", item: { id, type: "agent_message", text } });

describe("garde de sortie : hook Stop, Claude Code et Codex", () => {
  const GATE = fileURLToPath(new URL("./editorial-review-stop-gate.mjs", import.meta.url));
  // Recette R26, Codex racine : le contrôle accepte une réponse, puis la réponse finale ajoute deux
  // espaces en fin de trois titres de scène (+6 octets).
  const SCENES = [
    "**Scène 1 — Ouverture**",
    "Le filtre retient les impuretés du circuit de lubrification.",
    "",
    "**Scène 2 — Précaution**",
    `Ne le remplacez pas moteur chaud${NB}: l'huile peut être brûlante.`,
    "",
    "**Scène 3 — Rappel**",
    "Un filtre colmaté ne prévient pas toujours.",
  ].join("\n");
  const ACCEPTED = output(unchangedBlock(SCENES), `Brouillon relu, inchangé :\n\n${SCENES}`);
  const DELIVERED = ACCEPTED.replace(/(\*\*Scène \d — [^*\n]+\*\*)\n/g, "$1  \n");
  // Entrées Stop des deux CLI : la garde lit hook_event_name, last_assistant_message,
  // stop_hook_active, session_id et transcript_path ; les autres champs sont ignorés.
  const STOP = {
    claude: (msg, extra = {}) => ({ session_id: "0b6f2c1e-7c1d-4a43-9d55-2f1f6f0a9e01", transcript_path: "/dev/null", cwd: REPO, permission_mode: "default", hook_event_name: "Stop", stop_hook_active: false, last_assistant_message: msg, ...extra }),
    codex: (msg, extra = {}) => ({ session_id: "codex-r27-essai", turn_id: "tour-1", transcript_path: null, cwd: REPO, hook_event_name: "Stop", model: "modèle", stop_hook_active: false, last_assistant_message: msg, ...extra }),
  };
  let finals = 0;
  const newTraces = () => join(mkdtempSync(join(dir, "garde-")), "gate");
  const roots = ["--root", REPO, "--root", dir];
  const hook = (traces, payload) => spawnNode(GATE, ["--traces", traces, ...roots], typeof payload === "string" ? payload : JSON.stringify(payload));
  const verifier = (traces, text, extra = []) => {
    const f = join(dirname(traces), `finale-${(finals += 1)}.txt`);
    writeFileSync(f, text);
    return spawnNode(GATE, ["--traces", traces, ...roots, ...extra, "--verifier", f]);
  };
  const json = (res) => {
    assert.equal(res.status, 0, res.stderr);
    const v = JSON.parse(res.stdout);
    assert.ok(v && typeof v === "object" && !Array.isArray(v));
    return v;
  };
  const trace = (traces, k) => JSON.parse(readFileSync(join(traces, `livraison-${k}.json`), "utf8"));

  test("fixture R26 : +6 octets, réponse acceptée appliquee, réponse recomposée rejetée", () => {
    assert.equal(Buffer.byteLength(DELIVERED, "utf8") - Buffer.byteLength(ACCEPTED, "utf8"), 6);
    for (const r of [run(ACCEPTED), runStrict(ACCEPTED)]) assert.equal(r.resultat, "appliquee", errors(r));
    for (const r of [run(DELIVERED), runStrict(DELIVERED)]) assert.equal(r.resultat, "rejetee");
  });

  for (const shape of ["claude", "codex"]) {
    test(`${shape} : réponse recomposée bloquée (JSON block) et tracée, réponse contrôlée livrée (JSON continue), vérifiée après la fin`, () => {
      const traces = newTraces();
      const first = json(hook(traces, STOP[shape](DELIVERED)));
      assert.equal(first.decision, "block");
      assert.match(first.reason, /contrôle REJETEE en mode strict ; reprise 1 sur 2/);
      assert.ok(first.reason.includes(sha(DELIVERED)));
      assert.match(first.reason, /aux espaces de fin de ligne près/);
      assert.ok(readFileSync(join(traces, "livraison-1.txt")).equals(Buffer.from(DELIVERED, "utf8")));
      assert.deepEqual(trace(traces, 1).entree, { octets: Buffer.byteLength(DELIVERED, "utf8"), sha256: sha(DELIVERED) });
      assert.equal(trace(traces, 1).decision, "reprise");
      assert.deepEqual(json(hook(traces, STOP[shape](ACCEPTED, { stop_hook_active: true }))), { continue: true });
      assert.equal(trace(traces, 2).decision, "livree");
      const ok = verifier(traces, ACCEPTED);
      assert.equal(ok.status, 0, ok.stdout);
      assert.equal(JSON.parse(ok.stdout).verdict, "appliquee");
      const ko = verifier(traces, DELIVERED);
      assert.equal(ko.status, 1);
      assert.match(JSON.parse(ko.stdout).erreurs.join("\n"), /octets différents, comparés sans normalisation/);
    });
  }

  test("contrôle final sans normalisation : saut final ajouté, CRLF ou insécables en espaces rejetés ; réponse exacte acceptée", () => {
    const traces = newTraces();
    assert.deepEqual(json(hook(traces, STOP.claude(ACCEPTED))), { continue: true });
    for (const altered of [`${ACCEPTED}\n`, ACCEPTED.replace(/\n/g, "\r\n"), ACCEPTED.replace(/ /g, " ")]) {
      const res = verifier(traces, altered);
      assert.equal(res.status, 1, res.stdout);
      assert.match(JSON.parse(res.stdout).erreurs.join("\n"), /octets différents/);
    }
    assert.equal(verifier(traces, ACCEPTED).status, 0);
  });

  test("aucune trace : hook non exécuté, vérification en échec même sur une réponse conforme", () => {
    const res = verifier(newTraces(), ACCEPTED);
    assert.equal(res.status, 1);
    assert.match(JSON.parse(res.stdout).erreurs.join("\n"), /aucune trace de la garde/);
  });

  test("borne : le troisième refus laisse finir (JSON continue), réponse non livrée", () => {
    const traces = newTraces();
    for (const k of [1, 2]) assert.equal(json(hook(traces, STOP.codex(DELIVERED, { stop_hook_active: k > 1 }))).decision, "block");
    const third = hook(traces, STOP.codex(DELIVERED, { stop_hook_active: true }));
    assert.deepEqual(json(third), { continue: true });
    assert.match(third.stderr, /borne de 2 reprises atteinte/);
    assert.equal(trace(traces, 3).decision, "borne_atteinte");
    const res = verifier(traces, DELIVERED);
    assert.equal(res.status, 1);
    assert.match(JSON.parse(res.stdout).erreurs.join("\n"), /dernière décision de la garde « borne_atteinte »/);
  });

  test("entrée non contrôlable : code 1 (jamais 2), stdout vide, trace non_controlee, vérification en échec", () => {
    for (const payload of ["pas du JSON", STOP.claude(ACCEPTED, { last_assistant_message: null }), STOP.codex(ACCEPTED, { hook_event_name: "SubagentStop" })]) {
      const traces = newTraces();
      const res = hook(traces, payload);
      assert.equal(res.status, 1);
      assert.equal(res.stdout, "");
      assert.match(res.stderr, /non contrôlée, arrêt laissé/);
      assert.equal(trace(traces, 1).decision, "non_controlee");
      assert.equal(verifier(traces, ACCEPTED).status, 1);
    }
  });

  test("traces de deux sessions dans un dossier, ou usage incomplet : rejet, jamais le code 2", () => {
    const traces = newTraces();
    json(hook(traces, STOP.claude(ACCEPTED)));
    json(hook(traces, STOP.codex(ACCEPTED)));
    const res = verifier(traces, ACCEPTED);
    assert.equal(res.status, 1);
    assert.match(JSON.parse(res.stdout).erreurs.join("\n"), /traces de 2 sessions/);
    assert.equal(spawnNode(GATE, [], "").status, 1);
    assert.equal(spawnNode(GATE, ["--traces", traces], "").status, 1);
  });

  // QA R27 : une partielle livrée par la garde sort en 3 à la vérification, pas en 0 ni en 1.
  const partial = () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.sha256 = null;
    b.conditions.C2 = { etat: "non_remplie", manque: "aucun outil d'exécution pour calculer le sha256" };
    return output(b, `${SHOWN}\n\nRelecture partielle, C2 non remplie.`);
  };

  test("partielle : garde livree (JSON continue), puis vérification en code 3, verdict partielle", () => {
    const text = partial();
    assert.equal(runStrict(text).resultat, "partielle", errors(runStrict(text)));
    const traces = newTraces();
    assert.deepEqual(json(hook(traces, STOP.claude(text))), { continue: true });
    assert.equal(trace(traces, 1).decision, "livree");
    assert.equal(trace(traces, 1).resultat, "partielle");
    const res = verifier(traces, text);
    assert.equal(res.status, 3, res.stdout);
    assert.equal(JSON.parse(res.stdout).verdict, "partielle");
    assert.deepEqual(JSON.parse(res.stdout).erreurs, []);
  });

  // Étape 6 dans le flux natif de Codex, copié par le lanceur : un ordre, relevé sur les événements.
  let journals = 0;
  const journalOf = (traces, parts, text = ACCEPTED) => {
    const f = join(dirname(traces), `codex-exec-${(journals += 1)}.jsonl`);
    writeFileSync(f, `${[JSON.stringify({ type: "thread.started", thread_id: "essai" }), ...parts.flat(), agentMessage("item_fin", text)].join("\n")}\n`);
    return f;
  };
  const hookJ = (traces, journal, payload) => spawnNode(GATE, ["--traces", traces, ...roots, "--journal", journal], JSON.stringify(payload));
  const V = CONTRACT.version.replace(/\./g, "\\.");
  const SHA = "\\(\\d+ o, sha256 [0-9a-f]{64}\\)";
  const firstRefusal = (parts, text = ACCEPTED) => {
    const traces = newTraces();
    const r = json(hookJ(traces, journalOf(traces, parts, text), STOP.codex(text)));
    assert.equal(r.decision, "block");
    assert.equal(trace(traces, 1).decision, "reprise");
    return r.reason;
  };

  test("journal de Codex R27 (--help, puis un --emit accepté, aucun passage après) : reprises bornées, borne_atteinte, vérification en échec", () => {
    const traces = newTraces();
    const j = journalOf(traces, [helpCmd("item_43"), emitted("item_45", ACCEPTED)]);
    const first = json(hookJ(traces, j, STOP.codex(ACCEPTED)));
    assert.equal(first.decision, "block");
    assert.match(first.reason, /contrôle APPLIQUEE en mode strict, passages de livraison manquants ; reprise 1 sur 2/);
    assert.match(first.reason, new RegExp(`étape 6 : 0 commande\\(s\\) du contrôle sans --emit terminée\\(s\\) en code 0 ou 3 après l'acceptation de cette réponse ${SHA} par item_45`));
    assert.match(first.reason, /item_43 \(aide ou usage, code 2, lignes 2–3, aucun rapport lié à cette réponse\)/);
    assert.match(first.reason, new RegExp(`item_45 \\(--emit, code 0, lignes 4–5, rapport lié ${V} APPLIQUEE\\)`));
    assert.match(first.reason, /Suivre pour cette même réponse l'étape 6 du contrat : entrée acceptée par --emit, puis deux passages sans --emit, par deux commandes séparées lancées l'une après l'autre/);
    assert.doesNotMatch(first.reason, /Erreurs du contrôle/);
    const t = trace(traces, 1);
    assert.equal(t.decision, "reprise");
    assert.equal(t.resultat, "appliquee");
    assert.deepEqual(t.commandes.map((c) => [c.commande, c.emit, c.aide, c.accepte, c.recu]), [["item_43", false, true, false, false], ["item_45", true, false, true, false]]);
    assert.equal(json(hookJ(traces, j, STOP.codex(ACCEPTED, { stop_hook_active: true }))).decision, "block");
    const third = hookJ(traces, j, STOP.codex(ACCEPTED, { stop_hook_active: true }));
    assert.deepEqual(json(third), { continue: true });
    assert.match(third.stderr, /passages de livraison manquants ; borne de 2 reprises atteinte/);
    const res = verifier(traces, ACCEPTED, ["--journal", j]);
    assert.equal(res.status, 1);
    const erreurs = JSON.parse(res.stdout).erreurs.join("\n");
    assert.match(erreurs, /dernière décision de la garde « borne_atteinte »/);
    assert.match(erreurs, /étape 6 : 0 commande\(s\)/);
  });

  test("acceptation, puis deux passages l'un après l'autre : livree et vérification 0 ; un seul passage après l'acceptation : refus", () => {
    const traces = newTraces();
    const one = journalOf(traces, [emitted("item_1", ACCEPTED), passage("item_2", ACCEPTED)]);
    const first = json(hookJ(traces, one, STOP.codex(ACCEPTED)));
    assert.equal(first.decision, "block");
    assert.match(first.reason, /étape 6 : 1 commande\(s\) du contrôle sans --emit terminée\(s\) en code 0 ou 3 après l'acceptation .* par item_1/);
    const two = journalOf(traces, [emitted("item_1", ACCEPTED), passage("item_2", ACCEPTED), passage("item_3", ACCEPTED)]);
    assert.deepEqual(json(hookJ(traces, two, STOP.codex(ACCEPTED, { stop_hook_active: true }))), { continue: true });
    const t = trace(traces, 2);
    assert.equal(t.decision, "livree");
    assert.deepEqual(t.erreurs_passages, []);
    assert.deepEqual(t.commandes.map((c) => [c.commande, c.debut, c.fin, c.accepte, c.recu]), [["item_1", 2, 3, true, false], ["item_2", 4, 5, false, true], ["item_3", 6, 7, false, true]]);
    const ok = verifier(traces, ACCEPTED, ["--journal", two]);
    assert.equal(ok.status, 0, ok.stdout);
    assert.equal(JSON.parse(ok.stdout).verdict, "appliquee");
    // Même dossier de traces, flux sans le second passage : la vérification hors de l'agent recompte.
    const ko = verifier(traces, ACCEPTED, ["--journal", one]);
    assert.equal(ko.status, 1);
    assert.match(JSON.parse(ko.stdout).erreurs.join("\n"), /étape 6 : 1 commande\(s\)/);
  });

  test("l'étape 6 est un ordre : deux passages avant l'acceptation, ou un avant et un après, ne suffisent pas", () => {
    const before = firstRefusal([passage("item_1", ACCEPTED), passage("item_2", ACCEPTED), emitted("item_3", ACCEPTED)]);
    assert.match(before, /étape 6 : 0 commande\(s\) du contrôle sans --emit terminée\(s\) en code 0 ou 3 après l'acceptation .* par item_3/);
    const around = firstRefusal([passage("item_1", ACCEPTED), emitted("item_2", ACCEPTED), passage("item_3", ACCEPTED)]);
    assert.match(around, /étape 6 : 1 commande\(s\) du contrôle sans --emit terminée\(s\) en code 0 ou 3 après l'acceptation .* par item_2/);
  });

  test("deux passages lancés en parallèle après l'acceptation : refus, « l'une après l'autre » non prouvé", () => {
    const c = heredoc(ACCEPTED, "");
    const res = checker([], ACCEPTED);
    const reason = firstRefusal([emitted("item_1", ACCEPTED), cmdEvent("item.started", "item_2", c), cmdEvent("item.started", "item_3", c), cmdEvent("item.completed", "item_2", c, res), cmdEvent("item.completed", "item_3", c, res)]);
    assert.match(reason, /étape 6 : item_3 démarre avant la fin d'une commande précédente du contrôle : lancées en parallèle, « l'une après l'autre » non prouvé/);
  });

  test("preuve d'ordre incomplète (item.started absent, ligne illisible, identifiant absent) : refus, sans déduire l'ordre", () => {
    const c = heredoc(ACCEPTED, "");
    const res = checker([], ACCEPTED);
    const noStart = firstRefusal([emitted("item_1", ACCEPTED), cmdEvent("item.completed", "item_2", c, res), passage("item_3", ACCEPTED)]);
    assert.match(noStart, /étape 6 : commande\(s\) du contrôle sans couple item.started puis item.completed identifié : item_2 ; ordre des passages non prouvé/);
    const cut = firstRefusal([emitted("item_1", ACCEPTED), passage("item_2", ACCEPTED), passage("item_3", ACCEPTED), '{"type":"item.completed","item":{"id":"item_4"']);
    assert.match(cut, /étape 6 : flux natif incomplet, 1 ligne\(s\) illisible\(s\) : ordre des passages non prouvé/);
    const noId = firstRefusal([emitted("item_1", ACCEPTED), passage("item_2", ACCEPTED), [cmdEvent("item.started", "", c), cmdEvent("item.completed", "", c, res)]]);
    assert.match(noId, /sans couple item.started puis item.completed identifié : ligne-\d+, ligne-\d+ ; ordre/);
  });

  test("après l'acceptation, deux commandes dont une seule reçue (sortie de l'autre perdue) : livree, comme le contrat", () => {
    const traces = newTraces();
    const j = journalOf(traces, [emitted("item_1", ACCEPTED), cmd("item_2", heredoc(ACCEPTED, ""), { stdout: "", stderr: "", status: 0 }), passage("item_3", ACCEPTED)]);
    assert.deepEqual(json(hookJ(traces, j, STOP.codex(ACCEPTED))), { continue: true });
    assert.deepEqual(trace(traces, 1).commandes.map((c) => [c.commande, c.recu]), [["item_1", false], ["item_2", false], ["item_3", true]]);
    assert.equal(verifier(traces, ACCEPTED, ["--journal", j]).status, 0);
  });

  test("après l'acceptation, aucune commande reçue (vide, coupée, autre réponse, autre version, --json) : refus, plus conservateur que le contrat", () => {
    const other = ACCEPTED.replace("Un filtre colmaté", "Un filtre encrassé");
    const report = checker([], ACCEPTED);
    const [l1] = report.stdout.split("\n");
    const c = heredoc(ACCEPTED, "");
    const reason = firstRefusal([
      emitted("item_1", ACCEPTED),
      cmd("vide", c, { stdout: "", stderr: "", status: 0 }),
      cmd("coupee", c, { stdout: `${l1}\n`, stderr: "", status: 0 }),
      passage("autre", other),
      cmd("version", c, { stdout: report.stdout.replace(`editorial-review ${CONTRACT.version}`, "editorial-review 0.0.1"), stderr: "", status: 0 }),
      cmd("json", heredoc(ACCEPTED, "--json"), checker(["--json"], ACCEPTED)),
    ]);
    // « autre » (réponse rejetée, code 1) n'est pas comptée : terminée en échec.
    assert.match(reason, new RegExp(`étape 6 : aucun passage reçu pour cette réponse ${SHA} parmi vide, coupee, version, json \\(refus plus conservateur que le contrat, qui livrerait en relecture partielle\\)`));
    assert.match(reason, /autre \(sans --emit, code 1, lignes 8–9, aucun rapport lié à cette réponse\)/);
  });

  test("REJETEE pour ces octets, même après deux passages reçus : refus ; corrigé puis repassé en entier (acceptation, deux passages) : livree", () => {
    const n = Buffer.byteLength(ACCEPTED, "utf8");
    // Mêmes octets rejetés par un contrôle mal lancé (racine absente, par exemple), puis corrigé.
    const rejet = (id) => cmd(id, heredoc(ACCEPTED, "--strict"), { stdout: `editorial-review ${CONTRACT.version} — REJETEE\nentrée : ${n} o, sha256 ${sha(ACCEPTED)}\n`, stderr: "", status: 1 });
    const ok = [emitted("item_1", ACCEPTED), passage("item_2", ACCEPTED), passage("item_3", ACCEPTED)];
    const reason = firstRefusal([...ok, rejet("item_4")]);
    assert.match(reason, /étape 6 : la commande item_4 rend REJETEE pour cette réponse .* et aucune acceptation par --emit n'a démarré après elle : correction et nouveau passage complet exigés, puis les deux passages de livraison/);
    const partly = firstRefusal([...ok, rejet("item_4"), emitted("item_5", ACCEPTED), passage("item_6", ACCEPTED)]);
    assert.match(partly, /étape 6 : 1 commande\(s\) .* par item_5/);
    for (const parts of [
      [...ok, rejet("item_4"), emitted("item_5", ACCEPTED), passage("item_6", ACCEPTED), passage("item_7", ACCEPTED)],
      [rejet("item_0"), ...ok],
    ]) {
      const traces = newTraces();
      const j = journalOf(traces, parts);
      assert.deepEqual(json(hookJ(traces, j, STOP.codex(ACCEPTED))), { continue: true });
      assert.equal(verifier(traces, ACCEPTED, ["--journal", j]).status, 0);
    }
  });

  test("commande terminée en échec, même avec un rapport capturé : ni acceptation, ni passage compté, ni reçu", () => {
    const c = heredoc(ACCEPTED, "");
    const enEchec = (id, res, status) => cmd(id, c, { ...res, status });
    const report = checker([], ACCEPTED);
    // --emit puis « ; false » : rapport APPLIQUEE capturé, code 1.
    const noAcc = firstRefusal([cmd("item_1", heredoc(ACCEPTED, "--emit"), { ...checker(["--emit"], ACCEPTED), status: 1 }), passage("item_2", ACCEPTED), passage("item_3", ACCEPTED)]);
    assert.match(noAcc, /étape 6 : aucune acceptation par --emit de cette réponse .* item_1 \(--emit, code 1,/);
    const noPass = firstRefusal([emitted("item_1", ACCEPTED), enEchec("item_2", report, 1), enEchec("item_3", report, null)]);
    assert.match(noPass, /étape 6 : 0 commande\(s\) du contrôle sans --emit terminée\(s\) en code 0 ou 3 .* item_3 \(sans --emit, code null,/);
    // PARTIELLE capturée mais code 0 (contrôle passé dans un tube) : commande comptée, non reçue.
    const text = partial();
    const tube = firstRefusal([emitted("item_1", text), enEchec("item_2", checker([], text), 0), enEchec("item_3", checker([], text), 0)], text);
    assert.match(tube, /étape 6 : aucun passage reçu pour cette réponse .* parmi item_2, item_3/);
    // Une commande en échec entre deux passages n'empêche pas la livraison.
    const traces = newTraces();
    const j = journalOf(traces, [emitted("item_1", ACCEPTED), enEchec("item_2", report, 1), passage("item_3", ACCEPTED), passage("item_4", ACCEPTED)]);
    assert.deepEqual(json(hookJ(traces, j, STOP.codex(ACCEPTED))), { continue: true });
    assert.deepEqual(trace(traces, 1).commandes.map((x) => [x.commande, x.echec, x.recu]), [["item_1", false, false], ["item_2", true, false], ["item_3", false, true], ["item_4", false, true]]);
  });

  test("réponse qui cite la commande du contrôle avec --emit, dans le here-document : passages comptés sans --emit", () => {
    const text = output(unchangedBlock(SCENES), `Brouillon relu, inchangé :\n\n${SCENES}\n\nContrôle : node scripts/agents/check-editorial-review.mjs --emit --root <dossier>.`);
    assert.equal(runStrict(text).resultat, "appliquee", errors(runStrict(text)));
    const traces = newTraces();
    const j = journalOf(traces, [emitted("item_1", text), passage("item_2", text), passage("item_3", text)], text);
    assert.deepEqual(json(hookJ(traces, j, STOP.codex(text))), { continue: true });
    assert.deepEqual(trace(traces, 1).commandes.map((c) => [c.commande, c.emit, c.recu]), [["item_1", true, false], ["item_2", false, true], ["item_3", false, true]]);
  });

  test("partielle : acceptation puis deux passages PARTIELLE : livree, vérification --journal en code 3", () => {
    const text = partial();
    const traces = newTraces();
    const j = journalOf(traces, [emitted("item_1", text), passage("item_2", text), passage("item_3", text)], text);
    assert.deepEqual(json(hookJ(traces, j, STOP.codex(text))), { continue: true });
    const lie = [`${CONTRACT.version} PARTIELLE`];
    assert.deepEqual(trace(traces, 1).commandes.map((c) => c.rapports_lies), [lie, lie, lie]);
    const res = verifier(traces, text, ["--journal", j]);
    assert.equal(res.status, 3, res.stdout);
    assert.equal(JSON.parse(res.stdout).verdict, "partielle");
  });

  test("journal absent : non contrôlée (code 1, stdout vide) ; vérification --journal d'une livraison décidée sans journal : échec", () => {
    const traces = newTraces();
    const res = hookJ(traces, join(dirname(traces), "absent.jsonl"), STOP.codex(ACCEPTED));
    assert.equal(res.status, 1);
    assert.equal(res.stdout, "");
    assert.match(res.stderr, /journal natif illisible .* ENOENT/);
    assert.equal(trace(traces, 1).decision, "non_controlee");
    const sans = newTraces();
    json(hook(sans, STOP.codex(ACCEPTED)));
    const j = journalOf(sans, [emitted("item_1", ACCEPTED), passage("item_2", ACCEPTED), passage("item_3", ACCEPTED)]);
    const v = verifier(sans, ACCEPTED, ["--journal", j]);
    assert.equal(v.status, 1);
    assert.match(JSON.parse(v.stdout).erreurs.join("\n"), /livraison 1 décidée sans journal natif/);
  });

  test("--env : mêmes décisions qu'avec les options ; variables absentes ou options mêlées : code 1, stdout vide, aucune trace", () => {
    const traces = newTraces();
    const j = journalOf(traces, [emitted("item_1", ACCEPTED), passage("item_2", ACCEPTED), passage("item_3", ACCEPTED)]);
    const env = { ...process.env, EDITORIAL_REVIEW_TRACES: traces, EDITORIAL_REVIEW_ROOTS: `${REPO}:${dir}`, EDITORIAL_REVIEW_JOURNAL: j };
    const run1 = (e, args = ["--env"]) => spawnSync(process.execPath, [GATE, ...args], { input: JSON.stringify(STOP.codex(ACCEPTED)), encoding: "utf8", env: e });
    assert.deepEqual(json(run1(env)), { continue: true });
    assert.equal(trace(traces, 1).journal, j);
    assert.equal(verifier(traces, ACCEPTED, ["--journal", j]).status, 0);
    const bare = { ...process.env };
    for (const k of ["EDITORIAL_REVIEW_TRACES", "EDITORIAL_REVIEW_ROOTS", "EDITORIAL_REVIEW_JOURNAL"]) delete bare[k];
    const missing = run1(bare);
    assert.equal(missing.status, 1);
    assert.equal(missing.stdout, "");
    assert.match(missing.stderr, /--env sans EDITORIAL_REVIEW_TRACES ou EDITORIAL_REVIEW_ROOTS/);
    const mixed = run1(env, ["--env", "--traces", traces]);
    assert.equal(mixed.status, 1);
    assert.equal(mixed.stdout, "");
    assert.deepEqual(readdirSync(traces).sort(), ["livraison-1.json", "livraison-1.txt"]);
  });

  test("--extraire : réponse finale native à l'octet (dernier result, dernier agent_message) ; flux sans réponse ou illisible : code 1, stdout vide", () => {
    const base = mkdtempSync(join(dir, "extraire-"));
    const text = `${ACCEPTED}\n`;
    const write = (name, events) => {
      const f = join(base, name);
      writeFileSync(f, `${events.map((e) => JSON.stringify(e)).join("\n")}\n`);
      return f;
    };
    const claude = write("claude.jsonl", [{ type: "system", subtype: "init" }, { type: "assistant", message: { content: [{ type: "text", text: "brouillon" }] } }, { type: "result", subtype: "success", result: "première" }, { type: "result", subtype: "success", result: text }]);
    const codex = write("codex.jsonl", [{ type: "thread.started" }, { type: "item.completed", item: { id: "a", type: "agent_message", text: "premier" } }, { type: "item.completed", item: { id: "b", type: "agent_message", text } }, { type: "turn.completed" }]);
    for (const [kind, f] of [["claude", claude], ["codex", codex]]) {
      const r = spawnSync(process.execPath, [GATE, "--extraire", kind, f]);
      assert.equal(r.status, 0, String(r.stderr));
      assert.ok(r.stdout.equals(Buffer.from(text, "utf8")));
    }
    const sansResult = write("max-turns.jsonl", [{ type: "result", subtype: "error_max_turns" }]);
    const coupe = join(base, "coupe.jsonl");
    writeFileSync(coupe, `${agentMessage("b", text)}\n{"type":"item.comp`);
    const cases = [
      ["claude", sansResult, /dernier événement result sans champ result/],
      ["claude", codex, /aucun événement result/],
      ["codex", claude, /aucun agent_message terminé/],
      ["codex", coupe, /ligne 2 du flux illisible/],
      ["codex", join(base, "absent.jsonl"), /ENOENT/],
      ["gemini", codex, /usage/],
    ];
    for (const [kind, f, re] of cases) {
      const r = spawnSync(process.execPath, [GATE, "--extraire", kind, f], { encoding: "utf8" });
      assert.equal(r.status, 1, kind);
      assert.equal(r.stdout, "");
      assert.match(r.stderr, re);
    }
  });
});

// =============================================================================
// Lanceur opt-in versionné, avec une CLI factice qui exécute le hook déclaré comme le ferait la
// CLI (nouveau tour sur block, fin sur continue). Non couverts ici : la confiance Codex,
// l'héritage réel de l'environnement par le hook et le comportement réel des CLI (recette native).
// =============================================================================
const FAKE_CLI = `#!${process.execPath}
const { readFileSync, statSync, writeFileSync, writeSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const argv = process.argv.slice(2);
const cfg = JSON.parse(readFileSync(process.env.FAKE_CONFIG, "utf8"));
const codex = argv[0] === "exec";
let written = 0;
const line = (s) => { const b = Buffer.from(s + "\\n"); writeSync(1, b); written += b.length; };
const out = (o) => line(JSON.stringify(o));
const command = codex ? /command = "([^"]*)"/.exec(argv[3])[1] : JSON.parse(argv[1]).hooks.Stop[0].hooks[0].command;
// Le hook lit la copie du flux : attendre qu'elle ait rattrapé la sortie.
const caughtUp = () => {
  const j = process.env.EDITORIAL_REVIEW_JOURNAL;
  const size = () => { try { return statSync(j).size; } catch { return 0; } };
  for (let i = 0; j && i < 500 && size() < written; i += 1) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
};
out(codex ? { type: "thread.started", thread_id: "fake" } : { type: "system", subtype: "init" });
for (const l of cfg.items || []) line(l);
let last = null;
for (let turn = 0; turn < 6; turn += 1) {
  last = cfg.messages[Math.min(turn, cfg.messages.length - 1)];
  out(codex ? { type: "item.completed", item: { id: "item_msg_" + turn, type: "agent_message", text: last } } : { type: "assistant", message: { content: [{ type: "text", text: last }] } });
  if (cfg.noHook) break;
  caughtUp();
  const payload = { session_id: codex ? "fake-codex" : "fake-claude", transcript_path: null, cwd: process.cwd(), hook_event_name: "Stop", stop_hook_active: turn > 0, last_assistant_message: last };
  const h = spawnSync("/bin/sh", ["-c", command], { input: JSON.stringify(payload), encoding: "utf8" });
  const env = { traces: process.env.EDITORIAL_REVIEW_TRACES ?? null, roots: process.env.EDITORIAL_REVIEW_ROOTS ?? null, journal: process.env.EDITORIAL_REVIEW_JOURNAL ?? null };
  out({ type: "fake.hook", argv, command, env, status: h.status, stdout: h.stdout, stderr: h.stderr });
  let decision = null;
  try { decision = JSON.parse(h.stdout).decision; } catch {}
  if (decision !== "block") break;
}
if (codex && cfg.after) out({ type: "item.completed", item: { id: "item_apres", type: "agent_message", text: cfg.after } });
out(codex ? { type: "turn.completed" } : { type: "result", subtype: "success", result: cfg.result ?? last });
const o = argv.indexOf("-o");
if (codex && o !== -1) writeFileSync(argv[o + 1], cfg.o ?? cfg.after ?? last);
process.exitCode = cfg.exit ?? 0;
`;

describe("lanceur editorial-review-native.sh : extraction, vérification et code de sortie", () => {
  const LAUNCHER = fileURLToPath(new URL("./editorial-review-native.sh", import.meta.url));
  const GATE = realpathSync(fileURLToPath(new URL("./editorial-review-stop-gate.mjs", import.meta.url)));
  const SCENES = "**Scène 1 — Ouverture**\nLe filtre retient les impuretés du circuit de lubrification.";
  const accepted = output(unchangedBlock(SCENES), `Brouillon relu, inchangé :\n\n${SCENES}`);
  let base;
  let fake;
  let node;
  before(() => {
    base = mkdtempSync(join(dir, "lanceur-"));
    fake = join(base, "fake-cli.cjs");
    writeFileSync(fake, FAKE_CLI, { mode: 0o755 });
    node = spawnSync("bash", ["-c", "command -v node"], { encoding: "utf8" }).stdout.trim();
  });
  const launch = (cli, args, cfg, env = {}) => {
    const f = join(mkdtempSync(join(base, "cfg-")), "config.json");
    writeFileSync(f, JSON.stringify(cfg));
    return spawnSync("bash", [LAUNCHER, cli, ...args], { encoding: "utf8", env: { ...process.env, ...env, FAKE_CONFIG: f } });
  };
  const newRun = () => {
    const d = mkdtempSync(join(base, "run-"));
    return { traces: join(d, "gate"), o: join(d, "last.txt") };
  };
  const hooks = (stdout) => stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((e) => e.type === "fake.hook");
  const decisions = (stdout) => hooks(stdout).map((h) => JSON.parse(h.stdout).decision ?? "continue");
  const steps = (text) => [...emitted("item_1", text), ...passage("item_2", text), ...passage("item_3", text)];
  const codexArgs = (r) => ["--traces", r.traces, "--root", REPO, "--root", dir, "--bin", fake, "--", "-s", "read-only", "--ephemeral", "-o", r.o, "invite figée"];
  const claudeArgs = (r) => ["--traces", r.traces, "--root", REPO, "--root", dir, "--bin", fake, "--", "-p", "invite figée", "--output-format", "stream-json", "--verbose"];
  const report = (r) => JSON.parse(readFileSync(join(r.traces, "verification.json"), "utf8"));
  const partialText = () => {
    const b = block({ etat: "partielle" });
    b.relectures[0].original.sha256 = null;
    b.conditions.C2 = { etat: "non_remplie", manque: "aucun outil d'exécution pour calculer le sha256" };
    return output(b, `${SHOWN}\n\nRelecture partielle, C2 non remplie.`);
  };

  test("codex : flux natif inchangé sur stdout et copié, hook de session (-c), étape 6 prouvée, réponse extraite égale à -o : code 0", () => {
    const r = newRun();
    const res = launch("codex", codexArgs(r), { items: steps(accepted), messages: [accepted] });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(readFileSync(join(r.traces, "codex-exec.jsonl"), "utf8"), res.stdout);
    const [h] = hooks(res.stdout);
    const command = `'${node}' '${GATE}' --env`;
    assert.deepEqual(h.argv, ["exec", "--json", "-c", `hooks.Stop=[{ hooks = [{ type = "command", command = "${command}" }] }]`, "-s", "read-only", "--ephemeral", "-o", r.o, "invite figée"]);
    assert.deepEqual(h.env, { traces: r.traces, roots: `${REPO}:${dir}`, journal: join(r.traces, "codex-exec.jsonl") });
    assert.deepEqual(decisions(res.stdout), ["continue"]);
    assert.equal(readFileSync(join(r.traces, "reponse-finale.txt"), "utf8"), accepted);
    assert.equal(report(r).verdict, "appliquee");
    assert.match(res.stderr, /réponse finale vérifiée, code 0/);
  });

  test("codex, forme R27 (--emit accepté, aucun passage après) : refus, deux reprises, borne, lanceur code 1", () => {
    const r = newRun();
    const res = launch("codex", codexArgs(r), { items: [...helpCmd("item_43"), ...emitted("item_45", accepted)], messages: [accepted] });
    assert.equal(res.status, 1);
    assert.deepEqual(decisions(res.stdout), ["block", "block", "continue"]);
    assert.match(res.stderr, /réponse non livrée \(code 1\) : vérification : code 1/);
    const erreurs = report(r).erreurs.join("\n");
    assert.match(erreurs, /« borne_atteinte »/);
    assert.match(erreurs, /étape 6 : 0 commande\(s\)/);
  });

  test("hook absent (CLI qui ne l'exécute pas) : aucune trace, lanceur code 1, pour codex et claude", () => {
    for (const cli of ["codex", "claude"]) {
      const r = newRun();
      const res = launch(cli, cli === "codex" ? codexArgs(r) : claudeArgs(r), { items: cli === "codex" ? steps(accepted) : [], messages: [accepted], noHook: true });
      assert.equal(res.status, 1, res.stderr);
      assert.deepEqual(hooks(res.stdout), []);
      assert.match(report(r).erreurs.join("\n"), /aucune trace de la garde/);
    }
  });

  test("codex, réponse finale altérée : -o différent du flux, ou agent_message ajouté après la garde : code 1", () => {
    const r1 = newRun();
    const o = launch("codex", codexArgs(r1), { items: steps(accepted), messages: [accepted], o: `${accepted}\n` });
    assert.equal(o.status, 1);
    assert.match(o.stderr, /réponse finale altérée : .*last\.txt ≠ dernier agent_message du flux/);
    const r2 = newRun();
    const after = launch("codex", codexArgs(r2), { items: steps(accepted), messages: [accepted], after: `${accepted}  ` });
    assert.equal(after.status, 1);
    assert.match(report(r2).erreurs.join("\n"), /réponse finale native .* ≠ dernière livraison contrôlée/);
  });

  test("claude : --settings JSON de session, flux stream-json inchangé et copié, sans journal ; partielle vérifiée : code 3", () => {
    const text = partialText();
    const r = newRun();
    const res = launch("claude", claudeArgs(r), { messages: [text] }, { EDITORIAL_REVIEW_JOURNAL: "/ne/doit/pas/passer.jsonl" });
    assert.equal(res.status, 3, res.stderr);
    assert.equal(readFileSync(join(r.traces, "claude-stream.jsonl"), "utf8"), res.stdout);
    const [h] = hooks(res.stdout);
    assert.equal(h.argv[0], "--settings");
    assert.deepEqual(JSON.parse(h.argv[1]), { hooks: { Stop: [{ hooks: [{ type: "command", command: `'${node}' '${GATE}' --env` }] }] } });
    assert.deepEqual(h.argv.slice(2), ["-p", "invite figée", "--output-format", "stream-json", "--verbose"]);
    assert.deepEqual(h.env, { traces: r.traces, roots: `${REPO}:${dir}`, journal: null });
    assert.equal(readFileSync(join(r.traces, "reponse-finale.txt"), "utf8"), text);
    assert.equal(report(r).verdict, "partielle");
    assert.match(res.stderr, /réponse finale vérifiée, code 3/);
  });

  test("claude : result différent du message contrôlé, ou réponse refusée jusqu'à la borne : code 1", () => {
    const r1 = newRun();
    const alt = launch("claude", claudeArgs(r1), { messages: [accepted], result: `${accepted}\n` });
    assert.equal(alt.status, 1);
    assert.match(report(r1).erreurs.join("\n"), /≠ dernière livraison contrôlée/);
    const refused = accepted.replace(/(\*\*Scène \d — [^*\n]+\*\*)\n/g, "$1  \n");
    assert.equal(runStrict(refused).resultat, "rejetee");
    const r2 = newRun();
    const res = launch("claude", claudeArgs(r2), { messages: [refused] });
    assert.equal(res.status, 1);
    assert.deepEqual(decisions(res.stdout), ["block", "block", "continue"]);
    assert.match(report(r2).erreurs.join("\n"), /« borne_atteinte »/);
  });

  test("CLI en échec (code 7) : lanceur code 1, même si la réponse se vérifie", () => {
    const r = newRun();
    const res = launch("codex", codexArgs(r), { items: steps(accepted), messages: [accepted], exit: 7 });
    assert.equal(res.status, 1);
    assert.match(res.stderr, /réponse non livrée \(code 1\) : codex : code 7/);
    assert.equal(report(r).verdict, "appliquee");
  });

  test("refus avant lancement (code 2, CLI non lancée, aucun dossier créé)", () => {
    const existing = mkdtempSync(join(base, "existe-"));
    const quoted = join(base, 'a"b');
    const fresh = (n) => join(base, `neuf-${n}`);
    const cases = [
      ["codex", ["--traces", existing, "--root", REPO, "--bin", fake, "--", "x"]],
      ["codex", ["--traces", join(quoted, "gate"), "--root", REPO, "--bin", fake, "--", "x"]],
      ["claude", ["--traces", fresh(1), "--root", `${REPO}:${dir}`, "--bin", fake, "--", "-p", "x", "--output-format", "stream-json"]],
      ["claude", ["--traces", fresh(2), "--bin", fake, "--", "-p", "x", "--output-format", "stream-json"]],
      ["claude", ["--traces", fresh(3), "--root", REPO, "--bin", fake, "--", "-p", "x"]],
      ["claude", ["--traces", fresh(4), "--root", REPO, "--bin", fake, "--", "-p", "x", "--output-format=json"]],
      ["gemini", ["--traces", fresh(5), "--root", REPO, "--", "x"]],
    ];
    for (const [cli, args] of cases) {
      const res = launch(cli, args, { messages: ["x"] });
      assert.equal(res.status, 2, `${cli} ${args.join(" ")}\n${res.stderr}`);
      assert.equal(res.stdout, "");
      assert.match(res.stderr, /usage : editorial-review-native\.sh/);
    }
    for (const n of [1, 2, 3, 4, 5]) assert.equal(existsSync(fresh(n)), false);
    assert.equal(existsSync(join(quoted, "gate")), false);
  });
});
