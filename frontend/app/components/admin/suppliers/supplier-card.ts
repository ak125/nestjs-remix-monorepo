/**
 * Fiche fournisseur (mandat CH) — types et libellés de l'écran admin, et
 * conversion du formulaire en corps d'API.
 *
 * Contrat backend : `GET/PUT /api/suppliers/:id/card`, `POST /api/suppliers/card`
 * (schémas Zod stricts de backend/src/modules/suppliers/dto/supplier.schemas.ts).
 * Le corps ne contient que les champs connus ; une clé inconnue serait refusée.
 * Aucun champ ne porte une valeur de secret : seulement le NOM de la variable.
 */

export const SUPPLIER_TYPE_LABELS = {
  plateforme: "Plateforme",
  marque_directe: "Marque en direct",
} as const;

export const SUPPLIER_STATUS_LABELS = {
  actif: "Actif",
  occasionnel: "Occasionnel",
  a_confirmer: "À confirmer",
  archive: "Archivé",
} as const;

export const SUPPLY_MODE_LABELS = {
  flux_tendu: "Flux tendu",
  livraison_france: "Livraison France",
  import: "Import",
} as const;

/** Repli si la pièce n'est pas au dépôt (mandat DQ). */
export const FALLBACK_MODE_LABELS = {
  transporteur: "Transporteur",
  aucun: "Aucun repli",
} as const;

/** Nature d'une source d'achat de marque (mandat DQ). */
export const STOCK_KIND_LABELS = {
  stock: "Stock",
  commande: "Commande",
} as const;

export const ORDER_MODE_LABELS = {
  portail: "Portail",
  email: "E-mail",
  telephone: "Téléphone",
  edi: "EDI",
  api: "API",
} as const;

export const ACCESS_STATE_LABELS = {
  non_configure: "Non configuré",
  configure_non_verifie: "Configuré, non vérifié",
  verifie: "Vérifié",
  echec: "Échec",
  revoque: "Révoqué",
} as const;

export const SCOPE_LEVEL_LABELS: Record<string, string> = {
  SUPPLIER: "Fournisseur",
  BRAND: "Marque",
  FAMILY: "Famille",
  SUBFAMILY: "Sous-famille",
};

interface SupplierLinkedBrand {
  linkId: string;
  pmId: number | null;
  brandName: string | null;
  linkDisplayed: boolean;
  /** Rang du lien parmi les sources d'achat de la marque, ou null. */
  sourceRank: number | null;
  /** Point de livraison distinct du fournisseur, ou null. */
  deliverySplId: string | null;
}

/** État d'une règle à la date de lecture (backend, supplier-price-rule.ts). */
export const RULE_STATUS_LABELS: Record<string, string> = {
  en_vigueur: "En vigueur",
  remplacee: "Remplacée",
  a_venir: "À venir",
  expiree: "Expirée",
  inactive: "Inactive",
  sans_taux: "Sans remise ni marge",
};

interface SupplierPriceProfile {
  id: number;
  scopeLevel: string;
  /** Famille : code famille (NU17) ; sous-famille : code sous-famille (1738). */
  scopeCode: string | null;
  /** Marque de la règle (pm_id), ou null. */
  brandPmId: string | null;
  /**
   * "import" : profil lu par l'import tarifaire, en lecture seule ;
   * "condition" : remise / marge saisie sur la fiche (complément CH-3).
   */
  profileKind: "import" | "condition";
  /** Paramètres d'import : ligne "import" seulement. */
  priceBasis: string | null;
  derivation: string | null;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  isPromo: boolean;
  /** État d'une condition ; null pour un profil d'import. */
  ruleStatus: string | null;
  supersededBy: number | null;
  createdBy: string | null;
  changeReason: string | null;
  createdAt: string;
  defaultRemisePct: number | null;
  defaultMargePct: number | null;
  /** Retrait d'une condition : date et auteur. */
  retiredAt: string | null;
  retiredBy: string | null;
}

export interface SupplierDuplicate {
  splId: string;
  name: string | null;
  kind: "exact" | "voisin";
  key: string;
}

export interface SupplierCard {
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
  access: {
    secretName: string | null;
    state: string | null;
    checkedAt: string | null;
  };
  updatedAt: string | null;
  updatedBy: string | null;
  brands: SupplierLinkedBrand[];
  priceProfiles: SupplierPriceProfile[];
  possibleDuplicates: SupplierDuplicate[];
}

