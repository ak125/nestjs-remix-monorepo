import { Injectable, Logger } from '@nestjs/common';

import { SupabaseBaseService } from '@database/services/supabase-base.service';
import { TABLES } from '@repo/database-types';
import { type SurfaceKey } from '@repo/seo-role-contracts';

import { PRIX_PAS_CHER, VOUS_PROPOSE } from '../../seo-v4.types';

/**
 * Variables métier injectables dans les templates SEO.
 *
 * Aligné sur les marqueurs `#X#` legacy PHP : `meta.conf.php` + `sql.conf.php`
 * (cf. plan seo-v9 §1.2 pilier 4 « marqueurs métier + marketing »).
 *
 * `useMeta=true` (titre/description/preview) → variantes texte sans `<b>`.
 * `useMeta=false` (h1/content) → variantes typographiées avec `<b>`.
 */
export interface TemplateVariables {
  gamme: string;
  gammeMeta: string;
  marque: string;
  marqueMeta: string;
  marqueMetaTitle: string;
  modele: string;
  modeleMeta: string;
  type: string;
  typeMeta: string;
  annee: string;
  nbCh: number;
  carosserie: string;
  fuel: string;
  codeMoteur: string;
  /** Variables marketing legacy (PHP `$PrixPasCher[]` / `$VousPropose[]`). */
  minPrice?: number;
  articlesCount?: number;
  familyName?: string;
  seoScore?: number;
  gammeLevel?: number;
  isTopGamme?: boolean;
}

export interface RenderTemplateInput {
  surfaceKey: SurfaceKey;
  /** Champ libre du template legacy (`sgc_title` / `sgc_descrip` / etc.). */
  templateText: string;
  variables: TemplateVariables;
  /** Pour les marqueurs déterministes (`#PrixPasCher#` modulo). */
  pgId: number;
  typeId: number;
  /** `true` pour les champs sans HTML (title / preview / description). */
  useMeta: boolean;
  /** Si fourni, override l'index `PrixPasCher` (utile pour tests). */
  prixPasCherSeed?: number;
  /** Si fourni, override l'index `VousPropose`. */
  vousProposeSeed?: number;
  /** Format à utiliser pour `#MinPrice#` ('title' = "dès Xe", 'descrip' = "à partir de Xe"). */
  minPriceFormat?: 'title' | 'descrip';
}

/**
 * Service de rendu des templates SEO legacy (`__seo_*` tables).
 *
 * Responsabilités :
 *   1. **applyVariables** (pure) — interpolation `#Marker#` → valeur depuis
 *      `TemplateVariables`. Gère les variantes meta vs HTML (gras `<b>`).
 *      Identique à `replaceStandardVariables` legacy V4 mais isolée et testable.
 *   2. **fetchTemplate** (DB) — lit la ligne template canonique depuis la table
 *      résolue par la surface (`__seo_gamme_car` pour R1_GAMME_VEHICLE_ROUTER,
 *      `__seo_gamme` pour R1_GAMME_ROUTER, `__seo_marque` pour R7_BRAND_HUB).
 *      R2_PRODUCT n'a pas de table : `fetchTemplate` retourne `null`, le caller
 *      doit alors utiliser le mode concat programmatique (PR-11 différé).
 *
 * @see plan seo-v9 §3.1 — `SeoTemplateRenderer`
 */
@Injectable()
export class SeoTemplateRenderer extends SupabaseBaseService {
  protected readonly logger = new Logger(SeoTemplateRenderer.name);

  /**
   * Applique les variables métier sur un template texte. Logique pure : pas de DB.
   *
   * Inclut les marqueurs marketing déterministes (`#PrixPasCher#`,
   * `#VousPropose#`, `#MinPrice#`) ainsi que les variables contextuelles
   * (`#ArticlesCount#`, `#FamilyContext#`, `#QualityBadge#`).
   *
   * Le caller reste responsable d'appeler ensuite `SeoSwitchSelector` pour
   * résoudre `#CompSwitch_*#` et `SeoInternalLinkingService` pour `#LinkGamme*#`.
   */
  applyVariables(input: RenderTemplateInput): string {
    let out = input.templateText;
    out = this.replaceStandardVariables(out, input.variables, input.useMeta);
    out = this.replaceMarketingMarkers(out, input);
    out = this.replaceContextualMarkers(out, input.variables);
    return out;
  }

