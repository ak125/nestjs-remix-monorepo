import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseBaseService } from '../../database/services/supabase-base.service';

/**
 * Fiche fournisseur (mandat CH) : lecture et écriture de `___xtr_supplier` et
 * lecture des marques liées et des profils de prix d'un fournisseur.
 *
 * Placé dans supplier-truth parce que ce module est le seul lecteur autorisé
 * de `___xtr_supplier` (P35, authority-graph `reads.supplier_truth`, règle
 * ast-grep `commerce-no-direct-supplier-read`). Colonnes : migration
 * 20261118_xtr_supplier_fiche_columns.sql.
 *
 * Secrets : la table ne porte que le NOM de la variable (`spl_secret_name`) et
 * l'état de l'accès ; ce dépôt ne lit aucune variable d'environnement de
 * fournisseur. `spl_access_state` n'est jamais écrit ici (connecteur seul),
 * sauf sa valeur initiale `non_configure` à la création (modele-fiche §c).
 *
 * Écritures : jamais de DELETE. Retrait = `spl_status = 'archive'` et
 * `spl_display = '0'` ; les liens marque et l'historique de prix restent.
 */

export const SUPPLIER_CARD_COLUMNS = [
  'spl_id',
  'spl_name',
  'spl_alias',
  'spl_display',
  'spl_sort',
  'spl_type',
  'spl_status',
  'spl_contact_name',
  'spl_email',
  'spl_phone',
  'spl_website',
  'spl_address',
  'spl_postcode',
  'spl_city',
  'spl_country',
  'spl_supply_mode',
  'spl_location_validated_at',
  'spl_location_validated_by',
  'spl_payment_terms',
  'spl_franco_ht_cents',
  'spl_delivery_delay_days',
  'spl_order_mode',
  'spl_portal_url',
  'spl_secret_name',
  'spl_access_state',
  'spl_access_checked_at',
  'spl_updated_at',
  'spl_updated_by',
] as const;

type SupplierCardColumn = (typeof SUPPLIER_CARD_COLUMNS)[number];

/** Ligne de fiche telle que lue (bigint rendu en number par PostgREST). */
export type SupplierCardRow = Record<
  SupplierCardColumn,
  string | number | null
>;

/** Colonnes qu'un humain saisit (le reste : clé, connecteur, validation, traçabilité). */
type SupplierCardWritableColumn = Exclude<
  SupplierCardColumn,
  | 'spl_id'
  | 'spl_display'
  | 'spl_sort'
  | 'spl_access_state'
  | 'spl_access_checked_at'
  | 'spl_location_validated_at'
  | 'spl_location_validated_by'
  | 'spl_updated_at'
  | 'spl_updated_by'
>;

export type SupplierCardPatch = Partial<
  Record<SupplierCardWritableColumn, string | number | null>
>;

export interface SupplierIdentity {
  splId: string;
  name: string | null;
  alias: string | null;
}

export interface SupplierLinkedBrand {
  linkId: string;
  pmId: number | null;
  brandName: string | null;
  /** `slpm_display = '1'` : lien actif ; '0' = marque retirée (sans DELETE). */
  linkDisplayed: boolean;
}

export interface SupplierPriceProfileRow {
  id: number;
  supplier_id: string;
  scope_level: string;
  scope_code: string | null;
  /** pieces_marque.pm_id en texte (complément CH-2), ou null. */
  brand_pm_id: string | null;
  price_basis: string;
  derivation: string;
  key_field: string;
  /** Correspondance de colonnes du fichier tarif (noms de colonnes seulement). */
  column_mapping: unknown;
  version: number;
  effective_from: string | null;
  effective_to: string | null;
  active: boolean;
  created_by: string | null;
  change_reason: string | null;
  created_at: string;
  default_remise_pct: number | string | null;
  default_marge_pct: number | string | null;
}

/** Collision de clé primaire à la création (création concurrente). */
export class SupplierIdConflictError extends Error {
  constructor(readonly splId: string) {
    super(`spl_id ${splId} déjà pris`);
    this.name = 'SupplierIdConflictError';
  }
}

const T_SUPPLIER = '___xtr_supplier';
const T_LINK = '___xtr_supplier_link_pm';
const T_PROFILES = 'supplier_price_profiles';
const ROW_CAP = 1000;

