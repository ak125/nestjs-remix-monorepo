/**
 * Route : /diagnostic-auto
 * Index des pages Diagnostic (R5 - DIAGNOSTIC)
 *
 * Rôle SEO : R5 - DIAGNOSTIC
 * Intention : Identifier un symptôme automobile
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import {
  Link,
  useLoaderData,
  useRouteError,
  isRouteErrorResponse,
} from "@remix-run/react";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle2,
  ChevronRight,
  Disc3,
  Eye,
  Gauge,
  HelpCircle,
  Phone,
  ScanLine,
  Search,
  Shield,
  ThermometerSun,
  Volume2,
  Wrench,
  Zap,
  BookOpen,
} from "lucide-react";
import { useState } from "react";

import { Error404 } from "~/components/errors/Error404";
import { HeroDiagnostic } from "~/components/heroes";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { Separator } from "~/components/ui/separator";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
    canonicalEntity: "diagnostic-auto",
  }),
};

// Types
interface DiagnosticItem {
  slug: string;
  title: string;
  meta_description: string;
  observable_type: "symptom" | "sign" | "dtc";
  perception_channel: string;
  risk_level: "confort" | "securite" | "critique";
  safety_gate: "none" | "warning" | "stop_soon" | "stop_immediate";
  cluster_id: string;
}

interface ClusterInfo {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  color: string;
}

const CLUSTERS: ClusterInfo[] = [
  {
    id: "embrayage",
    label: "Embrayage",
    icon: Disc3,
    description: "Patinage, bruits, vibrations pédale",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "freinage",
    label: "Freinage",
    icon: Shield,
    description: "Sifflements, vibrations, efficacité réduite",
    color: "from-red-500 to-rose-600",
  },
  {
    id: "moteur",
    label: "Moteur",
    icon: Gauge,
    description: "Claquements, fumées, perte de puissance",
    color: "from-slate-600 to-slate-800",
  },
  {
    id: "suspension",
    label: "Suspension",
    icon: Car,
    description: "Cognements, tenue de route dégradée",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "electricite",
    label: "Électricité",
    icon: Zap,
    description: "Voyants allumés, démarrage difficile",
    color: "from-yellow-500 to-amber-600",
  },
  {
    id: "refroidissement",
    label: "Refroidissement",
    icon: ThermometerSun,
    description: "Surchauffe, fuites liquide, ventilateur",
    color: "from-cyan-500 to-teal-600",
  },
];

const PERCEPTION_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  auditory: Volume2,
  visual: Eye,
  tactile: Wrench,
  performance: Gauge,
  electronic: Zap,
  olfactory: ThermometerSun,
};

const RISK_CONFIG = {
  critique: {
    label: "Critique",
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
  },
  securite: {
    label: "Sécurité",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
  },
  confort: {
    label: "Confort",
    dot: "bg-blue-500",
    text: "text-blue-700",
    bg: "bg-blue-50",
  },
} as const;

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const canonicalUrl = "https://www.automecanik.com/diagnostic-auto";

  // Unified FAQPage: static items + dynamic featured items
  const staticEntities = FAQ_DATA.map((item) => ({
    "@type": "Question" as const,
    name: item.question,
    acceptedAnswer: { "@type": "Answer" as const, text: item.answer },
  }));

  const dynamicEntities =
    data?.featured && data.featured.length > 0
      ? data.featured.slice(0, 5).map((d: DiagnosticItem) => ({
          "@type": "Question" as const,
          name: `Qu'est-ce qu'un ${d.title.split(":")[0].trim()} ?`,
          acceptedAnswer: {
            "@type": "Answer" as const,
            text:
              d.meta_description ||
              `Le ${d.title.split(":")[0].trim().toLowerCase()} est un symptôme automobile.`,
          },
        }))
      : [];

  return [
    {
      title:
        "Identifier une panne auto : diagnostic gratuit, signes et codes OBD | AutoMecanik",
    },
    {
      name: "description",
      content:
        "Comment identifier une panne voiture ? Lisez les signes avant-coureurs, décodez les voyants et codes OBD. 193 diagnostics gratuits avec causes probables par nos experts.",
    },
    { name: "robots", content: "index, follow" },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    {
      property: "og:title",
      content:
        "Identifier une panne auto : diagnostic gratuit, signes et codes OBD",
    },
    {
      property: "og:description",
      content:
        "Comment identifier une panne voiture ? Signes avant-coureurs, voyants, codes OBD. 193 diagnostics gratuits avec causes et solutions.",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/diagnostic.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:image",
      content: "https://www.automecanik.com/images/og/diagnostic.webp",
    },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [...staticEntities, ...dynamicEntities],
      },
    },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "Comment identifier une panne auto",
        description:
          "3 méthodes pour diagnostiquer une panne voiture : observation sensorielle, lecture des voyants, scanner OBD.",
        step: [
          {
            "@type": "HowToStep",
            position: 1,
            name: "Observer les symptômes sensoriels",
            text: "Identifiez le canal sensoriel : auditif (bruits), visuel (fumée, voyants), tactile (vibrations), olfactif (odeurs brûlées). Chaque canal pointe vers un système spécifique du véhicule.",
          },
          {
            "@type": "HowToStep",
            position: 2,
            name: "Lire les voyants du tableau de bord",
            text: "Voyant rouge = arrêt immédiat. Voyant orange = attention requise. Voyant jaune = information. Un voyant moteur orange nécessite la lecture d'un code OBD dans les 48h.",
          },
          {
            "@type": "HowToStep",
            position: 3,
            name: "Scanner le code OBD",
            text: "Branchez un scanner OBD2 sur le port sous le tableau de bord. Les codes Pxxxx concernent le moteur, Cxxxx le châssis, Bxxxx la carrosserie. Entrez le code dans notre outil pour un diagnostic ciblé.",
          },
        ],
      },
    },
  ];
};

const SIGNS_DATA = [
  {
    title: "Bruit inhabituel au freinage",
    detail:
      "Sifflement aigu = plaquettes usées. Grincement métallique = disques atteints ou étrier. Organe de sécurité : à traiter en priorité.",
    cluster: "freinage",
    clusterLabel: "Freinage",
  },
  {
    title: "Voyant moteur allumé (check engine)",
    detail:
      "Un code OBD est enregistré dans le calculateur. Lisez-le dans les 48h avec un scanner OBD ou entrez-le dans notre outil ci-dessus.",
    cluster: "electricite",
    clusterLabel: "Électricité",
  },
  {
    title: "Vibration au volant",
    detail:
      "À vitesse constante : pneumatiques ou géométrie. Au freinage : disques voilés. Basse vitesse : rotule ou biellette de suspension.",
    cluster: "suspension",
    clusterLabel: "Suspension",
  },
  {
    title: "Démarrage difficile ou raté",
    detail:
      "Lent = batterie faible. Clic unique = relais de démarrage. Silence total = démarreur ou sécurité moteur. Vérifiez aussi les bougies.",
    cluster: "electricite",
    clusterLabel: "Électricité",
  },
  {
    title: "Surconsommation soudaine",
    detail:
      "Augmentation > 15% sans changement de conduite. Causes : injecteurs, bougie défaillante, thermostat bloqué ouvert, fuite circuit d'air.",
    cluster: "moteur",
    clusterLabel: "Moteur",
  },
  {
    title: "Fumée à l'échappement",
    detail:
      "Blanche dense = liquide de refroidissement (joint de culasse). Noire = mélange trop riche. Bleue = huile brûlée (segments, joints spi).",
    cluster: "moteur",
    clusterLabel: "Moteur",
  },
  {
    title: "Perte de puissance",
    detail:
      "FAP obstrué (diesel, trajets courts), turbo défaillant, injecteurs encrassés ou problème de gestion moteur. Scanner OBD recommandé.",
    cluster: "moteur",
    clusterLabel: "Moteur",
  },
  {
    title: "Odeur de brûlé",
    detail:
      "Caoutchouc : courroie en contact. Plastique : fusible ou faisceau. Œuf pourri : catalyseur. Âcre : embrayage en patinage.",
    cluster: "embrayage",
    clusterLabel: "Embrayage",
  },
  {
    title: "Pédale de frein molle ou spongieuse",
    detail:
      "Air dans le circuit ou fuite de liquide de frein. Perte de freinage possible. Arrêt immédiat si la pédale touche le plancher.",
    cluster: "freinage",
    clusterLabel: "Freinage",
  },
  {
    title: "Voyant ABS ou ESP allumé",
    detail:
      "ABS orange = capteur de roue défaillant dans 60% des cas. Le freinage reste actif mais sans assistance. Contrôle sous 7 jours.",
    cluster: "electricite",
    clusterLabel: "Électricité",
  },
];

const FAQ_DATA = [
  {
    question: "Comment savoir quel est le problème de ma voiture ?",
    answer:
      "Commencez par observer les symptômes sensoriels : voyants allumés, bruits inhabituels, vibrations, odeurs. Si un voyant moteur est allumé, lisez le code OBD avec un scanner ou entrez-le directement dans notre outil ci-dessus. Pour les pannes sans voyant, décrivez le symptôme dans le champ de recherche (ex : « bruit au freinage », « vibration volant »).",
    link: null as { href: string; label: string } | null,
  },
  {
    question: "Comment identifier une panne de démarreur ?",
    answer:
      "Un démarreur défaillant se manifeste par : un clic unique sans démarrage du moteur (relais ou solénoïde), un grincement bref lors de la mise en route, ou une absence totale de réaction alors que la batterie est chargée (tension > 12.4V). Pour confirmer, mesurez la tension aux bornes du démarreur lors de la sollicitation.",
    link: {
      href: "/diagnostic-auto?cluster=electricite",
      label: "Voir les diagnostics électricité",
    },
  },
  {
    question: "Qu'est-ce qu'une panne voyant ABS ?",
    answer:
      "Le voyant ABS orange indique que le système antiblocage est désactivé. Le freinage normal reste fonctionnel. Cause la plus fréquente : capteur ABS de roue défaillant (50 à 80 EUR la pièce). La lecture d'un code OBD Cxxxx confirme le capteur concerné. Rouler sans ABS est dangereux en freinage d'urgence.",
    link: null,
  },
  {
    question: "Comment lire un code panne OBD ?",
    answer:
      "Branchez un scanner OBD2 sur le port situé sous le tableau de bord côté conducteur (sous la colonne de direction). Le scanner lit les codes du type P0300 (raté d'allumage), C0031 (capteur ABS), etc. Vous pouvez également entrer le code dans notre outil Scanner en haut de page. N'effacez un code qu'après réparation.",
    link: null,
  },
  {
    question: "Voiture en panne qui ne démarre pas : par où commencer ?",
    answer:
      "Vérifiez dans cet ordre : 1) Batterie — tension > 12.4V au repos, bornes non oxydées. 2) Démarreur — clic = relais OK, silence = démarreur ou sécurité. 3) Allumage — bougies, bobines si le moteur tourne mais cale. 4) Alimentation — pompe à carburant (bruit 2 sec au contact). Un code OBD précise souvent la piste.",
    link: null,
  },
  {
    question: "Panne mécanique ou électrique : comment savoir ?",
    answer:
      "Une panne mécanique est progressive : bruits, vibrations, odeurs, aggravée par la température. Une panne électronique est souvent soudaine avec voyant allumé et sans symptôme sonore. Le scanner OBD identifie les défauts électroniques ; une inspection physique révèle les pannes mécaniques.",
    link: null,
  },
  {
    question: "Que faire si un voyant rouge s'allume en conduisant ?",
    answer:
      "Un voyant rouge impose l'arrêt immédiat sécurisé du véhicule (huile, température, frein). Garez-vous dès que possible, coupez le moteur. Relancer un moteur surchauffé ou en manque de pression d'huile cause des dommages irréversibles. Appelez de l'assistance.",
    link: {
      href: "/diagnostic-auto?cluster=moteur",
      label: "Diagnostics moteur urgents",
    },
  },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";

  try {
    const response = await fetch(`${API_URL}/api/seo/diagnostic/featured`, {
      headers: { Accept: "application/json" },
    });

    let featured: DiagnosticItem[] = [];
    if (response.ok) {
      const data = await response.json();
      featured = data?.data || [];
    }

    return json({ featured });
  } catch (error) {
    logger.error("[diagnostic-auto._index] Loader error:", error);
    return json({ featured: [] as DiagnosticItem[] });
  }
}

export default function DiagnosticAutoIndex() {
  const { featured } = useLoaderData<typeof loader>();
  const [searchQuery, setSearchQuery] = useState("");
  const [dtcCode, setDtcCode] = useState("");

  const filteredClusters = CLUSTERS.filter(
    (c) =>
      c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumbs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Diagnostic Auto", href: "/diagnostic-auto" },
            ]}
          />
        </div>
      </div>

      {/* ═══ HERO ═══ */}
      <HeroDiagnostic
        title="Identifiez votre panne auto"
        description="Décrivez le symptôme, notre outil identifie les causes probables et vous oriente vers la bonne pièce. Gratuit, sans inscription."
        severity="warning"
      />

      {/* ═══ RECHERCHE + OBD ═══ */}
      <section className="bg-white border-b py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="search"
                placeholder="Décrivez votre problème (ex: bruit au freinage...)"
                className="pl-11 h-11 rounded-xl text-base"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const code = dtcCode.trim().toUpperCase();
                if (code) {
                  window.location.href = `/diagnostic-auto?dtc=${encodeURIComponent(code)}`;
                }
              }}
              className="flex gap-2"
            >
              <Input
                type="text"
                placeholder="Code OBD (P0300...)"
                className="h-11 w-40 bg-gray-100 border-gray-200 font-mono rounded-xl text-center"
                value={dtcCode}
                onChange={(e) => setDtcCode(e.target.value)}
              />
              <button
                type="submit"
                className="h-11 px-5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors whitespace-nowrap"
              >
                Scanner
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ═══ CLUSTERS ═══ */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Par catégorie</h2>
        <p className="text-gray-500 mb-8">
          Sélectionnez la zone concernée pour affiner le diagnostic
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {filteredClusters.map((cluster) => {
            const Icon = cluster.icon;
            return (
              <Link
                key={cluster.id}
                to={`/diagnostic-auto?cluster=${cluster.id}`}
                className="group block"
              >
                <div
                  className={`relative rounded-2xl p-5 bg-gradient-to-br ${cluster.color} text-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
                >
                  <div
                    className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-x-4 -translate-y-4"
                    aria-hidden="true"
                  />
                  <Icon className="h-8 w-8 mb-3 relative z-10" />
                  <p className="font-bold text-sm relative z-10">
                    {cluster.label}
                  </p>
                  <p className="text-[11px] text-white/70 mt-1 leading-tight relative z-10">
                    {cluster.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {filteredClusters.length === 0 && searchQuery && (
          <p className="text-center text-gray-500 py-8">
            Aucune catégorie ne correspond à « {searchQuery} »
          </p>
        )}
      </section>

      {/* ═══ GUIDE : COMMENT IDENTIFIER SA PANNE ═══ */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <Badge className="mb-4 bg-orange-100 text-orange-700 border-orange-200">
              Guide expert
            </Badge>
            <h2 className="text-3xl font-extrabold text-gray-900 mb-4 leading-tight">
              Comment identifier une panne auto : le guide complet
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              80 % des pannes automobiles présentent des signes avant-coureurs
              pendant plusieurs semaines avant l'immobilisation. Savoir les
              reconnaître vous permet d'agir avant la panne totale et d'arriver
              chez le garagiste avec une hypothèse claire — ce qui réduit le
              coût de réparation.
            </p>

            {/* Methode 1 */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                Observer les symptômes sensoriels (sans outil)
              </h3>
              <p className="text-gray-600 mb-3">
                Chaque système du véhicule s'exprime par un canal sensoriel
                distinct. Identifier le canal affine le diagnostic avant tout
                démontage.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    icon: Volume2,
                    label: "Auditif",
                    examples: "Sifflement, claquement, grincement",
                    zone: "Freinage, suspension, moteur",
                    iconColor: "text-blue-500",
                  },
                  {
                    icon: Eye,
                    label: "Visuel",
                    examples: "Fumée, voyant, fuite visible",
                    zone: "Moteur, refroidissement, freins",
                    iconColor: "text-amber-500",
                  },
                  {
                    icon: Wrench,
                    label: "Tactile",
                    examples: "Vibration, à-coup, pédale molle",
                    zone: "Suspension, embrayage, freinage",
                    iconColor: "text-slate-500",
                  },
                  {
                    icon: ThermometerSun,
                    label: "Olfactif",
                    examples: "Odeur de brûlé, caoutchouc",
                    zone: "Embrayage, freins, électrique",
                    iconColor: "text-red-500",
                  },
                ].map(({ icon: Icon, label, examples, zone, iconColor }) => (
                  <div
                    key={label}
                    className="p-3 bg-gray-50 rounded-xl border border-gray-100"
                  >
                    <Icon className={`h-5 w-5 ${iconColor} mb-2`} />
                    <p className="font-semibold text-gray-900 text-sm">
                      {label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{examples}</p>
                    <p className="text-xs text-gray-400 mt-1 italic">{zone}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Methode 2 */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                Lire les voyants du tableau de bord
              </h3>
              <p className="text-gray-600 mb-3">
                Les voyants sont le premier niveau de diagnostic embarqué. La
                couleur indique l'urgence :{" "}
                <span className="text-red-600 font-semibold">
                  rouge = arrêt immédiat
                </span>
                ,{" "}
                <span className="text-amber-600 font-semibold">
                  orange = attention rapide
                </span>
                ,{" "}
                <span className="text-yellow-600 font-semibold">
                  jaune = information
                </span>
                .
              </p>
              <Link
                to="/diagnostic-auto?cluster=electricite"
                className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-800 font-medium transition-colors"
              >
                Voir tous les diagnostics voyants{" "}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Methode 3 */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-orange-500 text-white text-sm flex items-center justify-center font-bold shrink-0">
                  3
                </span>
                Scanner le code OBD (P, C, B, U)
              </h3>
              <p className="text-gray-600">
                Depuis 2001, tous les véhicules ont un port OBD2 sous le tableau
                de bord. Un scanner OBD (à partir de 30 EUR) lit les codes
                défaut enregistrés par le calculateur. Les codes Pxxxx
                concernent le moteur, Cxxxx le châssis (ABS, ESP), Bxxxx la
                carrosserie, Uxxxx le réseau de communication. Entrez votre code
                dans l'outil en haut de page pour un diagnostic ciblé.
              </p>
            </div>
          </div>

          {/* Sidebar stats */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-[#0d1b3e] text-white p-6">
              <p className="text-4xl font-extrabold text-orange-400 mb-1">
                80%
              </p>
              <p className="text-sm text-white/70">
                des pannes présentent des signes avant-coureurs avant
                l'immobilisation
              </p>
            </div>
            <div className="rounded-2xl border p-6 bg-white">
              <p className="text-4xl font-extrabold text-gray-900 mb-1">193</p>
              <p className="text-sm text-gray-500">
                diagnostics disponibles avec causes et solutions
              </p>
              <Link
                to="/diagnostic-auto?cluster=moteur"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-orange-600 font-medium hover:text-orange-800 transition-colors"
              >
                Explorer <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-2xl border p-6 bg-amber-50 border-amber-200">
              <Zap className="h-5 w-5 text-amber-600 mb-2" />
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Diagnostics électroniques
              </p>
              <p className="text-xs text-amber-700">
                Entrez votre code OBD (P0300...) dans l'outil ci-dessus pour
                identifier la panne avec 95% de fiabilité.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ SIGNES AVANT-COUREURS ═══ */}
      <section className="bg-gray-50 border-y py-14">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Les 10 signes avant-coureurs d'une panne auto
          </h2>
          <p className="text-gray-500 mb-8 max-w-2xl">
            Reconnaître ces signaux tôt évite l'immobilisation et réduit le coût
            de réparation. Classés par fréquence d'apparition.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SIGNS_DATA.map((sign, index) => (
              <div
                key={index}
                className="flex items-start gap-4 bg-white rounded-xl p-4 border border-gray-100"
              >
                <span className="text-2xl font-extrabold text-gray-200 w-8 shrink-0 leading-none mt-0.5">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm mb-0.5">
                    {sign.title}
                  </p>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {sign.detail}
                  </p>
                  {sign.cluster && (
                    <Link
                      to={`/diagnostic-auto?cluster=${sign.cluster}`}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium transition-colors"
                    >
                      Diagnostics {sign.clusterLabel}{" "}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MÉCANIQUE VS ÉLECTRIQUE ═══ */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Panne mécanique ou électrique : comment les distinguer ?
        </h2>
        <p className="text-gray-500 mb-8 max-w-2xl">
          Le type de panne conditionne la méthode de diagnostic et le
          professionnel à contacter. Voici les critères clés.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Mecanique */}
          <div className="rounded-2xl border-2 border-slate-200 p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-slate-100 rounded-xl">
                <Wrench className="h-6 w-6 text-slate-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Panne mécanique
              </h3>
            </div>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Apparition progressive sur plusieurs semaines</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>S'accompagne de bruits, vibrations ou odeurs</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Souvent aggravée par la montée en température</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Diagnostic : inspection visuelle et écoute</span>
              </li>
            </ul>
            <Separator className="my-4" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
              Exemples fréquents
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Usure plaquettes",
                "Joint de culasse",
                "Courroie de distribution",
                "Amortisseur",
                "Embrayage",
              ].map((ex) => (
                <span
                  key={ex}
                  className="text-xs bg-slate-100 text-slate-700 rounded-full px-2.5 py-0.5"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>

          {/* Electrique */}
          <div className="rounded-2xl border-2 border-yellow-200 p-6 bg-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 rounded-xl">
                <Zap className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Panne électrique / électronique
              </h3>
            </div>
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Apparition souvent soudaine avec voyant allumé</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Indépendante de la température ou des vibrations</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Scanner OBD indispensable pour lire le code défaut</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                <span>Peut masquer une cause mécanique sous-jacente</span>
              </li>
            </ul>
            <Separator className="my-4" />
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
              Exemples fréquents
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                "Capteur ABS",
                "Capteur O2",
                "Calculateur moteur",
                "Alternateur",
                "FAP obstrué",
              ].map((ex) => (
                <span
                  key={ex}
                  className="text-xs bg-yellow-100 text-yellow-700 rounded-full px-2.5 py-0.5"
                >
                  {ex}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ DIAGNOSTICS POPULAIRES ═══ */}
      <section className="bg-white border-y">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Diagnostics fréquents
              </h2>
              <p className="text-gray-500 mt-1">
                Les pannes les plus recherchées par nos utilisateurs
              </p>
            </div>
          </div>

          {featured.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {featured.map((item) => {
                const PerceptionIcon =
                  PERCEPTION_ICONS[item.perception_channel] || Volume2;
                const risk =
                  RISK_CONFIG[item.risk_level as keyof typeof RISK_CONFIG] ||
                  RISK_CONFIG.confort;

                return (
                  <Link
                    key={item.slug}
                    to={`/diagnostic-auto/${item.slug}`}
                    className="group"
                  >
                    <div className="h-full rounded-xl border bg-white p-5 transition-all duration-200 hover:shadow-lg hover:border-gray-300 group-hover:-translate-y-0.5">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-gray-100 rounded-lg shrink-0 group-hover:bg-orange-50 transition-colors">
                          <PerceptionIcon className="h-5 w-5 text-gray-500 group-hover:text-orange-600 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-orange-700 transition-colors">
                            {item.title}
                          </h3>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 group-hover:text-orange-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                        {item.meta_description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${risk.bg} ${risk.text}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${risk.dot}`}
                          />
                          {risk.label}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">
                          {item.cluster_id?.replace(/-/g, " ")}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center">
              <ScanLine className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="font-semibold text-gray-900 mb-1">
                Diagnostics en cours de préparation
              </p>
              <p className="text-sm text-gray-500">
                Explorez les catégories ci-dessus en attendant.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ═══ URGENCE : PANNE SUR AUTOROUTE ═══ */}
      <section className="bg-gradient-to-br from-red-950 to-red-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-red-800/60 rounded-xl border border-red-700/50">
              <AlertTriangle className="h-6 w-6 text-red-300" />
            </div>
            <div>
              <p className="text-xs text-red-400 uppercase tracking-widest font-semibold">
                Urgence
              </p>
              <h2 className="text-2xl font-bold">
                Que faire en cas de panne sur autoroute ?
              </h2>
            </div>
          </div>
          <p className="text-red-200 mb-8 max-w-2xl text-sm">
            Sur autoroute, la priorité absolue est la sécurité des occupants —
            avant tout diagnostic. Ne tentez jamais de réparer sur la bande
            d'arrêt d'urgence.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                step: "1",
                icon: AlertTriangle,
                text: "Allumer les feux de détresse immédiatement",
              },
              {
                step: "2",
                icon: Car,
                text: "Se garer sur la BAU, le plus à droite possible",
              },
              {
                step: "3",
                icon: Shield,
                text: "Sortir par la droite, s'éloigner, revêtir le gilet",
              },
              {
                step: "4",
                icon: Phone,
                text: "Appeler le 3477 (société d'autoroute) ou le 112",
              },
            ].map(({ step, icon: Icon, text }) => (
              <div
                key={step}
                className="flex gap-3 bg-red-800/40 rounded-xl p-4 border border-red-700/30"
              >
                <span className="w-8 h-8 rounded-full bg-red-500/30 text-red-200 text-sm font-bold flex items-center justify-center shrink-0">
                  {step}
                </span>
                <div>
                  <Icon className="h-4 w-4 text-red-300 mb-1.5" />
                  <p className="text-sm text-red-100 leading-snug">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/diagnostic-auto?cluster=moteur"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors border border-white/20"
            >
              Diagnostics moteur <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/diagnostic-auto?cluster=electricite"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors border border-white/20"
            >
              Diagnostics électricité <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section className="max-w-7xl mx-auto px-4 py-14">
        <div className="flex items-center gap-3 mb-8">
          <HelpCircle className="h-6 w-6 text-orange-500" />
          <h2 className="text-2xl font-bold text-gray-900">
            Questions fréquentes sur les pannes auto
          </h2>
        </div>
        <div className="max-w-3xl">
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_DATA.map((item, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="border rounded-xl px-4 bg-white"
              >
                <AccordionTrigger className="text-left text-sm font-semibold text-gray-900 py-4 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-gray-600 leading-relaxed pb-4">
                  {item.answer}
                  {item.link && (
                    <Link
                      to={item.link.href}
                      className="mt-2 inline-flex items-center gap-1 text-orange-600 hover:text-orange-800 font-medium transition-colors"
                    >
                      {item.link.label} <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ═══ CTA BOTTOM ═══ */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="rounded-2xl bg-[#0d1b3e] text-white p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400 uppercase tracking-wider">
                Code erreur
              </span>
            </div>
            <h3 className="text-2xl font-bold mb-2">
              Votre tableau de bord affiche un voyant ?
            </h3>
            <p className="text-white/60">
              Entrez le code OBD (P0XXX, C1XXX...) pour un diagnostic précis à
              95% de fiabilité.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const code = dtcCode.trim().toUpperCase();
              if (code) {
                window.location.href = `/diagnostic-auto?dtc=${encodeURIComponent(code)}`;
              }
            }}
            className="flex gap-2 shrink-0"
          >
            <Input
              type="text"
              placeholder="P0300"
              className="h-12 w-36 bg-white/10 border-white/20 text-white placeholder:text-white/40 font-mono text-center rounded-xl text-lg"
              value={dtcCode}
              onChange={(e) => setDtcCode(e.target.value)}
            />
            <button
              type="submit"
              className="h-12 px-6 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              Scanner
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Cross-link glossaire */}
      <div className="max-w-7xl mx-auto px-4 pb-12 flex items-center justify-center gap-2 text-sm text-gray-500">
        <BookOpen className="w-4 h-4 text-indigo-500" />
        <span>Comprendre les pièces mentionnées ?</span>
        <Link
          to="/reference-auto"
          className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Consulter le glossaire
        </Link>
      </div>
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <Error404 />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Erreur de chargement
          </h2>
          <p className="text-gray-600 mb-4">
            Impossible de charger la page diagnostic. Veuillez réessayer.
          </p>
          <Link
            to="/"
            className="inline-flex items-center text-orange-600 hover:text-orange-800"
          >
            Retour à l'accueil
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
