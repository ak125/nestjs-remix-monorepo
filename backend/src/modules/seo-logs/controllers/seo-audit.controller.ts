import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SeoAuditSchedulerService } from '../services/seo-audit-scheduler.service';
import { getErrorMessage } from '../../../common/utils/error.utils';

const execAsync = promisify(exec);

interface AuditReport {
  audit_date: string;
  sitemap_url: string;
  total_urls: number;
  sample_size: number;
  results: {
    xsd_validation: string;
    noindex_urls: number;
    http_errors: number;
    hreflang_errors: number;
    canonical_divergent: number;
  };
  summary: {
    total_errors: number;
    total_warnings: number;
    status: 'PASS' | 'FAIL';
  };
  output_dir: string;
}

/**
 * 🔍 Contrôleur pour les audits SEO hebdomadaires
 *
 * Gère la validation du sitemap et la détection d'incohérences SEO
 */
@ApiTags('SEO Audit')
@Controller('seo-logs/audit')
export class SeoAuditController {
  private readonly scriptsPath = path.join(
    process.cwd(),
    '..',
    'scripts',
    'seo-audit-weekly.sh',
  );

  constructor(private readonly schedulerService: SeoAuditSchedulerService) {}

  /**
   * 🚀 Déclencher un audit SEO complet (via BullMQ)
   *
   * Lance un job BullMQ qui exécute l'audit en background
   */
  @Post('run')
  @ApiOperation({
    summary: 'Lancer un audit SEO',
    description:
      'Déclenche un audit complet du sitemap via BullMQ (exécution en background)',
  })
  async runAudit() {
    try {
      const job = await this.schedulerService.triggerManualAudit('api');

      return {
        success: true,
        message: 'Audit job créé avec succès',
        data: {
          jobId: job.id,
          jobName: job.name,
          status: 'queued',
          message:
            "L'audit s'exécute en background. Utilisez /audit/job/:id pour suivre la progression.",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        message: "Erreur lors de la création du job d'audit",
      };
    }
  }

  /**
   * 📊 Statistiques de la queue BullMQ
   */
  @Get('queue/stats')
  @ApiOperation({
    summary: 'Statistiques de la queue',
    description: "État actuel de la queue d'audits BullMQ",
  })
  async getQueueStats() {
    const stats = await this.schedulerService.getQueueStats();

    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 📋 Jobs récents
   */
  @Get('queue/jobs')
  @ApiOperation({
    summary: 'Jobs récents',
    description: "Liste des jobs d'audit récents avec leur statut",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  async getRecentJobs(@Query('limit') limit: number = 10) {
    const jobs = await this.schedulerService.getRecentJobs(limit);

    return {
      success: true,
      data: {
        total: jobs.length,
        jobs,
      },
    };
  }

  /**
   * 🚀 LEGACY: Déclencher un audit SEO complet (synchrone)
   *
   * @deprecated Utilisez POST /audit/run (async via BullMQ)
   */
  @Post('run-sync')
  @ApiOperation({
    summary: '[DEPRECATED] Lancer un audit SEO synchrone',
    description: 'Exécution synchrone (peut timeout). Préférez POST /audit/run',
  })
  async runAuditSync() {
    try {
      const { stdout, stderr } = await execAsync(this.scriptsPath, {
        env: {
          ...process.env,
          SITEMAP_URL:
            process.env.SITEMAP_URL || 'https://automecanik.fr/sitemap.xml',
          LOKI_URL: process.env.LOKI_URL || 'http://loki:3100',
          MEILISEARCH_HOST:
            process.env.MEILISEARCH_HOST || 'http://localhost:7700',
          MEILISEARCH_API_KEY: process.env.MEILISEARCH_API_KEY,
        },
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      // Extraire le chemin du rapport depuis stdout
      const outputDirMatch = stdout.match(/output_dir":\s*"([^"]+)"/);
      const outputDir = outputDirMatch
        ? outputDirMatch[1]
        : `/tmp/seo-audit-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

      // Lire le rapport JSON
      const reportPath = path.join(outputDir, 'audit-report.json');
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report: AuditReport = JSON.parse(reportContent);

      return {
        success: true,
        message: 'Audit terminé avec succès',
        data: report,
        logs: {
          stdout: stdout.substring(0, 5000), // Limiter la taille
          stderr: stderr || null,
        },
      };
    } catch (error) {
      const execError = error as {
        message?: string;
        stdout?: string;
        stderr?: string;
      };
      return {
        success: false,
        error: getErrorMessage(error),
        message: "Erreur lors de l'exécution de l'audit",
        logs: {
          stdout: execError.stdout?.substring(0, 5000),
          stderr: execError.stderr?.substring(0, 5000),
        },
      };
    }
  }

  /**
   * 📊 Récupérer le dernier rapport d'audit
   */
  @Get('latest')
  @ApiOperation({
    summary: "Dernier rapport d'audit",
    description:
      "Récupère le dernier rapport d'audit disponible avec détails complets",
  })
  async getLatestReport() {
    try {
      // Trouver le répertoire d'audit le plus récent
      const tmpDir = '/tmp';
      const { stdout } = await execAsync(
        `ls -td ${tmpDir}/seo-audit-* 2>/dev/null | head -1`,
      );

      const latestDir = stdout.trim();

      if (!latestDir) {
        return {
          success: false,
          message: "Aucun rapport d'audit trouvé",
        };
      }

      // Lire le rapport principal
      const reportPath = path.join(latestDir, 'audit-report.json');
      const reportContent = await fs.readFile(reportPath, 'utf-8');
      const report: AuditReport = JSON.parse(reportContent);

      // Lire les fichiers de détails
      const details: any = {};

      try {
        details.noindexUrls = (
          await fs.readFile(path.join(latestDir, 'noindex-urls.txt'), 'utf-8')
        )
          .split('\n')
          .filter((line) => line.trim());
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        details.noindexUrls = [];
      }

      try {
        details.errorUrls = (
          await fs.readFile(path.join(latestDir, 'error-urls.txt'), 'utf-8')
        )
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => {
            const [status, ...urlParts] = line.split(' ');
            return { status, url: urlParts.join(' ') };
          });
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        details.errorUrls = [];
      }

      try {
        details.hreflangErrors = (
          await fs.readFile(
            path.join(latestDir, 'hreflang-errors.txt'),
            'utf-8',
          )
        )
          .split('\n')
          .filter((line) => line.trim());
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        details.hreflangErrors = [];
      }

      try {
        details.canonicalErrors = (
          await fs.readFile(
            path.join(latestDir, 'canonical-errors.txt'),
            'utf-8',
          )
        )
          .split('\n')
          .filter((line) => line.trim());
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        details.canonicalErrors = [];
      }

      return {
        success: true,
        data: {
          ...report,
          details,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        message: 'Erreur lors de la lecture du rapport',
      };
    }
  }

  /**
   * 📜 Historique des audits
   */
  @Get('history')
  @ApiOperation({
    summary: 'Historique des audits',
    description: "Liste tous les rapports d'audit disponibles",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
  })
  async getAuditHistory(@Query('limit') limit: number = 10) {
    try {
      const tmpDir = '/tmp';
      const { stdout } = await execAsync(
        `ls -td ${tmpDir}/seo-audit-* 2>/dev/null | head -${limit}`,
      );

      const auditDirs = stdout.trim().split('\n').filter(Boolean);

      if (auditDirs.length === 0) {
        return {
          success: true,
          data: {
            total: 0,
            audits: [],
          },
        };
      }

      // Lire tous les rapports
      const audits = await Promise.all(
        auditDirs.map(async (dir) => {
          try {
            const reportPath = path.join(dir, 'audit-report.json');
            const content = await fs.readFile(reportPath, 'utf-8');
            return JSON.parse(content);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_e) {
            return null;
          }
        }),
      );

      const validAudits = audits.filter((a) => a !== null);

      return {
        success: true,
        data: {
          total: validAudits.length,
          audits: validAudits,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        message: "Erreur lors de la récupération de l'historique",
      };
    }
  }

  /**
   * 📈 Statistiques d'évolution
   *
   * Compare les audits pour détecter les tendances
   */
  @Get('trends')
  @ApiOperation({
    summary: 'Tendances SEO',
    description: "Analyse l'évolution des métriques SEO au fil du temps",
  })
  @ApiQuery({
    name: 'period',
    required: false,
    type: Number,
    example: 30,
    description: 'Période en jours',
  })
  async getTrends(@Query('period') period: number = 30) {
    try {
      const { stdout } = await execAsync(
        `find /tmp -name 'seo-audit-*' -type d -mtime -${period} | sort`,
      );

      const auditDirs = stdout.trim().split('\n').filter(Boolean);

      if (auditDirs.length < 2) {
        return {
          success: true,
          message: 'Pas assez de données pour analyser les tendances',
          data: null,
        };
      }

      // Lire tous les rapports de la période
      const audits: AuditReport[] = [];

      for (const dir of auditDirs) {
        try {
          const reportPath = path.join(dir, 'audit-report.json');
          const content = await fs.readFile(reportPath, 'utf-8');
          audits.push(JSON.parse(content));
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
          // Ignorer les rapports corrompus
        }
      }

      // Calculer les tendances
      const firstAudit = audits[0];
      const lastAudit = audits[audits.length - 1];

      const trends = {
        period_days: period,
        total_audits: audits.length,
        first_audit_date: firstAudit.audit_date,
        last_audit_date: lastAudit.audit_date,
        evolution: {
          total_errors: {
            first: firstAudit.summary.total_errors,
            last: lastAudit.summary.total_errors,
            change:
              lastAudit.summary.total_errors - firstAudit.summary.total_errors,
            trend:
              lastAudit.summary.total_errors > firstAudit.summary.total_errors
                ? '📈 DÉGRADATION'
                : lastAudit.summary.total_errors <
                    firstAudit.summary.total_errors
                  ? '📉 AMÉLIORATION'
                  : '➡️ STABLE',
          },
          noindex_urls: {
            first: firstAudit.results.noindex_urls,
            last: lastAudit.results.noindex_urls,
            change:
              lastAudit.results.noindex_urls - firstAudit.results.noindex_urls,
          },
          http_errors: {
            first: firstAudit.results.http_errors,
            last: lastAudit.results.http_errors,
            change:
              lastAudit.results.http_errors - firstAudit.results.http_errors,
          },
          hreflang_errors: {
            first: firstAudit.results.hreflang_errors,
            last: lastAudit.results.hreflang_errors,
            change:
              lastAudit.results.hreflang_errors -
              firstAudit.results.hreflang_errors,
          },
        },
        timeline: audits.map((a) => ({
          date: a.audit_date,
          total_errors: a.summary.total_errors,
          total_warnings: a.summary.total_warnings,
          status: a.summary.status,
        })),
      };

      return {
        success: true,
        data: trends,
      };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error),
        message: "Erreur lors de l'analyse des tendances",
      };
    }
  }
}
