import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BrandSourcesConflictError,
  BrandSourcesRejectedError,
  PriceRuleConflictError,
  SupplierCardRepository,
  SupplierIdConflictError,
} from '../supplier-truth';
import type {
  SupplierCardPatch,
  SupplierCardRow,
  SupplierLinkedBrand,
  SupplierPriceConditionPut,
  SupplierPriceProfileRow,
} from '../supplier-truth';
import {
  BRAND_PM_ID_PARAM_PATTERN,
  LOCATION_FIELDS,
  SUPPLIER_CARD_FIELD_TO_COLUMN,
  type CreatePriceRuleDto,
  type PutBrandSourcesDto,
  type CreateSupplierCardDto,
  type SupplierCardField,
  type UpdateSupplierCardDto,
} from './dto/supplier.schemas';
import {
  findSupplierDuplicates,
  slugifySupplierAlias,
  type DuplicateMatch,
} from './supplier-name';
import {
  orderBrandSources,
  type BrandSourceIssue,
  type ResolvedBrandSource,
} from './supplier-brand-source';
import {
  isDatedRule,
  priceRuleStatus,
  type PriceRule,
  type PriceRuleLevel,
  type PriceRuleStatus,
} from './supplier-price-rule';

/** Fiche telle que servie à l'écran admin : champs camelCase, jamais de secret. */
export interface SupplierCardView {
  id: string;
  name: string | null;
  alias: string | null;
  displayed: boolean;
  type: string | null;
  status: string | null;
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
  };
  location: {
    address: string | null;
    postcode: string | null;
    city: string | null;
    country: string | null;
    supplyMode: string | null;
    /** Repli si la pièce n'est pas au dépôt (mandat DQ). */
    fallbackMode: string | null;
    validatedAt: string | null;
    validatedBy: string | null;
  };
  conditions: {
    paymentTerms: string | null;
    francoHtCents: number | null;
    deliveryDelayDays: number | null;
    orderMode: string | null;
    portalUrl: string | null;
  };
  /** Nom de la variable et état seulement : la valeur n'est ni lue ni servie. */
  access: {
    secretName: string | null;
    state: string | null;
    checkedAt: string | null;
  };
  updatedAt: string | null;
  updatedBy: string | null;
  brands: SupplierLinkedBrand[];
  priceProfiles: SupplierPriceProfileView[];
  /** Fournisseurs au nom voisin, à trancher par Marwane (non bloquant). */
  possibleDuplicates: DuplicateMatch[];
}

interface SupplierPriceProfileView {
  id: number;
  scopeLevel: string;
  /** FAMILY : code famille (NU17) ; SUBFAMILY : code sous-famille (1738). */
  scopeCode: string | null;
  /** Marque de la règle (pm_id), ou null. */
  brandPmId: string | null;
  /**
   * 'import' : profil lu par l'import tarifaire, en lecture seule sur la
   * fiche ; 'condition' : remise / marge saisie sur la fiche (CH-3).
   */
  profileKind: 'import' | 'condition';
  /** Paramètres d'import : ligne 'import' seulement, null sinon. */
  priceBasis: string | null;
  derivation: string | null;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  /** Ligne datée = promotion (complément CH-2). */
  isPromo: boolean;
  /**
   * État d'une condition à la date de lecture, selon resolvePriceRule (non
   * branché aux prix) ; null pour un profil d'import.
   */
  ruleStatus: PriceRuleStatus | null;
  supersededBy: number | null;
  createdBy: string | null;
  changeReason: string | null;
  createdAt: string;
  defaultRemisePct: number | null;
  defaultMargePct: number | null;
  /** Retrait d'une condition : date et auteur, ou null. */
  retiredAt: string | null;
  retiredBy: string | null;
}

/**
 * Sources d'achat d'une marque, dans l'ordre (mandat DQ). Les remises restent
 * dans les profils de prix de chaque fournisseur : rien n'est recopié ici.
 */
