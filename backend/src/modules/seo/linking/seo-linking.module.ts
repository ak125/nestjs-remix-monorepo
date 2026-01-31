/**
 * SeoLinkingModule
 *
 * Sous-module dédié au maillage interne SEO :
 * - Internal linking avec rotation verbe+nom (~105k liens)
 * - Tracking des clics sur liens internes
 * - A/B testing des ancres
 *
 * @see .spec/00-canon/architecture.md - SEO Module refactoring
 */
import { Module } from '@nestjs/common';

// 🚀 Cache Redis pour cache warming
import { CacheModule } from '../../../cache/cache.module';

// =====================================================
// SERVICES - Maillage Interne
// =====================================================

import { InternalLinkingService } from '../internal-linking.service';
import { SeoLinkTrackingService } from '../seo-link-tracking.service';

// =====================================================
// CONTROLLERS - API Maillage
// =====================================================

import { SeoLinkTrackingController } from '../seo-link-tracking.controller';
import { SeoVariationsController } from '../seo-variations.controller';

@Module({
  imports: [CacheModule],

  controllers: [
    SeoLinkTrackingController, // POST /api/seo/track-click
    SeoVariationsController, // Variations SEO (A/B testing)
  ],

  providers: [InternalLinkingService, SeoLinkTrackingService],

  exports: [InternalLinkingService, SeoLinkTrackingService],
})
export class SeoLinkingModule {}
