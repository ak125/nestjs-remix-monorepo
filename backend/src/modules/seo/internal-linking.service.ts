/**
 * 🔗 InternalLinkingService - Service centralisé pour le maillage interne SEO
 *
 * Centralise toute la logique des switches SEO avec:
 * - Cache warming au démarrage (OnModuleInit)
 * - Rotation verbe+nom conforme au PHP (SGCS_ALIAS=1+2)
 * - Support A/B testing avec tracking des formulations
 * - Limites configurables via seo-link-limits.config.ts
 *
 * Reproduit le système PHP avec ~105k liens internes
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TABLES } from '@repo/database-types';
import {
  SEO_LINK_LIMITS,
  SEO_AB_TESTING_CONFIG,
  SEO_SWITCH_TYPES,
} from '../../config/seo-link-limits.config';

// =====================================================
// Types
// =====================================================

export interface GammeCarSwitch {
  sgcs_id: number;
  sgcs_pg_id: number;
  sgcs_alias: string; // "1" = verbe, "2" = nom
  sgcs_content: string;
}

export interface ProcessedLink {
  html: string;
  verbId: number | null;
  nounId: number | null;
  formula: string | null;
  targetGammeId: number;
}

export interface LinkInjectionResult {
  content: string;
  linksInjected: number;
  formulas: Array<{
    verbId: number | null;
    nounId: number | null;
    formula: string | null;
    targetGammeId: number;
  }>;
}

export interface VehicleContext {
  marque: string;
  modele: string;
  type: string;
  nbCh: string;
  typeId: number;
}

export interface GammeInfo {
  pg_id: number;
  pg_name: string;
  pg_alias: string;
}

// =====================================================
// Cache Types
// =====================================================

interface CachedSwitches {
  verbs: Map<number, GammeCarSwitch[]>; // pgId -> switches ALIAS=1
  nouns: Map<number, GammeCarSwitch[]>; // pgId -> switches ALIAS=2
  gammes: Map<number, GammeInfo>; // pgId -> gamme info
}

@Injectable()
export class InternalLinkingService implements OnModuleInit {
  private readonly logger = new Logger(InternalLinkingService.name);
  private supabase: SupabaseClient;

  // Cache des switches pour éviter les requêtes répétées
  private cache: CachedSwitches = {
    verbs: new Map(),
    nouns: new Map(),
    gammes: new Map(),
  };

  // Statistiques de cache
  private cacheStats = {
    hits: 0,
    misses: 0,
    lastWarm: null as Date | null,
  };

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * 🚀 Initialisation du module - Cache warming des switches SEO
   */
  async onModuleInit() {
    this.logger.log(
      '🚀 Initialisation InternalLinkingService avec préchargement...',
    );

    try {
      await Promise.allSettled([
        this.preloadGammeCarSwitches(),
        this.preloadPopularGammes(),
      ]);

      this.cacheStats.lastWarm = new Date();
      this.logger.log(
        `✅ Cache warming terminé - Verbes: ${this.cache.verbs.size} gammes, ` +
          `Noms: ${this.cache.nouns.size} gammes, ` +
          `Gammes: ${this.cache.gammes.size}`,
      );
    } catch (error) {
      this.logger.error(
        '❌ Erreur cache warming InternalLinkingService:',
        error,
      );
    }
  }

  /**
   * 📥 Précharge les switches SGCS_ALIAS=1 (verbes) et ALIAS=2 (noms)
   */
  private async preloadGammeCarSwitches(): Promise<void> {
    if (!this.supabase) return;

    const { data, error } = await this.supabase
      .from(TABLES.seo_gamme_car_switch)
      .select('sgcs_id, sgcs_pg_id, sgcs_alias, sgcs_content')
      .in('sgcs_alias', ['1', '2']);

    if (error) {
      this.logger.error('Erreur chargement switches:', error);
      return;
    }

    // Organiser par gamme et alias
    for (const sw of data || []) {
      const pgId = Number(sw.sgcs_pg_id);

      if (sw.sgcs_alias === '1') {
        // Verbes
        if (!this.cache.verbs.has(pgId)) {
          this.cache.verbs.set(pgId, []);
        }
        this.cache.verbs.get(pgId)!.push(sw);
      } else if (sw.sgcs_alias === '2') {
        // Noms
        if (!this.cache.nouns.has(pgId)) {
          this.cache.nouns.set(pgId, []);
        }
        this.cache.nouns.get(pgId)!.push(sw);
      }
    }

    this.logger.log(`📥 Chargé ${data?.length || 0} switches (verbes+noms)`);
  }

  /**
   * 📥 Précharge les gammes populaires pour les liens
   */
  private async preloadPopularGammes(): Promise<void> {
    if (!this.supabase) return;

    const { data, error } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias')
      .eq('pg_display', true)
      .order('pg_id')
      .limit(200);

    if (error) {
      this.logger.error('Erreur chargement gammes:', error);
      return;
    }

    for (const g of data || []) {
      this.cache.gammes.set(Number(g.pg_id), {
        pg_id: Number(g.pg_id),
        pg_name: g.pg_name,
        pg_alias: g.pg_alias,
      });
    }

    this.logger.log(`📥 Chargé ${data?.length || 0} gammes`);
  }

  /**
   * 🎯 MÉTHODE PRINCIPALE: Traite #LinkGammeCar_Y# dans un contenu
   *
   * Reproduction fidèle du PHP:
   * - Rotation modulo: (typeId + targetPgId + offset) % count
   * - Combine verbe (ALIAS=1) + nom (ALIAS=2)
   * - Limite au MAX_INJECTED_LINKS configuré
   *
   * @returns Contenu avec liens HTML + métadonnées pour tracking A/B
   */
  async processLinkGammeCar(
    content: string,
    vehicle: VehicleContext,
    sourcePgId: number,
  ): Promise<LinkInjectionResult> {
    const result: LinkInjectionResult = {
      content,
      linksInjected: 0,
      formulas: [],
    };

    // Pattern: #LinkGammeCar_123#
    const pattern = /#LinkGammeCar_(\d+)#/g;
    const matches = [...content.matchAll(pattern)];

    if (matches.length === 0) {
      return result;
    }

    // Limiter le nombre de liens injectés
    const maxLinks = SEO_LINK_LIMITS.MAX_INJECTED_LINKS_PER_CONTENT;
    const linksToProcess = matches.slice(0, maxLinks);

    let processedContent = content;

    for (const match of linksToProcess) {
      const fullMatch = match[0];
      const targetPgId = parseInt(match[1], 10);

      const link = await this.buildLinkGammeCar(targetPgId, vehicle);

      if (link) {
        processedContent = processedContent.replace(fullMatch, link.html);
        result.linksInjected++;
        result.formulas.push({
          verbId: link.verbId,
          nounId: link.nounId,
          formula: link.formula,
          targetGammeId: link.targetGammeId,
        });
      } else {
        // Fallback si pas de switch disponible
        processedContent = processedContent.replace(fullMatch, '');
      }
    }

    // Supprimer les marqueurs restants (au-delà de la limite)
    processedContent = processedContent.replace(pattern, '');

    result.content = processedContent;
    return result;
  }

  /**
   * 🔧 Construit un lien LinkGammeCar avec rotation verbe+nom
   *
   * PHP Formula:
   * - Verbe: (typeId + targetPgId + 2) % count
   * - Nom: (typeId + targetPgId + 3) % count
   */
  private async buildLinkGammeCar(
    targetPgId: number,
    vehicle: VehicleContext,
  ): Promise<ProcessedLink | null> {
    // 1. Récupérer info gamme cible
    let gamme = this.cache.gammes.get(targetPgId);
    if (!gamme) {
      gamme = await this.fetchGamme(targetPgId);
      if (!gamme) return null;
    }

    // 2. Récupérer switches verbe et nom
    const verbs = await this.getSwitches(targetPgId, '1');
    const nouns = await this.getSwitches(targetPgId, '2');

    if (verbs.length === 0 || nouns.length === 0) {
      // Fallback sans switches - lien simple
      return this.buildSimpleLink(gamme, vehicle);
    }

    // 3. Rotation modulo (reproduction PHP)
    const verbIndex = this.calculateRotationIndex(
      vehicle.typeId,
      targetPgId,
      2,
      verbs.length,
    );
    const nounIndex = this.calculateRotationIndex(
      vehicle.typeId,
      targetPgId,
      3,
      nouns.length,
    );

    const selectedVerb = verbs[verbIndex];
    const selectedNoun = nouns[nounIndex];

    // 4. Construire le texte d'ancrage
    // Format: "{Verbe} les {gamme} {marque} {modele} {type} {nbCh} ch et {nom}"
    const anchorText = `${selectedVerb.sgcs_content} les ${gamme.pg_name} ${vehicle.marque} ${vehicle.modele} ${vehicle.type} ${vehicle.nbCh} ch et ${selectedNoun.sgcs_content}`;

    // 5. Construire l'URL
    const url = this.buildGammeUrl(gamme, vehicle);

    // 6. Générer la formule A/B testing
    const formula = `${selectedVerb.sgcs_id}:${selectedNoun.sgcs_id}`;

    return {
      html: `<a href="${url}" class="seo-internal-link" data-link-type="LinkGammeCar" data-formula="${formula}" data-target-gamme="${targetPgId}">${anchorText}</a>`,
      verbId: selectedVerb.sgcs_id,
      nounId: selectedNoun.sgcs_id,
      formula,
      targetGammeId: targetPgId,
    };
  }

  /**
   * 🔧 Construit un lien simple sans switches (fallback)
   */
  private buildSimpleLink(
    gamme: GammeInfo,
    vehicle: VehicleContext,
  ): ProcessedLink {
    const anchorText = `${gamme.pg_name} ${vehicle.marque} ${vehicle.modele}`;
    const url = this.buildGammeUrl(gamme, vehicle);

    return {
      html: `<a href="${url}" class="seo-internal-link" data-link-type="LinkGammeCar" data-target-gamme="${gamme.pg_id}">${anchorText}</a>`,
      verbId: null,
      nounId: null,
      formula: null,
      targetGammeId: gamme.pg_id,
    };
  }

  /**
   * 🔢 Calcule l'index de rotation (formule PHP)
   * Formula: (typeId + targetPgId + offset) % count
   */
  private calculateRotationIndex(
    typeId: number,
    targetPgId: number,
    offset: number,
    count: number,
  ): number {
    if (count === 0) return 0;

    if (SEO_AB_TESTING_CONFIG.ROTATION_MODE === 'random') {
      // Mode aléatoire pour A/B testing pur
      return Math.floor(Math.random() * count);
    }

    // Mode déterministe (reproduction PHP)
    return (typeId + targetPgId + offset) % count;
  }

  /**
   * 🔗 Construit l'URL vers une page gamme+véhicule
   */
  private buildGammeUrl(gamme: GammeInfo, vehicle: VehicleContext): string {
    // Format: /pieces/{gamme-alias}/{marque}/{modele}/{type}.html
    return `/pieces/${gamme.pg_alias}/${vehicle.marque}/${vehicle.modele}/${vehicle.type}.html`;
  }

  /**
   * 📥 Récupère les switches depuis le cache ou la DB
   */
  private async getSwitches(
    pgId: number,
    alias: '1' | '2',
  ): Promise<GammeCarSwitch[]> {
    const cacheMap = alias === '1' ? this.cache.verbs : this.cache.nouns;

    if (cacheMap.has(pgId)) {
      this.cacheStats.hits++;
      return cacheMap.get(pgId)!;
    }

    this.cacheStats.misses++;

    // Fetch depuis DB
    if (!this.supabase) return [];

    const { data } = await this.supabase
      .from(TABLES.seo_gamme_car_switch)
      .select('sgcs_id, sgcs_pg_id, sgcs_alias, sgcs_content')
      .eq('sgcs_pg_id', pgId)
      .eq('sgcs_alias', alias);

    const switches = (data as GammeCarSwitch[]) || [];

    // Mettre en cache
    cacheMap.set(pgId, switches);

    return switches;
  }

  /**
   * 📥 Récupère une gamme depuis le cache ou la DB
   */
  private async fetchGamme(pgId: number): Promise<GammeInfo | null> {
    if (this.cache.gammes.has(pgId)) {
      return this.cache.gammes.get(pgId)!;
    }

    if (!this.supabase) return null;

    const { data } = await this.supabase
      .from(TABLES.pieces_gamme)
      .select('pg_id, pg_name, pg_alias')
      .eq('pg_id', pgId)
      .single();

    if (data) {
      const gamme: GammeInfo = {
        pg_id: Number(data.pg_id),
        pg_name: data.pg_name,
        pg_alias: data.pg_alias,
      };
      this.cache.gammes.set(pgId, gamme);
      return gamme;
    }

    return null;
  }

  /**
   * 🔗 Traite #LinkGamme_Y# (lien simple sans véhicule)
   */
  async processLinkGamme(content: string): Promise<string> {
    const pattern = /#LinkGamme_(\d+)#/g;
    const matches = [...content.matchAll(pattern)];

    if (matches.length === 0) return content;

    let processed = content;
    const maxLinks = SEO_LINK_LIMITS.MAX_SIMPLE_GAMME_LINKS;
    let count = 0;

    for (const match of matches) {
      if (count >= maxLinks) {
        processed = processed.replace(match[0], '');
        continue;
      }

      const pgId = parseInt(match[1], 10);
      const gamme = await this.fetchGamme(pgId);

      if (gamme) {
        const link = `<a href="/pieces/${gamme.pg_alias}-${pgId}.html" class="seo-internal-link" data-link-type="LinkGamme"><b>${gamme.pg_name}</b></a>`;
        processed = processed.replace(match[0], link);
        count++;
      } else {
        processed = processed.replace(match[0], '');
      }
    }

    return processed;
  }

  /**
   * 📊 Retourne les statistiques du cache
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      verbsCached: this.cache.verbs.size,
      nounsCached: this.cache.nouns.size,
      gammesCached: this.cache.gammes.size,
      hitRate:
        this.cacheStats.hits + this.cacheStats.misses > 0
          ? (
              (this.cacheStats.hits /
                (this.cacheStats.hits + this.cacheStats.misses)) *
              100
            ).toFixed(2) + '%'
          : '0%',
    };
  }

  /**
   * 🔄 Force le rafraîchissement du cache
   */
  async refreshCache(): Promise<void> {
    this.cache = {
      verbs: new Map(),
      nouns: new Map(),
      gammes: new Map(),
    };
    this.cacheStats.hits = 0;
    this.cacheStats.misses = 0;

    await this.onModuleInit();
  }
}
