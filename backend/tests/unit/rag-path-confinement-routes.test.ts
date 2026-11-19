/**
 * Chemins du module RAG, vus par HTTP : les routes d'administration qui
 * reçoivent un nom de répertoire, une empreinte ou un alias de gamme.
 *
 * Pour chaque route : une valeur valide, puis les valeurs refusées, avec une
 * réponse identique qui ne répète pas la valeur reçue, et un arbre de fichiers
 * inchangé. Les gardes d'accès sont neutralisées : elles ne sont pas l'objet
 * de ce test. Les fichiers vivent dans un répertoire temporaire.
 *
 * @see backend/tests/unit/rag-path-confinement.test.ts (fonction et services)
 */
const mockRagConfig = { knowledgePath: '' };

jest.mock('../../src/config/rag.config', () => ({
  get RAG_KNOWLEDGE_PATH() {
    return mockRagConfig.knowledgePath;
  },
}));

jest.mock('@nestjs/platform-express', () => {
  const actual = jest.requireActual('@nestjs/platform-express');
  return { ...actual, FileInterceptor: () => jest.fn() };
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  lstatSync,
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
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { AdminRagIngestController } from '../../src/modules/admin/controllers/admin-rag-ingest.controller';
import { RagProxyController } from '../../src/modules/rag-proxy/rag-proxy.controller';
import { RagProxyService } from '../../src/modules/rag-proxy/rag-proxy.service';
import { PdfTextExtractorService } from '../../src/modules/rag-proxy/services/pdf-text-extractor.service';
import { PdfRagClassifierService } from '../../src/modules/rag-proxy/services/pdf-rag-classifier.service';
import { RagMdMergerService } from '../../src/modules/rag-proxy/services/rag-md-merger.service';
import { RagCleanupService } from '../../src/modules/rag-proxy/services/rag-cleanup.service';
import { RagImageManagementService } from '../../src/modules/rag-proxy/services/rag-image-management.service';
import { RagVideoManagementService } from '../../src/modules/rag-proxy/services/rag-video-management.service';
import { RagGammeDetectionService } from '../../src/modules/rag-proxy/services/rag-gamme-detection.service';
import { RagPhase2aShadowAuditService } from '../../src/modules/rag-proxy/services/rag-phase2a-shadow-audit.service';
import { WebhookAuditService } from '../../src/modules/rag-proxy/services/webhook-audit.service';
import type { FrontmatterValidatorService } from '../../src/modules/rag-proxy/services/frontmatter-validator.service';
import type { RagKnowledgeService } from '../../src/modules/rag-proxy/services/rag-knowledge.service';

const ALIAS = 'disque-de-frein';
const VIDEO_HASH = 'a'.repeat(64);
const IMAGE_HASH = 'a'.repeat(16);

const docFile = [
  '---',
  'title: Document de test',
  `gamme: ${ALIAS}`,
  '---',
  'Corps du document, assez long pour être pris en compte.',
  '',
].join('\n');

/** État d'un arbre : chemin relatif → contenu, cible de lien ou répertoire. */
const snapshot = (root: string): Record<string, string> => {
  const state: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full);
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) state[rel] = `lien → ${readlinkSync(full)}`;
      else if (stat.isDirectory()) {
        state[rel] = 'répertoire';
        walk(full);
      } else state[rel] = readFileSync(full, 'utf-8');
    }
  };
  walk(root);
  return state;
};