const PROFILE_COLUMNS =
  'id, supplier_id, scope_level, scope_code, brand_pm_id, price_basis, ' +
  'derivation, key_field, column_mapping, version, effective_from, ' +
  'effective_to, active, created_by, change_reason, created_at, ' +
  'default_remise_pct, default_marge_pct';

/** Ligne de règle à insérer (complément CH-2) ; id et created_at par la base. */
export type SupplierPriceProfileInsert = Omit<
  SupplierPriceProfileRow,
  'id' | 'created_at' | 'active'
>;

/** Une règle active de même clé existe déjà (index unique, écriture concurrente). */
export class PriceRuleConflictError extends Error {
  constructor() {
    super('Règle active de même portée et période déjà présente');
    this.name = 'PriceRuleConflictError';
  }
}

@Injectable()
export class SupplierCardRepository extends SupabaseBaseService {
  constructor(configService?: ConfigService) {
    super(configService);
  }

  async getCard(splId: string): Promise<SupplierCardRow | null> {
    const { data, error } = await this.supabase
      .from(T_SUPPLIER)
      .select(SUPPLIER_CARD_COLUMNS.join(', '))
      .eq('spl_id', splId)
      .maybeSingle();
    if (error) throw new Error(`getCard failed: ${error.message}`);
    return (data as unknown as SupplierCardRow | null) ?? null;
  }

  /** Tous les fournisseurs (id, nom, alias) : contrôle de doublon et prochain id. */
  async listIdentities(): Promise<SupplierIdentity[]> {
    const { data, error } = await this.supabase
      .from(T_SUPPLIER)
      .select('spl_id, spl_name, spl_alias')
      .limit(ROW_CAP);
    if (error) throw new Error(`listIdentities failed: ${error.message}`);
    const rows = (data ?? []) as {
      spl_id: unknown;
      spl_name: unknown;
      spl_alias: unknown;
    }[];
    // Plafond atteint = liste tronquée : un doublon pourrait échapper au contrôle.
    if (rows.length >= ROW_CAP) {
      throw new Error(`listIdentities: ${ROW_CAP}-row cap reached`);
    }
    return rows.map((r) => ({
      splId: String(r.spl_id),
      name: typeof r.spl_name === 'string' ? r.spl_name : null,
      alias: typeof r.spl_alias === 'string' ? r.spl_alias : null,
    }));
  }

  /** Marques liées (actives et retirées) avec leur nom `pieces_marque`. */
  async getLinkedBrands(splId: string): Promise<SupplierLinkedBrand[]> {
    const { data, error } = await this.supabase
      .from(T_LINK)
      .select('slpm_id, slpm_pm_id, slpm_display')
      .eq('slpm_spl_id', splId)
      .limit(ROW_CAP);
    if (error) throw new Error(`getLinkedBrands failed: ${error.message}`);
    const links = (data ?? []) as {
      slpm_id: string;
      slpm_pm_id: string | null;
      slpm_display: string | null;
    }[];
    if (links.length >= ROW_CAP) {
      throw new Error(`getLinkedBrands: ${ROW_CAP}-row cap reached`);
    }
    const pmIds = [
      ...new Set(
        links
          .map((l) => Number(l.slpm_pm_id))
          .filter((n) => Number.isInteger(n)),
      ),
    ];
    const names = new Map<number, string | null>();
    if (pmIds.length > 0) {
      const { data: brands, error: brandError } = await this.supabase
        .from('pieces_marque')
        .select('pm_id, pm_name')
        .in('pm_id', pmIds);
      if (brandError) {
        throw new Error(
          `getLinkedBrands (pieces_marque) failed: ${brandError.message}`,
        );
      }
      for (const b of (brands ?? []) as {
        pm_id: number;
        pm_name: string | null;
      }[]) {
        names.set(Number(b.pm_id), b.pm_name);
      }
    }
    return links
      .map((l) => {
        const pmId = Number(l.slpm_pm_id);
        const valid = Number.isInteger(pmId);
        return {
          linkId: String(l.slpm_id),
          pmId: valid ? pmId : null,
          brandName: valid ? (names.get(pmId) ?? null) : null,
          linkDisplayed: l.slpm_display === '1',
        };
      })
      .sort((a, b) => (a.brandName ?? '').localeCompare(b.brandName ?? ''));
  }