/** Libellé d'une valeur codée, ou la valeur brute si elle est inconnue. */
export function labelOf(
  labels: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return labels[value] ?? value;
}

/** Champs texte du formulaire envoyés tels quels (le backend vide '' en null). */
const TEXT_FIELDS = [
  "name",
  "alias",
  "type",
  "contactName",
  "email",
  "phone",
  "website",
  "address",
  "postcode",
  "city",
  "country",
  "supplyMode",
  "fallbackMode",
  "paymentTerms",
  "deliveryDelayDays",
  "orderMode",
  "portalUrl",
  "secretName",
] as const;

/** Champs du formulaire de règle de remise (complément CH-2). */
const PRICE_RULE_FIELDS = [
  "scopeLevel",
  "brandPmId",
  "scopeCode",
  "remisePct",
  "margePct",
  "effectiveFrom",
  "effectiveTo",
  "changeReason",
] as const;

/**
 * Formulaire de règle → corps de POST /api/suppliers/:id/price-rules. Seules
 * les clés connues et non vides partent ; les contrôles de forme (marque,
 * code, période, bornes) restent ceux du schéma Zod du backend.
 */
export function priceRuleFormToBody(
  form: FormData,
): Partial<Record<(typeof PRICE_RULE_FIELDS)[number], string>> {
  const body: Partial<Record<(typeof PRICE_RULE_FIELDS)[number], string>> = {};
  for (const field of PRICE_RULE_FIELDS) {
    const value = String(form.get(field) ?? "").trim();
    if (value !== "") body[field] = value;
  }
  return body;
}

/**
 * Euros saisis (« 150 », « 150,5 », « 150.50 ») → centimes entiers, sans
 * arithmétique flottante. '' → null. Valeur invalide → undefined.
 */
export function eurosToCents(input: string): number | null | undefined {
  const value = input.trim().replace(/\s/g, "");
  if (value === "") return null;
  const m = value.match(/^(\d{1,9})(?:[.,](\d{1,2}))?$/);
  if (!m) return undefined;
  const cents = (m[2] ?? "").padEnd(2, "0");
  return Number(m[1]) * 100 + Number(cents);
}

/** Centimes → saisie en euros (« 150,50 »), '' si absent. */
export function centsToEuros(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const euros = Math.trunc(cents / 100);
  const rest = String(cents % 100).padStart(2, "0");
  return rest === "00" ? String(euros) : `${euros},${rest}`;
}

export type CardFormResult =
  | { ok: true; body: Record<string, string | number | null> }
  | { ok: false; errors: Record<string, string> };

/**
 * Formulaire → corps d'API. `mode = 'create'` n'envoie pas de statut (imposé
 * « à confirmer » par le backend) ; `mode = 'update'` envoie le statut sauf
 * « archive », qui ne se pose que par le retrait.
 */
export function cardFormToBody(
  form: FormData,
  mode: "create" | "update",
): CardFormResult {
  const body: Record<string, string | number | null> = {};
  const errors: Record<string, string> = {};
  for (const field of TEXT_FIELDS) {
    const raw = form.get(field);
    if (typeof raw === "string") body[field] = raw.trim();
  }
  const franco = form.get("francoEuros");
  if (typeof franco === "string") {
    const cents = eurosToCents(franco);
    if (cents === undefined) {
      errors.francoEuros = "Montant en euros attendu (ex. 150 ou 150,50)";
    } else {
      body.francoHtCents = cents;
    }
  }
  if (mode === "update") {
    const status = form.get("status");
    if (typeof status === "string" && status !== "archive") {
      body.status = status;
    }
  }
  if (!body.name) errors.name = "Le nom du fournisseur est requis";
  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, body };
}

export interface CardApiError {
  message: string;
  fieldErrors: Record<string, string>;
  duplicates: SupplierDuplicate[];
}

