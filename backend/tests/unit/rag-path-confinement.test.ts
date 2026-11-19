/**
 * Chemins du module RAG : fonction de confinement partagée, format des noms,
 * puis chaque service qui construit un chemin à partir d'une valeur reçue.
 *
 * Pour chaque point d'entrée : un nom valide, un nom hors format, une sortie
 * du répertoire par segments relatifs, un chemin absolu, un lien symbolique
 * sortant. Un refus ne lit et n'écrit rien : l'arbre de fichiers est comparé
 * avant et après. Les fichiers vivent dans un répertoire temporaire.
 *
 * @see backend/src/modules/rag-proxy/utils/rag-paths.util.ts
 */
const mockRagConfig = { knowledgePath: '' };

jest.mock('../../src/config/rag.config', () => ({
  get RAG_KNOWLEDGE_PATH() {
    return mockRagConfig.knowledgePath;
  },
}));

const mockPdfParse = jest.fn();

jest.mock('pdf-parse', () => ({
  __esModule: true,
  default: (buffer: Buffer) => mockPdfParse(buffer),
}));

import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertGammeAlias,
  resolveConfinedPath,
} from '../../src/modules/rag-proxy/utils/rag-paths.util';
import { PdfTextExtractorService } from '../../src/modules/rag-proxy/services/pdf-text-extractor.service';
import {
  PdfRagClassifierService,
  type RagMergePatch,
} from '../../src/modules/rag-proxy/services/pdf-rag-classifier.service';
import { RagMdMergerService } from '../../src/modules/rag-proxy/services/rag-md-merger.service';
import { RagVideoManagementService } from '../../src/modules/rag-proxy/services/rag-video-management.service';
import { RagImageManagementService } from '../../src/modules/rag-proxy/services/rag-image-management.service';
import { RagGammeDetectionService } from '../../src/modules/rag-proxy/services/rag-gamme-detection.service';
import { RagCleanupService } from '../../src/modules/rag-proxy/services/rag-cleanup.service';
import { RagWebhookCompletionService } from '../../src/modules/rag-proxy/services/rag-webhook-completion.service';
import type { FrontmatterValidatorService } from '../../src/modules/rag-proxy/services/frontmatter-validator.service';
import type { RagKnowledgeService } from '../../src/modules/rag-proxy/services/rag-knowledge.service';
import type { WebhookAuditService } from '../../src/modules/rag-proxy/services/webhook-audit.service';
import type { RagRedisJobService } from '../../src/modules/rag-proxy/services/rag-redis-job.service';

const ALIAS = 'disque-de-frein';
const ALIAS_LINK_OUT = 'lien-sortant';
const INSIDE_MARKER = 'CONTENU-DE-LA-BASE';
const OUTSIDE_MARKER = 'CONTENU-HORS-BASE';

const VIDEO_HASH = 'a'.repeat(64);
const VIDEO_HASH_NO_SIDECAR = 'b'.repeat(64);
const VIDEO_HASH_LINK_OUT = 'c'.repeat(64);
const IMAGE_HASH = 'a'.repeat(16);
const IMAGE_HASH_LINK_OUT = 'c'.repeat(16);

const GAMME_FILE = [
  '---',
  'title: Disque de frein',
  `note: ${INSIDE_MARKER}`,
  'selection:',
  '  criteria:',
  '    - critère existant',
  '---',
  '# Disque de frein',
  '',
  'Corps de la fiche.',
  '',
].join('\n');

const docFile = (marker: string): string =>
  [
    '---',
    'title: Document de test',
    `gamme: ${ALIAS}`,
    `note: ${marker}`,
    '---',
    'Corps du document, assez long pour être pris en compte.',
    '',
  ].join('\n');

/** État d'un arbre : chemin relatif → contenu, cible de lien ou répertoire. */
const snapshot = (root: string): Record<string, string> => {
  const state: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isSymbolicLink()) state[rel] = `lien → ${readlinkSync(full)}`;
      else if (entry.isDirectory()) {
        state[rel] = 'répertoire';
        walk(full);
      } else state[rel] = readFileSync(full, 'utf-8');
    }
  };
  walk(root);
  return state;
};

