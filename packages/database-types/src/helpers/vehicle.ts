/**
 * Vehicle Helpers
 *
 * Utility functions for formatting and manipulating vehicle data
 *
 * @version 2.0.0
 * @package @repo/database-types
 */

// ====================================
// DATE FORMATTING
// ====================================

/**
 * Formate les dates de production comme dans le PHP
 * @example
 * formatProductionDate("06", "2005", "12", "2012") => "de 2005 a 2012"
 * formatProductionDate("06", "2020", null, null) => "depuis 06/2020"
 */
export function formatProductionDate(
  monthFrom?: string | null,
  yearFrom?: string | null,
  monthTo?: string | null,
  yearTo?: string | null,
): string {
  if (!yearFrom) return '';

  if (!yearTo) {
    // Vehicule encore en production
    if (monthFrom) {
      return `depuis ${monthFrom}/${yearFrom}`;
    }
    return `depuis ${yearFrom}`;
  }

  // Vehicule arrete
  return `de ${yearFrom} a ${yearTo}`;
}

/**
 * Formate les dates de production en version detaillee avec mois
 * @example
 * formatProductionDateDetailed("06", "2005", "12", "2012") => "06/2005 → 12/2012"
 */
export function formatProductionDateDetailed(
  monthFrom?: string | null,
  yearFrom?: string | null,
  monthTo?: string | null,
  yearTo?: string | null,
): string {
  if (!yearFrom) return '';

  const dateDebut = monthFrom ? `${monthFrom}/${yearFrom}` : yearFrom;

  if (!yearTo) {
    return `depuis ${dateDebut}`;
  }

  const dateFin = monthTo ? `${monthTo}/${yearTo}` : yearTo;
  return `${dateDebut} -> ${dateFin}`;
}

// ====================================
// POWER FORMATTING
// ====================================

/**
 * Formate la puissance en ch et kW
 * @example
 * formatPower(75, 55) => "75 ch / 55 kW"
 * formatPower(75) => "75 ch / 55 kW" (calcule kW)
 */
export function formatPower(
  powerPs?: number | string | null,
  powerKw?: number | string | null,
): string {
  const ps = typeof powerPs === 'string' ? parseInt(powerPs, 10) : powerPs;
  let kw = typeof powerKw === 'string' ? parseInt(powerKw, 10) : powerKw;

  if (!ps && !kw) return '';

  // Conversion si kW manquant (1 ch = 0.7355 kW)
  if (ps && !kw) {
    kw = Math.round(ps * 0.7355);
  }

  if (ps && kw) {
    return `${ps} ch / ${kw} kW`;
  }

  if (ps) return `${ps} ch`;
  if (kw) return `${kw} kW`;

  return '';
}

/**
 * Convert PS (chevaux) to kW
 */
export function psToKw(ps: number): number {
  return Math.round(ps * 0.7355);
}

/**
 * Convert kW to PS (chevaux)
 */
export function kwToPs(kw: number): number {
  return Math.round(kw / 0.7355);
}

// ====================================
// CYLINDER/LITER FORMATTING
// ====================================

/**
 * Convertit la cylindree de litres en cm3
 * @example
 * literToCm3("1.5") => 1500
 * literToCm3("2.0") => 2000
 */
export function literToCm3(liter?: string | null): number | undefined {
  if (!liter) return undefined;
  const liters = parseFloat(liter);
  if (isNaN(liters)) return undefined;
  return Math.round(liters * 1000);
}

/**
 * Convertit la cylindree de cm3 en litres
 * @example
 * cm3ToLiter(1500) => "1.5"
 */
export function cm3ToLiter(cm3: number): string {
  return (cm3 / 1000).toFixed(1);
}

/**
 * Formate la cylindree avec les deux unites
 * @example
 * formatCylinder("1.5") => "1500 cm3 (1.5 L)"
 */
export function formatCylinder(liter?: string | null): string {
  if (!liter) return '';
  const cm3 = literToCm3(liter);
  if (!cm3) return '';
  return `${cm3} cm3 (${liter} L)`;
}

// ====================================
// CODE FORMATTING
// ====================================

