import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseBaseService } from '@database/services/supabase-base.service';

import { SeoVariantFamilyRegistry } from '../../registries/seo-variant-family.registry';
import type { VariantFamilyKey } from '../../registries/seo-variant-family.registry';

/**
 * Inputs servant à dériver le seed canonique d'un tirage de variante switch.
 *
 * Le seed est un sha256 stable sur la concaténation `surfaceKey:pgId:vehicleId:alias`,
 * pris sur les 8 premiers hex caractères puis modulo la taille du jeu de variantes.
 *
 * Ceci remplace le seed legacy `(typeId + pgId) % len` qui était sensible aux
 * renumérotations TecDoc V2 (cf. mémoire `tecdoc-integration`).
 */
interface SwitchSeedInput {
  surfaceKey: string;
  pgId: number;
  vehicleId?: number | null;
  alias?: number | null;
}

/** Variante générique côté caller (renvoie la ligne brute de la table switch). */
export interface SwitchVariant {
  [key: string]: unknown;
}

interface PickVariantInput<TWhere extends Record<string, unknown>> {
  family: VariantFamilyKey;
  /** Filtres SQL `eq()` (ex: `{ sgcs_pg_id: 124 }` ou `{ sis_pg_id: 124 }`). */
  where: TWhere;
  /** Filtre additionnel sur la colonne `*_alias` (selon la famille). */
  aliasColumn?: string;
  alias?: number;
  seed: SwitchSeedInput;
}

/**
 * Sélectionne une variante déterministe dans une famille `__seo_*_switch`.
 *
 * Consulte `SeoVariantFamilyRegistry` pour résoudre la table cible, lit les
 * lignes filtrées (`where` + `alias` optionnel), puis applique le seed canonique
 * sha256 pour choisir l'index modulo le nombre de variantes.
 *
 * Logique d'index (pure, testable sans DB) : `computeSeedIndex(seed, length)`.
 *
 * @see plan seo-v9 §3.5 — Seed canonique stable
 *
 * Legacy seo-v4-switch-engine.service.ts supprimé 2026-06-12 (succédé par ce
 * sélecteur + SeoTemplateRenderer).
 */
@Injectable()
export class SeoSwitchSelector extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoSwitchSelector.name);

  constructor(private readonly families: SeoVariantFamilyRegistry) {
    super();
  }

  /**
   * Calcule l'index déterministe pour un seed donné parmi `length` candidats.
   *
   * Pure : aucune DB, testable directement.
   *
   * Algorithme :
   *   1. concatène `surfaceKey:pgId:vehicleId:alias` (vehicleId/alias optionnels → '')
   *   2. sha256 hex
   *   3. `parseInt(first8hex, 16) % length`
   */
  computeSeedIndex(seed: SwitchSeedInput, length: number): number {
    if (length <= 0) {
      throw new SeoSwitchError(`length doit être > 0 (reçu ${length})`);
    }
    const seedKey = [
      seed.surfaceKey,
      seed.pgId,
      seed.vehicleId ?? '',
      seed.alias ?? '',
    ].join(':');
    const hex = createHash('sha256').update(seedKey).digest('hex');
    return parseInt(hex.slice(0, 8), 16) % length;
  }

  /**
   * Tire une variante depuis la table switch résolue par la famille.
   *
   * @returns la variante choisie, ou `null` si aucune ligne ne match.
   */
  async pickVariant<TWhere extends Record<string, unknown>>(
    input: PickVariantInput<TWhere>,
  ): Promise<SwitchVariant | null> {
    const variants = await this.fetchVariants(input);
    if (variants.length === 0) return null;

    const idx = this.computeSeedIndex(input.seed, variants.length);
    return variants[idx];
  }

  /**
   * Tire toutes les variantes correspondant aux critères, sans sélection.
   * Utile pour les enchaînements (`processCompSwitch` qui itère sur tous les pgId).
   */
  async fetchVariants<TWhere extends Record<string, unknown>>(
    input: PickVariantInput<TWhere>,
  ): Promise<SwitchVariant[]> {
    const config = this.families.getConfig(input.family);
    const table = config.table;
    let query = this.supabase.from(table).select('*');

    for (const [col, val] of Object.entries(input.where)) {
      query = query.eq(col, val);
    }
    if (input.aliasColumn && typeof input.alias === 'number') {
      query = query.eq(input.aliasColumn, input.alias);
    }
    // Ordre stable obligatoire pour l'idempotence du seed sha256.
    // Les 4 familles legacy n'ont pas `orderBy` → comportement inchangé.
    if (config.orderBy) {
      query = query.order(config.orderBy, { ascending: true });
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(
        `[SeoSwitchSelector] erreur fetch ${table} : ${error.message}`,
      );
      return [];
    }
    return (data ?? []) as SwitchVariant[];
  }
}

export class SeoSwitchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SeoSwitchError';
  }
}
