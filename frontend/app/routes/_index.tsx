import {
  defer,
  type HeadersFunction,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Await, Link, useLoaderData, useNavigate } from "@remix-run/react";
import {
  type LucideIcon,
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  Car,
  ChevronRight,
  Cog,
  Phone,
  Search,
  Shield,
  ShoppingCart,
  Star,
  TrendingUp,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { Suspense, memo, useCallback, useState } from "react";

import DarkSection from "~/components/layout/DarkSection";
import LazySection from "~/components/layout/LazySection";
import PageSection from "~/components/layout/PageSection";
import Reveal from "~/components/layout/Reveal";
import SectionHeader from "~/components/layout/SectionHeader";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import VehicleSelector from "~/components/vehicle/VehicleSelector";
import { getFamilyTheme } from "~/utils/family-theme";
import { getInternalApiUrlFromRequest } from "~/utils/internal-api.server";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/**
 * Handle export pour propager le rôle SEO au root Layout
 * Homepage = R1 ROUTER (point d'entrée sélection véhicule)
 */
export const handle = {
  pageRole: createPageRoleMeta(PageRole.R1_ROUTER, {
    clusterId: "homepage",
    canonicalEntity: "automecanik",
  }),
};

export const meta: MetaFunction = () => [
  {
    title:
      "Catalogue de pièces détachées auto – Toutes marques & modèles | Automecanik",
  },
  {
    name: "description",
    content:
      "Pièces détachées auto pas cher pour toutes marques. Catalogue 400 000+ références, livraison 24-48h, qualité garantie. Filtrez par véhicule.",
  },
  {
    name: "keywords",
    content:
      "catalogue pièces auto, catalogue de pièces détachées auto, pièces auto en ligne, catalogue pièces détachées, pièces auto toutes marques, catalogue professionnel pièces auto",
  },
  { tagName: "link", rel: "canonical", href: "https://www.automecanik.com/" },
  { property: "og:type", content: "website" },
  {
    property: "og:title",
    content: "Catalogue de pièces détachées auto | Automecanik",
  },
  {
    property: "og:description",
    content:
      "400 000+ pièces auto en stock pour toutes marques. Livraison 24-48h. Qualité garantie.",
  },
  {
    property: "og:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  {
    property: "og:image:alt",
    content: "Automecanik - Pièces auto à prix pas cher",
  },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "twitter:title", content: "Catalogue pièces auto | Automecanik" },
  {
    name: "twitter:description",
    content:
      "400 000+ pièces auto en stock pour toutes marques. Livraison 24-48h.",
  },
  {
    name: "twitter:image",
    content: "https://www.automecanik.com/logo-og.webp",
  },
  { name: "robots", content: "index, follow" },
  { name: "googlebot", content: "index, follow" },
];

// ─── LCP OPTIMIZATION — Preload logos & fonts ───────────
const IMG_PROXY_LOGOS = "/img/uploads/constructeurs-automobiles/marques-logos";
const IMG_PROXY_FAMILIES = "/img/uploads/articles/familles-produits";
const IMG_PROXY_EQUIP = "/img/uploads/equipementiers-automobiles";

// Preloads supprimés : les fonts sont self-hosted (preload dans root.tsx),
// et les logos du carousel sont below-the-fold sur mobile — inutile de preload.

