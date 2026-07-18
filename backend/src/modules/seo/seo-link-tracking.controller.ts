/**
 * 📊 SEO Link Tracking Controller
 *
 * Endpoints pour le tracking des liens internes (maillage SEO)
 *
 * Endpoints:
 * - POST /api/seo/track-click : Enregistre un clic sur lien interne
 * - POST /api/seo/track-impression : Enregistre une impression de liens
 * - GET /api/seo/metrics/:linkType : Métriques par type de lien
 * - GET /api/seo/metrics/report : Rapport complet de performance
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Headers,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import {
  SeoLinkTrackingService,
  LinkClickEvent,
  LinkImpressionEvent,
  LinkMetrics,
  LinkPerformanceReport,
} from './infrastructure/seo-link-tracking.service';
import { z } from 'zod';

// ── Body schemas (public, unauthenticated beacon endpoints) ────────────────
// These POST endpoints are hit fire-and-forget via `navigator.sendBeacon`
// (frontend/app/utils/beacon.ts). Being public, they ALSO receive empty-body,
// wrong-content-type, bot and aborted requests — for those the custom
// body-parser in `main.ts` (`body-parser.json()`, default
// `type: 'application/json'`) never populates `req.body`, so `@Body()` binds to
// `undefined`. Validating with `safeParse` (and treating a malformed body as a
// silent no-op) mirrors the governed sibling beacon `LandingAttributionController`
// and prevents the 500 previously reported to Sentry
// (`TypeError: reading 'linkType'`). Unknown extra keys are stripped, never a
// hard reject, so a slightly richer client payload can't drop legit telemetry.

const DEVICE_TYPES = ['mobile', 'desktop', 'tablet'] as const;
const LINK_POSITIONS = [
  'header',
  'content',
  'sidebar',
  'footer',
  'crossselling',
  'voiraussi',
  'blog',
] as const;

const TrackClickSchema = z.object({
  linkType: z.string().min(1),
  sourceUrl: z.string().min(1),
  destinationUrl: z.string().min(1),
  anchorText: z.string().optional(),
  // Constrained optionals use `.catch(undefined)` so an out-of-range value drops
  // that single field instead of failing (and dropping) the whole beacon.
  linkPosition: z.enum(LINK_POSITIONS).optional().catch(undefined),
  sessionId: z.string().optional(),
  deviceType: z.enum(DEVICE_TYPES).optional().catch(undefined),
  userAgent: z.string().optional(),
  referer: z.string().optional(),
  // A/B Testing fields
  switchVerbId: z.number().optional().catch(undefined),
  switchNounId: z.number().optional().catch(undefined),
  switchFormula: z.string().optional(),
  targetGammeId: z.number().optional().catch(undefined),
});

const TrackImpressionSchema = z.object({
  linkType: z.string().min(1),
  pageUrl: z.string().min(1),
  linkCount: z.number(),
  sessionId: z.string().optional(),
});

@ApiTags('SEO Link Tracking')
@Controller('api/seo')
export class SeoLinkTrackingController {
  private readonly logger = new Logger(SeoLinkTrackingController.name);

  constructor(private readonly trackingService: SeoLinkTrackingService) {}

  /**
   * Enregistre un clic sur un lien interne
   */
  @Post('track-click')
  @ApiOperation({ summary: 'Track un clic sur lien interne' })
  @ApiResponse({ status: 201, description: 'Clic enregistré' })
  async trackClick(
    @Body() body: unknown,
    @Headers('user-agent') userAgent?: string,
    @Headers('referer') referer?: string,
  ): Promise<{ success: boolean }> {
    const parsed = TrackClickSchema.safeParse(body);
    if (!parsed.success) {
      // Empty/malformed/bot request to a public beacon endpoint → observable
      // no-op, never a 500 (cf. Sentry TypeError on undefined body).
      this.logger.debug(
        `track-click: body absent/malformed — no-op (${parsed.error.message})`,
      );
      return { success: false };
    }
    const dto = parsed.data;

    // Détecter le type de device (utiliser celui du DTO si fourni)
    const deviceType = dto.deviceType || this.detectDeviceType(userAgent);

    const event: LinkClickEvent = {
      linkType: dto.linkType,
      sourceUrl: dto.sourceUrl,
      destinationUrl: dto.destinationUrl,
      anchorText: dto.anchorText,
      linkPosition: dto.linkPosition,
      sessionId: dto.sessionId,
      userAgent: dto.userAgent || userAgent,
      referer: dto.referer || referer,
      deviceType,
      // A/B Testing fields
      switchVerbId: dto.switchVerbId,
      switchNounId: dto.switchNounId,
      switchFormula: dto.switchFormula,
      targetGammeId: dto.targetGammeId,
    };

    const success = await this.trackingService.trackClick(event);

    this.logger.debug(
      `📊 Track click: ${dto.linkType} | ${dto.sourceUrl} -> ${dto.destinationUrl} | ${deviceType}${dto.switchFormula ? ` | formula: ${dto.switchFormula}` : ''}`,
    );

    return { success };
  }

  /**
   * Enregistre une impression de liens (page vue)
   */
  @Post('track-impression')
  @ApiOperation({ summary: 'Track une impression de liens' })
  @ApiResponse({ status: 201, description: 'Impression enregistrée' })
  async trackImpression(@Body() body: unknown): Promise<{ success: boolean }> {
    const parsed = TrackImpressionSchema.safeParse(body);
    if (!parsed.success) {
      // Empty/malformed/bot request to a public beacon endpoint → observable
      // no-op, never a 500 (cf. Sentry TypeError on undefined body).
      this.logger.debug(
        `track-impression: body absent/malformed — no-op (${parsed.error.message})`,
      );
      return { success: false };
    }

    const event: LinkImpressionEvent = parsed.data;

    const success = await this.trackingService.trackImpression(event);
    return { success };
  }

  /**
   * Rapport complet de performance des liens internes
   * ⚠️ Route statique AVANT la route dynamique :linkType
   */
  @Get('metrics/report')
  @ApiOperation({ summary: 'Rapport complet de performance SEO' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Date de début (ISO)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Date de fin (ISO)',
  })
  @ApiResponse({ status: 200, description: 'Rapport de performance' })
  async getPerformanceReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<LinkPerformanceReport> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.trackingService.getPerformanceReport(start, end);
  }

  /**
   * Récupère les métriques pour un type de lien
   */
  @Get('metrics/:linkType')
  @ApiOperation({ summary: 'Métriques par type de lien' })
  @ApiParam({
    name: 'linkType',
    description: 'Type de lien (LinkGammeCar, CrossSelling, etc.)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Date de début (ISO)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Date de fin (ISO)',
  })
  @ApiResponse({ status: 200, description: 'Métriques du lien' })
  async getMetricsByLinkType(
    @Param('linkType') linkType: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<LinkMetrics | null> {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    return this.trackingService.getMetricsByLinkType(linkType, start, end);
  }

  /**
   * Détecte le type de device depuis le User-Agent
   */
  private detectDeviceType(
    userAgent?: string,
  ): 'mobile' | 'desktop' | 'tablet' {
    if (!userAgent) return 'desktop';

    const ua = userAgent.toLowerCase();

    // Tablettes
    if (
      ua.includes('ipad') ||
      (ua.includes('android') && !ua.includes('mobile'))
    ) {
      return 'tablet';
    }

    // Mobile
    if (
      ua.includes('mobile') ||
      ua.includes('iphone') ||
      ua.includes('android') ||
      ua.includes('windows phone')
    ) {
      return 'mobile';
    }

    return 'desktop';
  }

  /**
   * 📊 Agrège les métriques quotidiennes (appelé par cron job)
   */
  @Post('aggregate')
  @ApiOperation({ summary: 'Agrège les métriques quotidiennes (cron job)' })
  @ApiResponse({ status: 200, description: 'Agrégation effectuée' })
  async aggregateDailyMetrics(): Promise<{
    success: boolean;
    message: string;
    aggregatedDate?: string;
  }> {
    this.logger.log('📊 Déclenchement agrégation métriques quotidiennes...');
    return this.trackingService.aggregateDailyMetrics();
  }

  /**
   * 🧹 Nettoie les anciennes données brutes
   */
  @Post('cleanup')
  @ApiOperation({ summary: 'Nettoie les données de plus de 90 jours' })
  @ApiQuery({
    name: 'daysToKeep',
    required: false,
    description: 'Nombre de jours à conserver (défaut: 90)',
  })
  @ApiResponse({ status: 200, description: 'Nettoyage effectué' })
  async cleanupOldData(@Query('daysToKeep') daysToKeep?: string): Promise<{
    success: boolean;
    deletedClicks: number;
    deletedImpressions: number;
  }> {
    const days = daysToKeep ? parseInt(daysToKeep, 10) : 90;
    this.logger.log(`🧹 Déclenchement nettoyage données > ${days} jours...`);
    return this.trackingService.cleanupOldData(days);
  }
}
