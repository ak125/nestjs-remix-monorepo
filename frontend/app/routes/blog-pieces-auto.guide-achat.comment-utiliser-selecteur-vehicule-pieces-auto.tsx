/**
 * Route : /blog-pieces-auto/guide-achat/comment-utiliser-selecteur-vehicule-pieces-auto
 * Guide d'achat interactif : 4 methodes pour identifier son vehicule et commander les bonnes pieces
 *
 * Role SEO : R3 - BLOG (informationnelle + commerciale)
 * Intention : Apprendre a utiliser le selecteur de vehicule (immatriculation, VIN, manuelle, OEM)
 * Mots-cles principaux : selecteur de vehicule pieces auto, recherche pieces auto par plaque
 *   d'immatriculation, trouver piece auto avec numero de chassis, reference OEM
 */

import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Car,
  Check,
  CheckCircle,
  FileSearch,
  Hash,
  HelpCircle,
  Info,
  Package,
  Search,
  Settings,
  Shield,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";

import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { CarteGriseHelper } from "~/components/blog/guide-selecteur/CarteGriseHelper";
import { NoteProBlock } from "~/components/blog/guide-selecteur/NoteProBlock";
import { SelecteurVehiculeDemo } from "~/components/blog/guide-selecteur/SelecteurVehiculeDemo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

/* ===========================================================================
   FAQ DATA
   =========================================================================== */

const FAQ_ITEMS = [
  {
    question:
      "Pourquoi dois-je selectionner mon vehicule avant de commander des pieces auto ?",
    answer:
      "Chaque vehicule a des specifications techniques uniques : dimensions de disques, type de fixation, connecteurs electriques. Commander une piece incompatible peut entrainer un montage impossible, un dysfonctionnement ou un danger. Le selecteur de vehicule pieces auto garantit que seules les pieces compatibles avec votre vehicule vous sont proposees. Sans selection, vous verriez les 4 millions de references du catalogue — le selecteur reduit ce choix aux pieces verifiees pour votre montage exact.",
  },
  {
    question: "Comment trouver la reference d'une piece auto ?",
    answer:
      "Il existe 3 methodes pour trouver la reference d'une piece auto : 1) Relevez le numero OEM (Origine Equipementier) grave ou imprime directement sur la piece usagee (ex : 8200 123 456 pour Renault). 2) Consultez le catalogue constructeur avec votre numero VIN pour obtenir les references d'origine. 3) Utilisez notre selecteur de vehicule par immatriculation ou VIN : il identifie automatiquement les references compatibles avec votre montage exact.",
  },
  {
    question: "Ou trouver le numero VIN de mon vehicule ?",
    answer:
      "Le VIN (Vehicle Identification Number) est un code unique de 17 caracteres. Vous le trouverez : sur la plaque constructeur (montant de porte conducteur), sur le pare-brise cote conducteur (visible de l'exterieur), et sur votre carte grise au champ E. Le numero VIN 17 caracteres permet de trouver des pieces auto avec une precision de 99%+.",
  },
  {
    question: "C'est quoi F1, F2 et F3 sur une carte grise ?",
    answer:
      "Les champs F de la carte grise concernent les masses du vehicule : F.1 = masse en charge maximale techniquement admissible (PTAC), F.2 = PTAC de l'ensemble (vehicule + remorque), F.3 = masse en charge maximale de l'ensemble en service (PTRA). Ces informations sont utiles pour dimensionner correctement les pieces de freinage (disques, plaquettes) et de suspension (amortisseurs, ressorts) de votre vehicule.",
  },
  {
    question: "Comment savoir le type de motorisation de ma voiture ?",
    answer:
      "Pour connaitre le type de motorisation, consultez le champ P.3 de votre carte grise (type de carburant : essence, diesel, hybride, electrique, GPL) et le champ D.2 (type mine / variante / version). Vous pouvez aussi decoder votre VIN : les positions 4 a 8 identifient generalement le moteur. Notre selecteur par VIN extrait automatiquement ces informations.",
  },
  {
    question: "Que faire si mon vehicule n'apparait pas dans le selecteur ?",
    answer:
      "Essayez la recherche par VIN qui est la plus precise. Pour les vehicules rares, importes ou tres recents, contactez notre service client avec votre carte grise : nous identifierons les pieces compatibles manuellement. Astuce : les vehicules importes depuis l'Allemagne ou la Belgique sont generalement reconnus par VIN meme si la plaque etrangere ne fonctionne pas.",
  },
  {
    question: "Quelle est la difference entre type mine et code moteur ?",
    answer:
      "Le type mine (champ D.2 de la carte grise) identifie la version exacte du vehicule aupres du constructeur. Le code moteur, grave sur le bloc moteur, identifie uniquement la motorisation. Les deux informations sont complementaires pour une identification precise. Vous pouvez trouver le code moteur avec le VIN gratuitement via notre selecteur.",
  },
  {
    question:
      "Mon vehicule a des variantes de montage : comment choisir la bonne piece ?",
    answer:
      "Les variantes existent car les constructeurs changent de fournisseurs en cours de production. Pour identifier la bonne variante : mesurez les pieces actuelles (diametre des disques, nombre de trous), consultez la plaque constructeur (codes PR/option), ou utilisez la recherche par VIN qui identifie automatiquement la bonne configuration. Conseil rapide : prenez une photo du numero OE grave sur votre piece actuelle. Ce numero est votre meilleure reference pour retrouver l'equivalent exact.",
  },
  {
    question: "Comment etre sur de commander la bonne piece auto en ligne ?",
    answer:
      "Pour etre sur de commander la bonne piece auto : 1) Selectionnez votre vehicule via notre configurateur (immatriculation, VIN ou selection manuelle). 2) Verifiez que la fiche produit indique 'Compatible' avec votre vehicule. 3) Lisez les alertes de variantes (diametre, Start & Stop, capteur). 4) En cas de doute, comparez le numero OEM de votre ancienne piece. 5) Pour les pieces de securite (freins, suspension), privilegiez toujours la recherche par VIN.",
  },
  {
    question: "Les pieces premier prix sont-elles fiables pour le freinage ?",
    answer:
      "Pour les organes de securite (freinage, direction, suspension), nous recommandons les equipementiers de premiere monte (Bosch, TRW, Valeo, Brembo). Ces fabricants respectent les cahiers des charges constructeur et leurs pieces sont testees aux memes normes que les pieces d'origine. La difference entre une piece d'origine et un equipementier ? Souvent la meme usine, sans le logo constructeur, avec un prix reduit de 20 a 40%.",
  },
  {
    question: "Puis-je enregistrer plusieurs vehicules dans le selecteur ?",
    answer:
      "Le selecteur enregistre le dernier vehicule selectionne pour accelerer vos prochaines visites. Si vous possedez plusieurs vehicules, vous pouvez changer de vehicule a tout moment en cliquant sur 'Changer de vehicule'. L'historique de vos commandes conserve la reference de chaque vehicule.",
  },
  {
    question: "Le selecteur fonctionne-t-il pour les vehicules importes ?",
    answer:
      "Les vehicules importes depuis l'Europe (Allemagne, Belgique, Espagne, Italie) sont generalement reconnus par la recherche VIN, meme si la plaque d'immatriculation etrangere ne fonctionne pas avec la recherche par immatriculation. Le VIN est un standard international qui identifie le vehicule independamment du pays d'immatriculation.",
  },
  {
    question: "Ou trouver un logiciel de vue eclatee automobile gratuit ?",
    answer:
      "Les catalogues en ligne comme TecDoc et 7zap proposent des vues eclatees gratuites pour identifier les pieces par position sur le vehicule. Automecanik integre ces donnees TecDoc directement dans son catalogue : en selectionnant votre vehicule, vous accedez aux schemas de montage et aux references croisees des equipementiers. C'est le meilleur logiciel de reference piece auto integre a un site de vente.",
  },
  {
    question:
      "Quelle est la difference entre piece d'origine et piece equipementier ?",
    answer:
      "Une piece d'origine (OE) porte la marque du constructeur automobile (Renault, Peugeot, VW...) et est vendue par le reseau officiel. Une piece equipementier (Bosch, Valeo, TRW, Brembo...) sort souvent de la meme usine que la piece d'origine, sans le logo constructeur. La qualite est identique (meme cahier des charges, memes normes), mais le prix est generalement 20 a 40% inferieur. C'est pourquoi chercher le numero OEM de sa piece permet de trouver les equivalences exactes a meilleur prix.",
  },
];