  /**
   * Profils de prix du fournisseur, toutes versions. Un profil est immuable :
   * une condition nouvelle = nouvelle version (insertPriceProfile), l'ancienne
   * passe active = false (setPriceProfileActive).
   */
  async getPriceProfiles(splId: string): Promise<SupplierPriceProfileRow[]> {
    const { data, error } = await this.supabase
      .from(T_PROFILES)
      .select(PROFILE_COLUMNS)
      .eq('supplier_id', splId)
      .order('scope_level', { ascending: true })
      .order('version', { ascending: false })
      .limit(ROW_CAP);
    if (error) throw new Error(`getPriceProfiles failed: ${error.message}`);
    return (data ?? []) as unknown as SupplierPriceProfileRow[];
  }

  /** Nouvelle version de règle ; 409 métier si la clé active est déjà prise. */
  async insertPriceProfile(
    row: SupplierPriceProfileInsert,
  ): Promise<SupplierPriceProfileRow> {
    const { data, error } = await this.supabase
      .from(T_PROFILES)
      .insert({ ...row, active: true })
      .select(PROFILE_COLUMNS)
      .single();
    if (error) {
      if (error.code === '23505') throw new PriceRuleConflictError();
      throw new Error(`insertPriceProfile failed: ${error.message}`);
    }
    return data as unknown as SupplierPriceProfileRow;
  }

  /**
   * Active ou désactive une ligne du fournisseur, sans DELETE.
   * @returns false si la ligne n'existe pas pour ce fournisseur.
   */
  async setPriceProfileActive(
    splId: string,
    id: number,
    active: boolean,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(T_PROFILES)
      .update({ active })
      .eq('id', id)
      .eq('supplier_id', splId)
      .select('id');
    if (error) {
      if (error.code === '23505') throw new PriceRuleConflictError();
      throw new Error(`setPriceProfileActive failed: ${error.message}`);
    }
    return (data ?? []).length > 0;
  }

  /**
   * Création : statut `a_confirmer`, accès `non_configure` (modele-fiche §c,
   * statut du mandat CH). `spl_display` n'est pas posé.
   */
  async insertCard(
    splId: string,
    patch: SupplierCardPatch,
    by: string,
  ): Promise<void> {
    const { error } = await this.supabase.from(T_SUPPLIER).insert({
      ...patch,
      spl_id: splId,
      spl_status: 'a_confirmer',
      spl_access_state: 'non_configure',
      spl_updated_at: new Date().toISOString(),
      spl_updated_by: by,
    });
    if (error) {
      if (error.code === '23505') throw new SupplierIdConflictError(splId);
      throw new Error(`insertCard failed: ${error.message}`);
    }
  }

  /**
   * Mise à jour des colonnes saisies. `clearLocationValidation` efface la
   * validation de Marwane quand la localisation change : une validation ne
   * couvre que l'adresse qu'elle a vue.
   * @returns false si le fournisseur n'existe pas.
   */
  async updateCard(
    splId: string,
    patch: SupplierCardPatch,
    by: string,
    clearLocationValidation: boolean,
  ): Promise<boolean> {
    return this.updateRow(
      splId,
      {
        ...patch,
        ...(clearLocationValidation
          ? { spl_location_validated_at: null, spl_location_validated_by: null }
          : {}),
      },
      by,
      'updateCard',
    );
  }

  /** Retrait : archive + masqué, sans DELETE ; liens et prix intacts. */
  async archive(splId: string, by: string): Promise<boolean> {
    return this.updateRow(
      splId,
      { spl_status: 'archive', spl_display: '0' },
      by,
      'archive',
    );
  }

  /** Validation de la localisation : action explicite d'un humain, jamais calculée. */
  async validateLocation(splId: string, by: string): Promise<boolean> {
    return this.updateRow(
      splId,
      {
        spl_location_validated_at: new Date().toISOString(),
        spl_location_validated_by: by,
      },
      by,
      'validateLocation',
    );
  }

  private async updateRow(
    splId: string,
    values: Partial<Record<SupplierCardColumn, string | number | null>>,
    by: string,
    label: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from(T_SUPPLIER)
      .update({
        ...values,
        spl_updated_at: new Date().toISOString(),
        spl_updated_by: by,
      })
      .eq('spl_id', splId)
      .select('spl_id');
    if (error) throw new Error(`${label} failed: ${error.message}`);
    return (data ?? []).length > 0;
  }
}
