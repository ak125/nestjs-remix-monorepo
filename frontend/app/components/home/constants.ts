import {
  FAMILY_REGISTRY,
  FAMILY_IDS_ORDERED,
  FAMILY_DOMAIN_GROUPS,
} from "@repo/database-types";
import { type LucideIcon, Car, Cog, Shield, Wrench, Zap } from "lucide-react";

// ─── Image proxy paths ───────────────────────────────────
export const IMG_PROXY_LOGOS =
  "/img/uploads/constructeurs-automobiles/marques-logos";
export const IMG_PROXY_FAMILIES = "/img/uploads/articles/familles-produits";

// ─── Fallback: 19 product families (keyed par mf_id) ────
// Les noms/ordre réels viennent de l'API. Ceci est le fallback SSR.
const CATS_FALLBACK: Record<number, { desc: string; sub: string[] }> = {
  1: {
    desc: "Filtres huile, air, carburant et habitacle. Remplacement selon préconisations.",
    sub: [
      "Filtre à huile",
      "Filtre à air",
      "Filtre à carburant",
      "Filtre d'habitacle",
    ],
  },
  2: {
    desc: "Plaquettes, disques et étriers pour un freinage fiable et sécurisé.",
    sub: [
      "Plaquette de frein",
      "Disque de frein",
      "Étrier de frein",
      "Témoin d'usure de plaquettes de frein",
    ],
  },
  3: {
    desc: "Courroies, galets et kits de distribution pour la synchronisation moteur.",
    sub: [
      "Courroie d'accessoire",
      "Galet tendeur de courroie d'accessoire",
      "Galet enrouleur de courroie d'accessoire",
      "Kit de distribution",
    ],
  },
  4: {
    desc: "Bougies, faisceaux et boîtiers pour le démarrage et la combustion moteur.",
    sub: [
      "Bougie de préchauffage",
      "Boîtier de préchauffage",
      "Bougie d'allumage",
      "Faisceau d'allumage",
    ],
  },
  5: {
    desc: "Rotules, bras et barres de direction pour la tenue de route et la sécurité.",
    sub: [
      "Rotule de direction",
      "Barre de direction",
      "Rotule de suspension",
      "Bras de suspension",
    ],
  },
  6: {
    desc: "Amortisseurs, ressorts et butées pour le confort et la tenue de route.",
    sub: [
      "Amortisseur",
      "Butée de suspension",
      "Butée élastique d'amortisseur",
      "Ressort de suspension",
    ],
  },
  7: {
    desc: "Supports moteur et boîte de vitesses pour absorber vibrations et chocs.",
    sub: ["Support moteur", "Support de boîte de vitesses"],
  },
  9: {
    desc: "Kits, butées et récepteurs d'embrayage pour un passage de vitesses fluide.",
    sub: [
      "Kit d'embrayage",
      "Butée d'embrayage hydraulique",
      "Émetteur d'embrayage",
      "Récepteur d'embrayage",
    ],
  },
  10: {
    desc: "Cardans, soufflets et paliers pour transmettre le mouvement aux roues.",
    sub: [
      "Cardan",
      "Soufflet de cardan",
      "Bague d'étanchéité arbre de roue",
      "Palier d'arbre",
    ],
  },
  11: {
    desc: "Alternateurs, démarreurs et contacteurs pour le circuit électrique du véhicule.",
    sub: ["Alternateur", "Démarreur", "Neiman", "Contacteur démarreur"],
  },
  12: {
    desc: "Capteurs pression, niveau et impulsion pour le contrôle électronique moteur.",
    sub: [
      "Pressostat d'huile",
      "Capteur d'impulsion",
      "Capteur de pression",
      "Capteur de niveau d'huile",
    ],
  },
  13: {
    desc: "Débitmètres, vannes EGR et pompes pour l'alimentation air et carburant.",
    sub: [
      "Débitmètre d'air",
      "Vanne EGR",
      "Pompe à carburant",
      "Joint d'injecteur",
    ],
  },
  14: {
    desc: "Joints de culasse, cache-culbuteurs et bagues d'étanchéité moteur.",
    sub: [
      "Joint de culasse",
      "Joint cache culbuteurs",
      "Bagues d'étanchéité vilebrequin",
      "Vis de culasse",
    ],
  },
  15: {
    desc: "Pompes à eau, radiateurs et thermostats pour le circuit de refroidissement.",
    sub: [
      "Pompe à eau",
      "Radiateur",
      "Thermostat d'eau",
      "Sonde de refroidissement",
    ],
  },
  16: {
    desc: "Compresseurs, condenseurs et pulseurs pour la climatisation et le chauffage.",
    sub: [
      "Pulseur d'air",
      "Compresseur de climatisation",
      "Condenseur de climatisation",
      "Évaporateur",
    ],
  },
  17: {
    desc: "Catalyseurs, FAP, sondes lambda et joints pour la ligne d'échappement.",
    sub: [
      "Catalyseur",
      "Filtre à particules (FAP)",
      "Sonde lambda",
      "Joint d'échappement",
    ],
  },
  18: {
    desc: "Phares, feux arrière et clignotants pour l'éclairage et la signalisation.",
    sub: ["Feu avant", "Feu arrière", "Feu clignotant", "Phare antibrouillard"],
  },
  19: {
    desc: "Essuie-glaces, rétroviseurs et lève-vitres pour le confort au quotidien.",
    sub: [
      "Balai d'essuie-glace",
      "Commande d'essuie-glace",
      "Rétroviseur",
      "Lève-vitre",
    ],
  },
  20: {
    desc: "Turbocompresseurs, gaines et valves pour la suralimentation moteur.",
    sub: [
      "Turbocompresseur",
      "Gaine de turbo",
      "Valve de turbo",
      "Capteur de pression de turbo",
    ],
  },
};

