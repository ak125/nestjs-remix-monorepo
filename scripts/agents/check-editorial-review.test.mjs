// =============================================================================
// Tests de check-editorial-review.mjs — fixtures synthétiques minimales.
// Chaque cas rejeté reproduit, sur un texte inventé, un défaut observé en recette
// (empreinte sur une autre représentation, liste vide sans raison, RE-16/RE-23 qui
// changent l'information, conditions non nommées, lecture tronquée comptée, espace ordinaire
// restée aux positions RE-T1, original en texte brut d'un brouillon affiché en Markdown, champ
// structuré désigné par une plage ou sans son chemin de clés, plage d'original non lue, contrôle
// passé sur le seul bloc final, sections déclarées sans les titres rendus ou avec un titre
// seulement atteint, original dont la réponse affiche les lignes sous d'autres intertitres,
// `format` hors du contrat, script Fafa sans la persona).
// Run: node --test scripts/agents/check-editorial-review.test.mjs
// =============================================================================
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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
