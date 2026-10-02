/**
 * Garde — chaque glob `files` / `ignores` d'une règle ast-grep doit désigner
 * une extension que le `language` de cette règle analyse.
 *
 * Défaut corrigé : ast-grep sélectionne les fichiers d'après le langage de la
 * règle AVANT d'appliquer `files`. Une règle `language: typescript` ne lit que
 * les .ts / .cts / .mts : un glob en `.tsx` dans ses `files` ne correspond à
 * rien, sans erreur ni avertissement. Trois règles en `severity: error`
 * (frontend-no-headers-bypass-buildCacheHeaders, no-test-routes-without-env-guard,
 * seo-no-bare-role-literal) étaient ainsi vacantes sur tous les .tsx — 0 finding
 * mesuré là où les .tsx en portaient (2 `headers` court-circuitant
 * buildCacheHeaders, 16 littéraux de rôle nus).
 *
 * Correction retenue (FAQ ast-grep, « règles séparées ») : un fichier de règle
 * à deux documents YAML, l'un en `typescript` pour les .ts, l'autre en `tsx`
 * pour les .tsx, au `rule` et au `message` identiques. Écarté :
 * `languageGlobs: { tsx: ["*.ts"] }`, qui ferait analyser tous les .ts en TSX
 * et changerait le sens des 31 autres règles (assertions `<T>expr`).
 *
 * Pourquoi un test vitest et non une méta-règle ast-grep : `ast-grep scan`
 * ignore les dossiers cachés, donc une règle portant sur `.ast-grep/rules`
 * ne s'exécuterait jamais elle-même.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import yaml from "js-yaml";
import { describe, it, expect } from "vitest";

// vitest cwd = frontend/ (cf. tests/unit/r1-images-meta.test.ts)
const REPO_ROOT = resolve(process.cwd(), "..");

/**
 * Extensions effectivement analysées par langage, mesurées en lançant une règle
 * de chaque langage sur un fichier de chaque extension (@ast-grep/cli 0.44.0
 * et 0.45.3). Un langage absent fait échouer la garde : le mesurer, puis
 * l'ajouter — jamais le deviner.
 */
const EXTENSIONS_BY_LANGUAGE: Record<string, readonly string[]> = {
  typescript: ["ts", "cts", "mts"],
  tsx: ["tsx"],
  python: ["py", "py3", "pyi", "bzl"],
  yaml: ["yml", "yaml"],
};

/** Raison pour laquelle `glob` ne peut rien sélectionner sous `language`, ou null. */
function deadGlobReason(glob: string, language: string): string | null {
  const extensions = EXTENSIONS_BY_LANGUAGE[language.toLowerCase()];
  if (!extensions) {
    return `langage « ${language} » absent de la table : mesurer ses extensions, puis l'ajouter`;
  }
  const segment = glob.slice(glob.lastIndexOf("/") + 1);
  const dot = segment.lastIndexOf(".");
  // Répertoire ou `**` : le glob couvre des fichiers de toute extension.
  if (dot === -1) return null;
  const extension = segment.slice(dot + 1);
  if (/[*?[{]/.test(extension)) {
    return `extension joker « .${extension} » : écrire un glob par extension, dans le document du langage qui l'analyse`;
  }
  if (!extensions.includes(extension)) {
    return `« .${extension} » n'est jamais analysé en ${language} (${extensions
      .map((e) => `.${e}`)
      .join(", ")}) : glob mort`;
  }
  return null;
}

interface RuleDocument {
  id?: unknown;
  language?: unknown;
  files?: unknown;
  ignores?: unknown;
  rule?: unknown;
  message?: unknown;
}

interface LoadedDocument {
  file: string;
  index: number;
  doc: RuleDocument;
}

/** `ruleDirs` lus à leur source unique, sgconfig.yml — jamais recopiés ici. */
function readRuleDirs(): string[] {
  const config = yaml.load(
    readFileSync(join(REPO_ROOT, "sgconfig.yml"), "utf8"),
  ) as { ruleDirs?: unknown };
  const dirs = config?.ruleDirs;
  if (!Array.isArray(dirs) || dirs.length === 0) {
    throw new Error(
      "ruleDirs introuvable ou vide dans sgconfig.yml — mettre à jour cette garde, ne pas la neutraliser.",
    );
  }
  return dirs.map(String);
}

function ruleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return ruleFiles(full);
    return /\.ya?ml$/.test(entry.name) ? [full] : [];
  });
}

