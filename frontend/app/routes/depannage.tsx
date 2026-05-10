/**
 * Route : /depannage
 * Page hub urgence — panne immobilisante / dépannage routier (R5 - DIAGNOSTIC).
 *
 * ADR-032 PR-11 — entrée dédiée pour les visiteurs en panne immobilisante.
 * Cross-link vers /diagnostic-auto (analyse interactive sans urgence) et
 * /pieces (catalogue de pièces, post-réparation).
 *
 * Embarque DiagnosticWizard pour visiteurs capables d'attendre une analyse
 * interactive (3 steps). Le bouton urgence pointe vers le 3477/112.
 */

import { type MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Car,
  ChevronRight,
  Phone,
  Shield,
  ShoppingCart,
  Stethoscope,
} from "lucide-react";

import { DiagnosticWizard } from "~/components/diagnostic-wizard/DiagnosticWizard";
import { HeroDiagnostic } from "~/components/heroes";
import Container from "~/components/layout/Container";
import { Badge } from "~/components/ui/badge";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
    canonicalEntity: "depannage",
  }),
};

export const meta: MetaFunction = () => {
  const canonicalUrl = "https://www.automecanik.com/depannage";
  return [
    {
      title: "Dépannage voiture : que faire en cas de panne ? | AutoMecanik",
    },
    {
      name: "description",
      content:
        "Dépannage auto : que faire en cas de panne immobilisante ? Numéros d'urgence, étapes sécurité, diagnostic gratuit interactif. Hub urgence AutoMecanik.",
    },
    { name: "robots", content: "index, follow" },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    {
      property: "og:title",
      content: "Dépannage voiture : que faire en cas de panne ?",
    },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
  ];
};

const EMERGENCY_STEPS = [
  {
    step: "1",
    icon: AlertTriangle,
    title: "Allumer les feux de détresse",
    detail: "Avant tout autre geste, signaler la panne aux autres usagers.",
  },
  {
    step: "2",
    icon: Car,
    title: "Se ranger en sécurité",
    detail:
      "Bande d'arrêt d'urgence (BAU) sur autoroute, trottoir hors voie en ville. Ne jamais s'arrêter en pleine voie sauf casse moteur immédiate.",
  },
  {
    step: "3",
    icon: Shield,
    title: "Sortir par la droite, gilet jaune",
    detail:
      "Sortir tous les passagers côté droit, mettre le gilet jaune AVANT de sortir, s'éloigner derrière la glissière.",
  },
  {
    step: "4",
    icon: Phone,
    title: "Appeler les secours",
    detail:
      "Autoroute : 3477 (société d'autoroute, dépannage obligatoire). Ville/route : 112 (urgence européenne) ou votre assistance auto.",
  },
];

const CROSS_LINKS = [
  {
    href: "/diagnostic-auto",
    icon: Stethoscope,
    title: "Diagnostic auto interactif",
    description:
      "193 diagnostics gratuits par symptôme, voyant ou code OBD. Pour identifier une panne sans urgence immédiate.",
    cta: "Lancer un diagnostic",
    color: "from-blue-500 to-indigo-600",
  },
  {
    href: "/pieces",
    icon: ShoppingCart,
    title: "Catalogue de pièces",
    description:
      "Pièces auto compatibles avec votre véhicule. Sélecteur marque/modèle/motorisation et filtres par gamme.",
    cta: "Voir le catalogue",
    color: "from-amber-500 to-orange-600",
  },
];