// Noms DB fallback (keyed par mf_id) — en prod ces noms viennent de l'API
const FAMILY_NAMES: Record<number, string> = {
  1: "Système de filtration",
  2: "Système de freinage",
  3: "Courroie, galet, poulie et chaîne",
  4: "Allumage / Préchauffage",
  5: "Direction / Train avant",
  6: "Amortisseur / Suspension",
  7: "Support moteur",
  9: "Embrayage",
  10: "Transmission",
  11: "Électrique",
  12: "Capteurs / Sondes",
  13: "Alimentation Carburant & Air",
  14: "Moteur",
  15: "Refroidissement",
  16: "Climatisation",
  17: "Échappement",
  18: "Éclairage / Signalisation",
  19: "Accessoires",
  20: "Turbo / Suralimentation",
};

export const CATS = FAMILY_IDS_ORDERED.map((id) => {
  const meta = FAMILY_REGISTRY[id];
  const fb = CATS_FALLBACK[id] ?? { desc: "", sub: [] };
  return {
    mf_id: id,
    i: meta?.emoji ?? "❓",
    pic: meta?.pic ?? "",
    n: FAMILY_NAMES[id] ?? `Famille #${id}`,
    desc: fb.desc,
    sub: fb.sub,
  };
});

// ─── Catalogue domain tabs (keyed par mf_id) ────────────
const ICON_MAP: Record<string, LucideIcon> = { Car, Cog, Shield, Wrench, Zap };

export const CATALOG_DOMAINS: {
  label: string;
  icon: LucideIcon;
  familyIds: number[] | null;
}[] = FAMILY_DOMAIN_GROUPS.map((g) => ({
  label: g.label,
  icon: ICON_MAP[g.icon] ?? Car,
  familyIds: g.familyIds,
}));