const documents: LoadedDocument[] = readRuleDirs()
  .flatMap((dir) => ruleFiles(join(REPO_ROOT, dir)))
  .sort()
  .flatMap((path) =>
    (yaml.loadAll(readFileSync(path, "utf8")) as unknown[])
      .filter((doc): doc is RuleDocument => doc != null)
      .map((doc, index) => ({ file: relative(REPO_ROOT, path), index, doc })),
  );

function globsOf(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((g) => typeof g === "string")) {
    throw new Error(
      `forme de globs non prise en charge : ${JSON.stringify(value)} — étendre la garde`,
    );
  }
  return value;
}

describe("deadGlobReason — la garde reconnaît un glob mort", () => {
  it.each([
    ["frontend/app/routes/**/*.tsx", "typescript"],
    ["frontend/app/routes/__test*.*", "typescript"],
    ["**/*.test.tsx", "typescript"],
    ["frontend/app/**/*.ts", "tsx"],
    ["scripts/**/*.{ts,tsx}", "typescript"],
  ])("signale %s sous %s", (glob, language) => {
    expect(deadGlobReason(glob, language)).not.toBeNull();
  });

  it.each([
    ["frontend/app/routes/**/*.ts", "typescript"],
    ["frontend/app/routes/**/*.tsx", "tsx"],
    ["**/__tests__/**", "typescript"],
    ["**/__fixtures__/**", "tsx"],
    [".spec/automation-reality.yaml", "yaml"],
  ])("accepte %s sous %s", (glob, language) => {
    expect(deadGlobReason(glob, language)).toBeNull();
  });

  it("échoue sur un langage dont les extensions n'ont pas été mesurées", () => {
    expect(deadGlobReason("src/main.go", "go")).toMatch(/absent de la table/);
  });
});

describe("règles ast-grep — chaque glob désigne une extension du langage", () => {
  it("le corpus de règles est lu (garde non vacante)", () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  it.each(
    documents.map(
      (d) => [`${d.file}#${d.index} ${String(d.doc.id)}`, d] as const,
    ),
  )("%s", (_label, { doc }) => {
    expect(typeof doc.language, "language manquant").toBe("string");
    const language = doc.language as string;
    const problems = [
      ...globsOf(doc.files).map((glob) => ["files", glob] as const),
      ...globsOf(doc.ignores).map((glob) => ["ignores", glob] as const),
    ].flatMap(([key, glob]) => {
      const reason = deadGlobReason(glob, language);
      return reason ? [`${key}: ${glob} → ${reason}`] : [];
    });
    expect(problems).toEqual([]);
  });
});

describe("fichiers à plusieurs documents — jumeaux par langage", () => {
  const byFile = new Map<string, RuleDocument[]>();
  for (const { file, doc } of documents) {
    byFile.set(file, [...(byFile.get(file) ?? []), doc]);
  }
  const twins = [...byFile.entries()].filter(([, docs]) => docs.length > 1);

  it("au moins un fichier jumeau existe (garde non vacante)", () => {
    expect(twins.length).toBeGreaterThan(0);
  });

  it.each(twins)("%s", (_file, docs) => {
    const [first, ...others] = docs;
    expect(new Set(docs.map((d) => d.language)).size).toBe(docs.length);
    expect(new Set(docs.map((d) => d.id)).size).toBe(docs.length);
    for (const other of others) {
      expect(other.rule, `rule divergente dans ${String(other.id)}`).toEqual(
        first.rule,
      );
      expect(
        other.message,
        `message divergent dans ${String(other.id)}`,
      ).toEqual(first.message);
    }
  });
});