const TOC_ITEMS = [
  { id: "pourquoi", label: "Pourquoi", icon: Shield },
  { id: "methodes", label: "4 methodes", icon: Search },
  { id: "etapes-manuelles", label: "Pas a pas", icon: Settings },
  { id: "reference-oem", label: "Ref. OEM", icon: Package },
  { id: "variantes", label: "Variantes", icon: AlertTriangle },
  { id: "depannage", label: "Depannage", icon: Wrench },
  { id: "checklist", label: "Checklist", icon: CheckCircle },
  { id: "faq", label: "FAQ", icon: HelpCircle },
];

/* ===========================================================================
   SEO
   =========================================================================== */

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R3_BLOG, {
    clusterId: "guide",
    canonicalEntity: "selecteur-vehicule-pieces-auto",
  }),
};

export const meta: MetaFunction = ({ location }) => {
  const canonicalUrl = `https://www.automecanik.com${location.pathname}`;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": canonicalUrl,
    headline:
      "Comment utiliser le selecteur de vehicule pieces auto : 4 methodes pour trouver la bonne piece",
    description:
      "Comment trouver la piece auto compatible avec votre vehicule ? 4 methodes : plaque d'immatriculation, marque/modele/motorisation, numero VIN, reference OEM. Guide pratique parmi 4M+ pieces.",
    url: canonicalUrl,
    datePublished: "2026-02-15",
    dateModified: "2026-02-17",
    author: {
      "@type": "Organization",
      name: "Automecanik",
      url: "https://www.automecanik.com",
    },
    publisher: {
      "@type": "Organization",
      name: "Automecanik",
      url: "https://www.automecanik.com",
      logo: {
        "@type": "ImageObject",
        url: "https://www.automecanik.com/logo-navbar.webp",
      },
    },
    articleSection: "Guides Techniques",
    keywords:
      "selecteur de vehicule pieces auto, configurateur de pieces auto en ligne, recherche pieces auto par plaque d'immatriculation, piece auto avec carte grise, trouver piece auto avec numero de chassis, numero VIN 17 caracteres pieces auto, trouver code moteur avec VIN gratuit, trouver numero OEM avec VIN gratuit, comment trouver piece auto compatible avec mon vehicule, comment etre sur de commander la bonne piece auto, chercher piece detachee par reference OEM, guide pratique choisir pieces auto",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalUrl },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: "https://www.automecanik.com/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://www.automecanik.com/blog-pieces-auto",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "Guides d'achat",
        item: "https://www.automecanik.com/blog-pieces-auto/guide-achat",
      },
      {
        "@type": "ListItem",
        position: 4,
        name: "Selecteur de vehicule pieces auto",
      },
    ],
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Comment utiliser le selecteur de vehicule pour trouver des pieces auto compatibles",
    description:
      "4 methodes pour identifier votre vehicule et commander les bonnes pieces auto parmi 4M+ references verifiees.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Recherche par plaque d'immatriculation",
        text: "Saisissez votre numero de plaque (format SIV AA-123-BB ou ancien FNI). Le systeme identifie automatiquement votre vehicule en quelques secondes. C'est la methode la plus rapide pour les plaques francaises.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Recherche par numero VIN (chassis)",
        text: "Saisissez les 17 caracteres du VIN (visible sur carte grise champ E ou pare-brise). Cette methode offre 99%+ de fiabilite et identifie la configuration exacte sortie d'usine, y compris pour les vehicules importes.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Selection manuelle (marque, modele, motorisation)",
        text: "Selectionnez successivement la marque (champ D.1), le modele/generation, l'annee (champ B) et la motorisation (champ P.3). En cas de doute entre 2 motorisations proches, utilisez la recherche par VIN.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Recherche par reference OEM",
        text: "Saisissez le numero OEM (Origine Equipementier) grave sur la piece d'origine pour trouver l'equivalent exact ou les alternatives compatibles chez d'autres fabricants. C'est la methode la plus precise pour un remplacement a l'identique.",
      },
    ],
  };

  return [
    {
      title:
        "Selecteur de vehicule pieces auto : 4 methodes pour trouver la bonne piece | Automecanik",
    },
    {
      name: "description",
      content:
        "Comment trouver la piece auto compatible avec votre vehicule ? 4 methodes : plaque d'immatriculation, marque/modele/motorisation, numero VIN, reference OEM. Guide pratique parmi 4M+ pieces.",
    },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { name: "robots", content: "index, follow" },
    {
      property: "og:title",
      content:
        "Comment utiliser le selecteur de vehicule pieces auto : guide complet",
    },
    {
      property: "og:description",
      content:
        "Guide pratique avec demo interactive : identifiez votre vehicule en 15 secondes par immatriculation, VIN, selection manuelle ou reference OEM parmi 4M+ pieces verifiees.",
    },
    { property: "og:type", content: "article" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: "https://www.automecanik.com/logo-og.webp",
    },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    {
      property: "og:image:alt",
      content:
        "Guide selecteur vehicule Automecanik - 4 methodes pour trouver vos pieces auto compatibles",
    },
    { property: "article:published_time", content: "2026-02-15" },
    { property: "article:modified_time", content: "2026-02-17" },
    { name: "twitter:card", content: "summary_large_image" },
    {
      name: "twitter:title",
      content: "Selecteur de vehicule pieces auto : guide complet",
    },
    {
      name: "twitter:description",
      content:
        "4 methodes pour identifier votre vehicule et commander les pieces 100% compatibles parmi 4M+ references.",
    },
    { name: "author", content: "Automecanik - Experts Automobile" },
    { "script:ld+json": articleSchema },
    { "script:ld+json": breadcrumbSchema },
    { "script:ld+json": howToSchema },
  ];
};

