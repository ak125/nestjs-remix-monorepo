/**
 * Types pour le Moteur de Substitution Semantique
 *
 * Matrice HTTP:
 * | Cas                          | Code |
 * |------------------------------|------|
 * | Intention valide mais floue  | 412  | Lock: besoin de contexte
 * | Intention valide et precise  | 200  | Catalogue normal
 * | Intention fausse             | 410  | Gone: contenu retire
 * | Intention inconnue           | 404  | Not Found: URL incomprehensible
 */

/**
 * Intention extraite de l'URL
 * Parse les tokens pour identifier ce que cherche l'utilisateur
 */
export interface ExtractedIntent {
  // Gamme
  gammeAlias: string;
  gammeId: number | null;

  // Vehicule
  marqueAlias: string | null;
  marqueId: number | null;
  modeleAlias: string | null;
  modeleId: number | null;
  typeAlias: string | null;
  typeId: number | null;

  // Piece specifique (si URL produit)
  pieceId: number | null;

  // Tokens bruts pour recherche fuzzy
  rawTokens: string[];

  // Source de l'URL
  urlType: 'gamme_only' | 'gamme_vehicle' | 'product' | 'unknown';

  // Confiance de l'extraction (0-1)
  confidence: number;
}

/**
 * Types de substitution possibles
 */
export type SubstitutionType =
  | 'product_discontinued' // Produit supprime/indisponible → 410
  | 'vehicle_incomplete' // Vehicule incomplet (manque motorisation) → 412
  | 'vehicle_unknown' // Vehicule totalement inconnu → 412
  | 'technology_ambiguous' // Technologie non specifiee (essence/diesel) → 412
  | 'gamme_empty' // Gamme valide mais 0 produits → 410
  | 'unknown_slug' // URL avec tokens non reconnus → 404
  | 'none'; // Pas de substitution necessaire → 200

/**
 * Matrice HTTP du Moteur de Substitution
 *
 * | Cas                          | Code |
 * |------------------------------|------|
 * | Intention valide mais floue  | 412  | Lock: besoin de contexte
 * | Intention valide et precise  | 200  | Catalogue normal
 * | Intention fausse             | 410  | Gone: contenu retire
 * | Intention inconnue           | 404  | Not Found: URL incomprehensible
 */
export type SubstitutionHttpStatus = 200 | 404 | 410 | 412;

/**
 * Les 4 Types de Verrou 412
 *
 * A - Vehicule manquant: marque/modele/motorisation
 * B - Technologie manquante: plein/ventile, essence/diesel, bi/mono-masse
 * C - Ambiguite metier: butee, joint, capteur, module
 * D - Precision SEO insuffisante: guide vers le bon chemin
 */
export type LockType =
  | 'vehicle' // A - Vehicule manquant
  | 'technology' // B - Technologie manquante
  | 'ambiguity' // C - Ambiguite metier
  | 'precision'; // D - Precision SEO insuffisante

/**
 * Structure du verrou 412
 * "Dis-moi ce que tu as, et je te dirai ce que tu peux acheter"
 */
export interface SubstitutionLock {
  type: LockType;
  missing: string; // Description de ce qui manque

  // Ce qu'on connait deja
  known: {
    gamme?: { id: number; name: string; alias: string };
    marque?: { id: number; name: string };
    modele?: { id: number; name: string };
  };

  // Options pour debloquer
  options: Array<{
    id: number;
    label: string;
    url: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Resultat de la recherche de substitution
 */
export interface SubstitutionResult {
  type: SubstitutionType;
  httpStatus: SubstitutionHttpStatus;
  robots: string;

  // Message utilisateur
  message: string;

  // Verrou 412 (si contexte insuffisant)
  lock?: SubstitutionLock;

  // Bloc 1: Produit de substitution
  substitute?: {
    piece_id: number;
    name: string;
    price: number;
    priceFormatted: string;
    image: string;
    brand: string;
    reference: string;
    url: string;
  };

  // Bloc 2: Vehicule detecte
  detectedVehicle?: {
    marque: string;
    modele: string;
    motorisation: string;
    vehicleId: number | null;
  };

  // Bloc 3: Diagnostic metier
  diagnostic?: {
    symptoms: string[];
    causes: string[];
    tips: string[];
  };

  // Bloc 4: Pieces compatibles
  relatedParts?: Array<{
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    image: string;
    minPrice: number;
    url: string;
  }>;

  // Bloc 5: Suggestions
  suggestions?: Array<{
    label: string;
    url: string;
    reason: 'synonym' | 'typo' | 'family' | 'popular';
  }>;

  // V3: Gammes compatibles avec le véhicule
  compatibleGammes?: Array<{
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_pic?: string;
    total_pieces: number;
    url: string;
  }>;

  // SEO
  seo: {
    title: string;
    description: string;
    h1: string;
    canonical: string;
  };
}

/**
 * Log de substitution pour analytics
 */
export interface SubstitutionLogEntry {
  original_url: string;
  substitution_type: SubstitutionType;
  lock_type: LockType | null; // A/B/C/D
  original_intent: ExtractedIntent;
  substitute_content_id: string | null;
  http_status_served: SubstitutionHttpStatus;
  user_agent: string;
  is_bot: boolean;
  timestamp: Date;
}

/**
 * Parametres pour la RPC get_substitution_data
 */
export interface SubstitutionDataParams {
  gamme_alias: string;
  vehicle_id: number | null;
  marque_alias: string | null;
  modele_alias: string | null;
  type_alias: string | null;
}

/**
 * Reponse de la RPC get_substitution_data
 */
export interface SubstitutionDataResponse {
  // Gamme resolue
  gamme?: {
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    mf_id: number;
    mf_name: string;
  };

  // Best-seller pour Bloc 1
  substitute?: {
    piece_id: number;
    piece_name: string;
    piece_price: number;
    piece_image: string;
    pm_name: string;
    piece_ref: string;
  };

  // Diagnostic SEO pour Bloc 3
  diagnostic?: {
    symptoms: string[];
    causes: string[];
    tips: string[];
  };

  // Pieces meme famille pour Bloc 4
  related_parts?: Array<{
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_pic: string;
    min_price: number;
  }>;

  // Suggestions pour Bloc 5
  suggestions?: Array<{
    pg_name: string;
    pg_alias: string;
    pg_id: number;
    reason: string;
  }>;

  // Motorisations compatibles (pour vehicle_incompatible)
  // V3: Enrichi avec détails véhicule
  compatible_motors?: Array<{
    type_id: number;
    type_name: string;
    type_alias: string;
    // V3: Détails véhicule
    type_fuel?: string; // Diesel, Essence, Hybride, Électrique
    type_power_ps?: string; // Puissance en ch (ex: "110")
    type_year_from?: string; // Année début (ex: "2002")
    type_year_to?: string | null; // Année fin (ex: "2006", null si en cours)
    type_body?: string; // Carrosserie (Berline, Break, SUV, Monospace)
  }>;

  // V3: Gammes compatibles avec le premier véhicule
  compatible_gammes?: Array<{
    pg_id: number;
    pg_name: string;
    pg_alias: string;
    pg_pic?: string;
    total_pieces: number;
  }>;

  // Meta
  _meta?: {
    gamme_found: boolean;
    vehicle_found: boolean;
    products_count: number;
    resolved_by: 'exact' | 'similarity' | 'none';
  };
}
