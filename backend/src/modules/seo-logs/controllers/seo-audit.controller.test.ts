/**
 * Routes `seo-logs/audit` — application Nest réelle (pipes compris), système
 * de fichiers et service d'audit simulés.
 *
 * Prouve : (1) les rapports sont trouvés par l'API fichiers, dans le même
 * ordre qu'avant, avec la même forme de réponse ; (2) une entrée hors contrat
 * reçoit un 400 avant toute lecture ; (3) aucun processus n'est lancé par le
 * contrôleur, quelle que soit l'entrée.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthenticatedGuard } from '@auth/authenticated.guard';
import { IsAdminGuard } from '@auth/is-admin.guard';
import { SeoAuditController } from './seo-audit.controller';
import { SeoAuditSchedulerService } from '../services/seo-audit-scheduler.service';

jest.mock('child_process', () => ({
  exec: jest.fn(),
  execSync: jest.fn(),
  execFile: jest.fn(),
  execFileSync: jest.fn(),
  spawn: jest.fn(),
  spawnSync: jest.fn(),
  fork: jest.fn(),
}));

// Le service réel ouvre une file BullMQ : seul son contrat est utile ici.
jest.mock('../services/seo-audit-scheduler.service', () => ({
  SeoAuditSchedulerService: class SeoAuditSchedulerService {},
}));

// Caractères qu'un interpréteur de commandes traite à part. Chacun est accolé
// à une valeur valide : la requête entière doit être refusée.
const SHELL_SPECIAL_CHARACTERS = [...' \t\n;&|$`\\\'"<>(){}[]*?!#~=%'] as const;

const fsp = jest.requireActual<typeof import('fs/promises')>('fs/promises');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-19T06:00:00Z');

const report = (date: string, errors: number) => ({
  audit_date: date,
  sitemap_url: 'https://sitemap.test/sitemap.xml',
  total_urls: 100,
  sample_size: 10,
  results: {
    xsd_validation: 'PASS',
    noindex_urls: errors,
    http_errors: errors + 1,
    hreflang_errors: 0,
    canonical_divergent: 0,
  },
  summary: {
    total_errors: errors,
    total_warnings: 1,
    status: errors > 0 ? 'FAIL' : 'PASS',
  },
  output_dir: `/tmp/seo-audit-${date}`,
});

interface FakeEntry {
  name: string;
  directory: boolean;
  ageDays: number;
  files?: Record<string, string>;
}

describe('SeoAuditController — sans commande shell, entrées validées', () => {
  let app: INestApplication;
  let readdirMock: jest.SpyInstance;
  let statMock: jest.SpyInstance;
  let readFileMock: jest.SpyInstance;
  const scheduler = {
    triggerManualAudit: jest.fn(),
    getQueueStats: jest.fn(),
    getRecentJobs: jest.fn(),
    runAuditScript: jest.fn(),
  };

  const expectNoProcessLaunched = () => {
    const launchers = Object.values(
      jest.requireMock<Record<string, jest.Mock>>('child_process'),
    );
    expect(launchers).toHaveLength(7);
    for (const launcher of launchers) {
      expect(launcher).not.toHaveBeenCalled();
    }
  };

  const expectNothingRead = () => {
    expect(readdirMock).not.toHaveBeenCalled();
    expect(statMock).not.toHaveBeenCalled();
    expect(readFileMock).not.toHaveBeenCalled();
    expect(scheduler.getRecentJobs).not.toHaveBeenCalled();
    expect(scheduler.runAuditScript).not.toHaveBeenCalled();
  };

  /** Simule le contenu du répertoire de sortie des audits. */
  const givenOutputRoot = (entries: FakeEntry[]) => {
    readdirMock.mockImplementation(async (dir: string) => {
      if (dir !== '/tmp') throw new Error(`lecture inattendue : ${dir}`);
      return entries.map((entry) => ({
        name: entry.name,
        isDirectory: () => entry.directory,
      }));
    });
    statMock.mockImplementation(async (target: string) => {
      const entry = entries.find((e) => `/tmp/${e.name}` === target);
      if (!entry) throw new Error(`ENOENT: ${target}`);
      return { mtimeMs: NOW - entry.ageDays * DAY_MS };
    });
    readFileMock.mockImplementation(async (target: string) => {
      for (const entry of entries) {
        for (const [file, content] of Object.entries(entry.files ?? {})) {
          if (`/tmp/${entry.name}/${file}` === target) return content;
        }
      }
      throw new Error(`ENOENT: ${target}`);
    });
  };

  const auditDir = (date: string, ageDays: number, errors: number) => ({
    name: `seo-audit-${date}`,
    directory: true,
    ageDays,
    files: { 'audit-report.json': JSON.stringify(report(date, errors)) },
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SeoAuditController],
      providers: [{ provide: SeoAuditSchedulerService, useValue: scheduler }],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(IsAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    readdirMock = jest.spyOn(fsp, 'readdir');
    statMock = jest.spyOn(fsp, 'stat');
    readFileMock = jest.spyOn(fsp, 'readFile');
    givenOutputRoot([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /seo-logs/audit/history', () => {
    const entries: FakeEntry[] = [
      auditDir('20261102', 17, 5),
      auditDir('20261116', 3, 2),
      auditDir('20261109', 10, 4),
      // Répertoire au bon préfixe sans rapport lisible : ignoré comme avant
      { name: 'seo-audit-vide', directory: true, ageDays: 1 },
      // Fichier au bon préfixe et répertoire d'un autre nom : jamais listés
      { name: 'seo-audit-notes.log', directory: false, ageDays: 0 },
      { name: 'autre-dossier', directory: true, ageDays: 0 },
    ];

    it('sans paramètre : rapports du plus récent au plus ancien, même forme', async () => {
      givenOutputRoot(entries);

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/audit/history',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          total: 3,
          audits: [
            report('20261116', 2),
            report('20261109', 4),
            report('20261102', 5),
          ],
        },
      });
      expect(readdirMock).toHaveBeenCalledWith('/tmp', {
        withFileTypes: true,
      });
      expectNoProcessLaunched();
    });

    it('limit=2 : les deux répertoires les plus récents seulement', async () => {
      givenOutputRoot(entries);

      const res = await request(app.getHttpServer())
        .get('/seo-logs/audit/history')
        .query({ limit: '2' });

      expect(res.status).toBe(200);
      // Le répertoire sans rapport compte dans la limite, comme avant
      expect(res.body.data).toEqual({
        total: 1,
        audits: [report('20261116', 2)],
      });
    });

    it('aucun répertoire : liste vide', async () => {
      const res = await request(app.getHttpServer())
        .get('/seo-logs/audit/history')
        .query({ limit: '100' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { total: 0, audits: [] },
      });
    });

    it.each([['0'], ['101'], ['-1'], ['1.5'], ['05'], ['abc'], ['']])(
      'refuse limit=%j en 400, sans aucune lecture',
      async (limit) => {
        const res = await request(app.getHttpServer())
          .get('/seo-logs/audit/history')
          .query({ limit });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Validation failed');
        expect(res.body.errors[0].field).toBe('limit');
        expectNothingRead();
        expectNoProcessLaunched();
      },
    );

    it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
      'refuse en 400 une limite accompagnée du caractère %j : rien n’est lu ni lancé',
      async (char) => {
        for (const limit of [`5${char}`, `${char}5`, `1${char}0`]) {
          const res = await request(app.getHttpServer())
            .get('/seo-logs/audit/history')
            .query({ limit });

          expect(res.status).toBe(400);
        }
        expectNothingRead();
        expectNoProcessLaunched();
      },
    );
  });

  describe('GET /seo-logs/audit/trends', () => {
    const entries: FakeEntry[] = [
      auditDir('20261116', 3, 2),
      auditDir('20261026', 24, 6),
      auditDir('20261109', 10, 4),
      auditDir('20260928', 52, 9),
    ];

    it('sans paramètre : 30 jours, audits dans l’ordre de leur nom, même forme', async () => {
      givenOutputRoot(entries);

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/audit/trends',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          period_days: 30,
          total_audits: 3,
          first_audit_date: '20261026',
          last_audit_date: '20261116',
          evolution: {
            total_errors: {
              first: 6,
              last: 2,
              change: -4,
              trend: '📉 AMÉLIORATION',
            },
            noindex_urls: { first: 6, last: 2, change: -4 },
            http_errors: { first: 7, last: 3, change: -4 },
            hreflang_errors: { first: 0, last: 0, change: 0 },
          },
          timeline: [
            {
              date: '20261026',
              total_errors: 6,
              total_warnings: 1,
              status: 'FAIL',
            },
            {
              date: '20261109',
              total_errors: 4,
              total_warnings: 1,
              status: 'FAIL',
            },
            {
              date: '20261116',
              total_errors: 2,
              total_warnings: 1,
              status: 'FAIL',
            },
          ],
        },
      });
      expectNoProcessLaunched();
    });

    it.each([
      ['7', 1],
      ['14', 2],
      ['30', 3],
      ['60', 4],
      ['90', 4],
    ])(
      'accepte period=%s : %i répertoire(s) dans la période',
      async (period, expectedDirs) => {
        givenOutputRoot(entries);

        const res = await request(app.getHttpServer())
          .get('/seo-logs/audit/trends')
          .query({ period });

        expect(res.status).toBe(200);
        if (expectedDirs < 2) {
          expect(res.body).toEqual({
            success: true,
            message: 'Pas assez de données pour analyser les tendances',
            data: null,
          });
        } else {
          expect(res.body.data.period_days).toBe(Number(period));
          expect(res.body.data.total_audits).toBe(expectedDirs);
        }
      },
    );

    it.each([['0'], ['1'], ['31'], ['365'], ['030'], ['30d'], ['-30'], ['']])(
      'refuse period=%j en 400, sans aucune lecture',
      async (period) => {
        const res = await request(app.getHttpServer())
          .get('/seo-logs/audit/trends')
          .query({ period });

        expect(res.status).toBe(400);
        expect(res.body.errors[0].field).toBe('period');
        expectNothingRead();
        expectNoProcessLaunched();
      },
    );

    it.each(SHELL_SPECIAL_CHARACTERS.map((char) => [char]))(
      'refuse en 400 une période accompagnée du caractère %j : rien n’est lu ni lancé',
      async (char) => {
        for (const period of [`30${char}`, `${char}30`, `3${char}0`]) {
          const res = await request(app.getHttpServer())
            .get('/seo-logs/audit/trends')
            .query({ period });

          expect(res.status).toBe(400);
        }
        expectNothingRead();
        expectNoProcessLaunched();
      },
    );
  });

  describe('GET /seo-logs/audit/latest', () => {
    it('rend le rapport du répertoire le plus récent, avec ses détails', async () => {
      const latest = auditDir('20261116', 3, 2);
      latest.files['noindex-urls.txt'] = 'https://x.test/a\nhttps://x.test/b\n';
      latest.files['error-urls.txt'] = '404 https://x.test/c\n';
      givenOutputRoot([auditDir('20261109', 10, 4), latest]);

      const res = await request(app.getHttpServer()).get(
        '/seo-logs/audit/latest',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          ...report('20261116', 2),
          details: {
            noindexUrls: ['https://x.test/a', 'https://x.test/b'],
            errorUrls: [{ status: '404', url: 'https://x.test/c' }],
            hreflangErrors: [],
            canonicalErrors: [],
          },
        },
      });
      expectNoProcessLaunched();
    });

    it('aucun répertoire : même message qu’avant', async () => {
      const res = await request(app.getHttpServer()).get(
        '/seo-logs/audit/latest',
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: false,
        message: "Aucun rapport d'audit trouvé",
      });
    });
  });

  describe('GET /seo-logs/audit/queue/jobs', () => {
    it('transmet une limite entière au service', async () => {
      scheduler.getRecentJobs.mockResolvedValue([{ id: '1' }]);

      const byDefault = await request(app.getHttpServer()).get(
        '/seo-logs/audit/queue/jobs',
      );
      const explicit = await request(app.getHttpServer())
        .get('/seo-logs/audit/queue/jobs')
        .query({ limit: '25' });

      expect(byDefault.status).toBe(200);
      expect(byDefault.body).toEqual({
        success: true,
        data: { total: 1, jobs: [{ id: '1' }] },
      });
      expect(explicit.status).toBe(200);
      expect(scheduler.getRecentJobs.mock.calls).toEqual([[10], [25]]);
    });

    it.each([['0'], ['101'], ['abc'], ['5;']])(
      'refuse limit=%j en 400, sans appel au service',
      async (limit) => {
        const res = await request(app.getHttpServer())
          .get('/seo-logs/audit/queue/jobs')
          .query({ limit });

        expect(res.status).toBe(400);
        expect(scheduler.getRecentJobs).not.toHaveBeenCalled();
      },
    );
  });

  describe('POST /seo-logs/audit/run-sync', () => {
    it('délègue le lancement du script au service et rend la même forme', async () => {
      scheduler.runAuditScript.mockResolvedValue({
        stdout: '{"output_dir": "/tmp/seo-audit-20261116"}',
        stderr: '',
      });
      givenOutputRoot([auditDir('20261116', 3, 2)]);

      const res = await request(app.getHttpServer()).post(
        '/seo-logs/audit/run-sync',
      );

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        success: true,
        message: 'Audit terminé avec succès',
        data: report('20261116', 2),
        logs: {
          stdout: '{"output_dir": "/tmp/seo-audit-20261116"}',
          stderr: null,
        },
      });
      expect(scheduler.runAuditScript).toHaveBeenCalledTimes(1);
      expect(scheduler.runAuditScript).toHaveBeenCalledWith();
      expectNoProcessLaunched();
    });

    it('échec du script : même forme d’erreur', async () => {
      scheduler.runAuditScript.mockRejectedValue(
        Object.assign(new Error('script en échec'), {
          stdout: 'sortie',
          stderr: 'erreur',
        }),
      );

      const res = await request(app.getHttpServer()).post(
        '/seo-logs/audit/run-sync',
      );

      expect(res.body).toEqual({
        success: false,
        error: 'script en échec',
        message: "Erreur lors de l'exécution de l'audit",
        logs: { stdout: 'sortie', stderr: 'erreur' },
      });
    });
  });
});
