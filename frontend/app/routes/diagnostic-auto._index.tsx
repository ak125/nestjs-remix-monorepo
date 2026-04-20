/**
 * Route : /diagnostic-auto
 * Landing du moteur diagnostic + entretien (R5 DIAGNOSTIC).
 * Source unique : /api/diagnostic-engine/* (tables __diag_*).
 *
 * Contient :
 *   - Hero + CTA wizard
 *   - DiagnosticSearchBar (typeahead /search)
 *   - DtcQuickLookup (OBD-II)
 *   - SystemCardsGrid (13 systemes depuis /systems)
 *   - PopularSymptomsGrid (top from /popular?kind=symptom)
 *   - MaintenancePopularGrid (top from /maintenance?popular=true)
 *   - DiagnosticGuide (4 canaux sensoriels)
 *   - FAQ statique
 */
import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { ArrowRight, Car, Phone, Wrench, X } from "lucide-react";
import { useState } from "react";

import { DiagnosticGuide } from "~/components/diagnostic-public/DiagnosticGuide";
import { DiagnosticSearchBar } from "~/components/diagnostic-public/DiagnosticSearchBar";
import { DtcQuickLookup } from "~/components/diagnostic-public/DtcQuickLookup";
import { MaintenancePopularGrid } from "~/components/diagnostic-public/MaintenancePopularGrid";
import { PopularSymptomsGrid } from "~/components/diagnostic-public/PopularSymptomsGrid";
import { SystemCardsGrid } from "~/components/diagnostic-public/SystemCardsGrid";
import {
  type DiagSystemPublic,
  type PopularMaintenancePublic,
  type PopularSymptomPublic,
} from "~/components/diagnostic-public/types";
import Container from "~/components/layout/Container";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import VehicleSelector from "~/components/vehicle/VehicleSelector";
import { logger } from "~/utils/logger";
import { PageRole, createPageRoleMeta } from "~/utils/page-role.types";

interface SelectedVehicle {
  brandName: string;
  modelName: string;
  typeName: string;
  year: number;
  typeId: number;
}

export const handle = {
  pageRole: createPageRoleMeta(PageRole.R5_DIAGNOSTIC, {
    clusterId: "diagnostic",
    canonicalEntity: "diagnostic-auto",
  }),
};

interface Stats {
  total_sessions: number;
  systems_count: number;
  symptoms_count: number;
}

interface LoaderData {
  systems: DiagSystemPublic[];
  popularSymptoms: PopularSymptomPublic[];
  popularMaintenance: PopularMaintenancePublic[];
  stats: Stats | null;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    logger.error("[diagnostic-auto] fetch error", { url, error });
    return null;
  }
}

export async function loader(_args: LoaderFunctionArgs) {
  const API_URL = process.env.VITE_API_URL || "http://127.0.0.1:3000";

  const [systemsRes, popSympRes, popMaintRes, statsRes] = await Promise.all([
    fetchJson<{ systems?: DiagSystemPublic[] }>(
      `${API_URL}/api/diagnostic-engine/systems`,
    ),
    fetchJson<{ items?: PopularSymptomPublic[] }>(
      `${API_URL}/api/diagnostic-engine/popular?kind=symptom&limit=6`,
    ),
    fetchJson<{ items?: PopularMaintenancePublic[] }>(
      `${API_URL}/api/diagnostic-engine/maintenance?popular=true&limit=6`,
    ),
    fetchJson<Stats>(`${API_URL}/api/diagnostic-engine/stats`),
  ]);

  return json<LoaderData>({
    systems: systemsRes?.systems || [],
    popularSymptoms: popSympRes?.items || [],
    popularMaintenance: popMaintRes?.items || [],
    stats: statsRes,
  });
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const d = data as LoaderData | undefined;
  const canonicalUrl = "https://www.automecanik.com/diagnostic-auto";
  const symptomsCount = d?.stats?.symptoms_count ?? 0;
  const title = `Diagnostic auto : moteur d'analyse des pannes — ${symptomsCount} symptômes catalogués | AutoMecanik`;
  const description = `Identifier une panne auto : recherche par symptôme, code OBD ou système. ${symptomsCount} symptômes + ${d?.stats?.systems_count ?? 0} systèmes + entretien préventif.`;

  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "index,follow" },
    { tagName: "link", rel: "canonical", href: canonicalUrl },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: canonicalUrl },
    {
      property: "og:image",
      content: "https://www.automecanik.com/images/og/diagnostic.webp",
    },
    { name: "twitter:card", content: "summary_large_image" },
    {
      "script:ld+json": {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQ_DATA.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    },
  ];
};

const FAQ_DATA = [
  {
    question: "Comment savoir quel est le problème de ma voiture ?",
    answer:
      "Observez les symptômes sensoriels (voyants, bruits, vibrations, odeurs). Si un voyant moteur est allumé, lisez le code OBD et entrez-le dans le lookup ci-dessus. Pour les pannes sans voyant, utilisez la recherche de symptômes.",
  },
  {
    question: "Comment lire un code panne OBD ?",
    answer:
      "Branchez un scanner OBD-II sous le tableau de bord (côté conducteur). Les codes Pxxxx concernent le moteur, Cxxxx le châssis, Bxxxx la carrosserie, Uxxxx le réseau. Entrez le code dans le lookup ci-dessus.",
  },
  {
    question: "Voiture en panne qui ne démarre pas : par où commencer ?",
    answer:
      "Vérifiez dans cet ordre : 1) Batterie (tension > 12.4V), 2) Démarreur (clic = relais OK), 3) Allumage (bougies, bobines), 4) Alimentation (pompe à carburant). Lancez un diagnostic guidé pour une analyse pas-à-pas.",
  },
  {
    question: "Panne mécanique ou électrique : comment savoir ?",
    answer:
      "Une panne mécanique est progressive : bruits, vibrations, odeurs. Une panne électronique est soudaine, avec voyant allumé. Le scanner OBD identifie les défauts électroniques.",
  },
  {
    question: "Que faire si un voyant rouge s'allume en conduisant ?",
    answer:
      "Arrêtez-vous en sécurité immédiatement (huile, température, frein). Relancer un moteur surchauffé cause des dommages irréversibles. Appelez de l'assistance.",
  },
];

