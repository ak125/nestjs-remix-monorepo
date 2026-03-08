import { type LucideIcon, Car, Cog, Shield, Wrench, Zap } from "lucide-react";

// ─── Image proxy paths ───────────────────────────────────
export const IMG_PROXY_LOGOS =
  "/img/uploads/constructeurs-automobiles/marques-logos";
export const IMG_PROXY_FAMILIES = "/img/uploads/articles/familles-produits";

// ─── Fallback: 19 product families ───────────────────────
export const CATS = [
  {
    i: "🛢️",
    pic: "Filtres.webp",
    n: "Système de filtration",
    desc: "Filtres huile, air, carburant et habitacle. Remplacement selon préconisations.",
    sub: [
      "Filtre à huile",
      "Filtre à air",
      "Filtre à carburant",
      "Filtre d'habitacle",
    ],
  },
  {
    i: "🛞",
    pic: "Freinage.webp",
    n: "Système de freinage",
    desc: "Plaquettes, disques et étriers pour un freinage fiable et sécurisé.",
    sub: [
      "Plaquette de frein",
      "Disque de frein",
      "Étrier de frein",
      "Témoin d'usure de plaquettes de frein",
    ],
  },
  {
    i: "⛓️",
    pic: "Courroie_galet_poulie.webp",
    n: "Courroie, galet, poulie et chaîne",
    desc: "Courroies, galets et kits de distribution pour la synchronisation moteur.",
    sub: [
      "Courroie d'accessoire",
      "Galet tendeur de courroie d'accessoire",
      "Galet enrouleur de courroie d'accessoire",
      "Kit de distribution",
    ],
  },
  {
    i: "🔥",
    pic: "Allumage_Prechauffage.webp",
    n: "Allumage / Préchauffage",
    desc: "Bougies, faisceaux et boîtiers pour le démarrage et la combustion moteur.",
    sub: [
      "Bougie de préchauffage",
      "Boîtier de préchauffage",
      "Bougie d'allumage",
      "Faisceau d'allumage",
    ],
  },
  {
    i: "🔧",
    pic: "Direction.webp",
    n: "Direction / Train avant",
    desc: "Rotules, bras et barres de direction pour la tenue de route et la sécurité.",
    sub: [
      "Rotule de direction",
      "Barre de direction",
      "Rotule de suspension",
      "Bras de suspension",
    ],
  },
  {
    i: "🏎️",
    pic: "Amortisseur.webp",
    n: "Amortisseur / Suspension",
    desc: "Amortisseurs, ressorts et butées pour le confort et la tenue de route.",
    sub: [
      "Amortisseur",
      "Butée de suspension",
      "Butée élastique d'amortisseur",
      "Ressort de suspension",
    ],
  },
  {
    i: "⚙️",
    pic: "Support.webp",
    n: "Support moteur",
    desc: "Supports moteur et boîte de vitesses pour absorber vibrations et chocs.",
    sub: ["Support moteur", "Support de boîte de vitesses"],
  },
  {
    i: "🔩",
    pic: "Embrayage.webp",
    n: "Embrayage",
    desc: "Kits, butées et récepteurs d'embrayage pour un passage de vitesses fluide.",
    sub: [
      "Kit d'embrayage",
      "Butée d'embrayage hydraulique",
      "Émetteur d'embrayage",
      "Récepteur d'embrayage",
    ],
  },
  {
    i: "🔗",
    pic: "Transmission.webp",
    n: "Transmission",
    desc: "Cardans, soufflets et paliers pour transmettre le mouvement aux roues.",
    sub: [
      "Cardan",
      "Soufflet de cardan",
      "Bague d'étanchéité arbre de roue",
      "Palier d'arbre",
    ],
  },
  {
    i: "⚡",
    pic: "Systeme_electrique.webp",
    n: "Électrique",
    desc: "Alternateurs, démarreurs et contacteurs pour le circuit électrique du véhicule.",
    sub: ["Alternateur", "Démarreur", "Neiman", "Contacteur démarreur"],
  },
  {
    i: "📡",
    pic: "Capteurs.webp",
    n: "Capteurs / Sondes",
    desc: "Capteurs pression, niveau et impulsion pour le contrôle électronique moteur.",
    sub: [
      "Pressostat d'huile",
      "Capteur d'impulsion",
      "Capteur de pression",
      "Capteur de niveau d'huile",
    ],
  },
  {
    i: "⛽",
    pic: "Alimentation.webp",
    n: "Alimentation Carburant & Air",
    desc: "Débitmètres, vannes EGR et pompes pour l'alimentation air et carburant.",
    sub: [
      "Débitmètre d'air",
      "Vanne EGR",
      "Pompe à carburant",
      "Joint d'injecteur",
    ],
  },
  {
    i: "🔧",
    pic: "Moteur.webp",
    n: "Moteur",
    desc: "Joints de culasse, cache-culbuteurs et bagues d'étanchéité moteur.",
    sub: [
      "Joint de culasse",
      "Joint cache culbuteurs",
      "Bagues d'étanchéité vilebrequin",
      "Vis de culasse",
    ],
  },
  {
    i: "🌡️",
    pic: "Refroidissement.webp",
    n: "Refroidissement",
    desc: "Pompes à eau, radiateurs et thermostats pour le circuit de refroidissement.",
    sub: [
      "Pompe à eau",
      "Radiateur",
      "Thermostat d'eau",
      "Sonde de refroidissement",
    ],
  },
  {
    i: "❄️",
    pic: "Climatisation.webp",
    n: "Climatisation",
    desc: "Compresseurs, condenseurs et pulseurs pour la climatisation et le chauffage.",
    sub: [
      "Pulseur d'air",
      "Compresseur de climatisation",
      "Condenseur de climatisation",
      "Évaporateur",
    ],
  },
  {
    i: "💨",
    pic: "Echappement.webp",
    n: "Échappement",
    desc: "Catalyseurs, FAP, sondes lambda et joints pour la ligne d'échappement.",
    sub: [
      "Catalyseur",
      "Filtre à particules (FAP)",
      "Sonde lambda",
      "Joint d'échappement",
    ],
  },
  {
    i: "💡",
    pic: "Eclairage.webp",
    n: "Éclairage / Signalisation",
    desc: "Phares, feux arrière et clignotants pour l'éclairage et la signalisation.",
    sub: ["Feu avant", "Feu arrière", "Feu clignotant", "Phare antibrouillard"],
  },
  {
    i: "🧹",
    pic: "Accessoires.webp",
    n: "Accessoires",
    desc: "Essuie-glaces, rétroviseurs et lève-vitres pour le confort au quotidien.",
    sub: [
      "Balai d'essuie-glace",
      "Commande d'essuie-glace",
      "Rétroviseur",
      "Lève-vitre",
    ],
  },
  {
    i: "🌀",
    pic: "Turbo.webp",
    n: "Turbo / Suralimentation",
    desc: "Turbocompresseurs, gaines et valves pour la suralimentation moteur.",
    sub: [
      "Turbocompresseur",
      "Gaine de turbo",
      "Valve de turbo",
      "Capteur de pression de turbo",
    ],
  },
];

