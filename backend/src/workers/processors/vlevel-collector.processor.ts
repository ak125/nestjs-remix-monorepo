/**
 * 🔄 V-Level Collector Processor
 *
 * BullMQ Processor pour collecter les données V-Level via WebSearch + Anthropic
 *
 * Jobs:
 * - collect-gamme: Analyser une gamme spécifique
 * - collect-batch: Analyser un batch de gammes
 *
 * Features:
 * - Rate limiting: 1 job/10sec
 * - Backup MinIO avant/après injection
 * - Audit trail dans __seo_sync_runs
 */

import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client as MinioClient } from 'minio';
import {
  VLevelAnalyzerService,
  VLevelResult,
} from '../../modules/seo/services/vlevel-analyzer.service';

/**
 * Interface pour les jobs de collecte single
 */
export interface CollectGammeJobData {
  gammeId: number;
  gammeName: string;
  modelName: string;
  variants: string[];
  webSearchResults: string;
}

/**
 * Interface pour les jobs de collecte batch
 */
export interface CollectBatchJobData {
  items: Array<{
    gammeId: number;
    gammeName: string;
    modelName: string;
    variants: string[];
    webSearchResults: string;
  }>;
  batchId: string;
}

/**
 * Interface pour le résultat d'un job
 */
export interface CollectJobResult {
  success: boolean;
  gammeId: number;
  vLevels?: VLevelResult;
  error?: string;
  backupBefore?: string;
  backupAfter?: string;
}

@Processor('vlevel-collector')
export class VLevelCollectorProcessor {
  private readonly logger = new Logger(VLevelCollectorProcessor.name);
  private readonly supabase: SupabaseClient;
  private readonly minio: MinioClient | null = null;
  private readonly BACKUP_BUCKET = 'seo-backups';

  constructor(
    private configService: ConfigService,
    private vLevelAnalyzer: VLevelAnalyzerService,
  ) {
    // Init Supabase
    this.supabase = createClient(
      this.configService.get('SUPABASE_URL', ''),
      this.configService.get('SUPABASE_SERVICE_ROLE_KEY', ''),
    );

    // Init MinIO (optionnel)
    const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
    if (minioEndpoint) {
      this.minio = new MinioClient({
        endPoint: minioEndpoint,
        port: this.configService.get<number>('MINIO_PORT', 9000),
        useSSL: this.configService.get<boolean>('MINIO_USE_SSL', false),
        accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
        secretKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
      });
      this.logger.log('✅ MinIO client initialisé pour backups');
    } else {
      this.logger.warn('⚠️ MINIO_ENDPOINT non configuré - backups désactivés');
    }

    this.logger.log('🔄 VLevelCollectorProcessor initialisé');
  }

  /**
   * Job: Collecter V-Level pour une gamme
   */
  @Process('collect-gamme')
  async handleCollectGamme(
    job: Job<CollectGammeJobData>,
  ): Promise<CollectJobResult> {
    const { gammeId, gammeName, modelName, variants, webSearchResults } =
      job.data;

    this.logger.log(
      `📊 Collecte V-Level: ${gammeName} + ${modelName} (gamme ${gammeId})`,
    );

    try {
      // 1. Backup AVANT (MinIO)
      const backupBefore = await this.createBackup(gammeId, 'before');

      // 2. Analyser avec VLevelAnalyzerService
      const vLevels = await this.vLevelAnalyzer.analyzeGammeVLevels(
        gammeName,
        modelName,
        variants,
        webSearchResults,
      );

      // 3. Injecter les résultats dans gamme_seo_metrics
      await this.injectVLevelResults(gammeId, vLevels);

      // 4. Backup APRÈS (MinIO)
      const backupAfter = await this.createBackup(gammeId, 'after');

      // 5. Audit trail
      await this.createAuditRecord(gammeId, gammeName, modelName, vLevels);

      this.logger.log(`✅ V-Level collecté pour gamme ${gammeId}`);

      return {
        success: true,
        gammeId,
        vLevels,
        backupBefore,
        backupAfter,
      };
    } catch (error) {
      this.logger.error(
        `❌ Erreur collecte gamme ${gammeId}: ${error.message}`,
        error.stack,
      );

      return {
        success: false,
        gammeId,
        error: error.message,
      };
    }
  }