export default function DiagnosticAutoIndex() {
  const { systems, popularSymptoms, popularMaintenance, stats } =
    useLoaderData<typeof loader>();

  const [vehicle, setVehicle] = useState<SelectedVehicle | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <Container className="py-3">
          <PublicBreadcrumb
            items={[
              { label: "Accueil", href: "/" },
              { label: "Diagnostic Auto", href: "/diagnostic-auto" },
            ]}
          />
        </Container>
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-12 md:py-16">
        <Container>
          <div className="max-w-4xl">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Diagnostic auto — Identifier une panne
            </h1>
            <p className="text-lg text-slate-200 mb-8 max-w-2xl">
              {stats
                ? `${stats.symptoms_count} symptômes catalogués, ${stats.systems_count} systèmes, ${stats.total_sessions.toLocaleString()} diagnostics réalisés.`
                : "Recherchez un symptôme, un code OBD ou lancez un diagnostic guidé."}
            </p>

            <div className="mb-6 space-y-4">
              {vehicle ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Car className="h-4 w-4 shrink-0 text-emerald-300" />
                    <span className="font-semibold">Véhicule :</span>
                    <span className="truncate">
                      {vehicle.brandName} {vehicle.modelName} {vehicle.year}
                      {" • "}
                      {vehicle.typeName}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setVehicle(null)}
                    className="h-8 px-2 text-emerald-100 hover:bg-emerald-400/20 hover:text-white"
                    aria-label="Retirer le véhicule sélectionné"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <VehicleSelector
                  mode="full"
                  context="search"
                  redirectOnSelect={false}
                  onVehicleSelect={(v) =>
                    setVehicle({
                      brandName: v.brand.marque_name,
                      modelName: v.model.modele_name,
                      typeName: v.type.type_name,
                      year: v.year,
                      typeId: v.type.type_id,
                    })
                  }
                />
              )}
            </div>

            <DiagnosticSearchBar className="mb-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <DtcQuickLookup />
              <Link
                to="/diagnostic-auto/wizard"
                className="group block"
                aria-label="Lancer le diagnostic guidé"
              >
                <div className="h-full p-5 rounded-xl border-2 border-emerald-400/60 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                      <Wrench className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1 text-white">
                        Diagnostic guidé pas-à-pas
                      </h3>
                      <p className="text-xs text-emerald-100/90 mb-3">
                        Véhicule + symptômes → hypothèses scorées + alertes
                        sécurité
                      </p>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-200 group-hover:translate-x-1 transition-transform">
                        Lancer
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-10 space-y-10">
        {/* 13 systemes */}
        <section aria-labelledby="systems-heading">
          <div className="flex items-center gap-3 mb-4">
            <h2 id="systems-heading" className="text-xl font-bold">
              Choisir par système
            </h2>
            <span className="text-sm text-muted-foreground">
              {systems.length} systèmes analysés
            </span>
          </div>
          <SystemCardsGrid systems={systems} />
        </section>

        {/* Diagnostics frequents (popular symptoms) */}
        {popularSymptoms.length > 0 && (
          <PopularSymptomsGrid items={popularSymptoms} />
        )}

        {/* Entretiens populaires */}
        {popularMaintenance.length > 0 && (
          <section>
            <MaintenancePopularGrid items={popularMaintenance} />
            <div className="mt-3 text-right">
              <Link
                to="/entretien"
                className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline font-medium"
              >
                Voir tous les entretiens
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>
        )}

        {/* 4 canaux sensoriels */}
        <DiagnosticGuide />

        {/* FAQ */}
        <section aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-xl font-bold mb-4">
            Questions fréquentes
          </h2>
          <Accordion
            type="single"
            collapsible
            className="bg-white rounded-lg border"
          >
            {FAQ_DATA.map((f, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="px-5 text-left">
                  {f.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 text-sm text-muted-foreground">
                  {f.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </Container>

      {/* Footer urgence */}
      <section className="bg-gradient-to-br from-red-950 to-red-900 text-white py-10">
        <Container>
          <div className="max-w-3xl">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Voyant rouge ou panne bloquante ?
            </h2>
            <p className="text-red-100/90 text-sm mb-4">
              Un voyant rouge impose un arrêt immédiat du véhicule. N'essayez
              pas de continuer à rouler : les dommages peuvent devenir
              irréversibles. Contactez un dépannage ou un garage de confiance.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/diagnostic-auto/wizard"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-white text-red-800 text-sm font-medium hover:bg-red-50"
              >
                <Wrench className="h-4 w-4" />
                Diagnostic guidé
              </Link>
              <Link
                to="/entretien"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md border border-white/40 text-sm font-medium hover:bg-white/10"
              >
                Voir l'entretien préventif
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
