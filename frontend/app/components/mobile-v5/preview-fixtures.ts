/**
 * Fixtures de preview — UNIQUEMENT pour les routes /preview-mobile/*.
 *
 * Ces données simulent un parcours pieces auto pour permettre la validation
 * visuelle des composants mobile-V5 avant migration vers les routes V4.
 *
 * Après validation et migration des composants vers les routes V4 réelles,
 * ce fichier ET le dossier `preview-mobile/` complet seront supprimés.
 */

import { type MV5Product } from "./ProductCard";

export type MV5Category = {
  key: string;
  label: string;
  iconKey: string;
};

export const MV5_CATEGORIES: MV5Category[] = [
  { key: "freinage", label: "Freinage", iconKey: "shield" },
  { key: "moteur", label: "Moteur", iconKey: "bolt" },
  { key: "filtration", label: "Filtration", iconKey: "filter" },
  { key: "vidange", label: "Vidange", iconKey: "wrench" },
  { key: "embrayage", label: "Embrayage", iconKey: "wrench" },
  { key: "echappement", label: "Échappement", iconKey: "flame" },
  { key: "suspension", label: "Suspension", iconKey: "truck" },
  { key: "electricite", label: "Électricité", iconKey: "bolt" },
];

export const MV5_PRODUCTS: (MV5Product & { cat: string })[] = [
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

export const MV5_PREVIEW_VEHICLE = {
  label: "Peugeot 308 II",
  sub: "2017 · 1.6 BlueHDi 120",
};

export const findPreviewProduct = (
  ref: string,
): (MV5Product & { cat: string }) | undefined =>
  MV5_PRODUCTS.find((p) => p.ref === ref);
