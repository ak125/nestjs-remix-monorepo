/**
 * Service des vidéos RAG : format du nom de fichier et confinement au
 * répertoire des vidéos.
 *
 * Deux niveaux : la route `GET api/rag/videos/:hashWithExt` par HTTP (le
 * paramètre arrive décodé par Express), puis `streamVideo` appelé directement.
 * Les fichiers vivent dans un répertoire temporaire créé pour le test.
 *
 * @see backend/src/modules/rag-proxy/services/rag-video-management.service.ts
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
import { INestApplication, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import request from 'supertest';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { RagProxyController } from '../../src/modules/rag-proxy/rag-proxy.controller';
import { RagProxyService } from '../../src/modules/rag-proxy/rag-proxy.service';
import { RagCleanupService } from '../../src/modules/rag-proxy/services/rag-cleanup.service';
import { RagImageManagementService } from '../../src/modules/rag-proxy/services/rag-image-management.service';
import { RagVideoManagementService } from '../../src/modules/rag-proxy/services/rag-video-management.service';
import { RagGammeDetectionService } from '../../src/modules/rag-proxy/services/rag-gamme-detection.service';
import { RagPhase2aShadowAuditService } from '../../src/modules/rag-proxy/services/rag-phase2a-shadow-audit.service';
import { WebhookAuditService } from '../../src/modules/rag-proxy/services/webhook-audit.service';

const VIDEO_CONTENT = Buffer.from('contenu de vidéo pour le test');
const OUTSIDE_CONTENT = 'fichier hors du répertoire des vidéos';

const sha256 = (value: Buffer | string): string =>
  createHash('sha256').update(value).digest('hex');

/** Nom tel que l'ingestion l'écrit : sha256 du contenu + extension. */
const VALID_HASH = sha256(VIDEO_CONTENT);
const VALID_NAME = `${VALID_HASH}.mp4`;
const ABSENT_NAME = `${sha256('absent')}.mp4`;
const LINK_OUT_NAME = `${sha256('lien sortant')}.mp4`;
const DIRECTORY_NAME = `${sha256('répertoire')}.mp4`;
const OUTSIDE_NAME = 'hors-repertoire.txt';

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  m4v: 'video/mp4',
};