/**
 * Formate un tableau de codes en chaine separee par virgules
 * @example
 * formatCodes(["K9K 752", "K9K 764"]) => "K9K 752, K9K 764"
 */
export function formatCodes(codes?: string[] | null): string {
  if (!codes || codes.length === 0) return '';
  return codes.filter(Boolean).join(', ');
}

/**
 * Parse une chaine de codes en tableau
 * @example
 * parseCodes("K9K 752, K9K 764") => ["K9K 752", "K9K 764"]
 */
export function parseCodes(codesString?: string | null): string[] {
  if (!codesString) return [];
  return codesString
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);
}

// ====================================
// URL GENERATION
// ====================================

/**
 * Genere l'URL du vehicule au format Automecanik
 * @example
 * generateVehicleUrl({marque_alias: "renault", marque_id: 5, ...})
 * => "/constructeurs/renault-5/clio-iii-5010/1-5-dci-16789.html"
 */
export function generateVehicleUrl(vehicle: {
  marque_alias: string;
  marque_id: number;
  modele_alias: string;
  modele_id: number;
  type_alias: string;
  type_id: number;
}): string {
  return `/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`;
}

/**
 * Genere l'URL d'une page produit pour un vehicule
 */
export function generateProductVehicleUrl(params: {
  gamme_alias: string;
  gamme_id: number;
  marque_alias: string;
  marque_id: number;
  modele_alias: string;
  modele_id: number;
  type_alias: string;
  type_id: number;
}): string {
  return `/pieces/${params.gamme_alias}-${params.gamme_id}/${params.marque_alias}-${params.marque_id}/${params.modele_alias}-${params.modele_id}/${params.type_alias}-${params.type_id}.html`;
}

/**
 * Genere l'URL d'une page marque
 */
export function generateBrandUrl(brand: {
  marque_alias: string;
  marque_id: number;
}): string {
  return `/constructeurs/${brand.marque_alias}-${brand.marque_id}.html`;
}

/**
 * Genere l'URL d'une page modele
 */
export function generateModelUrl(model: {
  marque_alias: string;
  marque_id: number;
  modele_alias: string;
  modele_id: number;
}): string {
  return `/constructeurs/${model.marque_alias}-${model.marque_id}/${model.modele_alias}-${model.modele_id}.html`;
}

// ====================================
// SLUG GENERATION
// ====================================

/**
 * Genere un slug a partir d'un nom
 * @example
 * generateSlug("Renault Clio III") => "renault-clio-iii"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ====================================
// VEHICLE NAME FORMATTING
// ====================================

/**
 * Formate le nom complet du vehicule
 * @example
 * formatVehicleFullName({marque: "Renault", modele: "Clio III", type: "1.5 DCI"})
 * => "Renault Clio III 1.5 DCI"
 */
export function formatVehicleFullName(vehicle: {
  marque?: string;
  modele?: string;
  type?: string;
}): string {
  return [vehicle.marque, vehicle.modele, vehicle.type]
    .filter(Boolean)
    .join(' ');
}

/**
 * Formate le nom court du vehicule (marque + modele)
 */
export function formatVehicleShortName(vehicle: {
  marque?: string;
  modele?: string;
}): string {
  return [vehicle.marque, vehicle.modele].filter(Boolean).join(' ');
}

// ====================================
// YEAR RANGE HELPERS
// ====================================

/**
 * Verifie si une annee est dans une plage
 */
export function isYearInRange(
  year: number,
  yearFrom?: number | string | null,
  yearTo?: number | string | null,
): boolean {
  const from = yearFrom ? parseInt(String(yearFrom), 10) : 1900;
  const to = yearTo ? parseInt(String(yearTo), 10) : new Date().getFullYear();

  return year >= from && year <= to;
}

/**
 * Retourne la liste des annees disponibles pour un vehicule
 */
export function getAvailableYears(
  yearFrom?: number | string | null,
  yearTo?: number | string | null,
): number[] {
  const from = yearFrom ? parseInt(String(yearFrom), 10) : 1980;
  const to = yearTo ? parseInt(String(yearTo), 10) : new Date().getFullYear();

  const years: number[] = [];
  for (let year = to; year >= from; year--) {
    years.push(year);
  }
  return years;
}