  /**
   * Lit la ligne template canonique pour une surface (table résolue côté
   * service — pas via registry car les schémas de colonnes diffèrent).
   *
   * @returns la ligne brute Supabase, ou `null` si non trouvée / non
   * supportée pour la surface.
   */
  async fetchTemplate(
    surfaceKey: SurfaceKey,
    pgId: number,
    extra?: { brandId?: number },
  ): Promise<Record<string, unknown> | null> {
    const cfg = this.resolveTemplateConfig(surfaceKey);
    if (!cfg) return null;

    const filterCol = cfg.filterColumn;
    const filterVal = filterCol === 'sm_marque_id' ? extra?.brandId : pgId;
    if (filterVal == null) return null;

    const { data, error } = await this.supabase
      .from(cfg.table)
      .select('*')
      .eq(filterCol, filterVal)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `[SeoTemplateRenderer] fetchTemplate ${cfg.table}.${filterCol}=${filterVal}: ${error.message}`,
      );
      return null;
    }
    return data ?? null;
  }

  /**
   * Mapping surface → table legacy. Surfaces sans template DB (R0_HOME,
   * R2_PRODUCT*, blog géré par `SeoMetaRegistryService`, etc.) renvoient null.
   */
  private resolveTemplateConfig(
    surfaceKey: SurfaceKey,
  ): { table: string; filterColumn: string } | null {
    switch (surfaceKey) {
      case 'R1_GAMME_ROUTER':
        return { table: TABLES.seo_gamme, filterColumn: 'sg_pg_id' };
      case 'R1_GAMME_VEHICLE_ROUTER':
        return { table: TABLES.seo_gamme_car, filterColumn: 'sgc_pg_id' };
      case 'R7_BRAND_HUB':
        return { table: '__seo_marque', filterColumn: 'sm_marque_id' };
      default:
        return null;
    }
  }

  // ───────────────── private — pure substitutions ─────────────────

  private replaceStandardVariables(
    content: string,
    v: TemplateVariables,
    useMeta: boolean,
  ): string {
    const replacements: Record<string, string> = {
      '#Gamme#': useMeta ? v.gammeMeta : `<b>${v.gamme}</b>`,
      '#VMarque#': useMeta ? v.marqueMetaTitle : `<b>${v.marque}</b>`,
      '#VModele#': useMeta ? v.modeleMeta : `<b>${v.modele}</b>`,
      '#VType#': useMeta ? v.typeMeta : `<b>${v.type}</b>`,
      '#VAnnee#': useMeta ? v.annee : `<b>${v.annee}</b>`,
      '#VNbCh#': useMeta ? String(v.nbCh) : `<b>${v.nbCh} ch</b>`,
      '#VCarosserie#': `<b>${v.carosserie}</b>`,
      '#VMotorisation#': `<b>${v.fuel}</b>`,
      '#VCodeMoteur#': `<b>${v.codeMoteur}</b>`,
      '#GammeLevel#': v.gammeLevel ? `niveau ${v.gammeLevel}` : '',
      '#IsTop#': v.isTopGamme ? 'gamme premium' : '',
    };

    let out = content;
    for (const [marker, value] of Object.entries(replacements)) {
      out = out.split(marker).join(value);
    }
    return out;
  }

  private replaceMarketingMarkers(
    content: string,
    input: RenderTemplateInput,
  ): string {
    let out = content;

    // #MinPrice# (deux formats selon contexte)
    if (input.variables.minPrice != null) {
      const formatted =
        input.minPriceFormat === 'descrip'
          ? `à partir de ${input.variables.minPrice}€`
          : input.minPriceFormat === 'title'
            ? `dès ${input.variables.minPrice}€`
            : `dès ${input.variables.minPrice}€`;
      out = out.split('#MinPrice#').join(formatted);
      out = out
        .split('#MinPriceFormatted#')
        .join(`${input.variables.minPrice}€`);
    }

    // #PrixPasCher# (16 variantes, seed déterministe)
    const prixIdx =
      (input.prixPasCherSeed ?? input.pgId + input.typeId) %
      PRIX_PAS_CHER.length;
    out = out.split('#PrixPasCher#').join(PRIX_PAS_CHER[prixIdx]);

    // #VousPropose# (12 variantes)
    const vpIdx = (input.vousProposeSeed ?? input.typeId) % VOUS_PROPOSE.length;
    out = out.split('#VousPropose#').join(VOUS_PROPOSE[vpIdx]);

    return out;
  }

  private replaceContextualMarkers(
    content: string,
    v: TemplateVariables,
  ): string {
    let out = content;

    if (typeof v.articlesCount === 'number' && v.articlesCount > 0) {
      out = out
        .split('#ArticlesCount#')
        .join(String(v.articlesCount))
        .split('#ArticlesCountFormatted#')
        .join(this.formatArticlesCount(v.articlesCount));
    }

    if (typeof v.seoScore === 'number') {
      out = out
        .split('#QualityBadge#')
        .join(this.formatQualityBadge(v.seoScore));
    }

    if (v.familyName) {
      out = out
        .split('#FamilyContext#')
        .join(`dans la catégorie <b>${v.familyName}</b>`);
    }

    return out;
  }

  private formatArticlesCount(count: number): string {
    if (count === 1) return '<b>1 référence</b>';
    if (count < 10) return `<b>${count} références</b>`;
    return `<b>plus de ${count} références</b>`;
  }

  private formatQualityBadge(score: number): string {
    if (score >= 80) return '<b>Sélection Premium</b>';
    if (score >= 60) return '<b>Qualité Vérifiée</b>';
    return '';
  }
}