/* ===========================================================================
   SUB-COMPONENTS
   =========================================================================== */

function TableOfContentsGuide() {
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-20% 0px -80% 0px", threshold: 0.1 },
    );

    TOC_ITEMS.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const activeIndex = TOC_ITEMS.findIndex((item) => item.id === activeSection);

  return (
    <nav aria-label="Sommaire du guide" className="mb-8">
      <div className="flex flex-wrap gap-2">
        {TOC_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all duration-200 ${
                isActive
                  ? "border-green-400 bg-green-100 font-medium text-green-800"
                  : "border-gray-200 bg-white text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </a>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          4 methodes : immatriculation, VIN, manuelle, reference OEM.
        </p>
        {activeIndex >= 0 && (
          <span className="shrink-0 text-xs text-gray-400">
            {activeIndex + 1} / {TOC_ITEMS.length}
          </span>
        )}
      </div>
    </nav>
  );
}

function MethodCard({
  icon,
  title,
  badge,
  badgeVariant,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  badgeVariant?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <Badge
            className={
              badgeVariant === "success"
                ? "border-green-300 bg-green-50 text-green-800"
                : badgeVariant === "info"
                  ? "border-blue-300 bg-blue-50 text-blue-800"
                  : badgeVariant === "purple"
                    ? "border-purple-300 bg-purple-50 text-purple-800"
                    : ""
            }
          >
            {badge}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-gray-600">{children}</CardContent>
    </Card>
  );
}

function FaqSection() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <Card className="border-slate-200 bg-white" aria-labelledby="faq-title">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0d1b3e] text-white">
              <HelpCircle className="w-5 h-5" />
            </span>
            <h2
              id="faq-title"
              className="text-xl sm:text-2xl md:text-[28px] font-bold tracking-tight text-slate-900"
            >
              Questions frequentes sur le selecteur de vehicule
            </h2>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="faq-0">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border-slate-200 bg-white rounded-lg mb-3 last:mb-0"
              >
                <AccordionTrigger className="px-4 text-left text-slate-900 hover:no-underline hover:bg-slate-50 rounded-t-lg">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-4 border-t border-slate-100">
                  <p className="text-slate-700 leading-relaxed pt-2">
                    {item.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </>
  );
}