export interface BrandSourcesView {
  pmId: number;
  brandName: string | null;
  sources: ResolvedBrandSource[];
  /** Anomalies de la donnée lue, signalées sans correction. */
  issues: BrandSourceIssue[];
  /** Liens de la marque non classés (candidats à classer). */
  unrankedLinks: Array<{
    linkId: string;
    splId: string;
    name: string | null;
    displayed: boolean;
  }>;
  /** Fiches actives : choix d'une source ou d'un point de livraison. */
  activeSuppliers: Array<{
    splId: string;
    name: string | null;
    type: string | null;
    supplyMode: string | null;
    fallbackMode: string | null;
  }>;
}

export interface SupplierCardWriteResult {
  id: string;
  /** Doublons possibles (voisins) signalés à l'écriture, non bloquants. */
  possibleDuplicates: DuplicateMatch[];
}

const str = (v: unknown): string | null =>
  v === null || v === undefined ? null : String(v);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Fiche fournisseur (mandat CH). Logique métier de l'écran admin ; l'accès
 * aux tables passe par `SupplierCardRepository` (supplier-truth, P35).
 *
 * Doublons : une clé de nom commune avec un autre fournisseur refuse la
 * création ou le renommage (409, avec l'id en conflit) ; un nom voisin est
 * renvoyé en signalement.
 */
@Injectable()
export class SupplierCardService {
  private readonly logger = new Logger(SupplierCardService.name);

  constructor(private readonly cards: SupplierCardRepository) {}

  async getCard(splId: string): Promise<SupplierCardView> {
    const row = await this.cards.getCard(splId);
    if (!row) throw new NotFoundException(`Fournisseur ${splId} introuvable`);
    const [brands, profiles, identities] = await Promise.all([
      this.cards.getLinkedBrands(splId),
      this.cards.getPriceProfiles(splId),
      this.cards.listIdentities(),
    ]);
    return {
      ...toView(row),
      brands,
      priceProfiles: toProfileViews(profiles, new Date()),
      possibleDuplicates: findSupplierDuplicates(
        str(row.spl_name),
        str(row.spl_alias),
        identities,
        splId,
      ),
    };
  }

  async createCard(
    dto: CreateSupplierCardDto,
    by: string,
  ): Promise<SupplierCardWriteResult> {
    const identities = await this.cards.listIdentities();
    const alias = dto.alias ?? slugifySupplierAlias(dto.name);
    const possibleDuplicates = this.assertNoExactDuplicate(
      dto.name,
      alias,
      identities,
    );
    const maxId = identities.reduce((max, s) => {
      const n = Number(s.splId);
      return Number.isInteger(n) && n > max ? n : max;
    }, 0);
    const splId = String(maxId + 1);
    try {
      await this.cards.insertCard(splId, toPatch({ ...dto, alias }), by);
    } catch (error) {
      if (error instanceof SupplierIdConflictError) {
        throw new ConflictException(
          `Identifiant ${splId} pris entre-temps : relancer la création`,
        );
      }
      throw error;
    }
    this.logger.log(`Fiche fournisseur ${splId} créée par ${by}`);
    return { id: splId, possibleDuplicates };
  }

  async updateCard(
    splId: string,
    dto: UpdateSupplierCardDto,
    by: string,
  ): Promise<SupplierCardWriteResult> {
    const current = await this.cards.getCard(splId);
    if (!current)
      throw new NotFoundException(`Fournisseur ${splId} introuvable`);
    let possibleDuplicates: DuplicateMatch[] = [];
    // Contrôle seulement si le nom ou l'alias CHANGE : le formulaire renvoie
    // toujours le nom, et un doublon historique (26/71) ne doit pas bloquer
    // l'enregistrement des autres champs de ces fiches.
    const nameChanged =
      dto.name !== undefined && dto.name !== str(current.spl_name);
    const aliasChanged =
      dto.alias !== undefined && dto.alias !== str(current.spl_alias);
    if (nameChanged || aliasChanged) {
      // Seules les valeurs nouvelles sont comparées : une clé inchangée ne
      // crée pas de doublon nouveau.
      possibleDuplicates = this.assertNoExactDuplicate(
        nameChanged ? (dto.name ?? null) : null,
        aliasChanged ? (dto.alias ?? null) : null,
        await this.cards.listIdentities(),
        splId,
      );
    }
    const patch = toPatch(dto);
    const clearValidation = LOCATION_FIELDS.some((field) => {
      if (!(field in dto)) return false;
      const column = SUPPLIER_CARD_FIELD_TO_COLUMN[field];
      return str(patch[column]) !== str(current[column]);
    });
    const found = await this.cards.updateCard(
      splId,
      patch,
      by,
      clearValidation,
    );
    if (!found) throw new NotFoundException(`Fournisseur ${splId} introuvable`);
    return { id: splId, possibleDuplicates };
  }

  /**
   * Validation de la localisation par un humain (Marwane, décision du
   * 18/11 14:35). Exige au moins le pays et le mode d'approvisionnement ;
   * une modification ultérieure de la localisation l'efface.
   */
  async validateLocation(splId: string, by: string): Promise<void> {
    const current = await this.cards.getCard(splId);
    if (!current)
      throw new NotFoundException(`Fournisseur ${splId} introuvable`);
    if (!current.spl_country || !current.spl_supply_mode) {
      throw new BadRequestException(
        'Pays et mode d’approvisionnement requis avant validation',
      );
    }
    await this.cards.validateLocation(splId, by);
  }

  /**
   * Retrait d'un fournisseur : `spl_status = 'archive'` et `spl_display = '0'`,
   * sans DELETE. Les liens marque et les profils de prix ne sont pas touchés
   * (leur désactivation relève d'un lot gouverné de PricingModule).
   */
  async deactivateSupplier(splId: string, by: string): Promise<void> {
    const found = await this.cards.archive(splId, by);
    if (!found) throw new NotFoundException(`Fournisseur ${splId} introuvable`);
    this.logger.log(`Fournisseur ${splId} archivé par ${by}`);
  }

  /**
   * Condition de remise / marge (compléments CH-2 et CH-3). Une condition
   * active de même clé (marque, niveau, code, période) est remplacée par une
   * nouvelle version, dans une seule transaction en base
   * (`supplier_price_condition_put`). Une condition ne porte aucun paramètre
   * d'import : l'import tarifaire ne lit que les lignes 'import'.
   */
  async createPriceRule(
    splId: string,
    dto: CreatePriceRuleDto,
    by: string,
  ): Promise<{ id: number; version: number }> {
    if (!(await this.cards.getCard(splId)))
      throw new NotFoundException(`Fournisseur ${splId} introuvable`);
    const brandPmId = dto.brandPmId ?? null;
    if (brandPmId !== null) {
      const brands = await this.cards.getLinkedBrands(splId);
      if (!brands.some((b) => b.pmId !== null && String(b.pmId) === brandPmId))
        throw new BadRequestException(
          `Marque ${brandPmId} non liée au fournisseur ${splId}`,
        );
    }
    const condition: SupplierPriceConditionPut = {
      supplierId: splId,
      brandPmId,
      scopeLevel: dto.scopeLevel,
      scopeCode: dto.scopeCode ?? null,
      effectiveFrom: dayStart(dto.effectiveFrom),
      effectiveTo: dayStart(dto.effectiveTo),
      remisePct: dto.remisePct ?? null,
      margePct: dto.margePct ?? null,
      changeReason: dto.changeReason ?? null,
      by,
    };
    try {
      const written = await this.cards.putPriceCondition(condition);
      this.logger.log(
        `Condition de prix ${written.id} (v${written.version}) du fournisseur ${splId} écrite par ${by}` +
          (written.replacedId === null
            ? ''
            : `, remplace ${written.replacedId}`),
      );
      return { id: written.id, version: written.version };
    } catch (error) {
      if (error instanceof PriceRuleConflictError)
        throw new ConflictException(error.message);
      throw error;
    }
  }

  /**
   * Retrait d'une condition : active = false, avec date et auteur, sans
   * DELETE. Un profil d'import n'est jamais retiré depuis la fiche.
   */
  async retirePriceRule(
    splId: string,
    ruleId: number,
    by: string,
  ): Promise<void> {
    const rows = await this.cards.getPriceProfiles(splId);
    const row = rows.find((r) => r.id === ruleId && r.active);
    if (!row)
      throw new NotFoundException(
        `Règle active ${ruleId} introuvable pour le fournisseur ${splId}`,
      );
    if (row.profile_kind !== 'condition')
      throw new ConflictException(
        `Ligne ${ruleId} : profil d'import, non retiré depuis la fiche`,
      );
    if (!(await this.cards.retirePriceCondition(splId, ruleId, by)))
      throw new ConflictException(
        'Règle modifiée entre-temps : recharger la fiche',
      );
    this.logger.log(
      `Condition de prix ${ruleId} du fournisseur ${splId} retirée par ${by}`,
    );
  }

  /**
   * Sources d'achat de la marque, classées par `orderBrandSources` (rang
   * croissant, point de livraison, nature, surcoût, repli). Lecture seule.
   */
  async getBrandSources(pmIdParam: string): Promise<BrandSourcesView> {
    const pmId = parseBrandPmId(pmIdParam);
    const brand = await this.cards.getBrand(pmId);
    if (!brand) throw new NotFoundException(`Marque ${pmId} introuvable`);
    const [links, summaries] = await Promise.all([
      this.cards.getBrandLinks(pmId),
      this.cards.listSummaries(),
    ]);
    const { sources, issues } = orderBrandSources(links, summaries);
    const names = new Map(summaries.map((c) => [c.splId, c.name]));
    return {
      pmId,
      brandName: brand.name,
      sources,
      issues,
      unrankedLinks: links
        .filter((l) => l.rank === null)
        .map((l) => ({
          linkId: l.linkId,
          splId: l.splId,
          name: names.get(l.splId) ?? null,
          displayed: l.displayed,
        }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
      activeSuppliers: summaries
        .filter((c) => c.status === 'actif')
        .map(({ splId, name, type, supplyMode, fallbackMode }) => ({
          splId,
          name,
          type,
          supplyMode,
          fallbackMode,
        }))
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
    };
  }

  /**
   * Remplace la liste ordonnée des sources de la marque (rang = position),
   * en une transaction (`supplier_brand_sources_put`), avec l'auteur. Les
   * contrôles (source et point de livraison actifs, lien affiché, surcoût
   * ≥ 0, rang unique) sont tenus par la fonction et par la table.
   */
  async putBrandSources(
    pmIdParam: string,
    dto: PutBrandSourcesDto,
    by: string,
  ): Promise<{
    pmId: number;
    written: Array<{ linkId: string; rank: number; created: boolean }>;
  }> {
    const pmId = parseBrandPmId(pmIdParam);
    try {
      const written = await this.cards.putBrandSources(
        pmId,
        dto.sources.map((s) => ({
          splId: s.splId,
          linkId: s.linkId ?? null,
          deliverySplId: s.deliverySplId ?? null,
          stockKind: s.stockKind,
          surchargeCents: s.surchargeCents,
        })),
        by,
      );
      const created = written.filter((w) => w.created).map((w) => w.linkId);
      this.logger.log(
        `Sources de la marque ${pmId} : ${written.length} classée(s) par ${by}` +
          (created.length ? `, lien(s) créé(s) ${created.join(', ')}` : ''),
      );
      return { pmId, written };
    } catch (error) {
      if (error instanceof BrandSourcesRejectedError)
        throw new BadRequestException(error.message);
      if (error instanceof BrandSourcesConflictError)
        throw new ConflictException(error.message);
      throw error;
    }
  }

  private assertNoExactDuplicate(
    name: string | null,
    alias: string | null,
    identities: Parameters<typeof findSupplierDuplicates>[2],
    excludeSplId?: string,
  ): DuplicateMatch[] {
    const matches = findSupplierDuplicates(
      name,
      alias,
      identities,
      excludeSplId,
    );
    const exact = matches.filter((m) => m.kind === 'exact');
    if (exact.length > 0) {
      throw new ConflictException({
        message: 'Un fournisseur porte déjà ce nom (nom normalisé)',
        duplicates: exact,
      });
    }
    return matches;
  }
}

/** Champs saisis → colonnes ; seules les clés présentes dans le DTO sont écrites. */
export function toPatch(
  dto: Partial<Record<SupplierCardField, string | number | null | undefined>>,
): SupplierCardPatch {
  const patch: SupplierCardPatch = {};
  for (const [field, column] of Object.entries(
    SUPPLIER_CARD_FIELD_TO_COLUMN,
  ) as [
    SupplierCardField,
    (typeof SUPPLIER_CARD_FIELD_TO_COLUMN)[SupplierCardField],
  ][]) {
    const value = dto[field];
    if (value !== undefined) patch[column] = value;
  }
  return patch;
}

function toView(
  row: SupplierCardRow,
): Omit<SupplierCardView, 'brands' | 'priceProfiles' | 'possibleDuplicates'> {
  return {
    id: String(row.spl_id),
    name: str(row.spl_name),
    alias: str(row.spl_alias),
    displayed: row.spl_display === '1',
    type: str(row.spl_type),
    status: str(row.spl_status),
    contact: {
      name: str(row.spl_contact_name),
      email: str(row.spl_email),
      phone: str(row.spl_phone),
      website: str(row.spl_website),
    },
    location: {
      address: str(row.spl_address),
      postcode: str(row.spl_postcode),
      city: str(row.spl_city),
      country: str(row.spl_country),
      supplyMode: str(row.spl_supply_mode),
      fallbackMode: str(row.spl_fallback_mode),
      validatedAt: str(row.spl_location_validated_at),
      validatedBy: str(row.spl_location_validated_by),
    },
    conditions: {
      paymentTerms: str(row.spl_payment_terms),
      francoHtCents: num(row.spl_franco_ht_cents),
      deliveryDelayDays: num(row.spl_delivery_delay_days),
      orderMode: str(row.spl_order_mode),
      portalUrl: str(row.spl_portal_url),
    },
    access: {
      secretName: str(row.spl_secret_name),
      state: str(row.spl_access_state),
      checkedAt: str(row.spl_access_checked_at),
    },
    updatedAt: str(row.spl_updated_at),
    updatedBy: str(row.spl_updated_by),
  };
}

/** Paramètre de route → pm_id entier (même motif que la fonction SQL). */
function parseBrandPmId(value: string): number {
  if (!BRAND_PM_ID_PARAM_PATTERN.test(value))
    throw new BadRequestException('Identifiant de marque numérique attendu');
  return Number(value);
}

/** 'AAAA-MM-JJ' → début du jour UTC (ISO), ou null. */
function dayStart(day: string | null | undefined): string | null {
  return day ? `${day}T00:00:00.000Z` : null;
}

function toRule(p: SupplierPriceProfileRow): PriceRule {
  return {
    id: p.id,
    supplierId: p.supplier_id,
    brandPmId: p.brand_pm_id ?? null,
    scopeLevel: p.scope_level as PriceRuleLevel,
    scopeCode: p.scope_code,
    effectiveFrom: p.effective_from,
    effectiveTo: p.effective_to,
    active: p.active,
    version: Number(p.version),
    remisePct: num(p.default_remise_pct),
    margePct: num(p.default_marge_pct),
  };
}

function toProfileViews(
  rows: SupplierPriceProfileRow[],
  at: Date,
): SupplierPriceProfileView[] {
  // L'état se calcule entre conditions seulement : un profil d'import n'est
  // pas une règle de remise et n'en remplace aucune.
  const conditions = rows
    .filter((p) => p.profile_kind === 'condition')
    .map(toRule);
  return rows.map((p) => {
    const rule = toRule(p);
    const { status, supersededBy } =
      p.profile_kind === 'condition'
        ? priceRuleStatus(rule, conditions, at)
        : { status: null, supersededBy: null };
    return {
      ...toProfileView(p, rule),
      ruleStatus: status,
      supersededBy,
    };
  });
}

function toProfileView(
  p: SupplierPriceProfileRow,
  rule: PriceRule,
): Omit<SupplierPriceProfileView, 'ruleStatus' | 'supersededBy'> {
  return {
    id: p.id,
    scopeLevel: p.scope_level,
    scopeCode: p.scope_code,
    brandPmId: rule.brandPmId,
    profileKind: p.profile_kind,
    priceBasis: p.price_basis,
    derivation: p.derivation,
    version: p.version,
    effectiveFrom: p.effective_from,
    effectiveTo: p.effective_to,
    active: p.active,
    isPromo: isDatedRule(rule),
    createdBy: p.created_by,
    changeReason: p.change_reason,
    createdAt: p.created_at,
    defaultRemisePct: rule.remisePct,
    defaultMargePct: rule.margePct,
    retiredAt: p.retired_at,
    retiredBy: p.retired_by,
  };
}