describe('Routes d’administration RAG — répertoires, empreintes et alias reçus', () => {
  let app: INestApplication;
  let tmpRoot: string;
  let knowledge: string;
  let webDir: string;
  let videoDir: string;
  let imageDir: string;
  let outside: string;
  let before: Record<string, string>;

  const syncFilesToDb = jest.fn();
  const extractText = jest.fn();
  const classify = jest.fn();
  const merge = jest.fn();
  const emitIngestionCompleted = jest.fn();
  const persistGammeAliases = jest.fn();

  /** Chemin qui garde ses segments relatifs (path.join les réduirait). */
  const withSegments = (...parts: string[]): string => parts.join('/');

  beforeAll(async () => {
    tmpRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'rag-routes-')));
    knowledge = path.join(tmpRoot, 'knowledge');
    webDir = path.join(knowledge, 'web');
    videoDir = path.join(knowledge, '_raw', 'videos');
    imageDir = path.join(knowledge, '_raw', 'web-images');
    outside = path.join(tmpRoot, 'outside');
    mockRagConfig.knowledgePath = knowledge;

    for (const dir of [
      path.join(knowledge, 'gammes'),
      webDir,
      videoDir,
      imageDir,
      outside,
    ]) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(path.join(knowledge, 'gammes', `${ALIAS}.md`), docFile);
    writeFileSync(path.join(webDir, 'doc-valide.md'), docFile);
    writeFileSync(path.join(webDir, 'notes.txt'), 'notes');
    writeFileSync(path.join(knowledge, 'racine.md'), docFile);
    writeFileSync(path.join(outside, 'doc-hors-base.md'), docFile);
    writeFileSync(path.join(outside, 'compagnon.prompt.md'), 'gamme: null\n');
    symlinkSync(outside, path.join(knowledge, 'lien-repertoire'));

    const detection = new RagGammeDetectionService(
      { emit: jest.fn() } as unknown as EventEmitter2,
      {} as FrontmatterValidatorService,
      {
        search: jest.fn(async () => ({ results: [] })),
        persistGammeAliases,
      } as unknown as RagKnowledgeService,
    );
    detection.emitIngestionCompleted = emitIngestionCompleted;

    const images = Object.assign(
      Object.create(
        RagImageManagementService.prototype,
      ) as RagImageManagementService,
      { logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagProxyController, AdminRagIngestController],
      providers: [
        { provide: RagProxyService, useValue: {} },
        { provide: RagCleanupService, useValue: { syncFilesToDb } },
        { provide: RagImageManagementService, useValue: images },
        {
          provide: RagVideoManagementService,
          useValue: new RagVideoManagementService({} as ConfigService),
        },
        { provide: RagGammeDetectionService, useValue: detection },
        { provide: RagPhase2aShadowAuditService, useValue: {} },
        { provide: WebhookAuditService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: PdfTextExtractorService, useValue: { extractText } },
        { provide: PdfRagClassifierService, useValue: { classify } },
        { provide: RagMdMergerService, useValue: { merge } },
      ],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    syncFilesToDb.mockResolvedValue({
      synced: 1,
      skipped: 0,
      errors: [],
      receipts: [],
    });
    extractText.mockResolvedValue({ fullText: 'texte', pages: ['texte'] });
    classify.mockResolvedValue({ confidence: 90 });
    merge.mockReturnValue({
      applied: true,
      filePath: path.join(knowledge, 'gammes', `${ALIAS}.md`),
    });
    emitIngestionCompleted.mockResolvedValue(undefined);
    persistGammeAliases.mockResolvedValue(0);

    writeFileSync(
      path.join(videoDir, `${VIDEO_HASH}.prompt.md`),
      'gamme: null\n',
    );
    writeFileSync(
      path.join(imageDir, `${IMAGE_HASH}.prompt.md`),
      'gamme: "ancienne"\n',
    );
    before = snapshot(tmpRoot);
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const post = (route: string, body: Record<string, unknown>) =>
    request(app.getHttpServer()).post(route).send(body);

  /**
   * Chaque valeur refusée reçoit 400 et le même corps, qui ne la répète pas ;
   * rien n'est écrit.
   */
  const expectUniformRefusal = async (
    route: string,
    bodies: Array<[string, Record<string, unknown>, string]>,
  ): Promise<void> => {
    const answers = new Set<string>();
    for (const [, body, received] of bodies) {
      const response = await post(route, body).expect(400);
      const text = JSON.stringify(response.body);

      expect(text).not.toContain(received);
      expect(text).not.toContain(tmpRoot);
      answers.add(text);
    }

    expect(answers.size).toBe(1);
    expect(snapshot(tmpRoot)).toEqual(before);
  };

  // ───────────────────────────────────────────────────────────────
  describe('POST /api/rag/admin/cleanup/sync-files (pattern)', () => {
    const ROUTE = '/api/rag/admin/cleanup/sync-files';

    it('synchronise les fichiers .md d’un répertoire de la base', async () => {
      const response = await post(ROUTE, { pattern: 'web/doc-*.md' }).expect(
        200,
      );

      expect(response.body).toMatchObject({ synced: 1, filesMatched: 1 });
      expect(syncFilesToDb).toHaveBeenCalledWith(
        [path.join(webDir, 'doc-valide.md')],
        knowledge,
      );
    });

    it('refuse un répertoire hors de la base, absent ou lié vers l’extérieur', async () => {
      await expectUniformRefusal(ROUTE, [
        ['répertoire parent', { pattern: '../outside/*.md' }, 'outside'],
        [
          'lien symbolique sortant',
          { pattern: 'lien-repertoire/*.md' },
          'lien-repertoire',
        ],
        ['répertoire absent', { pattern: 'absent/*.md' }, 'absent'],
        ['fichier', { pattern: 'racine.md/*.md' }, 'racine'],
      ]);

      expect(syncFilesToDb).not.toHaveBeenCalled();
    });

    it('ne synchronise rien pour un chemin absolu', async () => {
      const response = await post(ROUTE, {
        pattern: `${outside}/*.md`,
      }).expect(200);

      expect(response.body).toMatchObject({ message: 'No files matched' });
      expect(syncFilesToDb).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('POST /api/rag/admin/gamme-detection/rerun (subDir)', () => {
    const ROUTE = '/api/rag/admin/gamme-detection/rerun';

    it('analyse un sous-répertoire de la base', async () => {
      const response = await post(ROUTE, { subDir: 'web' }).expect(200);

      expect(response.body).toEqual({
        total: 1,
        matched: 1,
        orphan: 0,
        results: [
          {
            file: 'doc-valide.md',
            alias: ALIAS,
            score: 95,
            strategy: '2a-gamme',
          },
        ],
      });
    });

    it('refuse un sous-répertoire hors de la base, absent ou lié vers l’extérieur', async () => {
      await expectUniformRefusal(ROUTE, [
        ['répertoire parent', { subDir: '..', dryRun: false }, '..'],
        [
          'segments relatifs sortants',
          { subDir: withSegments('..', 'outside'), dryRun: false },
          'outside',
        ],
        ['chemin absolu', { subDir: outside, dryRun: false }, 'outside'],
        [
          'lien symbolique sortant',
          { subDir: 'lien-repertoire', dryRun: false },
          'lien-repertoire',
        ],
        ['répertoire absent', { subDir: 'absent', dryRun: false }, 'absent'],
        [
          'fichier',
          { subDir: 'web/doc-valide.md', dryRun: false },
          'doc-valide',
        ],
      ]);

      expect(persistGammeAliases).not.toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('POST /api/rag/admin/videos/assign (hash)', () => {
    const ROUTE = '/api/rag/admin/videos/assign';

    it('renseigne la gamme pour une empreinte valide', async () => {
      const response = await post(ROUTE, { hash: VIDEO_HASH, gamme: ALIAS });

      expect(response.status).toBeLessThan(300);
      expect(response.body).toEqual({ success: true, enriched: 1 });
      expect(
        readFileSync(path.join(videoDir, `${VIDEO_HASH}.prompt.md`), 'utf-8'),
      ).toBe(`gamme: "${ALIAS}"\n`);
    });

    it('refuse une empreinte hors format', async () => {
      await expectUniformRefusal(ROUTE, [
        [
          'empreinte de 16 caractères',
          { hash: IMAGE_HASH, gamme: ALIAS },
          IMAGE_HASH,
        ],
        [
          'empreinte en majuscules',
          { hash: VIDEO_HASH.toUpperCase(), gamme: ALIAS },
          VIDEO_HASH.toUpperCase(),
        ],
        [
          'segments relatifs sortants',
          {
            hash: withSegments('..', '..', '..', 'outside', 'compagnon'),
            gamme: ALIAS,
          },
          'compagnon',
        ],
        [
          'chemin absolu',
          { hash: path.join(outside, 'compagnon'), gamme: ALIAS },
          'compagnon',
        ],
      ]);
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe('POST /api/rag/admin/images/bulk-reassign (hashes)', () => {
    const ROUTE = '/api/rag/admin/images/bulk-reassign';
    const body = (hashes: unknown) => ({
      hashes,
      fromGamme: 'ancienne',
      toGamme: ALIAS,
    });

    it('réaffecte une empreinte valide', async () => {
      const response = await post(ROUTE, body([IMAGE_HASH]));

      expect(response.status).toBeLessThan(300);
      expect(response.body).toEqual({ updated: 1, skipped: [] });
      expect(
        readFileSync(path.join(imageDir, `${IMAGE_HASH}.prompt.md`), 'utf-8'),
      ).toBe(`gamme: "${ALIAS}"\n`);
    });

    it('refuse une liste qui contient une empreinte hors format', async () => {
      await expectUniformRefusal(ROUTE, [
        ['empreinte de 64 caractères', body([VIDEO_HASH]), VIDEO_HASH],
        [
          'segments relatifs sortants',
          body([
            IMAGE_HASH,
            withSegments('..', '..', '..', 'outside', 'compagnon'),
          ]),
          'compagnon',
        ],
        ['chemin absolu', body([path.join(outside, 'compagnon')]), 'compagnon'],
        ['valeur qui n’est pas une liste', body('compagnon'), 'compagnon'],
      ]);
    });
  });

  // ───────────────────────────────────────────────────────────────
  describe.each(['preview', 'apply'])(
    'POST /api/admin/rag/pdf-merge/%s (pgAlias)',
    (action) => {
      const ROUTE = `/api/admin/rag/pdf-merge/${action}`;

      it('traite un alias valide', async () => {
        const response = await post(ROUTE, {
          pdfPath: 'inbox/doc.pdf',
          pgAlias: ALIAS,
        }).expect(200);

        expect(response.body).toMatchObject({ pgAlias: ALIAS });
        expect(extractText).toHaveBeenCalledWith('inbox/doc.pdf');
        expect(classify).toHaveBeenCalledTimes(1);
      });

      it('refuse un alias hors format avant toute lecture', async () => {
        const pdfPath = 'inbox/doc.pdf';

        await expectUniformRefusal(ROUTE, [
          ['majuscules', { pdfPath, pgAlias: 'Disque_De_Frein' }, 'Disque'],
          [
            'segments relatifs sortants',
            { pdfPath, pgAlias: withSegments('..', '..', 'outside', 'fiche') },
            'fiche',
          ],
          [
            'chemin absolu',
            { pdfPath, pgAlias: path.join(outside, 'fiche') },
            'fiche',
          ],
          ['extension', { pdfPath, pgAlias: 'fiche.md' }, 'fiche'],
          ['valeur absente', { pdfPath }, 'fiche'],
        ]);

        expect(extractText).not.toHaveBeenCalled();
        expect(classify).not.toHaveBeenCalled();
        expect(merge).not.toHaveBeenCalled();
        expect(syncFilesToDb).not.toHaveBeenCalled();
      });
    },
  );
});
