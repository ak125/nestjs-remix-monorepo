/**
 * SEO V4 Switch Engine Service
 *
 * Extracted from dynamic-seo-v4-ultimate.service.ts
 * Handles all switch/interpolation processing:
 * - CompSwitch (generic + gamme-specific + aliased)
 * - LinkGammeCar (internal links)
 * - FamilySwitch (alias 1-16)
 * - External gamme switches (batch processing)
 */

import { Injectable, Logger } from '@nestjs/common';
import { TABLES } from '@repo/database-types';
import { SupabaseBaseService } from '../../../database/services/supabase-base.service';
import { FAMILY_SWITCH_DEFAULTS } from '../seo-v4.types';

@Injectable()
export class SeoV4SwitchEngineService extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoV4SwitchEngineService.name);

  // Cache for switch data (separate from main SEO cache)
  private switchCache = new Map<string, { data: any; expires: number }>();
  private readonly CACHE_TTL_MEDIUM = 900000; // 15 min
  private readonly CACHE_TTL_LONG = 3600000; // 1 heure

  // ====================================
  // 🔧 CACHE HELPERS
  // ====================================

  private getCachedData(key: string): any {
    const cached = this.switchCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.switchCache.set(key, {
      data,
      expires: Date.now() + ttl,
    });
  }

  // ====================================
  // 🚀 EXTERNAL SWITCHES (BATCH)
  // ====================================

  async processExternalSwitchesEnhanced(
    content: string,
    typeId: number,
  ): Promise<string> {
    const cacheKey = `gammes:external:${typeId}`;
    let allGammes = this.getCachedData(cacheKey);

    if (!allGammes) {
      const { data } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias')
        .eq('pg_display', true)
        .in('pg_level', [1, 2])
        .order('pg_id');

      allGammes = data || [];
      this.setCachedData(cacheKey, allGammes, this.CACHE_TTL_MEDIUM);
    }

    let processed = content;

    // Traitement par batch pour performance
    const batchSize = 10;
    for (let i = 0; i < allGammes.length; i += batchSize) {
      const batch = allGammes.slice(i, i + batchSize);
      const batchPromises = batch.map((gamme: any) =>
        this.processSingleGammeSwitch(processed, gamme.pg_id, typeId),
      );

      const results = await Promise.all(batchPromises);
      results.forEach((result) => {
        if (result.processed !== processed) {
          processed = result.processed;
        }
      });
    }

    return processed;
  }

  async processSingleGammeSwitch(
    content: string,
    thisPgId: number,
    typeId: number,
  ): Promise<{ processed: string; switchesFound: number }> {
    let processed = content;
    let switchesFound = 0;

    // Vérification rapide des patterns avant requête DB
    const hasSimplePattern = new RegExp(`#CompSwitch_${thisPgId}#`).test(
      content,
    );
    const hasAliasPatterns = /CompSwitch_[123]_\d+#/.test(content);

    if (!hasSimplePattern && !hasAliasPatterns) {
      return { processed, switchesFound };
    }

    // Cache par gamme
    const cacheKey = `switches:gamme:${thisPgId}`;
    let switches = this.getCachedData(cacheKey);

    if (!switches) {
      const { data } = await this.supabase
        .from(TABLES.seo_gamme_car_switch)
        .select('sgcs_content, sgcs_alias')
        .eq('sgcs_pg_id', thisPgId);

      switches = data || [];
      this.setCachedData(cacheKey, switches, this.CACHE_TTL_MEDIUM);
    }

    // CompSwitch simple
    if (hasSimplePattern) {
      const simpleRegex = new RegExp(`#CompSwitch_${thisPgId}#`, 'g');
      if (switches.length > 0) {
        const index = (typeId + thisPgId) % switches.length;
        processed = processed.replace(
          simpleRegex,
          switches[index].sgcs_content || '',
        );
        switchesFound++;
      }
    }

    // CompSwitch avec alias
    for (let alias = 1; alias <= 3; alias++) {
      const aliasRegex = new RegExp(`#CompSwitch_${alias}_${thisPgId}#`, 'g');
      if (aliasRegex.test(processed)) {
        const aliasSwitches = switches.filter(
          (s: any) => s.sgcs_alias === alias,
        );
        if (aliasSwitches.length > 0) {
          const index = (typeId + thisPgId + alias) % aliasSwitches.length;
          processed = processed.replace(
            aliasRegex,
            aliasSwitches[index].sgcs_content || '',
          );
          switchesFound++;
        }
      }
    }

    return { processed, switchesFound };
  }

  // ====================================
  // 🔧 COMP SWITCH (GENERIC)
  // ====================================

  async processCompSwitch(processed: string): Promise<string> {
    if (!/#CompSwitch(?:_[1-3])?#/g.test(processed)) {
      return processed;
    }

    processed = processed.replace(/#CompSwitch#/g, 'nos experts automobiles');
    processed = processed.replace(/#CompSwitch_1#/g, 'notre équipe technique');
    processed = processed.replace(
      /#CompSwitch_2#/g,
      'nos spécialistes pièces auto',
    );
    processed = processed.replace(/#CompSwitch_3#/g, 'notre service qualité');

    return processed;
  }

  // ====================================
  // 🔗 LINK GAMME CAR
  // ====================================

  async processLinkGammeCar(processed: string): Promise<string> {
    if (!/#LinkGammeCar(?:_\d+)?#/g.test(processed)) {
      return processed;
    }

    const cacheKey = 'gammes:popular:links';
    let popularGammes = this.getCachedData(cacheKey);

    if (!popularGammes) {
      const { data } = await this.supabase
        .from(TABLES.pieces_gamme)
        .select('pg_id, pg_name, pg_alias, pg_url_slug')
        .eq('pg_display', true)
        .in('pg_level', [1, 2])
        .order('pg_id')
        .limit(20);

      popularGammes = data || [];
      this.setCachedData(cacheKey, popularGammes, this.CACHE_TTL_LONG);
    }

    // LinkGammeCar générique
    if (popularGammes.length > 0) {
      const mainGamme = popularGammes[0];
      const link = `<a href="/gammes/${mainGamme.pg_url_slug || mainGamme.pg_id}" class="link-gamme-internal">${mainGamme.pg_name}</a>`;
      processed = processed.replace(/#LinkGammeCar#/g, link);
    }

    // LinkGammeCar avec ID spécifique (#LinkGammeCar_123#)
    const linkPattern = /#LinkGammeCar_(\d+)#/g;
    const matches = processed.matchAll(linkPattern);

    for (const match of matches) {
      const gammeId = parseInt(match[1], 10);
      const gamme = popularGammes.find((g: any) => g.pg_id === gammeId);

      if (gamme) {
        const link = `<a href="/gammes/${gamme.pg_url_slug || gamme.pg_id}" class="link-gamme-internal">${gamme.pg_name}</a>`;
        processed = processed.replace(
          new RegExp(`#LinkGammeCar_${gammeId}#`, 'g'),
          link,
        );
      } else {
        processed = processed.replace(
          new RegExp(`#LinkGammeCar_${gammeId}#`, 'g'),
          'nos pièces auto',
        );
      }
    }

    return processed;
  }

  // ====================================
  // 🔧 GAMME SWITCHES (no-op)
  // ====================================

  async processGammeSwitches(processed: string): Promise<string> {
    return processed;
  }

  // ====================================
  // 👨‍👩‍👧 FAMILY SWITCHES
  // ====================================

  async processFamilySwitchesEnhanced(processed: string): Promise<string> {
    if (!/#FamilySwitch_\d+#/g.test(processed)) {
      return processed;
    }

    for (let alias = 1; alias <= 16; alias++) {
      const pattern = new RegExp(`#FamilySwitch_${alias}#`, 'g');
      if (pattern.test(processed)) {
        const defaultText = FAMILY_SWITCH_DEFAULTS[alias] || 'nos pièces auto';
        processed = processed.replace(pattern, defaultText);
      }
    }

    return processed;
  }

  // ====================================
  // 🔗 ALL LINKS (no-op)
  // ====================================

  async processAllLinksEnhanced(processed: string): Promise<string> {
    return processed;
  }
}
