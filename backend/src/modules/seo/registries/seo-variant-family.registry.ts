import { Injectable } from '@nestjs/common';
import { z } from 'zod';

/**
 * Catalogue des 4 familles de tables `__seo_*_switch` qui stockent les
 * variantes de contenu par alias (gamme×véhicule, véhicule contextuel, etc.).
 *
 * Aligné sur l'audit PR-1 du plan `seo-v9` (inventaire DB seo_*).
 */
export const VariantFamilyKeySchema = z.enum([
  'ITEM_SWITCH', // __seo_item_switch (R1 catalogue, alias 1=title 2=descrip 3=h1)
  'TYPE_SWITCH', // __seo_type_switch (R8 véhicule, alias 1/2/10/11/12)
  'GAMME_CAR_SWITCH', // __seo_gamme_car_switch (variantes contenu gamme×véhicule)
  'FAMILY_GAMME_CAR_SWITCH', // __seo_family_gamme_car_switch (variantes par famille)
]);
export type VariantFamilyKey = z.infer<typeof VariantFamilyKeySchema>;

export interface VariantFamilyConfig {
  table: string;
  /** Aliases observés en prod (cf. audit PR-1). */
  knownAliases: number[];
  /** Description fonctionnelle. */
  purpose: string;
}

const VARIANT_FAMILIES: Record<VariantFamilyKey, VariantFamilyConfig> = {
  ITEM_SWITCH: {
    table: '__seo_item_switch',
    knownAliases: [1, 2, 3],
    purpose: 'R1 catalogue gamme×véhicule : title (1), description (2), h1 (3)',
  },
  TYPE_SWITCH: {
    table: '__seo_type_switch',
    knownAliases: [1, 2, 10, 11, 12],
    purpose: 'R8 véhicule : variantes contextuelles par type',
  },
  GAMME_CAR_SWITCH: {
    table: '__seo_gamme_car_switch',
    knownAliases: [],
    purpose: 'Variantes contenu textes/CTAs gamme×véhicule',
  },
  FAMILY_GAMME_CAR_SWITCH: {
    table: '__seo_family_gamme_car_switch',
    knownAliases: [],
    purpose: 'Variantes par famille produit (mfId)',
  },
};

@Injectable()
export class SeoVariantFamilyRegistry {
  list(): VariantFamilyKey[] {
    return VariantFamilyKeySchema.options as VariantFamilyKey[];
  }

  resolveTable(key: VariantFamilyKey): string {
    VariantFamilyKeySchema.parse(key);
    return VARIANT_FAMILIES[key].table;
  }

  getConfig(key: VariantFamilyKey): VariantFamilyConfig {
    VariantFamilyKeySchema.parse(key);
    return VARIANT_FAMILIES[key];
  }
}