/** Réponse d'erreur du backend (400 Zod, 409 doublon, autre) → message affiché. */
export function readCardApiError(
  status: number,
  payload: unknown,
): CardApiError {
  const p = (payload ?? {}) as {
    message?: unknown;
    errors?: { field?: string; message?: string }[];
    duplicates?: SupplierDuplicate[];
  };
  const fieldErrors: Record<string, string> = {};
  for (const e of Array.isArray(p.errors) ? p.errors : []) {
    if (e.field && e.message) {
      fieldErrors[e.field === "francoHtCents" ? "francoEuros" : e.field] =
        e.message;
    }
  }
  const duplicates = Array.isArray(p.duplicates) ? p.duplicates : [];
  const message =
    typeof p.message === "string"
      ? p.message
      : Array.isArray(p.message)
        ? p.message.join(" ; ")
        : `Erreur ${status}`;
  return { message, fieldErrors, duplicates };
}

// ===== SOURCES D'ACHAT PAR MARQUE (mandat DQ) =====
// Contrat backend : GET/PUT /api/suppliers/brands/:pmId/sources (schéma Zod
// strict PutBrandSourcesSchema). Rang = position dans la liste envoyée.

export interface ResolvedBrandSource {
  rank: number;
  linkId: string;
  source: { splId: string; name: string | null; type: string | null };
  delivery: { splId: string; name: string | null; isSource: boolean };
  stockKind: "stock" | "commande" | null;
  surchargeCents: number | null;
  supplyMode: string | null;
  fallbackMode: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface BrandSources {
  pmId: number;
  brandName: string | null;
  sources: ResolvedBrandSource[];
  issues: Array<{
    code: string;
    rank: number;
    linkId: string;
    message: string;
  }>;
  unrankedLinks: Array<{
    linkId: string;
    splId: string;
    name: string | null;
    displayed: boolean;
  }>;
  activeSuppliers: Array<{
    splId: string;
    name: string | null;
    type: string | null;
    supplyMode: string | null;
    fallbackMode: string | null;
  }>;
}

export interface BrandSourceBody {
  splId: string;
  linkId?: string;
  deliverySplId?: string;
  stockKind: string;
  surchargeCents: number;
}

export type BrandSourcesFormResult =
  | { ok: true; body: { sources: BrandSourceBody[] } }
  | { ok: false; errors: string[] };

/**
 * Formulaire de l'écran des sources → corps du PUT. Chaque ligne `i` porte
 * `rank_i`, `splId_i`, `linkId_i`, `deliverySplId_i`, `stockKind_i` et
 * `surcharge_i` (euros) ; une ligne sans fournisseur ou sans rang est
 * ignorée (son lien éventuel reste en place, non classé). Les lignes
 * sont triées par rang saisi, qui doit être unique ; le rang envoyé est la
 * position. Les contrôles d'existence et de statut restent au backend.
 */
export function brandSourcesFormToBody(
  form: FormData,
  rowCount: number,
): BrandSourcesFormResult {
  const rows: Array<{ rank: number; body: BrandSourceBody }> = [];
  const errors: string[] = [];
  const seenRanks = new Set<number>();
  for (let i = 0; i < rowCount; i++) {
    const read = (key: string) => String(form.get(`${key}_${i}`) ?? "").trim();
    const splId = read("splId");
    const rankRaw = read("rank");
    // Sans fournisseur ou sans rang : pas une source (le lien reste, non classé).
    if (splId === "" || rankRaw === "") continue;
    const line = `Ligne ${i + 1}`;
    const rank = /^\d{1,2}$/.test(rankRaw) ? Number(rankRaw) : NaN;
    if (!Number.isInteger(rank) || rank < 1) {
      errors.push(`${line} : rang entier ≥ 1 attendu`);
      continue;
    }
    if (seenRanks.has(rank)) errors.push(`${line} : rang ${rank} déjà pris`);
    seenRanks.add(rank);
    const stockKind = read("stockKind");
    if (!(stockKind in STOCK_KIND_LABELS))
      errors.push(`${line} : nature stock ou commande attendue`);
    const cents = eurosToCents(read("surcharge"));
    if (cents === undefined)
      errors.push(`${line} : surcoût en euros attendu (ex. 3 ou 3,50)`);
    const body: BrandSourceBody = {
      splId,
      stockKind,
      surchargeCents: cents ?? 0,
    };
    const linkId = read("linkId");
    if (linkId !== "") body.linkId = linkId;
    const delivery = read("deliverySplId");
    if (delivery !== "" && delivery !== splId) body.deliverySplId = delivery;
    rows.push({ rank, body });
  }
  if (errors.length > 0) return { ok: false, errors };
  rows.sort((a, b) => a.rank - b.rank);
  return { ok: true, body: { sources: rows.map((r) => r.body) } };
}