export async function loader({ request }: LoaderFunctionArgs) {
  // FAQ fetch — deferred (below-the-fold, does not block HTML)
  const faqPromise = fetch(
    getInternalApiUrlFromRequest(
      "/api/support/faq?status=published&limit=5",
      request,
    ),
  )
    .then((res) => (res.ok ? res.json() : null))
    .then(
      (data) =>
        (data?.faqs || []) as Array<{
          id: string;
          question: string;
          answer: string;
        }>,
    )
    .catch(() => [] as Array<{ id: string; question: string; answer: string }>);

  try {
    // RPC fetch — synchronous (above-the-fold: families, brands, stats)
    const rpcRes = await fetch(
      getInternalApiUrlFromRequest("/api/catalog/homepage-rpc", request),
    );
    const rpcData = rpcRes.ok ? await rpcRes.json() : null;

    return defer({
      families: (rpcData?.catalog?.families || []) as Array<{
        mf_id: number;
        mf_name: string;
        mf_pic: string;
        mf_description?: string;
        gammes: Array<{ pg_id: number; pg_alias: string; pg_name: string }>;
      }>,
      brands: (rpcData?.brands || []).map((b: any) => ({
        id: b.marque_id as number,
        name: b.marque_name as string,
        slug: b.marque_alias as string,
        logo: b.marque_logo
          ? `${IMG_PROXY_LOGOS}/${b.marque_logo}`
          : (undefined as string | undefined),
      })),
      equipementiers: (rpcData?.equipementiers || []).map((e: any) => ({
        name:
          typeof e === "string"
            ? e
            : e.pm_name || e.name || e.eq_name || String(e),
        logo: e.pm_logo || null,
      })) as Array<{ name: string; logo: string | null }>,
      blogArticles: (rpcData?.blog_articles || []) as Array<{
        ba_id: number;
        ba_title: string;
        ba_alias: string;
        ba_descrip: string;
        ba_preview: string;
        ba_category?: string;
        pg_name?: string;
        pg_alias?: string;
      }>,
      faqs: faqPromise, // deferred — streams after initial HTML
      stats: (rpcData?.stats || {}) as {
        total_pieces?: number;
        total_families?: number;
        total_brands?: number;
      },
    });
  } catch {
    return defer({
      families: [],
      brands: [],
      equipementiers: [],
      blogArticles: [],
      faqs: faqPromise, // still deferred even on RPC error
      stats: {},
    });
  }
}

export const headers: HeadersFunction = () => ({
  "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
});

// ─── COULEURS PAR FAMILLE (source unique: family-theme.ts) ────────────