  /**
   * Job: Collecter V-Level pour un batch de gammes
   */
  @Process('collect-batch')
  async handleCollectBatch(
    job: Job<CollectBatchJobData>,
  ): Promise<CollectJobResult[]> {
    const { items, batchId } = job.data;
    const results: CollectJobResult[] = [];

    this.logger.log(`📦 Batch V-Level: ${items.length} gammes (${batchId})`);

    // Créer un audit record pour le batch
    await this.createBatchAuditRecord(batchId, items.length, 'started');

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Progress update
      await job.progress(Math.round(((i + 1) / items.length) * 100));

      try {
        // Backup AVANT
        const backupBefore = await this.createBackup(item.gammeId, 'before');

        // Analyser
        const vLevels = await this.vLevelAnalyzer.analyzeGammeVLevels(
          item.gammeName,
          item.modelName,
          item.variants,
          item.webSearchResults,
        );

        // Injecter
        await this.injectVLevelResults(item.gammeId, vLevels);

        // Backup APRÈS
        const backupAfter = await this.createBackup(item.gammeId, 'after');

        // Audit
        await this.createAuditRecord(
          item.gammeId,
          item.gammeName,
          item.modelName,
          vLevels,
        );

        results.push({
          success: true,
          gammeId: item.gammeId,
          vLevels,
          backupBefore,
          backupAfter,
        });

        this.logger.log(
          `✅ [${i + 1}/${items.length}] Gamme ${item.gammeId} OK`,
        );
      } catch (error) {
        this.logger.error(
          `❌ [${i + 1}/${items.length}] Gamme ${item.gammeId}: ${error.message}`,
        );

        results.push({
          success: false,
          gammeId: item.gammeId,
          error: error.message,
        });
      }

      // Rate limiting: 10 secondes entre chaque job
      if (i < items.length - 1) {
        await this.sleep(10000);
      }
    }

    // Mettre à jour l'audit du batch
    const successCount = results.filter((r) => r.success).length;
    await this.createBatchAuditRecord(
      batchId,
      items.length,
      'completed',
      successCount,
    );

    this.logger.log(
      `📦 Batch ${batchId} terminé: ${successCount}/${items.length} succès`,
    );

