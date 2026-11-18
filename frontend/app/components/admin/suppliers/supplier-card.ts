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
}

interface SupplierPriceProfile {
  id: number;
  scopeLevel: string;
  scopeCode: string | null;
  priceBasis: string;
  derivation: string;
  version: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  active: boolean;
  isPromo: boolean;
  createdBy: string | null;
  changeReason: string | null;
  createdAt: string;
  defaultRemisePct: number | null;
  defaultMargePct: number | null;
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
  "paymentTerms",
  "deliveryDelayDays",
  "orderMode",
  "portalUrl",
  "secretName",
] as const;

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