// ─── Fallback: brand list ────────────────────────────────
export const MARQUES = [
  { n: "Renault", f: "🇫🇷" },
  { n: "Peugeot", f: "🇫🇷" },
  { n: "Citroën", f: "🇫🇷" },
  { n: "Dacia", f: "🇷🇴" },
  { n: "DS", f: "🇫🇷" },
  { n: "Volkswagen", f: "🇩🇪" },
  { n: "BMW", f: "🇩🇪" },
  { n: "Mercedes", f: "🇩🇪" },
  { n: "Audi", f: "🇩🇪" },
  { n: "Opel", f: "🇩🇪" },
  { n: "Porsche", f: "🇩🇪" },
  { n: "Toyota", f: "🇯🇵" },
  { n: "Nissan", f: "🇯🇵" },
  { n: "Honda", f: "🇯🇵" },
  { n: "Mazda", f: "🇯🇵" },
  { n: "Suzuki", f: "🇯🇵" },
  { n: "Mitsubishi", f: "🇯🇵" },
  { n: "Ford", f: "🇺🇸" },
  { n: "Chevrolet", f: "🇺🇸" },
  { n: "Jeep", f: "🇺🇸" },
  { n: "Fiat", f: "🇮🇹" },
  { n: "Alfa Romeo", f: "🇮🇹" },
  { n: "Lancia", f: "🇮🇹" },
  { n: "Seat", f: "🇪🇸" },
  { n: "Cupra", f: "🇪🇸" },
  { n: "Skoda", f: "🇨🇿" },
  { n: "Volvo", f: "🇸🇪" },
  { n: "Saab", f: "🇸🇪" },
  { n: "Hyundai", f: "🇰🇷" },
  { n: "Kia", f: "🇰🇷" },
  { n: "SsangYong", f: "🇰🇷" },
  { n: "Land Rover", f: "🇬🇧" },
  { n: "Jaguar", f: "🇬🇧" },
  { n: "Mini", f: "🇬🇧" },
  { n: "Smart", f: "🇩🇪" },
  { n: "Tesla", f: "🇺🇸" },
];

// ─── Fallback: blog articles ─────────────────────────────
export const BLOG = [
  {
    ico: "🛒",
    t: "Plaquettes de frein : organique, semi-métallique ou céramique ?",
    d: "Les critères essentiels pour sélectionner la bonne matière selon votre usage.",
    tag: "Guide d'achat",
  },
  {
    ico: "📰",
    t: "Entretien auto : le calendrier par km",
    d: "Vidange, filtres, distribution, freins — quand changer quoi selon votre kilométrage.",
    tag: "Entretien",
  },
  {
    ico: "💡",
    t: "5 pièces à vérifier avant le contrôle technique",
    d: "Freinage, éclairage, échappement, suspension, direction — les points clés.",
    tag: "Guide",
  },
  {
    ico: "🔧",
    t: "Alternateur défaillant : les signes à surveiller",
    d: "Voyant batterie, démarrage difficile, phares faibles — ce que ces symptômes indiquent.",
    tag: "Diagnostic",
  },
];

// ─── FAQ fallback ────────────────────────────────────────
export const FAQ_DATA = [
  {
    q: "Comment trouver la bonne pièce pour mon véhicule ?",
    a: "Utilisez notre sélecteur véhicule en haut de page : choisissez votre constructeur, modèle et motorisation, ou entrez votre numéro de Type Mine (repère D.2.1 sur la carte grise). Vous pouvez aussi rechercher par immatriculation ou référence OE. Toutes les pièces affichées seront 100% compatibles.",
  },
  {
    q: "Quels sont les délais de livraison ?",
    a: "Les commandes passées avant 15h sont expédiées le jour même. Livraison en 24-48h ouvrées via Colissimo, DHL ou GLS. Point relais disponible. Livraison gratuite dès 50€ d'achat.",
  },
  {
    q: "Les pièces sont-elles garanties ?",
    a: "Toutes nos pièces sont garanties minimum 2 ans. Pièces neuves de qualité OE des plus grandes marques (BOSCH, VALEO, TRW, BREMBO…). Remplacement ou remboursement en cas de défaut.",
  },
  {
    q: "Comment retourner une pièce ?",
    a: "Vous disposez de 30 jours après réception pour retourner une pièce. Elle doit être dans son emballage d'origine, non montée. Contactez le service client pour l'étiquette de retour. Remboursement sous 5 jours ouvrés.",
  },
  {
    q: "Proposez-vous des tarifs professionnels ?",
    a: "Oui, nous proposons des conditions spéciales pour les garages, carrosseries et mécaniciens indépendants. Contactez notre service commercial pour obtenir un devis personnalisé et un accès pro avec remises sur volume.",
  },
];

// ─── Shared types ────────────────────────────────────────
export interface CatalogFamily {
  mf_id: number;
  img?: string;
  i: string;
  n: string;
  desc: string;
  color: string;
  gammes: Array<{ name: string; link: string }>;
  /** Total gammes count (may exceed gammes.length when SSR-trimmed) */
  gammes_count?: number;
}

export interface BrandItem {
  id: number;
  name: string;
  slug: string;
  logo?: string;
}

export interface BlogArticle {
  ico: string;
  t: string;
  d: string;
  tag: string;
  link: string;
  img?: string;
}
