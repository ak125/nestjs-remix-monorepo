/**
 * DTO pour résoudre des type_ids en informations véhicule enrichies
 */
export interface ResolveVehicleTypesDto {
  type_ids: number[];
}

/**
 * DTO pour résoudre des véhicules par texte (model, variant, energy)
 */
export interface ResolveByTextDto {
  items: Array<{
    model: string;
    variant: string;
    energy?: string;
  }>;
}

/**
 * Interface pour un véhicule enrichi
 */
export interface EnrichedVehicleType {
  type_id: number;
  make: string;
  model: string;
  generation: string;
  engine: string;
  power_hp: number | null;
  year_from: string | null;
  year_to: string | null;
  fuel: string;
  type_name: string;
  type_liter?: string;
  type_body?: string;
}

/**
 * Interface pour la réponse du batch resolve
 */
export interface ResolveVehicleTypesResponse {
  [typeId: number]: EnrichedVehicleType;
}