    return results;
  }

  /**
   * Crée un backup dans MinIO
   */
  private async createBackup(
    gammeId: number,
    phase: 'before' | 'after',
  ): Promise<string | undefined> {
    if (!this.minio) return undefined;

    try {
      // Récupérer les données actuelles
      const { data } = await this.supabase
        .from('gamme_seo_metrics')
        .select('*')
        .eq('gamme_id', gammeId.toString());

      if (!data || data.length === 0) return undefined;

      // Créer le fichier de backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${phase}/gamme-${gammeId}/${timestamp}.json`;
      const content = JSON.stringify(data, null, 2);

      // Vérifier que le bucket existe
      const bucketExists = await this.minio.bucketExists(this.BACKUP_BUCKET);
      if (!bucketExists) {
        await this.minio.makeBucket(this.BACKUP_BUCKET, 'eu-west-1');
      }

      // Upload
      await this.minio.putObject(
        this.BACKUP_BUCKET,
        fileName,
        Buffer.from(content),
        content.length,
        { 'Content-Type': 'application/json' },
      );

      this.logger.debug(`📁 Backup créé: ${fileName}`);
      return fileName;
    } catch (error) {
      this.logger.warn(
        `⚠️ Backup échoué pour gamme ${gammeId}: ${error.message}`,
      );
      return undefined;
    }
  }

  /**
   * Injecte les résultats V-Level dans gamme_seo_metrics
   */
  private async injectVLevelResults(
    gammeId: number,
    vLevels: VLevelResult,
  ): Promise<void> {
    const updates: Array<{
      variant_name: string;
      energy: string;
      v_level: string;
      search_volume: number;
    }> = [];

    // Traiter Diesel
    if (vLevels.v_levels.diesel.v2) {
      updates.push({
        variant_name: vLevels.v_levels.diesel.v2,
        energy: 'diesel',
        v_level: 'V2',
        search_volume: 100, // Score relatif V2
      });
    }
    for (const v3 of vLevels.v_levels.diesel.v3) {
      updates.push({
        variant_name: v3,
        energy: 'diesel',
        v_level: 'V3',
        search_volume: 50, // Score relatif V3
      });
    }
    for (const v4 of vLevels.v_levels.diesel.v4) {
      updates.push({
        variant_name: v4,
        energy: 'diesel',
        v_level: 'V4',
        search_volume: 10, // Score relatif V4
      });
    }

    // Traiter Essence
    if (vLevels.v_levels.essence.v2) {
      updates.push({
        variant_name: vLevels.v_levels.essence.v2,
        energy: 'essence',
        v_level: 'V2',
        search_volume: 100,
      });
    }
    for (const v3 of vLevels.v_levels.essence.v3) {
      updates.push({
        variant_name: v3,
        energy: 'essence',
        v_level: 'V3',
        search_volume: 50,
      });
    }
    for (const v4 of vLevels.v_levels.essence.v4) {
      updates.push({
        variant_name: v4,
        energy: 'essence',
        v_level: 'V4',
        search_volume: 10,
      });
    }

    // Upsert dans gamme_seo_metrics
    for (const update of updates) {
      await this.supabase
        .from('gamme_seo_metrics')
        .update({
          v_level: update.v_level,
          search_volume: update.search_volume,
          updated_at: new Date().toISOString(),
        })
        .eq('gamme_id', gammeId.toString())
        .eq('energy', update.energy)
        .ilike('variant_name', `%${update.variant_name}%`);
    }

    this.logger.debug(
      `📊 ${updates.length} variants mis à jour pour gamme ${gammeId}`,
    );
  }

  /**
   * Crée un enregistrement d'audit
   */
  private async createAuditRecord(
    gammeId: number,
    gammeName: string,
    modelName: string,
    vLevels: VLevelResult,
  ): Promise<void> {
    try {
      await this.supabase.from('__seo_sync_runs').insert({
        run_type: 'vlevel-collect',
        target_type: 'gamme',
        target_id: gammeId.toString(),
        status: 'completed',
        details: {
          gammeName,
          modelName,
          v2_diesel: vLevels.v_levels.diesel.v2,
          v2_essence: vLevels.v_levels.essence.v2,
          v3_count:
            vLevels.v_levels.diesel.v3.length +
            vLevels.v_levels.essence.v3.length,
          v4_count:
            vLevels.v_levels.diesel.v4.length +
            vLevels.v_levels.essence.v4.length,
          analysis: vLevels.analysis,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(`⚠️ Audit record échoué: ${error.message}`);
    }
  }

  /**
   * Crée un enregistrement d'audit pour un batch
   */
  private async createBatchAuditRecord(
    batchId: string,
    totalCount: number,
    status: 'started' | 'completed',
    successCount?: number,
  ): Promise<void> {
    try {
      await this.supabase.from('__seo_sync_runs').insert({
        run_type: 'vlevel-batch',
        target_type: 'batch',
        target_id: batchId,
        status,
        details: {
          totalCount,
          successCount: successCount ?? 0,
          startedAt:
            status === 'started' ? new Date().toISOString() : undefined,
          completedAt:
            status === 'completed' ? new Date().toISOString() : undefined,
        },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.warn(`⚠️ Batch audit record échoué: ${error.message}`);
    }
  }

  /**
   * Utilitaire sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