describe('Service des vidéos RAG — nom de fichier et répertoire', () => {
  let app: INestApplication;
  let service: RagVideoManagementService;
  let tmpRoot: string;
  let videoDir: string;
  let outsideSibling: string;
  let outsideRoot: string;

  beforeAll(async () => {
    tmpRoot = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'rag-video-')));
    mockRagConfig.knowledgePath = path.join(tmpRoot, 'knowledge');
    videoDir = path.join(mockRagConfig.knowledgePath, '_raw', 'videos');
    mkdirSync(videoDir, { recursive: true });

    // Fichiers servis : un par extension de la liste d'administration.
    for (const ext of Object.keys(MIME_BY_EXT)) {
      writeFileSync(path.join(videoDir, `${VALID_HASH}.${ext}`), VIDEO_CONTENT);
    }

    // Fichiers présents dans le répertoire mais qui ne sont pas des vidéos servies.
    writeFileSync(path.join(videoDir, `${VALID_HASH}.prompt.md`), 'sidecar');
    writeFileSync(path.join(videoDir, `${VALID_HASH}.json`), '{}');
    writeFileSync(path.join(videoDir, `${VALID_HASH}.avi`), VIDEO_CONTENT);
    writeFileSync(path.join(videoDir, 'notes.txt'), 'notes');
    writeFileSync(
      path.join(videoDir, `${VALID_HASH.toUpperCase()}.mp4`),
      VIDEO_CONTENT,
    );
    writeFileSync(
      path.join(videoDir, `${VALID_HASH.slice(0, 16)}.mp4`),
      VIDEO_CONTENT,
    );
    mkdirSync(path.join(videoDir, DIRECTORY_NAME));

    // Fichiers hors du répertoire, et un lien du répertoire vers l'un d'eux.
    outsideSibling = path.join(videoDir, '..', OUTSIDE_NAME);
    outsideRoot = path.join(tmpRoot, OUTSIDE_NAME);
    writeFileSync(outsideSibling, OUTSIDE_CONTENT);
    writeFileSync(outsideRoot, OUTSIDE_CONTENT);
    symlinkSync(outsideRoot, path.join(videoDir, LINK_OUT_NAME));

    service = new RagVideoManagementService({} as ConfigService);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RagProxyController],
      providers: [
        { provide: RagProxyService, useValue: {} },
        { provide: RagCleanupService, useValue: {} },
        { provide: RagImageManagementService, useValue: {} },
        { provide: RagVideoManagementService, useValue: service },
        { provide: RagGammeDetectionService, useValue: {} },
        { provide: RagPhase2aShadowAuditService, useValue: {} },
        { provide: WebhookAuditService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const get = (rawName: string) =>
    request(app.getHttpServer())
      .get(`/api/rag/videos/${rawName}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

  describe('GET /api/rag/videos/:hashWithExt', () => {
    it.each(Object.entries(MIME_BY_EXT))(
      'sert un nom valide en .%s avec ses en-têtes',
      async (ext, mime) => {
        const response = await get(`${VALID_HASH}.${ext}`).expect(200);

        expect(response.headers['content-type']).toBe(mime);
        expect(response.headers['cache-control']).toBe(
          'public, max-age=31536000, immutable',
        );
        expect(response.headers['accept-ranges']).toBe('bytes');
        expect(response.headers['content-length']).toBe(
          String(VIDEO_CONTENT.length),
        );
        expect(Buffer.compare(response.body, VIDEO_CONTENT)).toBe(0);
      },
    );

    const refused: Array<[string, () => string]> = [
      ['séparateur encodé', () => `..%2F${OUTSIDE_NAME}`],
      ['séparateur et points encodés', () => `%2e%2e%2F${OUTSIDE_NAME}`],
      ['remontée de plusieurs niveaux', () => `..%2F..%2F..%2F${OUTSIDE_NAME}`],
      ['double encodage', () => `%252e%252e%252F${OUTSIDE_NAME}`],
      ['barre oblique inversée', () => `..%5C${OUTSIDE_NAME}`],
      ['chemin absolu', () => encodeURIComponent(outsideRoot)],
      ['octet nul après un nom valide', () => `${VALID_NAME}%00`],
      ['octet nul avant une autre extension', () => `${VALID_NAME}%00.txt`],
      ['nom valide suivi d’un séparateur', () => `${VALID_NAME}%2F`],
      ['saut de ligne final', () => `${VALID_NAME}%0A`],
      ['lien symbolique sortant', () => LINK_OUT_NAME],
      ['répertoire au nom de vidéo', () => DIRECTORY_NAME],
      ['fichier compagnon .prompt.md', () => `${VALID_HASH}.prompt.md`],
      ['fichier compagnon .json', () => `${VALID_HASH}.json`],
      ['extension hors liste', () => `${VALID_HASH}.avi`],
      ['extension en majuscules', () => `${VALID_HASH}.MP4`],
      ['empreinte en majuscules', () => `${VALID_HASH.toUpperCase()}.mp4`],
      ['empreinte de 16 caractères', () => `${VALID_HASH.slice(0, 16)}.mp4`],
      ['nom libre', () => 'notes.txt'],
      ['nom valide absent du disque', () => ABSENT_NAME],
    ];

    it.each(refused)('répond 404 : %s', async (_label, rawName) => {
      const response = await get(rawName()).expect(404);

      expect(response.body.toString('utf-8')).not.toContain(OUTSIDE_CONTENT);
    });

    it('répond la même chose à tout nom refusé, sans le répéter', async () => {
      const reference = JSON.parse(
        (await get(ABSENT_NAME).expect(404)).body.toString('utf-8'),
      );
      expect(JSON.stringify(reference)).not.toContain(ABSENT_NAME);

      for (const [, rawName] of refused) {
        const response = await get(rawName()).expect(404);
        expect(JSON.parse(response.body.toString('utf-8'))).toEqual(reference);
      }
    });
  });

  describe('streamVideo (appel direct)', () => {
    const fakeResponse = () =>
      ({ setHeader: jest.fn() }) as unknown as Response & {
        setHeader: jest.Mock;
      };

    it.each([
      ['séparateur', () => `../${OUTSIDE_NAME}`],
      [
        'séparateur après un nom valide',
        () => `${VALID_NAME}/../${VALID_NAME}`,
      ],
      ['chemin absolu', () => outsideRoot],
      [
        'chemin absolu vers un nom valide',
        () => path.join(videoDir, VALID_NAME),
      ],
      ['octet nul', () => `${VALID_NAME}\0`],
      ['chaîne vide', () => ''],
      ['point seul', () => '.'],
      ['lien symbolique sortant', () => LINK_OUT_NAME],
      ['valeur qui n’est pas une chaîne', () => undefined as unknown as string],
    ])('refuse sans rien écrire dans la réponse : %s', (_label, name) => {
      const res = fakeResponse();

      expect(() => service.streamVideo(name(), res)).toThrow(NotFoundException);
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('deleteVideo', () => {
    it('ne supprime rien pour un nom qui n’est pas celui d’un fichier du répertoire', () => {
      for (const name of [`../${OUTSIDE_NAME}`, '..', outsideRoot]) {
        expect(() => service.deleteVideo(name)).toThrow(NotFoundException);
      }

      expect(existsSync(outsideSibling)).toBe(true);
      expect(existsSync(outsideRoot)).toBe(true);
      expect(existsSync(path.join(videoDir, VALID_NAME))).toBe(true);
    });
  });
});