// ─── Catalogue domain tabs ───────────────────────────────
export const CATALOG_DOMAINS: {
  label: string;
  icon: LucideIcon;
  families: string[] | null;
}[] = [
  { label: "Tout", icon: Car, families: null },
  {
    label: "Moteur",
    icon: Wrench,
    families: [
      "Système de filtration",
      "Alimentation Carburant & Air",
      "Système d'alimentation",
      "Allumage / Préchauffage",
      "Préchauffage et allumage",
      "Moteur",
      "Turbo / Suralimentation",
      "Turbo",
      "Refroidissement",
      "Échappement",
      "Echappement",
      "Support moteur",
    ],
  },
  {
    label: "Freinage & Châssis",
    icon: Shield,
    families: [
      "Système de freinage",
      "Direction / Train avant",
      "Direction et liaison au sol",
      "Amortisseur / Suspension",
      "Amortisseur et suspension",
    ],
  },
  {
    label: "Transmission",
    icon: Cog,
    families: [
      "Courroie, galet, poulie et chaîne",
      "Embrayage",
      "Transmission",
    ],
  },
  {
    label: "Électrique & Confort",
    icon: Zap,
    families: [
      "Électrique",
      "Système électrique",
      "Capteurs / Sondes",
      "Capteurs",
      "Climatisation",
      "Éclairage / Signalisation",
      "Eclairage",
      "Accessoires",
    ],
  },
];

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