export default function DepannageHub() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Dépannage", href: "/depannage" },
            ]}
          />
        </Container>
      </div>

      <HeroDiagnostic
        title="Dépannage voiture : que faire en cas de panne ?"
        description="Panne immobilisante ? Suivez les étapes de mise en sécurité, puis identifiez la cause avec notre diagnostic interactif."
        severity="danger"
      />

      {/* ═══ NUMEROS URGENCE ═══ */}
      <section className="bg-gradient-to-br from-red-950 to-red-900 text-white py-10">
        <Container>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <Badge className="mb-3 bg-red-800 text-red-100 border-red-700">
                Urgence
              </Badge>
              <h2 className="text-2xl font-bold mb-1">
                Numéros à composer en priorité
              </h2>
              <p className="text-red-200 text-sm">
                Avant tout diagnostic, mettez-vous en sécurité et appelez.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <a
                href="tel:3477"
                className="inline-flex items-center justify-center gap-3 bg-white text-red-900 font-bold px-6 py-3 rounded-xl hover:bg-red-50 transition-colors"
              >
                <Phone className="h-5 w-5" />
                <span>
                  3477
                  <span className="block text-xs font-normal text-red-700">
                    Autoroutes
                  </span>
                </span>
              </a>
              <a
                href="tel:112"
                className="inline-flex items-center justify-center gap-3 bg-red-700 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl transition-colors border border-red-500"
              >
                <Phone className="h-5 w-5" />
                <span>
                  112
                  <span className="block text-xs font-normal text-red-200">
                    Urgence Europe
                  </span>
                </span>
              </a>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ ETAPES SECURITE ═══ */}
      <Container as="section" className="py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Mise en sécurité — les 4 étapes
        </h2>
        <p className="text-gray-500 mb-8 max-w-2xl">
          Ces étapes priment sur tout diagnostic. Elles s'appliquent autoroute
          comme route nationale ou ville.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {EMERGENCY_STEPS.map(({ step, icon: Icon, title, detail }) => (
            <div
              key={step}
              className="rounded-2xl border border-gray-200 bg-white p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold flex items-center justify-center shrink-0">
                  {step}
                </span>
                <Icon className="h-5 w-5 text-red-500" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm mb-1.5">
                {title}
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">{detail}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* ═══ DIAGNOSTIC WIZARD (panne non-immobilisante) ═══ */}
      <section className="bg-white border-y py-12">
        <Container>
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <Badge className="mb-3 bg-blue-50 text-blue-800 border-blue-200">
                Diagnostic interactif
              </Badge>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                La panne n'est pas immobilisante ?
              </h2>
              <p className="text-gray-500 text-sm">
                Lancez notre diagnostic interactif en 3 étapes pour identifier
                la cause probable.
              </p>
            </div>
            <DiagnosticWizard />
          </div>
        </Container>
      </section>

      {/* ═══ CROSS-LINKS ═══ */}
      <Container as="section" className="py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Aller plus loin
        </h2>
        <p className="text-gray-500 mb-8 max-w-2xl">
          Selon votre besoin, nos autres outils gratuits.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          {CROSS_LINKS.map(
            ({ href, icon: Icon, title, description, cta, color }) => (
              <Link key={href} to={href} className="group block">
                <div
                  className={`relative rounded-2xl p-6 bg-gradient-to-br ${color} text-white overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
                >
                  <Icon className="h-8 w-8 mb-3" />
                  <h3 className="font-bold text-lg mb-2">{title}</h3>
                  <p className="text-sm text-white/85 mb-4 leading-relaxed">
                    {description}
                  </p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold border-b border-white/40 group-hover:border-white pb-0.5 transition-colors">
                    {cta}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </Link>
            ),
          )}
        </div>
      </Container>

      {/* ═══ CONSEIL : NE PAS REPRENDRE LA ROUTE ═══ */}
      <Container as="section" className="pb-14">
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-2">
                Quand NE PAS reprendre la route ?
              </h3>
              <ul className="space-y-1.5 text-sm text-amber-800">
                <li className="flex gap-2">
                  <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Voyant rouge allumé (huile, température, frein) — risque de
                    casse moteur ou de freinage.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Pédale de frein qui touche le plancher — perte totale de
                    freinage probable.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Direction durcie ou vibrations volant intenses — perte de
                    contrôle possible.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ChevronRight className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Fumée blanche dense ou liquide qui fuit sous le moteur —
                    casse joint de culasse imminente.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Container>

      {/* Cross-link glossaire */}
      <Container className="pb-12 flex items-center justify-center gap-2 text-sm text-gray-500">
        <BookOpen className="w-4 h-4 text-indigo-500" />
        <span>Comprendre les pièces mentionnées ?</span>
        <Link
          to="/reference-auto"
          className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          Consulter le glossaire
        </Link>
      </Container>
    </div>
  );
}
