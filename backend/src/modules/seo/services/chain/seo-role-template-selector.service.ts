import { Injectable, Logger } from '@nestjs/common';

import { renderSeoTemplate } from '../../../../config/seo-variations.config';
import { SeoSwitchSelector } from './seo-switch-selector.service';

/**
 * Slots R8 meta supportés en PR-1 (plan seo-v9 §3 — R8 meta-variant pool).
 * Élargir lors de la PR-2 quand les blocs R8 (intro/highlight/...) migrent
 * du système const TS vers le pool DB.
 *
 * H1 NON inclus : `buildR8H1` (r8-keyword-plan.constants.ts:854) produit déjà
 * un format optimisé `${brand} ${model} ${type} ${power} ch (${years})` avec
 * désambiguïsation par plage d'années — pas de besoin GSC démontré pour
 * pooliser H1.
 */
export type SeoR8MetaSlot = 'meta_title' | 'meta_description';

export interface SeoRoleTemplatePickInput {
  /** PR-1 ne supporte que `R8_VEHICLE`. Élargir RoleId en PR-2. */
  role: 'R8_VEHICLE';
  slot: SeoR8MetaSlot;
  /** Défaut `'fr'`. Multilangue déféré (la colonne `srtp_lang` est prête). */
  lang?: string;
  /** Inputs minimaux pour le seed sha256 (vehicleId stable, pgId=0 par défaut). */
  seed: {
    vehicleId: number;
    pgId?: number;
  };
  /** Map de placeholders `{key}` → valeur (cf. `renderSeoTemplate`). */
  placeholders: Record<string, string | number | null | undefined>;
}

export interface SeoRoleTemplatePickResult {
  /** UUID de `__seo_role_template_pool.srtp_id` — persisté dans `variant_signature`. */
  id: string;
  /** Texte rendu après substitution + cap `srtp_max_length`. */
  rendered: string;
}

/**
 * Wrapper thin sur `SeoSwitchSelector.pickVariant()` qui sait :
 * 1. construire le `where` clause `(role, slot, lang, status='active')`
 * 2. saler le `surfaceKey` par slot (`R8_VEHICLE:meta_title` ...) — entropie
 *    indépendante par slot (sinon 2 slots de même taille donneraient le même
 *    idx pour un même `vehicleId`)
 * 3. type-narrower les colonnes `srtp_template`/`srtp_id`/`srtp_max_length`
 *    (le schéma TS Database peut autoriser `null` → guard explicite, sinon
 *    `String(null)` leakerait `'null'` literal en GSC)
 *
 * Pas de cache : 1 SELECT par `pick()`. Ajout d'un cache mémoire (TTL 1h
 * pattern `SeoMetaRegistryService`) prévu en follow-up post-merge si signal
 * volume.
 *
 * @see plan seo-v9 §3 — pool DB-backed `__seo_role_template_pool`
 * @see SeoSwitchSelector — seed canonique sha256 résistant TecDoc V2
 */
@Injectable()
export class SeoRoleTemplateSelector {
  private readonly logger = new Logger(SeoRoleTemplateSelector.name);

  constructor(private readonly switchSelector: SeoSwitchSelector) {}

  async pick(
    input: SeoRoleTemplatePickInput,
  ): Promise<SeoRoleTemplatePickResult | null> {
    const lang = input.lang ?? 'fr';
    const variant = await this.switchSelector.pickVariant({
      family: 'ROLE_TEMPLATE_POOL',
      where: {
        srtp_role: input.role,
        srtp_slot: input.slot,
        srtp_lang: lang,
        srtp_status: 'active',
      },
      seed: {
        // surfaceKey UPPER_SNAKE aligné sur l'existant (R1_GAMME_ROUTER, R1_GAMME_VEHICLE_ROUTER).
        // Salage par slot pour entropie indépendante.
        surfaceKey: `${input.role}:${input.slot}`,
        pgId: input.seed.pgId ?? 0,
        vehicleId: input.seed.vehicleId,
        alias: null,
      },
    });
    if (!variant) {
      return null;
    }

    // Type narrowing : pickVariant retourne `Record<string, unknown>`.
    // Le schéma TS Database autorise `srtp_template` null → guard explicite.
    const template = variant.srtp_template;
    const id = variant.srtp_id;
    if (typeof template !== 'string' || typeof id !== 'string') {
      this.logger.warn(
        `[SeoRoleTemplateSelector] variant invalide (role=${input.role} slot=${input.slot} lang=${lang}) : srtp_template ou srtp_id non-string`,
      );
      return null;
    }

    const rendered = renderSeoTemplate(template, input.placeholders);
    const maxLen =
      typeof variant.srtp_max_length === 'number'
        ? variant.srtp_max_length
        : null;
    const finalText = maxLen ? rendered.slice(0, maxLen) : rendered;

    return { id, rendered: finalText };
  }
}
