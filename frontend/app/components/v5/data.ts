/**
 * ⚠️  MOCK DATA — V5 ship 1 only
 *
 * Ce fichier sera SUPPRIMÉ au ship 2 (wiring backend réel via
 * `frontend/app/services/pieces/pieces.service.ts`).
 *
 * Issue de tracking : à créer dans la PR du ship 1 — "V5 ship 2: replace mock data with real loaders".
 *
 * NE PAS :
 *   - importer ce fichier ailleurs que sous frontend/app/routes/_v5* ou frontend/app/components/v5/*
 *   - étendre le mock avec de nouveaux produits (toute donnée vient des loaders Remix au ship 2)
 *   - utiliser ces refs en dur dans les tests E2E (préférer des fixtures de test)
 *
 * Source : design pack `Automecanik Design System` v5/data.jsx (port verbatim).
 */

export type V5Category = {
  key: string;
  label: string;
  icon: string;
};

export type V5Product = {
  ref: string;
  brand: string;
  name: string;
  price: number;
  priceOld?: number;
  stock: number;
  badge?: string;
  badgeVariant?: "promo" | "warning" | "success";
  cat: string;
};

export const CATEGORIES: V5Category[] = [
  { key: "freinage", label: "Freinage", icon: "shield" },
  { key: "moteur", label: "Moteur", icon: "bolt" },
  { key: "filtration", label: "Filtration", icon: "filter" },
  { key: "vidange", label: "Vidange", icon: "wrench" },
  { key: "embrayage", label: "Embrayage", icon: "wrench" },
  { key: "echappement", label: "Échappement", icon: "flame" },
  { key: "suspension", label: "Suspension", icon: "truck" },
  { key: "electricite", label: "Électricité", icon: "bolt" },
];

export const PRODUCTS: V5Product[] = [
  {
    ref: "BR-2412",
    brand: "Bosch",
    name: "Plaquettes de frein avant — Peugeot 308",
    price: 42.9,
    priceOld: 58,
    stock: 24,
    badge: "-26%",
    cat: "freinage",
  },
  {
    ref: "FH-0921",
    brand: "Mann-Filter",
    name: "Filtre à huile original moteur 1.6 BlueHDi",
    price: 9.9,
    stock: 132,
    cat: "filtration",
  },
  {
    ref: "AM-3304",
    brand: "Total",
    name: "Huile moteur 5W-30 Quartz 9000 — bidon 5L",
    price: 38.5,
    stock: 48,
    cat: "vidange",
  },
  {
    ref: "CB-7812",
    brand: "Valeo",
    name: "Kit embrayage complet 3 pièces — 308 II",
    price: 189.0,
    priceOld: 235,
    stock: 4,
    badge: "STOCK BAS",
    badgeVariant: "warning",
    cat: "embrayage",
  },
  {
    ref: "BD-5501",
    brand: "ATE",
    name: "Disques de frein avant Ø 283mm (paire)",
    price: 67.2,
    stock: 18,
    cat: "freinage",
  },
  {
    ref: "FA-0214",
    brand: "Mann-Filter",
    name: "Filtre à air panneau — moteur HDi",
    price: 14.5,
    stock: 96,
    cat: "filtration",
  },
  {
    ref: "AM-7755",
    brand: "Castrol",
    name: "Huile moteur Edge 5W-30 LL — bidon 5L",
    price: 44.9,
    priceOld: 52,
    stock: 22,
    badge: "PROMO",
    cat: "vidange",
  },
  {
    ref: "BL-3398",
    brand: "Brembo",
    name: "Liquide de frein DOT 4 — 1L",
    price: 7.9,
    stock: 0,
    cat: "freinage",
  },
  {
    ref: "EM-1102",
    brand: "Bosch",
    name: "Bougies d'allumage iridium (jeu de 4)",
    price: 32.4,
    stock: 12,
    cat: "moteur",
  },
  {
    ref: "EC-4408",
    brand: "Bosal",
    name: "Silencieux arrière inox — 308 II",
    price: 124.9,
    stock: 6,
    cat: "echappement",
  },
];

export const findProduct = (ref: string): V5Product | undefined =>
  PRODUCTS.find((p) => p.ref === ref);
