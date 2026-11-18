import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  SupplierCardRepository,
  SupplierIdConflictError,
} from '../supplier-truth';
import type {
  SupplierCardPatch,
  SupplierCardRow,
  SupplierLinkedBrand,
  SupplierPriceProfileRow,
} from '../supplier-truth';
import {
  LOCATION_FIELDS,
  SUPPLIER_CARD_FIELD_TO_COLUMN,
  type CreateSupplierCardDto,
  type SupplierCardField,
  type UpdateSupplierCardDto,
} from './dto/supplier.schemas';
import {
  findSupplierDuplicates,
  slugifySupplierAlias,
  type DuplicateMatch,
} from './supplier-name';

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

export interface SupplierPriceProfileView {
  id: number;
  scopeLevel: string;
  scopeCode: string | null;
  priceBasis: string;
  derivation: string;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  /** Ligne datée dont le motif commence par PROMO (modele-fiche §b). */
  isPromo: boolean;
  createdBy: string | null;
  changeReason: string | null;
  createdAt: string;
  defaultRemisePct: number | null;
  defaultMargePct: number | null;
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
      priceProfiles: profiles.map(toProfileView),
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

function toProfileView(p: SupplierPriceProfileRow): SupplierPriceProfileView {
  return {
    id: p.id,
    scopeLevel: p.scope_level,
    scopeCode: p.scope_code,
    priceBasis: p.price_basis,
    derivation: p.derivation,
    version: p.version,
    effectiveFrom: p.effective_from,
    effectiveTo: p.effective_to,
    active: p.active,
    isPromo: (p.change_reason ?? '').toUpperCase().startsWith('PROMO'),
    createdBy: p.created_by,
    changeReason: p.change_reason,
    createdAt: p.created_at,
    defaultRemisePct: num(p.default_remise_pct),
    defaultMargePct: num(p.default_marge_pct),
  };
}