const silentLogger = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('Chemins du module RAG — confinement et format des noms', () => {
  let tmpRoot: string;
  let knowledge: string;
  let gammesDir: string;
  let webDir: string;
  let videoDir: string;
  let imageDir: string;
  let pdfsDir: string;
  let outside: string;
  let before: Record<string, string>;

  /** Chemin qui garde ses segments relatifs (path.join les réduirait). */
  const withSegments = (...parts: string[]): string => parts.join(path.sep);

  beforeEach(() => {
    tmpRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'rag-paths-')));
    knowledge = path.join(tmpRoot, 'knowledge');
    gammesDir = path.join(knowledge, 'gammes');
    webDir = path.join(knowledge, 'web');
    videoDir = path.join(knowledge, '_raw', 'videos');
    imageDir = path.join(knowledge, '_raw', 'web-images');
    pdfsDir = path.join(tmpRoot, 'pdfs');
    outside = path.join(tmpRoot, 'outside');
    mockRagConfig.knowledgePath = knowledge;

    for (const dir of [
      gammesDir,
      webDir,
      videoDir,
      imageDir,
      path.join(knowledge, '_raw', 'pdf'),
      path.join(pdfsDir, 'inbox'),
      path.join(pdfsDir, 'inbox', 'dossier.pdf'),
      path.join(tmpRoot, 'knowledge-bis'),
      outside,
    ]) {
      mkdirSync(dir, { recursive: true });
    }

    // Hors de la base : des fichiers que chaque point d'entrée saurait lire
    // ou modifier s'il les atteignait.
    writeFileSync(path.join(outside, 'gamme-hors-base.md'), GAMME_FILE);
    writeFileSync(
      path.join(outside, 'doc-hors-base.md'),
      docFile(OUTSIDE_MARKER),
    );
    writeFileSync(path.join(outside, 'hors-depot.pdf'), OUTSIDE_MARKER);
    writeFileSync(path.join(outside, 'compagnon.prompt.md'), 'gamme: null\n');
    writeFileSync(
      path.join(outside, 'compagnon-image.prompt.md'),
      'gamme: "ancienne"\n',
    );
    writeFileSync(
      path.join(tmpRoot, 'knowledge-bis', 'voisin.md'),
      docFile(OUTSIDE_MARKER),
    );

    // Dans la base.
    writeFileSync(path.join(gammesDir, `${ALIAS}.md`), GAMME_FILE);
    symlinkSync(
      path.join(outside, 'gamme-hors-base.md'),
      path.join(gammesDir, `${ALIAS_LINK_OUT}.md`),
    );
    writeFileSync(path.join(webDir, 'doc-valide.md'), docFile(INSIDE_MARKER));
    symlinkSync(
      path.join(outside, 'doc-hors-base.md'),
      path.join(webDir, 'lien-sortant.md'),
    );
    symlinkSync(
      path.join(gammesDir, `${ALIAS}.md`),
      path.join(webDir, 'lien-interne.md'),
    );
    symlinkSync(outside, path.join(knowledge, 'lien-repertoire'));

    writeFileSync(
      path.join(videoDir, `${VIDEO_HASH}.prompt.md`),
      'gamme: null\n',
    );
    symlinkSync(
      path.join(outside, 'compagnon.prompt.md'),
      path.join(videoDir, `${VIDEO_HASH_LINK_OUT}.prompt.md`),
    );
    writeFileSync(
      path.join(imageDir, `${IMAGE_HASH}.prompt.md`),
      'gamme: "ancienne"\n',
    );
    symlinkSync(
      path.join(outside, 'compagnon-image.prompt.md'),
      path.join(imageDir, `${IMAGE_HASH_LINK_OUT}.prompt.md`),
    );

    // PDF : dépôt voisin de la base, et `_raw/pdf` dans la base.
    writeFileSync(path.join(pdfsDir, 'inbox', 'doc.pdf'), INSIDE_MARKER);
    writeFileSync(path.join(pdfsDir, 'inbox', 'notes.txt'), INSIDE_MARKER);
    writeFileSync(
      path.join(knowledge, '_raw', 'pdf', 'archive.pdf'),
      INSIDE_MARKER,
    );
    symlinkSync(
      path.join(outside, 'hors-depot.pdf'),
      path.join(pdfsDir, 'inbox', 'lien-sortant.pdf'),
    );

    mockPdfParse.mockReset();
    mockPdfParse.mockImplementation(async (buffer: Buffer) => ({
      text: buffer.toString('utf-8'),
      numpages: 1,
      info: {},
    }));

    before = snapshot(tmpRoot);
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const expectNothingWritten = (): void => {
    expect(snapshot(tmpRoot)).toEqual(before);
  };

  // ───────────────────────────────────────────────────────────────
  describe('resolveConfinedPath', () => {
    it('renvoie le chemin réel d’un fichier de la racine, relatif ou absolu', () => {
      const expected = path.join(webDir, 'doc-valide.md');

      expect(resolveConfinedPath(knowledge, 'web/doc-valide.md')).toBe(
        expected,
      );
      expect(resolveConfinedPath(knowledge, expected)).toBe(expected);
    });

    it('suit un lien symbolique qui reste dans la racine', () => {
      expect(resolveConfinedPath(knowledge, 'web/lien-interne.md')).toBe(
        path.join(gammesDir, `${ALIAS}.md`),
      );
    });

    it('accepte un répertoire de la racine, et la racine elle-même', () => {
      expect(resolveConfinedPath(knowledge, 'web', 'directory')).toBe(webDir);
      expect(resolveConfinedPath(knowledge, '.', 'directory')).toBe(knowledge);
      expect(resolveConfinedPath(knowledge, '', 'directory')).toBe(knowledge);
    });

    const refusedFiles: Array<[string, () => unknown]> = [
      [
        'segments relatifs sortants',
        () => withSegments('..', 'outside', 'doc-hors-base.md'),
      ],
      [
        'segments relatifs après un répertoire valide',
        () => withSegments('web', '..', '..', 'outside', 'doc-hors-base.md'),
      ],
      [
        'chemin absolu hors racine',
        () => path.join(outside, 'doc-hors-base.md'),
      ],
      [
        'répertoire voisin au nom préfixé par celui de la racine',
        () => path.join(tmpRoot, 'knowledge-bis', 'voisin.md'),
      ],
      ['lien symbolique sortant', () => 'web/lien-sortant.md'],
      [
        'fichier atteint par un répertoire lié sortant',
        () => 'lien-repertoire/doc-hors-base.md',
      ],
      ['fichier absent', () => 'web/absent.md'],
      ['répertoire là où un fichier est attendu', () => 'web'],
      ['racine là où un fichier est attendu', () => '.'],
      ['chaîne vide', () => ''],
      ['octet nul', () => 'web/doc-valide.md\0'],
      ['valeur qui n’est pas une chaîne', () => undefined],
    ];

    it.each(refusedFiles)('refuse un fichier : %s', (_label, candidate) => {
      expect(resolveConfinedPath(knowledge, candidate() as string)).toBeNull();
    });

    const refusedDirectories: Array<[string, () => unknown]> = [
      ['répertoire parent', () => '..'],
      ['segments relatifs sortants', () => withSegments('web', '..', '..')],
      ['chemin absolu hors racine', () => outside],
      ['lien symbolique sortant', () => 'lien-repertoire'],
      ['répertoire absent', () => 'absent'],
      ['fichier là où un répertoire est attendu', () => 'web/doc-valide.md'],
      ['valeur qui n’est pas une chaîne', () => 42],
    ];

    it.each(refusedDirectories)(
      'refuse un répertoire : %s',
      (_label, candidate) => {
        expect(
          resolveConfinedPath(knowledge, candidate() as string, 'directory'),
        ).toBeNull();
      },
    );

    it('refuse tout quand la racine n’existe pas', () => {
      const missingRoot = path.join(tmpRoot, 'absente');

      expect(resolveConfinedPath(missingRoot, 'doc.md')).toBeNull();
      expect(resolveConfinedPath(missingRoot, '.', 'directory')).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('assertGammeAlias', () => {
    it.each([ALIAS, 'kit-d-embrayage', 'filtre-a-huile', 'h7', 'a'])(
      'accepte %s',
      (alias) => {
        expect(() => assertGammeAlias(alias)).not.toThrow();
      },
    );

    const refusedAliases: Array<[string, unknown]> = [
      ['chaîne vide', ''],
      ['majuscules', 'Disque-De-Frein'],
      ['tiret bas', 'disque_de_frein'],
      ['tirets consécutifs', 'disque--frein'],
      ['tiret initial', '-disque'],
      ['tiret final', 'disque-'],
      ['point', 'disque.frein'],
      ['extension', `${ALIAS}.md`],
      ['espace', 'disque de frein'],
      ['séparateur de chemin', withSegments('gammes', ALIAS)],
      ['segments relatifs', withSegments('..', ALIAS)],
      ['barre oblique inversée', `..\\${ALIAS}`],
      ['octet nul', `${ALIAS}\0`],
      ['saut de ligne final', `${ALIAS}\n`],
      ['plus de 100 caractères', 'a'.repeat(101)],
      ['valeur absente', undefined],
      ['tableau', [ALIAS]],
    ];

    it.each(refusedAliases)('refuse (400) : %s', (_label, value) => {
      expect(() => assertGammeAlias(value)).toThrow(
        new BadRequestException('Invalid pgAlias format'),
      );
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('PdfTextExtractorService.extractText (pdfPath)', () => {
    const service = new PdfTextExtractorService();

    it('lit un PDF du dépôt par son chemin absolu', async () => {
      const pdfPath = path.join(pdfsDir, 'inbox', 'doc.pdf');

      const result = await service.extractText(pdfPath);

      expect(result.fullText).toBe(INSIDE_MARKER);
      expect(result.sourcePath).toBe(pdfPath);
      expect(mockPdfParse).toHaveBeenCalledTimes(1);
    });

    it('lit un PDF du dépôt par un chemin relatif au dépôt', async () => {
      const result = await service.extractText('inbox/doc.pdf');

      expect(result.sourcePath).toBe(path.join(pdfsDir, 'inbox', 'doc.pdf'));
    });

    it('lit un PDF conservé dans la base de connaissances', async () => {
      const pdfPath = path.join(knowledge, '_raw', 'pdf', 'archive.pdf');

      const result = await service.extractText(pdfPath);

      expect(result.sourcePath).toBe(pdfPath);
    });

    const refused: Array<[string, () => unknown]> = [
      ['fichier sans extension .pdf', () => 'inbox/notes.txt'],
      [
        'segments relatifs sortants',
        () => withSegments('inbox', '..', '..', 'outside', 'hors-depot.pdf'),
      ],
      ['chemin absolu hors dépôt', () => path.join(outside, 'hors-depot.pdf')],
      ['lien symbolique sortant', () => 'inbox/lien-sortant.pdf'],
      ['répertoire au nom de PDF', () => 'inbox/dossier.pdf'],
      ['fichier absent', () => 'inbox/absent.pdf'],
      ['octet nul', () => 'inbox/doc.pdf\0'],
      ['valeur absente', () => undefined],
    ];

    it.each(refused)('refuse sans rien lire : %s', async (_label, pdfPath) => {
      await expect(service.extractText(pdfPath() as string)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockPdfParse).not.toHaveBeenCalled();
      expectNothingWritten();
    });

    it('répond la même chose à tout chemin refusé, sans le répéter', async () => {
      const messages = new Set<string>();
      for (const [, pdfPath] of refused) {
        const error = await service
          .extractText(pdfPath() as string)
          .catch((err: Error) => err);
        messages.add((error as Error).message);
      }

      expect([...messages]).toEqual(['PDF not found or not allowed']);
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('PdfRagClassifierService.classify (pgAlias)', () => {
    let fetchMock: jest.Mock;
    let service: PdfRagClassifierService;

    const configWithKey = {
      get: (key: string) => (key === 'GROQ_API_KEY' ? 'valeur-de-test' : null),
    } as unknown as ConfigService;

    beforeEach(() => {
      fetchMock = jest.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '{}' } }] }),
      }));
      jest.spyOn(global, 'fetch').mockImplementation(fetchMock);
      service = new PdfRagClassifierService(configWithKey);
    });

    const sentBody = (): string => String(fetchMock.mock.calls[0][1].body);

    it('joint la fiche existante d’un alias valide', async () => {
      await service.classify('texte du PDF', ALIAS, 'L2', 'essai');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sentBody()).toContain(INSIDE_MARKER);
    });

    it('continue sans fiche pour un alias valide qui n’a pas de fichier', async () => {
      await service.classify('texte du PDF', 'alias-sans-fiche', 'L2', 'essai');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(sentBody()).not.toContain(INSIDE_MARKER);
    });

    it('ne lit pas une fiche qui est un lien symbolique sortant', async () => {
      await service.classify('texte du PDF', ALIAS_LINK_OUT, 'L2', 'essai');

      expect(sentBody()).not.toContain(INSIDE_MARKER);
      expectNothingWritten();
    });

    const refused: Array<[string, () => unknown]> = [
      ['nom hors format', () => 'Disque_De_Frein'],
      [
        'segments relatifs sortants',
        () => withSegments('..', '..', 'outside', 'gamme-hors-base'),
      ],
      ['chemin absolu', () => path.join(outside, 'gamme-hors-base')],
      ['valeur absente', () => undefined],
    ];

    it.each(refused)(
      'refuse (400) avant toute lecture et tout appel : %s',
      async (_label, alias) => {
        await expect(
          service.classify('texte du PDF', alias() as string, 'L2', 'essai'),
        ).rejects.toThrow(new BadRequestException('Invalid pgAlias format'));

        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it('refuse aussi un nom hors format sans clé de classification', async () => {
      const passthrough = new PdfRagClassifierService({
        get: () => null,
      } as unknown as ConfigService);

      await expect(
        passthrough.classify('texte', withSegments('..', ALIAS), 'L2', 'essai'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        passthrough.classify('texte', ALIAS, 'L2', 'essai'),
      ).resolves.toMatchObject({ confidence: 50 });
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('RagMdMergerService.merge et preview (pgAlias)', () => {
    const ADDED = 'critère ajouté par le test';
    const patch = (confidence = 90): RagMergePatch => ({
      source_ref: 'essai',
      truth_level: 'L2',
      yaml_array_appends: { 'selection.criteria': [ADDED] },
      yaml_field_enrichments: {},
      new_yaml_blocks: {},
      markdown_sections: [],
      confidence,
    });

    it('fusionne dans la fiche d’un alias valide et renvoie son chemin', () => {
      const service = new RagMdMergerService();
      const filePath = path.join(gammesDir, `${ALIAS}.md`);

      const result = service.merge(ALIAS, patch());

      expect(result.applied).toBe(true);
      expect(result.filePath).toBe(filePath);
      expect(result.modifiedFields).toContain('selection.criteria');
      const after = snapshot(tmpRoot);
      expect(after[path.relative(tmpRoot, filePath)]).toContain(ADDED);
      // Seule la fiche visée a changé ; aucun fichier temporaire ne reste.
      expect({
        ...after,
        [path.relative(tmpRoot, filePath)]: GAMME_FILE,
      }).toEqual(before);
    });

    it('prévisualise les champs pour un alias valide', () => {
      const service = new RagMdMergerService();

      expect(service.preview(ALIAS, patch())).toMatchObject({
        fieldsToModify: ['selection.criteria'],
        estimatedNewItems: 1,
      });
      expectNothingWritten();
    });

    it('garde le refus de confiance faible sans rien écrire', () => {
      const service = new RagMdMergerService();

      expect(service.merge(ALIAS, patch(10))).toMatchObject({
        applied: false,
        reason: 'LOW_CONFIDENCE',
        filePath: path.join(gammesDir, `${ALIAS}.md`),
      });
      expectNothingWritten();
    });

    const refused: Array<[string, () => unknown]> = [
      ['nom hors format', () => 'Disque_De_Frein'],
      [
        'segments relatifs sortants',
        () => withSegments('..', '..', 'outside', 'gamme-hors-base'),
      ],
      ['chemin absolu', () => path.join(outside, 'gamme-hors-base')],
      ['valeur absente', () => undefined],
    ];

    it.each(refused)(
      'refuse (400) sans rien lire ni écrire : %s',
      (_label, alias) => {
        const service = new RagMdMergerService();
        const expected = new BadRequestException('Invalid pgAlias format');

        expect(() => service.merge(alias() as string, patch())).toThrow(
          expected,
        );
        expect(() => service.merge(alias() as string, patch(10))).toThrow(
          expected,
        );
        expect(() => service.preview(alias() as string, patch())).toThrow(
          expected,
        );
        expectNothingWritten();
      },
    );

    it('ne suit pas une fiche qui est un lien symbolique sortant', () => {
      const service = new RagMdMergerService();

      const error = (() => {
        try {
          service.merge(ALIAS_LINK_OUT, patch());
          return null;
        } catch (err) {
          return err as Error;
        }
      })();

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error?.message).not.toContain(tmpRoot);
      expect(service.preview(ALIAS_LINK_OUT, patch())).toEqual({
        fieldsToModify: [],
        sectionsToAdd: [],
        estimatedNewItems: 0,
      });
      expectNothingWritten();
    });

    it('répond 400 sans chemin absolu pour un alias valide sans fiche', () => {
      const service = new RagMdMergerService();

      expect(() => service.merge('alias-sans-fiche', patch())).toThrow(
        new BadRequestException(
          'RAG file not found for gamme alias-sans-fiche',
        ),
      );
      expectNothingWritten();
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('RagVideoManagementService.enrichVideoPrompts (hash)', () => {
    const newService = () => new RagVideoManagementService({} as ConfigService);

    it('renseigne la gamme du fichier compagnon d’une empreinte valide', () => {
      expect(newService().enrichVideoPrompts([VIDEO_HASH], ALIAS)).toBe(1);

      expect(
        readFileSync(path.join(videoDir, `${VIDEO_HASH}.prompt.md`), 'utf-8'),
      ).toBe(`gamme: "${ALIAS}"\n`);
    });

    it('ignore une empreinte valide sans fichier compagnon', () => {
      expect(
        newService().enrichVideoPrompts([VIDEO_HASH_NO_SIDECAR], ALIAS),
      ).toBe(0);
      expectNothingWritten();
    });

    it('ne suit pas un fichier compagnon qui est un lien symbolique sortant', () => {
      expect(
        newService().enrichVideoPrompts([VIDEO_HASH_LINK_OUT], ALIAS),
      ).toBe(0);
      expectNothingWritten();
    });

    const refused: Array<[string, () => unknown]> = [
      ['empreinte de 16 caractères', () => [VIDEO_HASH.slice(0, 16)]],
      ['empreinte en majuscules', () => [VIDEO_HASH.toUpperCase()]],
      ['empreinte suivie d’une extension', () => [`${VIDEO_HASH}.mp4`]],
      [
        'segments relatifs sortants',
        () => [withSegments('..', '..', '..', 'outside', 'compagnon')],
      ],
      ['chemin absolu', () => [path.join(outside, 'compagnon')]],
      ['empreinte valide suivie d’un nom refusé', () => [VIDEO_HASH, 'autre']],
      ['valeur qui n’est pas une liste', () => VIDEO_HASH],
    ];

    it.each(refused)(
      'refuse (400) sans rien lire ni écrire : %s',
      (_label, hashes) => {
        expect(() =>
          newService().enrichVideoPrompts(hashes() as string[], ALIAS),
        ).toThrow(
          new BadRequestException(
            'Invalid hash format (expected 64 hex chars)',
          ),
        );
        expectNothingWritten();
      },
    );
  });

  // ───────────────────────────────────────────────────────────────
  describe('RagImageManagementService.reassignImageGammes (hashes)', () => {
    const newService = (): RagImageManagementService =>
      Object.assign(
        Object.create(
          RagImageManagementService.prototype,
        ) as RagImageManagementService,
        { logger: silentLogger },
      );

    it('réaffecte le fichier compagnon d’une empreinte valide', () => {
      expect(
        newService().reassignImageGammes([IMAGE_HASH], 'ancienne', ALIAS),
      ).toEqual({ updated: 1, skipped: [] });

      expect(
        readFileSync(path.join(imageDir, `${IMAGE_HASH}.prompt.md`), 'utf-8'),
      ).toBe(`gamme: "${ALIAS}"\n`);
    });

    it('ne suit pas un fichier compagnon qui est un lien symbolique sortant', () => {
      expect(
        newService().reassignImageGammes(
          [IMAGE_HASH_LINK_OUT],
          'ancienne',
          ALIAS,
        ),
      ).toEqual({ updated: 0, skipped: [IMAGE_HASH_LINK_OUT] });
      expectNothingWritten();
    });

    const refused: Array<[string, () => unknown]> = [
      ['empreinte de 64 caractères', () => [VIDEO_HASH]],
      ['empreinte en majuscules', () => [IMAGE_HASH.toUpperCase()]],
      [
        'segments relatifs sortants',
        () => [withSegments('..', '..', '..', 'outside', 'compagnon-image')],
      ],
      ['chemin absolu', () => [path.join(outside, 'compagnon-image')]],
      ['empreinte valide suivie d’un nom refusé', () => [IMAGE_HASH, 'autre']],
      ['valeur qui n’est pas une liste', () => IMAGE_HASH],
    ];

    it.each(refused)(
      'refuse (400) sans rien lire ni écrire : %s',
      (_label, hashes) => {
        expect(() =>
          newService().reassignImageGammes(
            hashes() as string[],
            'ancienne',
            ALIAS,
          ),
        ).toThrow(
          new BadRequestException(
            'Invalid hash format (expected 16 hex chars)',
          ),
        );
        expectNothingWritten();
      },
    );
  });

  // ───────────────────────────────────────────────────────────────
  const newKnowledgeStub = () => ({
    search: jest.fn(async () => ({ results: [] })),
    persistGammeAliases: jest.fn(async () => 0),
  });

  const newDetection = (knowledgeStub = newKnowledgeStub()) =>
    new RagGammeDetectionService(
      { emit: jest.fn() } as unknown as EventEmitter2,
      {} as FrontmatterValidatorService,
      knowledgeStub as unknown as RagKnowledgeService,
    );

  describe('RagGammeDetectionService.resolveGammesFromFiles (fichiers reçus)', () => {
    it('détecte la gamme d’un fichier de la base', async () => {
      const filePath = path.join(webDir, 'doc-valide.md');

      const result = await newDetection().resolveGammesFromFiles([filePath]);

      expect(Object.fromEntries(result)).toEqual({ [ALIAS]: [filePath] });
    });

    it('garde la règle du répertoire des gammes : le nom du fichier est l’alias', async () => {
      const filePath = path.join(gammesDir, `${ALIAS}.md`);

      const result = await newDetection().resolveGammesFromFiles([filePath]);

      expect(Object.fromEntries(result)).toEqual({ [ALIAS]: [filePath] });
    });

    const refused: Array<[string, () => string]> = [
      [
        'segments relatifs sortants',
        () => withSegments(webDir, '..', '..', 'outside', 'doc-hors-base.md'),
      ],
      ['chemin absolu hors base', () => path.join(outside, 'doc-hors-base.md')],
      [
        'répertoire voisin au nom préfixé',
        () => path.join(tmpRoot, 'knowledge-bis', 'voisin.md'),
      ],
      ['lien symbolique sortant', () => path.join(webDir, 'lien-sortant.md')],
    ];

    it.each(refused)('ne lit pas : %s', async (_label, filePath) => {
      const knowledgeStub = newKnowledgeStub();

      const result = await newDetection(knowledgeStub).resolveGammesFromFiles([
        filePath(),
      ]);

      expect(result.size).toBe(0);
      expect(knowledgeStub.search).not.toHaveBeenCalled();
      expectNothingWritten();
    });
  });

  describe('RagGammeDetectionService.rerunDetection (subDir)', () => {
    it('analyse un sous-répertoire valide', async () => {
      const result = await newDetection().rerunDetection({
        dryRun: true,
        subDir: 'web',
      });

      // Trois fichiers listés ; le lien sortant n'est pas lu, donc pas détecté.
      expect(result).toMatchObject({ total: 3, matched: 2, orphan: 1 });
      expect(
        [...result.results].sort((a, b) => a.file.localeCompare(b.file)),
      ).toEqual([
        {
          file: 'doc-valide.md',
          alias: ALIAS,
          score: 95,
          strategy: '2a-gamme',
        },
        {
          file: 'lien-interne.md',
          alias: ALIAS,
          score: 100,
          strategy: '3-title',
        },
      ]);
    });

    it('analyse les répertoires par défaut et ignore ceux qui n’existent pas', async () => {
      const result = await newDetection().rerunDetection({ dryRun: true });

      expect(result).toMatchObject({ total: 3, matched: 2, orphan: 1 });
    });

    const refused: Array<[string, () => unknown]> = [
      ['répertoire parent', () => '..'],
      ['segments relatifs sortants', () => withSegments('..', 'outside')],
      ['chemin absolu hors base', () => outside],
      ['lien symbolique sortant', () => 'lien-repertoire'],
      ['répertoire absent', () => 'absent'],
      ['fichier', () => 'web/doc-valide.md'],
      ['valeur qui n’est pas une chaîne', () => 42],
    ];

    it.each(refused)(
      'refuse (400) sans rien lire : %s',
      async (_label, subDir) => {
        const knowledgeStub = newKnowledgeStub();

        await expect(
          newDetection(knowledgeStub).rerunDetection({
            dryRun: false,
            subDir: subDir() as string,
          }),
        ).rejects.toThrow(new BadRequestException('Invalid subDir'));

        expect(knowledgeStub.persistGammeAliases).not.toHaveBeenCalled();
        expectNothingWritten();
      },
    );
  });

  // ───────────────────────────────────────────────────────────────
  const FILE_REFUSED =
    'File refused: missing, not a regular file or outside the knowledge base';

  const newCleanup = (detection: unknown) => {
    const stubs = {
      logger: silentLogger,
      frontmatterValidator: {
        parseFrontmatter: jest.fn(() => ({
          title: 'Document de test',
          truth_level: 'L2',
          domain: 'knowledge',
        })),
      },
      ragFingerprintService: {
        buildFingerprintPack: jest.fn(() => ({})),
        checkWriteSafety: jest.fn(async () => ({ safe: true })),
      },
      ragNormalizationService: { normalize: jest.fn(async () => undefined) },
      ragAdmissibilityGateService: { evaluate: jest.fn(async () => undefined) },
      ragGammeDetectionService: detection,
      decideIngest: jest.fn(async () => ({
        decision: 'ACCEPT_UPSERT',
        reasons: [],
      })),
      applyIngest: jest.fn(async () => ({ id: 'id-de-test' })),
    };
    const service: RagCleanupService = Object.create(
      RagCleanupService.prototype,
    );
    Object.assign(service, stubs);
    return { service, stubs };
  };

  describe('RagCleanupService.syncFilesToDb (fichiers reçus)', () => {
    const detectionStub = () => ({
      resolveGammesFromFiles: jest.fn(async () => new Map()),
    });

    it.each([
      ['absolu', () => path.join(webDir, 'doc-valide.md')],
      ['relatif à la base', () => 'web/doc-valide.md'],
    ])('synchronise un fichier de la base, chemin %s', async (_label, fp) => {
      const { service, stubs } = newCleanup(detectionStub());

      const result = await service.syncFilesToDb([fp()], knowledge);

      expect(result).toMatchObject({ synced: 1, skipped: 0, errors: [] });
      expect(result.receipts[0]).toMatchObject({
        sourceLocator: fp(),
        finalStatus: 'accepted',
      });
      expect(stubs.frontmatterValidator.parseFrontmatter).toHaveBeenCalledWith(
        docFile(INSIDE_MARKER),
      );
      expect(stubs.applyIngest).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'web/doc-valide' }),
        expect.anything(),
      );
    });

    const refused: Array<[string, () => string]> = [
      [
        'segments relatifs sortants',
        () => withSegments('web', '..', '..', 'outside', 'doc-hors-base.md'),
      ],
      ['chemin absolu hors base', () => path.join(outside, 'doc-hors-base.md')],
      [
        'répertoire voisin au nom préfixé',
        () => path.join(tmpRoot, 'knowledge-bis', 'voisin.md'),
      ],
      ['lien symbolique sortant', () => path.join(webDir, 'lien-sortant.md')],
      ['fichier absent', () => 'web/absent.md'],
      ['répertoire', () => 'web'],
    ];

    it.each(refused)(
      'refuse sans rien lire ni écrire en base : %s',
      async (_label, fp) => {
        const { service, stubs } = newCleanup(detectionStub());

        const result = await service.syncFilesToDb([fp()], knowledge);

        expect(result).toMatchObject({
          synced: 0,
          skipped: 0,
          errors: [FILE_REFUSED],
        });
        expect(JSON.stringify(result)).not.toContain(fp());
        expect(result.receipts[0]).toMatchObject({
          receptionSuccess: false,
          finalStatus: 'failed',
        });
        expect(
          stubs.frontmatterValidator.parseFrontmatter,
        ).not.toHaveBeenCalled();
        expect(stubs.applyIngest).not.toHaveBeenCalled();
        expectNothingWritten();
      },
    );

    it('traite les fichiers valides d’une liste qui contient des refus', async () => {
      const { service, stubs } = newCleanup(detectionStub());

      const result = await service.syncFilesToDb(
        [
          path.join(outside, 'doc-hors-base.md'),
          path.join(webDir, 'doc-valide.md'),
          path.join(webDir, 'lien-sortant.md'),
        ],
        knowledge,
      );

      expect(result).toMatchObject({
        synced: 1,
        errors: [FILE_REFUSED, FILE_REFUSED],
      });
      expect(stubs.applyIngest).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('RagWebhookCompletionService (files_created)', () => {
    it('ne traite que les fichiers de la base parmi ceux annoncés', async () => {
      const detection = newDetection();
      const { service: cleanup, stubs } = newCleanup(detection);
      const emit = jest.fn();
      const webhook = new RagWebhookCompletionService(
        { emit } as unknown as EventEmitter2,
        {
          recordWebhook: jest.fn(async () => undefined),
        } as unknown as WebhookAuditService,
        detection,
        {} as RagRedisJobService,
        cleanup,
      );

      const result = await webhook.handleWebhookCompletion({
        job_id: 'essai',
        source: 'web',
        status: 'done',
        files_created: [
          'web/doc-valide.md',
          withSegments('web', '..', '..', 'outside', 'doc-hors-base.md'),
          path.join(outside, 'doc-hors-base.md'),
          'web/lien-sortant.md',
        ],
      });

      expect(result).toEqual({
        gammes_detected: [ALIAS],
        diagnostics_detected: [],
        event_emitted: true,
      });
      expect(stubs.applyIngest).toHaveBeenCalledTimes(1);
      expect(stubs.frontmatterValidator.parseFrontmatter).toHaveBeenCalledTimes(
        1,
      );
      expect(stubs.frontmatterValidator.parseFrontmatter).toHaveBeenCalledWith(
        docFile(INSIDE_MARKER),
      );
      expect(emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          affectedGammesMap: { [ALIAS]: [path.join(webDir, 'doc-valide.md')] },
        }),
      );
      expectNothingWritten();
    });
  });
});