/* ===========================================================================
   PAGE COMPONENT
   =========================================================================== */

export default function GuideSelecteurVehicule() {
  return (
    <>
      <BlogPiecesAutoNavigation />

      <CompactBlogHeader
        title="Selecteur de vehicule pieces auto : comment trouver la bonne piece"
        description="4 methodes pour identifier votre vehicule et commander les bonnes pieces parmi 4M+ references verifiees."
        gradientFrom="from-green-600"
        gradientTo="to-emerald-600"
        breadcrumb={[
          { label: "Accueil", href: "/" },
          { label: "Blog", href: "/blog-pieces-auto/conseils" },
          { label: "Guides d'achat", href: "/blog-pieces-auto/guide-achat" },
          { label: "Selecteur de vehicule" },
        ]}
        stats={[
          { icon: Package, value: "4M+", label: "Pieces" },
          { icon: Car, value: "200+", label: "Marques" },
          { icon: Shield, value: "50+", label: "Equipementiers" },
        ]}
      />

      {/* Bande CTA sous le header */}
      <div className="bg-green-50 border-b border-green-200 py-3">
        <div className="container mx-auto px-4 flex flex-wrap gap-3 justify-center">
          <Button asChild size="sm">
            <Link to="/">
              <Car className="mr-1.5 h-4 w-4" />
              Selectionner mon vehicule
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="#demo-selecteur">Tester la demo interactive</a>
          </Button>
        </div>
      </div>

      <article className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
          {/* --- TL;DR --- */}
          <Card className="mb-8 border-green-200 bg-green-50/60">
            <CardContent className="pt-5">
              <p className="mb-3 text-base font-semibold text-green-900">
                Comment bien choisir ses pieces auto en ligne — guide pratique :
              </p>
              <p className="mb-4 text-sm text-green-800">
                Identifiez votre vehicule <strong>avant</strong> de chercher des
                pieces. Le selecteur de vehicule pieces auto filtre
                automatiquement les 4M+ references pour ne garder que celles
                compatibles avec votre montage exact. 4 methodes disponibles :
                plaque d'immatriculation, VIN, selection manuelle ou reference
                OEM.
              </p>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-green-800">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Checklist rapide
                  </p>
                  <ul className="space-y-1 text-sm text-green-900">
                    {[
                      "Utilisez VIN pour les pieces de securite (freins, suspension)",
                      "Immatriculation = le plus rapide si plaque francaise",
                      "Selection manuelle = toujours disponible, meme sans carte grise",
                      "Reference OEM = 100% precis pour un remplacement a l'identique",
                      "Verifiez les alertes de variantes sur la fiche produit",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-red-800">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Erreurs a eviter
                  </p>
                  <ul className="space-y-1 text-sm text-red-900">
                    {[
                      "Commander sans selectionner de vehicule (risque d'incompatibilite)",
                      "Ignorer les variantes de montage (diametre disque, capteur, fixation)",
                      "Se fier au nom du modele sans verifier la motorisation exacte",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table of Contents */}
          <TableOfContentsGuide />

          {/* --- Section: Pourquoi --- */}
          <section
            id="pourquoi"
            aria-labelledby="h2-pourquoi"
            className="mb-12"
          >
            <h2
              id="h2-pourquoi"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <Shield className="h-6 w-6 text-green-600" />
              Comment trouver la piece auto compatible avec votre vehicule
            </h2>

            <div className="space-y-4">
              <p className="text-gray-700">
                Comment etre sur de commander la bonne piece auto ? Un meme
                modele existe en plusieurs versions : motorisation, phase de
                production, options, parfois meme systeme de freinage different.
                Exemple : deux Renault Clio IV de la meme annee peuvent avoir
                des{" "}
                <Link
                  to="/pieces/disque-de-frein-82.html"
                  className="font-medium text-green-700 underline hover:text-green-900"
                >
                  disques de frein
                </Link>{" "}
                de diametres differents (283 mm vs 302 mm).
              </p>

              <Alert
                variant="warning"
                icon={<AlertTriangle className="h-4 w-4" />}
              >
                <AlertDescription>
                  <strong>A retenir :</strong> une piece « presque compatible »
                  est la pire situation. Elle peut se monter mal, s'user vite,
                  ou degrader la securite (freinage, suspension). Le selecteur
                  de vehicule pieces auto elimine ce risque.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    icon: <Shield className="h-5 w-5 text-green-600" />,
                    title: "Securite : tolerance zero",
                    text: "Freins, direction, suspension : les pieces de securite doivent correspondre exactement aux specifications constructeur.",
                  },
                  {
                    icon: <CheckCircle className="h-5 w-5 text-green-600" />,
                    title: "Compatibilite filtree",
                    text: "La compatibilite est verifiee avant l'achat : 0 erreur de commande, 0 retour couteux. Comment savoir si une piece est compatible avec votre voiture ? Le selecteur le fait pour vous.",
                  },
                  {
                    icon: <Search className="h-5 w-5 text-green-600" />,
                    title: "Des milliers de refs en moins",
                    text: "Le configurateur de pieces auto en ligne elimine automatiquement les references incompatibles. Vous ne voyez que ce qui correspond.",
                  },
                ].map((item) => (
                  <Card
                    key={item.title}
                    className="p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {item.icon}
                      <span className="font-medium text-gray-900">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{item.text}</p>
                  </Card>
                ))}
              </div>

              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-sm italic text-green-800">
                  "J'ai commande des plaquettes pour ma Golf VII en pensant que
                  c'etait les bonnes. Resultat : mauvais diametre, retour a mes
                  frais. Depuis que j'utilise le selecteur avec mon VIN, zero
                  erreur en 3 commandes."
                  <span className="mt-1 block font-medium not-italic text-green-900">
                    — Cas type rencontre par notre service client
                  </span>
                </CardContent>
              </Card>
            </div>
          </section>

          <Separator className="mb-12" />

          {/* --- Section: 4 Methodes --- */}
          <section
            id="methodes"
            aria-labelledby="h2-methodes"
            className="mb-12"
          >
            <h2
              id="h2-methodes"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <Search className="h-6 w-6 text-green-600" />4 methodes pour
              identifier votre vehicule et trouver vos pieces
            </h2>

            <p className="mb-6 text-gray-700">
              Comment trouver la piece detachee adaptee a votre voiture ?
              Choisissez la methode selon votre situation :
            </p>

            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MethodCard
                icon={<Hash className="h-5 w-5 text-green-600" />}
                title="Par immatriculation"
                badge="La plus rapide"
                badgeVariant="success"
              >
                <ul className="space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    Saisissez votre plaque (ex : AA-123-BB)
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    Recherche de pieces auto par plaque d'immatriculation
                    instantanee
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    Fonctionne avec la carte grise (piece auto par carte grise)
                  </li>
                </ul>
                <div className="mt-3 rounded-md bg-green-50 p-2 text-xs text-green-800">
                  <strong>Recommande si :</strong> vous etes sur le vehicule ou
                  vous avez la plaque sous les yeux.
                </div>
              </MethodCard>

              <MethodCard
                icon={<FileSearch className="h-5 w-5 text-blue-600" />}
                title="Par numero VIN"
                badge="La plus fiable"
                badgeVariant="info"
              >
                <ul className="space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                    Numero VIN 17 caracteres pieces auto
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                    Identifie la configuration exacte en sortie d'usine
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                    Trouver piece auto avec numero de chassis
                  </li>
                </ul>
                <div className="mt-3 rounded-md bg-blue-50 p-2 text-xs text-blue-800">
                  <strong>Recommande si :</strong> pieces de securite, vehicule
                  importe ou variantes de montage.
                </div>
              </MethodCard>

              <MethodCard
                icon={<Settings className="h-5 w-5 text-gray-600" />}
                title="Selection manuelle"
                badge="Toujours disponible"
              >
                <ul className="space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" />
                    Marque → modele → annee → motorisation
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" />
                    Fonctionne sans carte grise
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600" />
                    Selection des pieces detachees par modele de voiture
                  </li>
                </ul>
                <div className="mt-3 rounded-md bg-gray-100 p-2 text-xs text-gray-700">
                  <strong>Recommande si :</strong> vous connaissez votre
                  vehicule. Si doute entre 2 motorisations : passez en VIN.
                </div>
              </MethodCard>

              <MethodCard
                icon={<Package className="h-5 w-5 text-purple-600" />}
                title="Par reference OEM"
                badge="La plus precise"
                badgeVariant="purple"
              >
                <ul className="space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />
                    Chercher piece detachee par sa reference OEM
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />
                    Trouver les equivalences equipementiers
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-600" />
                    Remplacement a l'identique garanti
                  </li>
                </ul>
                <div className="mt-3 rounded-md bg-purple-50 p-2 text-xs text-purple-800">
                  <strong>Recommande si :</strong> vous avez le numero OE de
                  l'ancienne piece (grave sur la piece).
                </div>
              </MethodCard>
            </div>

            {/* Grille de decision — quelle methode choisir */}
            <Card className="mb-8">
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-green-200 bg-green-50">
                    <TableHead className="font-semibold text-gray-900">
                      Critere
                    </TableHead>
                    <TableHead className="font-semibold text-green-800">
                      Immatriculation
                    </TableHead>
                    <TableHead className="font-semibold text-blue-800">
                      VIN
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Manuelle
                    </TableHead>
                    <TableHead className="font-semibold text-purple-800">
                      OEM
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium text-gray-900">
                      Fiabilite
                    </TableCell>
                    <TableCell className="text-green-700">
                      Bonne (si base a jour)
                    </TableCell>
                    <TableCell className="text-blue-700">
                      Excellente (99%+)
                    </TableCell>
                    <TableCell className="text-gray-600">
                      Bonne (si motorisation exacte)
                    </TableCell>
                    <TableCell className="text-purple-700">
                      Maximale (100%)
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-gray-50">
                    <TableCell className="font-medium text-gray-900">
                      Vitesse
                    </TableCell>
                    <TableCell className="text-green-700">
                      Quelques secondes
                    </TableCell>
                    <TableCell className="text-blue-700">
                      Quelques secondes
                    </TableCell>
                    <TableCell className="text-gray-600">1-2 minutes</TableCell>
                    <TableCell className="text-purple-700">
                      Instantane
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-900">
                      Ce qu'il faut
                    </TableCell>
                    <TableCell className="text-green-700">
                      Plaque francaise (SIV/FNI)
                    </TableCell>
                    <TableCell className="text-blue-700">
                      17 caracteres (carte grise champ E)
                    </TableCell>
                    <TableCell className="text-gray-600">
                      Marque, modele, annee, motorisation
                    </TableCell>
                    <TableCell className="text-purple-700">
                      Numero OE (grave sur la piece)
                    </TableCell>
                  </TableRow>
                  <TableRow className="bg-gray-50">
                    <TableCell className="font-medium text-gray-900">
                      Quand l'utiliser
                    </TableCell>
                    <TableCell className="text-green-700">
                      Commandes courantes
                    </TableCell>
                    <TableCell className="text-blue-700">
                      Pieces securite, variantes, import
                    </TableCell>
                    <TableCell className="text-gray-600">
                      Sans carte grise, vehicule connu
                    </TableCell>
                    <TableCell className="text-purple-700">
                      Remplacement a l'identique
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium text-gray-900">
                      Limitation
                    </TableCell>
                    <TableCell className="text-green-700">
                      Plaques etrangeres non reconnues
                    </TableCell>
                    <TableCell className="text-blue-700">
                      VIN pas toujours sous la main
                    </TableCell>
                    <TableCell className="text-gray-600">
                      Doute entre motorisations proches
                    </TableCell>
                    <TableCell className="text-purple-700">
                      Piece usagee necessaire
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </Card>

            {/* Interactive Demo */}
            <SelecteurVehiculeDemo />
          </section>

          <Separator className="mb-12" />

          {/* --- Section: Etapes manuelles --- */}
          <section
            id="etapes-manuelles"
            aria-labelledby="h2-etapes"
            className="mb-12"
          >
            <h2
              id="h2-etapes"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <Settings className="h-6 w-6 text-green-600" />
              Selection manuelle pas a pas : utiliser le selecteur (marque,
              modele, motorisation)
            </h2>

            <p className="mb-6 text-gray-700">
              Si vous choisissez la selection manuelle, voici comment trouver
              les infos sans vous tromper. Ce configurateur de pieces auto en
              ligne vous guide etape par etape :
            </p>

            <div className="mb-6 space-y-4">
              {[
                {
                  step: 1,
                  title: "La marque",
                  ref: "Le constructeur (Renault, Peugeot, VW...)",
                  detail:
                    "C'est l'information la plus simple. Vous la connaissez deja ou vous la trouverez sur la carte grise au champ D.1.",
                },
                {
                  step: 2,
                  title: "Le modele + generation (phase)",
                  ref: "Denomination commerciale et type mine",
                  detail:
                    "Attention : un meme nom commercial peut designer plusieurs generations (ex : Clio III ≠ Clio IV). Si le site propose 'Phase / generation', choisissez-la.",
                },
                {
                  step: 3,
                  title: "L'annee de mise en circulation",
                  ref: "Date de premiere immatriculation (carte grise champ B)",
                  detail:
                    "Permet de situer la version dans la periode de production. L'information voiture avec plaque d'immatriculation gratuit est aussi disponible sur les sites du SIV.",
                },
                {
                  step: 4,
                  title: "La motorisation (le point cle)",
                  ref: "Carburant + cylindree + puissance (champ P.3 carte grise)",
                  detail:
                    "Comment savoir le type de motorisation ? Consultez le champ P.3 de votre carte grise. Le code moteur est disponible sur le bloc moteur ou via le VIN. En cas de doute entre 2 motorisations proches : la meilleure solution est le VIN.",
                },
              ].map((item) => (
                <Card key={item.step} className="bg-white">
                  <CardContent className="flex gap-4 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                      {item.step}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Etape {item.step} — {item.title}
                      </h3>
                      <p className="text-xs text-green-600">{item.ref}</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {item.detail}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <CarteGriseHelper />

            <Alert
              variant="info"
              icon={<Info className="h-4 w-4" />}
              className="mt-4"
            >
              <AlertDescription>
                <strong>Astuce pratique :</strong> prenez votre carte grise en
                photo avec votre telephone. Vous aurez toutes les infos sous la
                main la prochaine fois, meme loin du vehicule. C'est la
                meilleure facon de trouver une piece auto avec la carte grise
                rapidement.
              </AlertDescription>
            </Alert>
          </section>

          <Separator className="mb-12" />

          {/* --- Section: Reference OEM --- */}
          <section
            id="reference-oem"
            aria-labelledby="h2-oem"
            className="mb-12"
          >
            <h2
              id="h2-oem"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <Package className="h-6 w-6 text-purple-600" />
              Recherche par reference OEM : trouver la piece exacte
            </h2>

            <div className="space-y-4">
              <p className="text-gray-700">
                Le numero OEM (Origine Equipementier) est la methode la plus
                precise pour chercher une piece detachee par sa reference. Ce
                numero unique, attribue par le constructeur, identifie
                exactement la piece montee en premiere monte sur votre vehicule.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "Ou trouver le numero OEM",
                    text: "Grave ou imprime directement sur la piece d'origine (ex : 0 986 478 868 pour Bosch, 8200 123 456 pour Renault). Aussi disponible sur les anciennes factures ou le carnet d'entretien.",
                  },
                  {
                    title: "A quoi ca sert",
                    text: "Permet de retrouver les equivalences exactes chez d'autres equipementiers (cross-reference). Vous pouvez trouver le numero OEM avec le VIN gratuitement via notre selecteur.",
                  },
                  {
                    title: "Quand l'utiliser",
                    text: "Remplacement a l'identique d'une piece usee, recherche d'alternatives moins cheres (piece equipementier vs piece d'origine), ou verification de compatibilite en cas de doute.",
                  },
                ].map((item) => (
                  <Card key={item.title} className="p-4">
                    <h3 className="mb-2 font-medium text-gray-900">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600">{item.text}</p>
                  </Card>
                ))}
              </div>

              <Alert variant="info" icon={<Info className="h-4 w-4" />}>
                <AlertDescription>
                  <strong>Conseil :</strong> avant de demonter une piece, prenez
                  une photo du numero OEM. C'est votre meilleure garantie pour
                  trouver l'equivalent exact. Les sites comme 7zap ou les
                  catalogues TecDoc permettent aussi de retrouver les references
                  croisees.
                </AlertDescription>
              </Alert>
            </div>
          </section>

          <Separator className="mb-12" />

          {/* --- Section: Variantes --- */}
          <section
            id="variantes"
            aria-labelledby="h2-variantes"
            className="mb-12"
          >
            <h2
              id="h2-variantes"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <AlertTriangle className="h-6 w-6 text-amber-600" />
              Variantes de montage : comprendre et eviter les erreurs
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-lg font-semibold text-gray-800">
                  Pourquoi les variantes existent
                </h3>
                <p className="mb-3 text-gray-700">
                  Les constructeurs automobiles utilisent plusieurs fournisseurs
                  pour une meme piece. En cours de production, ils peuvent
                  changer de fournisseur, modifier des specifications ou ajouter
                  des options.
                </p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                    <span>
                      <strong>Multi-fournisseurs :</strong> un meme modele peut
                      etre equipe en premiere monte par differents
                      equipementiers selon la date et le lieu de fabrication.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                    <span>
                      <strong>Evolutions en serie :</strong> les constructeurs
                      ameliorent les pieces en continu. Un vehicule de debut de
                      serie peut avoir des specifications differentes d'un
                      vehicule de fin de serie.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                    <span>
                      <strong>Options d'usine :</strong> les packs sport,
                      suspensions pilotees ou systemes Start & Stop modifient
                      les pieces requises.
                    </span>
                  </li>
                </ul>
              </div>

              <Card className="border-gray-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Exemples courants de variantes (meme vehicule)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {[
                      {
                        label: "Freinage",
                        detail:
                          "diametre disque 280 vs 288 vs 312, ventile vs plein",
                        href: "/pieces/disque-de-frein-82.html",
                      },
                      {
                        label: "Batterie",
                        detail: "Start & Stop → AGM/EFB obligatoire",
                        href: "/pieces/batterie-1.html",
                      },
                      {
                        label: "Filtration",
                        detail: "cartouche vs visse selon moteur",
                        href: "/pieces/filtre-a-huile-7.html",
                      },
                      {
                        label: "Suspension",
                        detail: "standard vs sport / pilotee",
                        href: "/pieces/amortisseur-854.html",
                      },
                    ].map((ex) => (
                      <div
                        key={ex.label}
                        className="flex items-start gap-2 rounded-md bg-gray-50 p-2.5 text-sm"
                      >
                        <Link to={ex.href}>
                          <Badge
                            variant="outline"
                            className="shrink-0 cursor-pointer text-xs hover:border-green-300 hover:text-green-700"
                          >
                            {ex.label}
                          </Badge>
                        </Link>
                        <span className="text-gray-600">{ex.detail}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div>
                <h3 className="mb-2 text-lg font-semibold text-gray-800">
                  Comment eviter l'erreur
                </h3>
                <div className="space-y-2">
                  {[
                    "Verifiez les criteres cles sur la fiche produit (diametre, capteur, type de fixation).",
                    "Privilegiez VIN quand c'est disponible — 99% de compatibilite.",
                    "En cas de doute : comparez le numero OE de l'ancienne piece avec les references proposees. Le numero OE = la meilleure confirmation.",
                  ].map((tip, i) => (
                    <Alert
                      key={i}
                      variant="warning"
                      icon={<CheckCircle className="h-4 w-4" />}
                      size="sm"
                    >
                      <AlertDescription>{tip}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <Separator className="mb-12" />

          {/* --- Depannage --- */}
          <section
            id="depannage"
            aria-labelledby="h2-depannage"
            className="mb-12"
          >
            <h2
              id="h2-depannage"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <Wrench className="h-6 w-6 text-orange-600" />
              Depannage : problemes courants
            </h2>

            <div className="space-y-3">
              {[
                {
                  symptom: "Mon vehicule n'apparait pas dans le selecteur",
                  cause:
                    "Vehicule importe, tres recent, ou plaque etrangere non reconnue.",
                  solution:
                    "Passez en recherche par VIN (champ E de la carte grise). Les vehicules importes sont generalement reconnus par VIN meme si la plaque ne fonctionne pas.",
                },
                {
                  symptom: "J'hesite entre deux motorisations proches",
                  cause:
                    "Le modele existe avec plusieurs cylindrees ou puissances similaires (ex : 1.5 dCi 90ch vs 110ch).",
                  solution:
                    "Utilisez le VIN pour identifier la configuration exacte. Sinon, verifiez le champ P.3 (carburant) et D.2 (type mine) sur votre carte grise.",
                },
                {
                  symptom:
                    "Le selecteur propose plusieurs variantes pour une meme piece",
                  cause:
                    "Le constructeur a utilise plusieurs fournisseurs ou modifie les specifications en cours de production.",
                  solution:
                    "Mesurez la piece actuelle (diametre, nombre de trous) ou relevez le numero OE grave dessus. Ce numero est la confirmation la plus fiable.",
                },
                {
                  symptom:
                    "La piece affichee est marquee 'compatible' mais je ne suis pas sur",
                  cause:
                    "Doute sur la variante de montage ou les options du vehicule.",
                  solution:
                    "Comparez le numero OE de votre piece actuelle avec les references proposees. Si le doute persiste, contactez notre service client avec votre carte grise.",
                },
              ].map((item, i) => (
                <Card key={i} className="border-orange-100">
                  <CardContent className="pt-4">
                    <p className="mb-1 text-sm font-semibold text-orange-900">
                      {item.symptom}
                    </p>
                    <p className="mb-1 text-sm text-gray-600">
                      <strong className="text-gray-700">
                        Cause probable :
                      </strong>{" "}
                      {item.cause}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong className="text-green-700">Solution :</strong>{" "}
                      {item.solution}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <Separator className="mb-12" />

          {/* --- Checklist --- */}
          <section
            id="checklist"
            aria-labelledby="h2-checklist"
            className="mb-12"
          >
            <h2
              id="h2-checklist"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <CheckCircle className="h-6 w-6 text-green-600" />
              Checklist 15 secondes avant de commander
            </h2>

            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="pt-6">
                <ol className="space-y-3">
                  {[
                    "Mon vehicule est affiche en haut (bandeau).",
                    "Marque / modele / annee / motorisation = OK.",
                    "J'ai lu les alertes de variantes (diametre, Start & Stop, systeme...).",
                    "La fiche produit indique 'Compatible' avec mon vehicule.",
                    "Si plusieurs versions : j'utilise VIN ou je verifie le numero OE.",
                    "Je confirme la quantite (unite / paire, avant / arriere).",
                  ].map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-green-900"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-200 text-xs font-bold text-green-800">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <p className="mt-3 text-sm text-gray-600">
              <strong>Premiere commande ?</strong> Privilegiez le VIN pour votre
              premier achat — c'est la methode avec le plus haut taux de
              compatibilite. Vous pourrez utiliser votre plaque pour les
              commandes suivantes, le selecteur retiendra votre vehicule.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/">
                  <Car className="mr-2 h-4 w-4" />
                  Selectionner mon vehicule
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/">
                  <Search className="mr-2 h-4 w-4" />
                  Rechercher mes pieces compatibles
                </Link>
              </Button>
            </div>
          </section>

          <Separator className="mb-12" />

          {/* --- FAQ --- */}
          <section id="faq" className="mb-12">
            <FaqSection />
          </section>

          <Separator className="mb-12" />

          {/* --- Note Pro --- */}
          <section aria-labelledby="h2-note-pro" className="mb-12">
            <h2 id="h2-note-pro" className="sr-only">
              Conseils avances pour les professionnels
            </h2>
            <NoteProBlock />
          </section>

          {/* --- Guides lies --- */}
          <section aria-labelledby="h2-guides-lies" className="mb-12">
            <h2
              id="h2-guides-lies"
              className="mb-4 flex items-center gap-2 text-xl font-bold text-gray-900 sm:text-2xl"
            >
              <BookOpen className="h-6 w-6 text-green-600" />
              Guides d'achat recommandes
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: "Comment choisir ses freins",
                  description:
                    "Disques, plaquettes, etriers : tout comprendre pour commander les bons composants de freinage.",
                  href: "/blog-pieces-auto/conseils/disque-de-frein",
                  icon: <Shield className="h-5 w-5 text-red-600" />,
                },
                {
                  title: "Choisir sa batterie auto",
                  description:
                    "Capacite, technologie AGM/EFB, Start & Stop : les criteres essentiels pour ne pas se tromper.",
                  href: "/blog-pieces-auto/conseils/batterie",
                  icon: <Settings className="h-5 w-5 text-yellow-600" />,
                },
                {
                  title: "Quand changer ses filtres",
                  description:
                    "Huile, air, habitacle, carburant : les intervalles et les signes d'usure a connaitre.",
                  href: "/blog-pieces-auto/conseils/filtre-a-huile",
                  icon: <Wrench className="h-5 w-5 text-green-600" />,
                },
                {
                  title: "Catalogue des Constructeurs",
                  description:
                    "Parcourez 50+ marques automobiles avec logos, modeles et motorisations pour trouver vos pieces.",
                  href: "/blog-pieces-auto/auto",
                  icon: <Car className="h-5 w-5 text-blue-600" />,
                },
              ].map((guide) => (
                <Link key={guide.href} to={guide.href} className="group">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="pt-5">
                      <div className="mb-2 flex items-center gap-2">
                        {guide.icon}
                        <span className="font-medium text-gray-900 group-hover:text-green-700">
                          {guide.title}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {guide.description}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-green-600 group-hover:text-green-800">
                        Lire le guide
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>

          {/* --- Bottom CTA --- */}
          <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <BookOpen className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  Trouvez vos pieces compatibles en 15 secondes
                </p>
                <p className="text-sm text-gray-600">
                  Selectionnez votre vehicule et accedez directement aux pieces
                  verifiees pour votre montage exact.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-700">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Pieces filtrees pour votre vehicule
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  4M+ references disponibles
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  Retours simplifies
                </span>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="bg-green-700 hover:bg-green-800"
                >
                  <Link to="/">
                    Rechercher mes pieces
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/blog-pieces-auto/guide-achat">
                    Voir tous les guides
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </article>
    </>
  );
}
