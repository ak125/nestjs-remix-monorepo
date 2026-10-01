/**
 * Chargement pré-validé de `exports/diagnostic/` (spec §4.5, étape 1).
 *
 * Tout ou rien : le moindre écart entre `_index.json` et les fichiers présents
 * lève `DiagnosticExportsInvalidError` AVANT toute écriture — un run partiel
 * retirerait à tort la provenance des fiches absentes.
 */
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import {
  ExportIndexSchema,
  GammeExportEnvelopeSchema,
  type LoadedDiagnosticExports,
  type LoadedGammeExport,
} from './diagnostic-projection.types';

const DIAGNOSTIC_EXPORTS_INDEX_FILE = '_index.json';
const DIAGNOSTIC_EXPORTS_GAMME_DIR = 'gamme';

export type DiagnosticExportsErrorCode =
  | 'exports_root_missing'
  | 'index_invalid'
  | 'duplicate_index_path'
  | 'listed_file_missing'
  | 'unlisted_file_present'
  | 'non_regular_file'
  | 'sha256_mismatch'
  | 'envelope_invalid'
  | 'envelope_mismatch';

export class DiagnosticExportsInvalidError extends Error {
  constructor(
    readonly code: DiagnosticExportsErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'DiagnosticExportsInvalidError';
  }
}

const sha256 = (bytes: Buffer) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

/** `stat` (suit les liens) ou `lstat` ; seul ENOENT vaut « absent ». */
async function lstatOrNull(target: string, followLinks = false) {
  try {
    return await (followLinks ? fs.stat(target) : fs.lstat(target));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Lit un fichier régulier (jamais un lien symbolique). */
async function readRegularFile(
  target: string,
  label: string,
  missingCode: DiagnosticExportsErrorCode,
): Promise<Buffer> {
  const stat = await lstatOrNull(target);
  if (!stat) throw new DiagnosticExportsInvalidError(missingCode, label);
  if (!stat.isFile()) {
    throw new DiagnosticExportsInvalidError('non_regular_file', label);
  }
  return fs.readFile(target);
}

function parseJson(bytes: Buffer): unknown {
  return JSON.parse(bytes.toString('utf8'));
}

export async function loadDiagnosticExports(
  root: string,
): Promise<LoadedDiagnosticExports> {
  // Seul ENOENT signifie « racine absente » ; EACCES, ENOTDIR, EIO… remontent
  // telles quelles (le writer les trace en run `failed`).
  const rootStat = await lstatOrNull(root, true);
  if (!rootStat?.isDirectory()) {
    throw new DiagnosticExportsInvalidError('exports_root_missing', root);
  }

  const indexBytes = await readRegularFile(
    path.join(root, DIAGNOSTIC_EXPORTS_INDEX_FILE),
    DIAGNOSTIC_EXPORTS_INDEX_FILE,
    'index_invalid',
  );
  let indexJson: unknown;
  try {
    indexJson = parseJson(indexBytes);
  } catch {
    throw new DiagnosticExportsInvalidError(
      'index_invalid',
      `${DIAGNOSTIC_EXPORTS_INDEX_FILE}: JSON illisible`,
    );
  }
  const index = ExportIndexSchema.safeParse(indexJson);
  if (!index.success) {
    throw new DiagnosticExportsInvalidError(
      'index_invalid',
      index.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    );
  }

  const listed = new Set<string>();
  for (const entry of index.data.files) {
    if (listed.has(entry.path)) {
      throw new DiagnosticExportsInvalidError(
        'duplicate_index_path',
        entry.path,
      );
    }
    listed.add(entry.path);
  }

  // Le répertoire ne contient QUE ce que l'index liste, et que des fichiers réguliers.
  const gammeDir = path.join(root, DIAGNOSTIC_EXPORTS_GAMME_DIR);
  const gammeStat = await lstatOrNull(gammeDir);
  if (gammeStat && !gammeStat.isDirectory()) {
    throw new DiagnosticExportsInvalidError(
      'non_regular_file',
      DIAGNOSTIC_EXPORTS_GAMME_DIR,
    );
  }
  const present = gammeStat
    ? await fs.readdir(gammeDir, { withFileTypes: true })
    : [];
  for (const entry of present.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = `${DIAGNOSTIC_EXPORTS_GAMME_DIR}/${entry.name}`;
    if (!entry.isFile()) {
      throw new DiagnosticExportsInvalidError('non_regular_file', relative);
    }
    if (!listed.has(relative)) {
      throw new DiagnosticExportsInvalidError(
        'unlisted_file_present',
        relative,
      );
    }
  }

  const files: LoadedGammeExport[] = [];
  for (const entry of index.data.files) {
    const bytes = await readRegularFile(
      path.join(root, entry.path),
      entry.path,
      'listed_file_missing',
    );
    const digest = sha256(bytes);
    if (digest !== entry.sha256) {
      throw new DiagnosticExportsInvalidError(
        'sha256_mismatch',
        `${entry.path}: index ${entry.sha256}, fichier ${digest}`,
      );
    }
    let envelopeJson: unknown;
    try {
      envelopeJson = parseJson(bytes);
    } catch {
      throw new DiagnosticExportsInvalidError(
        'envelope_invalid',
        `${entry.path}: JSON illisible`,
      );
    }
    const envelope = GammeExportEnvelopeSchema.safeParse(envelopeJson);
    if (!envelope.success) {
      throw new DiagnosticExportsInvalidError(
        'envelope_invalid',
        `${entry.path}: ${envelope.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ')}`,
      );
    }
    const data = envelope.data;
    const mismatches = [
      entry.path !==
        `${DIAGNOSTIC_EXPORTS_GAMME_DIR}/${data.gamme_slug}.json` &&
        'gamme_slug',
      data.wiki_path !== `wiki/gamme/${data.gamme_slug}.md` && 'wiki_path',
      data.source_wiki_commit !== entry.source_wiki_commit &&
        'source_wiki_commit',
      data.source_catalog_commit !== index.data.source_catalog_commit &&
        'source_catalog_commit',
      data.builder_version !== index.data.builder_version && 'builder_version',
      data.relations.length !== entry.relation_count && 'relation_count',
    ].filter((field): field is string => typeof field === 'string');
    if (mismatches.length > 0) {
      throw new DiagnosticExportsInvalidError(
        'envelope_mismatch',
        `${entry.path}: ${mismatches.join(', ')}`,
      );
    }
    files.push({ path: entry.path, envelope: data });
  }

  return {
    indexSha256: sha256(indexBytes),
    builderVersion: index.data.builder_version,
    files,
  };
}