// ─── FALLBACK DATA ───────────────────────────────────────
const CATS = [
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

const CATALOG_DOMAINS: {
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

const MARQUES = [
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

const EQUIP = [
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

const BLOG = [
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

const STATS = [
  { value: "50K+", label: "Références", icon: TrendingUp },
  { value: "120+", label: "Marques auto", icon: Car },
  { value: "98%", label: "Clients satisfaits", icon: Star },
  { value: "24-48h", label: "Livraison", icon: Truck },
];

const FAQ_DATA = [
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

// Reveal, SectionHeader, PageSection, DarkSection, GlassCard → imported from ~/components/layout/

// ═══════════════════════════════════════════════════════════
// Memoized catalog card to avoid re-renders on tab switch
// ═══════════════════════════════════════════════════════════
interface CatalogCardProps {
  cat: {
    img?: string;
    i: string;
    n: string;
    desc: string;
    color: string;
    gammes: Array<{ name: string; link: string }>;
  };
  index: number;
  isOpen: boolean;
  onToggle: (name: string) => void;
}

const CatalogFamilyCard = memo(function CatalogFamilyCard({
  cat,
  index,
  isOpen,
  onToggle,
}: CatalogCardProps) {
  const displayedGammes = isOpen ? cat.gammes : cat.gammes.slice(0, 4);
  return (
    <Reveal key={cat.n} delay={Math.min(index * 40, 400)}>
      <Card className="group transition-all duration-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1">
        <div
          className={`relative h-32 sm:h-48 overflow-hidden bg-gradient-to-br ${cat.color}`}
        >
          {cat.img ? (
            <img
              src={cat.img}
              alt={cat.n}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              width="400"
              height="300"
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-6xl opacity-40">
              {cat.i}
            </span>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent group-hover:from-black/80 transition-colors duration-300">
            <h3 className="text-white font-bold text-lg line-clamp-2">
              {cat.n}
            </h3>
          </div>
        </div>
        <CardContent className="pt-4 pb-4">
          {cat.desc && (
            <p className="text-sm text-slate-500 mb-3 line-clamp-2">
              {cat.desc}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {displayedGammes.map((g) => (
              <Link key={g.name} to={g.link}>
                <Badge
                  variant="secondary"
                  className="px-2.5 py-1 bg-white rounded-lg text-[11px] text-slate-600 font-medium hover:bg-orange-50 hover:text-[#e8590c] transition-colors border border-slate-100 hover:border-[#e8590c]/20 cursor-pointer"
                >
                  {g.name}
                </Badge>
              </Link>
            ))}
            {cat.gammes.length > 4 && (
              <button
                type="button"
                onClick={() => onToggle(cat.n)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[#e8590c] hover:bg-orange-50 transition-colors border border-[#e8590c]/20 cursor-pointer"
              >
                {isOpen ? "Voir moins" : `+${cat.gammes.length - 4} gammes`}
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </Reveal>
  );
});

// ═══════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════
export default function RedesignPreview() {
  const loaderData = useLoaderData<typeof loader>();

  // Merge API data with static fallbacks
  const catalogFamilies =
    loaderData.families.length > 0
      ? loaderData.families.map((f) => ({
          img: f.mf_pic ? `${IMG_PROXY_FAMILIES}/${f.mf_pic}` : undefined,
          i: "📦",
          n: f.mf_name,
          desc: f.mf_description || "",
          color: getFamilyTheme(f.mf_name).gradient,
          sub: f.gammes.slice(0, 4).map((g) => g.pg_name),
          gammes: f.gammes.map((g) => ({
            name: g.pg_name,
            link: `/pieces/${g.pg_alias}-${g.pg_id}.html`,
          })),
          link: f.gammes[0]
            ? `/pieces/${f.gammes[0].pg_alias}-${f.gammes[0].pg_id}.html`
            : "#",
        }))
      : CATS.map((c) => ({
          ...c,
          desc: c.desc || "",
          color: getFamilyTheme(c.n).gradient,
          img: c.pic ? `${IMG_PROXY_FAMILIES}/${c.pic}` : undefined,
          gammes: c.sub.map((s) => ({ name: s, link: "#" })),
          link: "#",
        }));

  const brandsList =
    loaderData.brands.length > 0
      ? loaderData.brands
      : MARQUES.map((m) => ({
          id: 0,
          name: m.n,
          slug: m.n.toLowerCase().replace(/\s/g, "-"),
          logo: undefined,
        }));

  const equipAll =
    loaderData.equipementiers.length > 0
      ? loaderData.equipementiers
      : EQUIP.map((name) => ({ name, logo: null as string | null }));

  const equipMarquee = equipAll.slice(0, 12).map((e) => ({
    name: e.name,
    logoUrl: `${IMG_PROXY_EQUIP}/${
      e.logo ||
      e.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") + ".webp"
    }`,
  }));

  const blogList =
    loaderData.blogArticles.length > 0
      ? loaderData.blogArticles.map((a) => ({
          ico: "📰",
          t: a.ba_title,
          d: a.ba_descrip || a.ba_preview || "",
          tag: a.pg_name || a.ba_category || "Guide",
          link: `/blog-pieces-auto/conseils/${a.pg_alias || a.ba_alias}`,
        }))
      : BLOG.map((b) => ({ ...b, link: "#" }));

  // FAQ is deferred — resolved via <Await> in the JSX below
  const faqsPromise = loaderData.faqs;

  const navigate = useNavigate();
  const [mineCode, setMineCode] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const toggleCat = useCallback((name: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Schema.org JSON-LD pour SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebSite",
                "@id": "https://www.automecanik.com/#website",
                url: "https://www.automecanik.com",
                name: "Automecanik",
                description:
                  "Pièces détachées auto pour toutes marques et modèles",
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate:
                      "https://www.automecanik.com/recherche?q={search_term_string}",
                  },
                  "query-input": "required name=search_term_string",
                },
              },
              {
                "@type": "AutoPartsStore",
                "@id": "https://www.automecanik.com/#store",
                name: "Automecanik",
                description:
                  "Catalogue de pièces détachées auto pour toutes marques et modèles",
                url: "https://www.automecanik.com",
                logo: "https://www.automecanik.com/logo-navbar.webp",
                image: "https://www.automecanik.com/logo-og.webp",
                priceRange: "€€",
                address: {
                  "@type": "PostalAddress",
                  addressCountry: "FR",
                },
              },
            ],
          }),
        }}
      />

      {/* Skip to main content - Accessibilité */}
      <a
        href="#catalogue"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:bg-[#e8590c] focus:text-white focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
      >
        Aller au contenu principal
      </a>

      {/* CSS animations */}
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .hide-scroll::-webkit-scrollbar { display: none; }
        .hide-scroll { scrollbar-width: none; -ms-overflow-style: none; }
        .tab-pill { transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1); }
        @media (prefers-reduced-motion: reduce) {
          .shimmer-anim, .marquee-anim { animation: none !important; }
        }
      `}</style>

      {/* ════════════════════════════════════════
          BANDEAU PROMO — Orange shimmer
         ════════════════════════════════════════ */}
      <div className="bg-[#e8590c] text-white text-center py-2 px-4 text-xs sm:text-sm font-semibold relative overflow-hidden leading-snug">
        <div
          className="shimmer-anim absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          style={{ animation: "shimmer 3s ease-in-out infinite" }}
        />
        <span className="relative z-10">
          Livraison GRATUITE d&egrave;s 150&euro; d&apos;achat &bull; Retours 30
          jours
        </span>
      </div>

      {/* ════════════════════════════════════════
          HERO — Vehicle Search with Tabs
         ════════════════════════════════════════ */}
      <section className="relative overflow-hidden py-6 sm:py-8 md:py-10 bg-gradient-to-br from-[#0d1b3e] via-[#0f2347] to-[#162d5a]">
        {/* Decorative */}
        <div
          className="absolute top-[10%] -right-[5%] w-48 sm:w-72 h-48 sm:h-72 rounded-full bg-[#e8590c]/10 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative container mx-auto px-4 max-w-[780px] text-center">
          <h1 className="text-xl sm:text-2xl md:text-[32px] font-extrabold text-white leading-tight mb-1 sm:mb-2 tracking-tight">
            Pi&egrave;ces auto{" "}
            <span className="bg-gradient-to-r from-[#e8590c] to-[#f76707] bg-clip-text text-transparent">
              pas cher
            </span>
          </h1>

          {/* Search box with tabs */}
          <div className="bg-white/[0.07] border border-white/[0.12] rounded-2xl overflow-hidden">
            <Tabs defaultValue="vehicule">
              <TabsList className="w-full h-auto rounded-none bg-black/15 p-0 gap-0">
                <TabsTrigger
                  value="vehicule"
                  className="flex-1 rounded-none min-h-[44px] gap-1.5 text-xs sm:text-sm font-semibold text-white/45 data-[state=active]:bg-white data-[state=active]:text-[#0d1b3e] data-[state=active]:shadow-none border-0 px-2 sm:px-5"
                >
                  <Car className="w-3.5 h-3.5 flex-shrink-0" /> Par
                  v&eacute;hicule
                </TabsTrigger>
                <TabsTrigger
                  value="mine"
                  className="flex-1 rounded-none min-h-[44px] gap-1.5 text-xs sm:text-sm font-semibold text-white/45 data-[state=active]:bg-white data-[state=active]:text-[#0d1b3e] data-[state=active]:shadow-none border-0 px-2 sm:px-5"
                >
                  🔢 Type Mine
                </TabsTrigger>
                <TabsTrigger
                  value="reference"
                  className="flex-1 rounded-none min-h-[44px] gap-1.5 text-xs sm:text-sm font-semibold text-white/45 data-[state=active]:bg-white data-[state=active]:text-[#0d1b3e] data-[state=active]:shadow-none border-0 px-2 sm:px-5"
                >
                  <Search className="w-3.5 h-3.5 flex-shrink-0" />{" "}
                  R&eacute;f&eacute;rence
                </TabsTrigger>
              </TabsList>

              {/* TAB: Par véhicule */}
              <TabsContent
                value="vehicule"
                className="mt-0 bg-white p-4 sm:p-5"
              >
                <VehicleSelector
                  mode="compact"
                  className="flex-wrap gap-2"
                  context="homepage"
                />
              </TabsContent>

              {/* TAB: Type Mine */}
              <TabsContent value="mine" className="mt-0 bg-white p-4 sm:p-5">
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  <span className="w-[18px] h-[18px] rounded-full bg-[#0d1b3e] text-white text-[9px] font-bold grid place-items-center flex-shrink-0">
                    1
                  </span>
                  Num&eacute;ro de Type Mine ou CNIT
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (mineCode.length >= 5) {
                      navigate(`/search/mine?code=${mineCode.toUpperCase()}`);
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <div className="relative flex-1">
                    <Car className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
                    <Input
                      value={mineCode}
                      onChange={(e) =>
                        setMineCode(e.target.value.toUpperCase())
                      }
                      placeholder="Ex : M10RENVP0A5G35"
                      maxLength={20}
                      className="min-h-[44px] pl-10 bg-slate-50 border-slate-200 rounded-xl text-[15px] font-bold tracking-[2.5px] font-mono uppercase focus-visible:border-[#e8590c] focus-visible:ring-[#e8590c]/10"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={mineCode.length < 5}
                    className="min-h-[46px] rounded-xl px-6 font-bold text-sm uppercase tracking-wide bg-[#e8590c] hover:bg-[#d9480f] text-white shadow-[0_4px_14px_rgba(232,89,12,0.3)] whitespace-nowrap disabled:opacity-50"
                  >
                    <Search className="w-[18px] h-[18px] mr-2" /> Rechercher
                  </Button>
                </form>
                <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1">
                  💡 Trouvez ce num&eacute;ro sur votre carte grise,
                  rep&egrave;re D.2.1
                </p>
              </TabsContent>

              {/* TAB: Référence */}
              <TabsContent
                value="reference"
                className="mt-0 bg-white p-4 sm:p-5"
              >
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  <Search className="w-3.5 h-3.5" /> Rechercher par
                  r&eacute;f&eacute;rence ou nom de pi&egrave;ce
                </label>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (refQuery.trim()) {
                      navigate(
                        `/recherche?q=${encodeURIComponent(refQuery.trim())}`,
                      );
                    }
                  }}
                  className="flex flex-col sm:flex-row gap-2.5"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      value={refQuery}
                      onChange={(e) => setRefQuery(e.target.value)}
                      placeholder="Référence OE, marque ou nom de pièce…"
                      className="min-h-[44px] pl-10 bg-slate-50 border-slate-200 rounded-xl text-sm focus-visible:border-[#e8590c] focus-visible:ring-[#e8590c]/10"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={!refQuery.trim()}
                    className="min-h-[46px] rounded-xl px-6 font-bold text-sm uppercase tracking-wide bg-[#e8590c] hover:bg-[#d9480f] text-white shadow-[0_4px_14px_rgba(232,89,12,0.3)] whitespace-nowrap disabled:opacity-50"
                  >
                    <Search className="w-[18px] h-[18px] mr-2" /> Rechercher
                  </Button>
                </form>
                <div className="flex flex-wrap gap-1 mt-2.5">
                  {[
                    "7701208265",
                    "P68050",
                    "Plaquettes Clio 4",
                    "KD457.74",
                    "Filtre huile Golf 7",
                  ].map((ex) => (
                    <Badge
                      key={ex}
                      variant="secondary"
                      className="px-2.5 py-1 bg-slate-100 rounded-full text-[10px] font-semibold text-slate-500 cursor-pointer hover:bg-slate-200 hover:text-slate-900 transition-colors border-0"
                      onClick={() => {
                        setRefQuery(ex);
                        navigate(`/recherche?q=${encodeURIComponent(ex)}`);
                      }}
                    >
                      {ex}
                    </Badge>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Luminous separator Hero → Conseils */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#e8590c]/25 to-transparent" />

      {/* ════════════════════════════════════════
          CONSEILS & DIAGNOSTIC — Dark Glassmorphism
         ════════════════════════════════════════ */}
      <DarkSection id="conseils-diagnostic">
        {/* Header */}
        <Reveal>
          <div className="text-center mb-8 md:mb-12">
            <h2
              id="conseils-diagnostic-title"
              className="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 tracking-tight"
            >
              Conseils & <span className="text-[#fb923c]">Diagnostic</span>
            </h2>
            <div className="h-1 w-16 bg-gradient-to-r from-[#fb923c] to-[#e8590c] mx-auto rounded mb-4" />
            <p className="text-sm md:text-base text-white/70 max-w-xl mx-auto">
              L&apos;expertise automobile au service de votre v&eacute;hicule
            </p>
          </div>
        </Reveal>

        {/* Feature Card: Diagnostic auto */}
        <Reveal>
          <Link
            to="/diagnostic-auto"
            className="group relative block mb-5 md:mb-6 rounded-2xl border border-white/10 overflow-hidden transition-all duration-300 hover:-translate-y-1"
            aria-label="Lancer un diagnostic auto"
          >
            {/* Glass bg */}
            <div className="absolute inset-0 bg-white/[0.07] backdrop-blur-sm" />
            {/* Orange left accent */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#fb923c] via-[#e8590c] to-[#c2410c]" />
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-[#e8590c]/0 group-hover:bg-[#e8590c]/5 transition-colors duration-300" />

            <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-5 md:gap-8">
              {/* Icon */}
              <div className="flex-shrink-0">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-[#e8590c] to-[#c2410c] flex items-center justify-center shadow-lg shadow-[#e8590c]/25 group-hover:shadow-[#e8590c]/40 group-hover:scale-105 transition-all duration-300">
                  <Activity className="w-7 h-7 md:w-8 md:h-8 text-white" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl md:text-2xl font-bold text-white">
                    Diagnostic auto
                  </h3>
                  <Badge className="hidden md:inline-flex bg-[#e8590c]/20 text-[#fb923c] border-[#e8590c]/30 hover:bg-[#e8590c]/20">
                    Gratuit
                  </Badge>
                </div>
                <p className="text-sm md:text-base text-white/70 leading-relaxed mb-3 md:mb-0">
                  Identifiez votre panne : vibrations, bruits, voyants moteur
                  &mdash; causes et solutions par nos experts.
                </p>
                {/* Feature tags */}
                <div className="flex flex-wrap gap-2 md:mt-3">
                  {["Vibrations", "Bruits moteur", "Voyants", "Freinage"].map(
                    (tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="bg-white/[0.06] text-white/60 border-white/10 hover:bg-white/[0.06] font-normal"
                      >
                        {tag}
                      </Badge>
                    ),
                  )}
                </div>
              </div>

              {/* CTA */}
              <div className="flex-shrink-0 flex items-center gap-2 text-[#fb923c] font-bold text-sm md:text-base">
                <span className="md:hidden">Diagnostiquer</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>
          </Link>
        </Reveal>

        {/* Secondary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          {[
            {
              icon: BookOpen,
              t: "Guides d\u2019achat",
              d: "Distribution, freinage, filtration\u2026",
              link: "/blog-pieces-auto/guide-achat",
            },
            {
              icon: Wrench,
              t: "R\u00e9f\u00e9rence technique",
              d: "Glossaire, d\u00e9finitions, specs OE",
              link: "/reference-auto",
            },
            {
              icon: Shield,
              t: "Conseils entretien",
              d: "Calendrier, astuces m\u00e9canicien, pi\u00e8ces \u00e0 surveiller",
              link: "/blog-pieces-auto/conseils",
            },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 80}>
              <Link
                to={c.link}
                className="group relative flex items-center gap-4 p-4 md:p-5 rounded-xl border border-white/10 bg-white/[0.05] backdrop-blur-sm hover:bg-white/[0.09] hover:border-white/20 transition-all duration-300"
              >
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors duration-300">
                  <c.icon className="w-5 h-5 md:w-6 md:h-6 text-white/80" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm md:text-base font-semibold text-white mb-0.5">
                    {c.t}
                  </h3>
                  <p className="text-xs text-white/50 line-clamp-1">{c.d}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </Link>
            </Reveal>
          ))}
        </div>
      </DarkSection>

      {/* ════════════════════════════════════════
          CATALOGUE — 19 familles de pièces (Tabs)
         ════════════════════════════════════════ */}
      <LazySection minHeight={400}>
        <PageSection id="catalogue">
          <SectionHeader
            title="Catalogue pièces auto"
            sub={`Pièces neuves pour toutes marques — ${catalogFamilies.length} familles techniques`}
          />

          <Tabs defaultValue="Tout" className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto hide-scroll bg-[#0d1b3e] rounded-2xl p-1.5 mb-5 sm:mb-6 flex-nowrap h-auto shadow-lg">
              {CATALOG_DOMAINS.map((domain) => {
                const count = domain.families
                  ? catalogFamilies.filter((c) =>
                      domain.families!.some((d) => d === c.n),
                    ).length
                  : catalogFamilies.length;
                const DomainIcon = domain.icon;
                return (
                  <TabsTrigger
                    key={domain.label}
                    value={domain.label}
                    className="group tab-pill text-xs sm:text-sm px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl whitespace-nowrap font-semibold flex items-center gap-1.5 sm:gap-2 text-white/50 hover:text-white/80 hover:bg-white/[0.06] data-[state=active]:bg-[#e8590c] data-[state=active]:text-white data-[state=active]:shadow-[0_0_20px_rgba(232,89,12,0.3)]"
                  >
                    <DomainIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">{domain.label}</span>
                    <span className="sm:hidden">
                      {domain.label.split(" ")[0]}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-white/10 font-medium leading-none group-data-[state=active]:bg-white/20">
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {CATALOG_DOMAINS.map((domain) => (
              <TabsContent
                key={domain.label}
                value={domain.label}
                className="mt-0"
              >
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
                  {(domain.families === null
                    ? catalogFamilies
                    : catalogFamilies.filter((cat) =>
                        domain.families!.some((d) => d === cat.n),
                      )
                  ).map((cat, i) => (
                    <CatalogFamilyCard
                      key={cat.n}
                      cat={cat}
                      index={i}
                      isOpen={expandedCats.has(cat.n)}
                      onToggle={toggleCat}
                    />
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </PageSection>
      </LazySection>

      {/* ════════════════════════════════════════
          WHY AUTOMECANIK — 4 avantages
         ════════════════════════════════════════ */}
      <LazySection minHeight={120}>
        <PageSection bg="navy-gradient">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {[
              {
                icon: Truck,
                title: "Livraison 24-48h",
                desc: "France métropolitaine",
              },
              {
                icon: Shield,
                title: "Garantie 2 ans",
                desc: "Pièces origine et adaptables",
              },
              {
                icon: Award,
                title: "Qualité certifiée",
                desc: "Marques ISO 9001 / TÜV",
              },
              {
                icon: Phone,
                title: "Support expert",
                desc: "Conseillers techniques",
              },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Reveal key={title} delay={i * 80}>
                <Card className="bg-white/[0.06] border-white/10 hover:bg-white/[0.09] hover:border-white/20 transition-all duration-200 rounded-2xl">
                  <CardContent className="p-4 sm:p-5 text-center">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#e8590c]/15 flex items-center justify-center mx-auto mb-2.5 sm:mb-3">
                      <Icon className="w-6 h-6 sm:w-7 sm:h-7 text-[#e8590c]" />
                    </div>
                    <div className="text-sm sm:text-[15px] font-semibold text-white mb-0.5">
                      {title}
                    </div>
                    <div className="text-[11px] sm:text-xs text-white/60 leading-relaxed">
                      {desc}
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </PageSection>
      </LazySection>

      {/* ════════════════════════════════════════
          CONSTRUCTEURS — 36 marques grille
         ════════════════════════════════════════ */}
      <LazySection minHeight={400}>
        <PageSection id="marques" bg="slate">
          <SectionHeader
            title="Par constructeur"
            sub={`${brandsList.length} marques auto`}
          />
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2.5 sm:gap-3">
            {brandsList.map((b) => (
              <Link key={b.name} to={`/constructeurs/${b.slug}-${b.id}.html`}>
                <Card className="group hover:border-[#e8590c] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 rounded-2xl border-[1.5px]">
                  <CardContent className="flex flex-col items-center justify-center py-3 px-2 gap-1.5">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-50 flex items-center justify-center overflow-hidden group-hover:bg-orange-50 transition-colors">
                      {b.logo ? (
                        <img
                          src={b.logo}
                          alt={b.name}
                          className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-base sm:text-lg font-bold text-[#0d1b3e]">
                          {b.name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-500 text-center truncate w-full group-hover:text-[#e8590c] transition-colors">
                      {b.name}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </PageSection>
      </LazySection>

      {/* ════════════════════════════════════════
          STATS — Social proof
         ════════════════════════════════════════ */}
      <LazySection minHeight={100}>
        <PageSection id="stats">
          <Reveal>
            <Card className="rounded-2xl bg-[#0d1b3e] border-0 overflow-hidden">
              <CardContent className="grid grid-cols-2 md:grid-cols-4 p-0">
                {STATS.map(({ value, label, icon: Icon }, i) => (
                  <div
                    key={label}
                    className={`flex items-center gap-3 p-4 sm:p-5 ${i < STATS.length - 1 ? "md:border-r md:border-white/10" : ""}`}
                  >
                    <Icon className="w-5 h-5 text-[#e8590c] flex-shrink-0" />
                    <div>
                      <div className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                        {value}
                      </div>
                      <div className="text-[10px] sm:text-xs text-white/50 font-medium">
                        {label}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Reveal>
        </PageSection>
      </LazySection>

      {/* ════════════════════════════════════════
          BLOG & GUIDES — 3 articles
         ════════════════════════════════════════ */}
      <LazySection minHeight={300}>
        <PageSection bg="slate">
          <SectionHeader
            title="Blog & Guides"
            sub="Conseils pratiques pour l'entretien de votre véhicule"
            linkText="Tous les articles"
            linkHref="/blog-pieces-auto"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {blogList.slice(0, 3).map((article, i) => {
              const BlogIcon =
                article.tag === "Guide d'achat"
                  ? ShoppingCart
                  : article.tag === "Entretien"
                    ? Wrench
                    : BookOpen;
              return (
                <Reveal key={article.t} delay={i * 80}>
                  <Link to={article.link || "#"}>
                    <Card className="group h-full rounded-2xl border-[1.5px] overflow-hidden hover:border-[#e8590c]/20 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                      <CardContent className="p-5 sm:p-6 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge
                            variant="secondary"
                            className="px-2.5 py-0.5 text-[10px] font-semibold bg-orange-50 text-[#e8590c] rounded-full border-0"
                          >
                            {article.tag}
                          </Badge>
                        </div>
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-lg bg-[#0d1b3e] flex items-center justify-center flex-shrink-0">
                            <BlogIcon className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug mb-1.5 group-hover:text-[#e8590c] transition-colors">
                              {article.t}
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                              {article.d}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-slate-100 text-xs font-semibold text-[#e8590c]">
                          Lire l&apos;article{" "}
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </PageSection>
      </LazySection>

      {/* ════════════════════════════════════════
          FAQ — Accordion shadcn (deferred)
         ════════════════════════════════════════ */}
      <LazySection minHeight={200}>
        <PageSection maxWidth="3xl">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900">
              Questions fr&eacute;quentes
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Tout ce qu&apos;il faut savoir avant de commander
            </p>
          </div>
          <Suspense
            fallback={
              <Accordion type="single" collapsible className="space-y-3">
                {FAQ_DATA.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="border border-slate-200 rounded-xl bg-white overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 sm:px-5 py-4 text-sm sm:text-[15px] font-bold text-slate-900 hover:no-underline">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="px-4 sm:px-5 text-sm text-slate-600 leading-relaxed">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            }
          >
            <Await resolve={faqsPromise} errorElement={null}>
              {(resolvedFaqs) => {
                const faqList =
                  resolvedFaqs.length > 0
                    ? resolvedFaqs.map((f) => ({
                        q: f.question,
                        a: f.answer,
                      }))
                    : FAQ_DATA;
                return (
                  <Accordion type="single" collapsible className="space-y-3">
                    {faqList.map((faq, i) => (
                      <AccordionItem
                        key={i}
                        value={`faq-${i}`}
                        className="border border-slate-200 rounded-xl bg-white overflow-hidden hover:border-[#e8590c]/20 transition-colors data-[state=open]:border-[#e8590c]/20 data-[state=open]:shadow-md"
                      >
                        <AccordionTrigger className="px-4 sm:px-5 py-4 text-sm sm:text-[15px] font-bold text-slate-900 hover:no-underline data-[state=open]:text-[#e8590c]">
                          {faq.q}
                        </AccordionTrigger>
                        <AccordionContent className="px-4 sm:px-5 text-sm text-slate-600 leading-relaxed">
                          {faq.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                );
              }}
            </Await>
          </Suspense>
        </PageSection>
      </LazySection>

      {/* ════════════════════════════════════════
          EQUIPEMENTIERS — titre + marquee + tags
         ════════════════════════════════════════ */}
      <LazySection minHeight={100}>
        <section className="py-8 sm:py-10 overflow-hidden">
          <div className="text-center mb-5 sm:mb-6">
            <h2 className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900">
              Nos &eacute;quipementiers partenaires
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Les plus grandes marques de pi&egrave;ces auto
            </p>
          </div>
          <div
            className="w-full overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent)",
            }}
          >
            <div
              className="marquee-anim flex items-center gap-6 sm:gap-10 w-max"
              style={{ animation: "marquee 30s linear infinite" }}
            >
              {[...equipMarquee, ...equipMarquee].map((e, i) => (
                <div
                  key={`${e.name}-${i}`}
                  className="flex-shrink-0 h-8 sm:h-10 w-auto"
                >
                  <img
                    src={e.logoUrl}
                    alt={e.name}
                    title={e.name}
                    className="h-full w-auto object-contain"
                    loading="lazy"
                    onError={(ev) => {
                      ev.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      </LazySection>
    </div>
  );
}
