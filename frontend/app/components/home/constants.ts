import {
  type LucideIcon,
  Award,
  Car,
  Cog,
  Phone,
  Shield,
  Star,
  TrendingUp,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";

// ─── Image proxy paths ───────────────────────────────────
export const IMG_PROXY_LOGOS =
  "/img/uploads/constructeurs-automobiles/marques-logos";
export const IMG_PROXY_FAMILIES = "/img/uploads/articles/familles-produits";
export const IMG_PROXY_EQUIP = "/img/uploads/equipementiers-automobiles";

// ─── Fallback: 19 product families ───────────────────────
export const CATS = [
  {
    i: "🛢️",
    pic: "Filtres.webp",
    n: "Système de filtration",
    desc: "Le système de filtration du véhicule est conçu pour filtrer l'air et les fluides entrant dans le moteur et dans l'habitacle. Les filtres doivent être régulièrement remplacés selon les préconisations des constructeurs automobiles.",
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
    desc: "Le système de freinage est l'élément de sécurité le plus important du véhicule. Il doit être en parfait état de fonctionnement afin d'assurer le freinage à tout instant.",
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
    desc: "L'entraînement des différents composants du moteur se fait par l'intermédiaire des courroies, des galets et des poulies qui synchronisent l'ensemble des pièces moteur.",
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
    desc: "L'allumage du moteur essence et le préchauffage du moteur diesel sont actionnés par les différents composants du système qui assurent le démarrage et la combustion du moteur.",
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
    desc: "Le système de direction est l'ensemble des pièces de liaison au sol et de direction qui assure votre sécurité et le confort de conduite.",
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
    desc: "Le système de suspension est l'ensemble des pièces qui garantit l'amortissement des chocs pour une bonne tenue de route lors de la conduite.",
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
    desc: "La suspension du moteur et de la boîte de vitesses est assurée par des supports qui absorbent les chocs et vibrations lors du fonctionnement du véhicule.",
    sub: ["Support moteur", "Support de boîte de vitesses"],
  },
  {
    i: "🔩",
    pic: "Embrayage.webp",
    n: "Embrayage",
    desc: "Le système d'embrayage est l'ensemble des composants qui assurent l'accouplement du moteur à la boîte de vitesses pour garantir le passage des vitesses.",
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
    desc: "Le système de transmission est l'ensemble des composants qui assure la transmission du mouvement du moteur vers les roues du véhicule.",
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
    desc: "Le système électrique est l'ensemble des composants qui assure le démarrage du moteur et la charge électrique des différents accessoires.",
    sub: ["Alternateur", "Démarreur", "Neiman", "Contacteur démarreur"],
  },
  {
    i: "📡",
    pic: "Capteurs.webp",
    n: "Capteurs / Sondes",
    desc: "Les capteurs sont des composants électroniques qui captent l'information et l'envoient aux différents actionneurs pour assurer le bon fonctionnement du véhicule.",
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
    desc: "Le système d'alimentation est l'ensemble des éléments qui gèrent l'air et le carburant nécessaire pour le bon fonctionnement du moteur.",
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
    desc: "L'étanchéité du moteur est l'ensemble des joints et des pièces qui assurent la jointure entre les différents éléments du moteur pour une bonne circulation des fluides.",
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
    desc: "Le système de refroidissement est l'ensemble des composants qui font circuler le liquide de refroidissement pour refroidir le moteur.",
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
    desc: "Le système de climatisation et chauffage est l'ensemble des composants qui créent l'air frais et chaud circulant du moteur vers l'habitacle.",
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
    desc: "Le système d'échappement est l'ensemble des pièces qui font évacuer les gaz d'échappement du moteur.",
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
    desc: "Le système d'éclairage est l'ensemble des pièces qui éclairent l'avant et l'arrière du véhicule pour la sécurité et le confort de conduite.",
    sub: ["Feu avant", "Feu arrière", "Feu clignotant", "Phare antibrouillard"],
  },
  {
    i: "🧹",
    pic: "Accessoires.webp",
    n: "Accessoires",
    desc: "Les accessoires sont l'ensemble des pièces utilisées pour la sécurité et le confort de conduite au quotidien.",
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
    desc: "Le turbo est un composant de suralimentation qui assure l'augmentation de la puissance du moteur.",
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

// ─── Fallback: equipment suppliers ───────────────────────
export const EQUIP = [
  "BOSCH",
  "VALEO",
  "TRW",
  "BREMBO",
  "SNR",
  "MONROE",
  "SKF",
  "SACHS",
  "LUK",
  "GATES",
  "DAYCO",
  "MANN",
];

// ─── Fallback: blog articles ─────────────────────────────
export const BLOG = [
  {
    ico: "🛒",
    t: "Comment choisir ses plaquettes de frein",
    d: "Organique, semi-métallique ou céramique ? Le guide complet pour faire le bon choix.",
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
    d: "Freinage, éclairage, échappement, suspension, direction — la checklist complète.",
    tag: "Guide",
  },
];

// ─── Stats social proof ──────────────────────────────────
export const STATS = [
  { value: "50K+", label: "Références", icon: TrendingUp },
  { value: "120+", label: "Marques auto", icon: Car },
  { value: "98%", label: "Clients satisfaits", icon: Star },
  { value: "24-48h", label: "Livraison", icon: Truck },
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
}

export interface EquipItem {
  name: string;
  logoUrl: string;
}

// ─── Why Automecanik advantages ──────────────────────────
export const ADVANTAGES = [
  { icon: Truck, title: "Livraison 24-48h", desc: "France métropolitaine" },
  {
    icon: Shield,
    title: "Garantie 2 ans",
    desc: "Pièces origine et adaptables",
  },
  { icon: Award, title: "Qualité certifiée", desc: "Marques ISO 9001 / TÜV" },
  { icon: Phone, title: "Support expert", desc: "Conseillers techniques" },
];
