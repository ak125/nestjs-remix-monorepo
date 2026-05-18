/**
 * Route : /blog-pieces-auto/calendrier-entretien
 * Calendrier d'entretien automobile — DYNAMIQUE (ADR-032 PR-7)
 *
 * Single fetch loader → /api/diagnostic-engine/calendar (D9 agrégé) qui
 * retourne schedule (kg_*) + alerts paliers (kg_*) + controles_mensuels (wiki/support/).
 *
 * Query string : ?type_id=X&current_km=Y&fuel_type=Z (tous optionnels).
 * Si pas fournis : calendrier générique (sans personnalisation véhicule).
 */

import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  AlertTriangle,
  Battery,
  Calendar,
  CheckCircle,
  Droplets,
  Gauge,
  Snowflake,
  Sun,
  Thermometer,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { BlogPiecesAutoNavigation } from "~/components/blog/BlogPiecesAutoNavigation";
import { CompactBlogHeader } from "~/components/blog/CompactBlogHeader";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

/* ===========================================================================
   SEO — noindex, nofollow
   =========================================================================== */

export const meta: MetaFunction = () => [
  { title: "Calendrier d'entretien automobile | Blog AutoMecanik" },
  {
    name: "description",
    content:
      "Calendrier d'entretien complet pour votre vehicule : vidange, filtres, freins, distribution, controles saisonniers. Intervalles en km et en mois.",
  },
  { name: "robots", content: "noindex, nofollow" },
];

/* ===========================================================================
   API SHAPE (mirror backend MaintenanceCalendar — ADR-032 D9)
   =========================================================================== */

interface ScheduleItem {
  rule_alias: string;
  rule_label: string;
  km_interval: number | null;
  month_interval: number | null;
  maintenance_priority: "critique" | "important" | "normal" | null;
  applies_to_fuel: "essence" | "diesel" | null;
  km_remaining: number;
  status: "ok" | "due_soon" | "overdue" | "time_only";
}

interface AlertAction {
  rule_alias: string;
  rule_label: string;
  maintenance_priority: "critique" | "important" | "normal" | null;
  km_interval: number | null;
}

interface AlertMilestone {
  milestone_km: number;
  actions: AlertAction[];
}

interface ControleMensuel {
  element: string;
  icon: string;
  detail: string;
}

interface CalendarPayload {
  type_id: number | null;
  current_km: number;
  fuel_type: string | null;
  schedule: ScheduleItem[];
  alerts: AlertMilestone[];
  controles_mensuels: ControleMensuel[];
}

/* ===========================================================================
   LOADER — single fetch /api/diagnostic-engine/calendar
   =========================================================================== */

const API_BASE =
  process.env.BACKEND_API_URL ?? "http://localhost:3000/api/diagnostic-engine";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  for (const k of ["type_id", "current_km", "fuel_type"]) {
    const v = url.searchParams.get(k);
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  const apiUrl = `${API_BASE}/calendar${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const calendar = (await res.json()) as CalendarPayload;
    return json({ calendar });
  } catch {
    return json({
      calendar: {
        type_id: null,
        current_km: 0,
        fuel_type: null,
        schedule: [],
        alerts: [],
        controles_mensuels: [],
      } as CalendarPayload,
    });
  }
}

/* ===========================================================================
   HELPERS
   =========================================================================== */

const ICON_MAP: Record<string, LucideIcon> = {
  Droplets,
  Thermometer,
  Gauge,
  Sun,
  Wrench,
};

function ImportanceBadge({
  level,
}: {
  level: "critique" | "important" | "normal" | null;
}) {
  if (!level) return null;
  const styles = {
    critique: "bg-red-100 text-red-700 border-red-200",
    important: "bg-amber-100 text-amber-700 border-amber-200",
    normal: "bg-green-100 text-green-700 border-green-200",
  };
  const labels = {
    critique: "Critique",
    important: "Important",
    normal: "Normal",
  };
  return (
    <Badge variant="outline" className={styles[level]}>
      {labels[level]}
    </Badge>
  );
}

function formatKmInterval(km: number | null): string {
  if (km == null) return "—";
  return `${km.toLocaleString("fr-FR")} km`;
}

function formatMonthInterval(months: number | null): string {
  if (months == null) return "—";
  if (months >= 12 && months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "1 an" : `${years} ans`;
  }
  return `${months} mois`;
}

function pieceLinkFromSlug(slug: string): string {
  return `/pieces/${slug}`;
}

/* ===========================================================================
   PAGE
   =========================================================================== */

export default function CalendrierEntretienPage() {
  const { calendar } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-gray-50">
      <BlogPiecesAutoNavigation />

      <CompactBlogHeader
        title="Calendrier d'entretien automobile"
        description="Tous les intervalles de remplacement pour maintenir votre vehicule en parfait etat. Adapte aux recommandations constructeur les plus courantes."
        gradientFrom="from-orange-600"
        gradientTo="to-amber-500"
        breadcrumb={[
          { label: "Blog", href: "/blog-pieces-auto" },
          { label: "Calendrier entretien" },
        ]}
        stats={[
          {
            icon: Wrench,
            value: String(calendar.schedule.length),
            label: "pieces",
          },
          {
            icon: Calendar,
            value: String(calendar.alerts.length),
            label: "paliers km",
          },
        ]}
      />

      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-10">
        {/* ── Section 1 : Entretien periodique (dynamique kg_*) ── */}
        <section id="entretien-periodique">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Wrench className="w-5 h-5 text-orange-600" />
                Entretien periodique — Intervalles de remplacement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6 border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Ces intervalles sont des moyennes. Consultez toujours le
                  carnet d&apos;entretien de votre vehicule pour les
                  preconisations exactes du constructeur.
                </AlertDescription>
              </Alert>

              {calendar.schedule.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Calendrier en cours de population. Reessayez avec
                  ?type_id=X&amp;current_km=Y dans l&apos;URL.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[260px]">Piece</TableHead>
                        <TableHead>Kilometrage</TableHead>
                        <TableHead>Duree</TableHead>
                        <TableHead>Priorite</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Carburant
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {calendar.schedule.map((item) => (
                        <TableRow key={item.rule_alias}>
                          <TableCell className="font-medium">
                            <Link
                              to={pieceLinkFromSlug(item.rule_alias)}
                              className="text-blue-600 hover:underline"
                            >
                              {item.rule_label}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {formatKmInterval(item.km_interval)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {formatMonthInterval(item.month_interval)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <ImportanceBadge
                              level={item.maintenance_priority}
                            />
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-sm text-gray-600">
                            {item.applies_to_fuel ?? "tous"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Section 2 : Entretien saisonnier (statique éditorial, hors ADR-032) ── */}
        <section id="entretien-saisonnier">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Calendar className="w-5 h-5 text-blue-600" />
                Entretien saisonnier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-5 bg-amber-50/50 border-amber-200">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    <Sun className="w-5 h-5 text-amber-500" />
                    Avant l&apos;ete (avril-mai)
                  </h3>
                  <ul className="space-y-2">
                    {[
                      "Recharge climatisation si souffle tiede",
                      "Verification liquide de refroidissement",
                      "Controle pneus ete (profondeur + pression)",
                      "Nettoyage filtre habitacle (pollen)",
                      "Verification essuie-glaces avant les orages",
                      "Controle batterie (la chaleur l'use aussi)",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border rounded-lg p-5 bg-blue-50/50 border-blue-200">
                  <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                    <Snowflake className="w-5 h-5 text-blue-500" />
                    Avant l&apos;hiver (octobre-novembre)
                  </h3>
                  <ul className="space-y-2">
                    {[
                      "Montage pneus hiver ou 4 saisons",
                      "Verification antigel (concentration -20°C min)",
                      "Test batterie (tension > 12,4 V)",
                      "Remplacement essuie-glaces si traces",
                      "Lave-glace antigel (-20°C)",
                      "Controle eclairage complet (jours courts)",
                      "Verification chauffage et desembuage",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Section 3 : Controles mensuels (dynamique wiki/support/) ── */}
        <section id="controles-mensuels">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Controles mensuels recommandes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calendar.controles_mensuels.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Liste en cours de population.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {calendar.controles_mensuels.map((item) => {
                    const Icon = ICON_MAP[item.icon] ?? CheckCircle;
                    return (
                      <div
                        key={item.element}
                        className="border rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-gray-500" />
                          <span className="font-medium text-sm">
                            {item.element}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600">{item.detail}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Section 4 : Alertes paliers km (dynamique kg_*) ── */}
        <section id="alertes-km">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Gauge className="w-5 h-5 text-purple-600" />
                Alertes par palier kilometrique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {calendar.alerts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Paliers en cours de population.
                </p>
              ) : (
                <div className="space-y-6">
                  {calendar.alerts.map((palier) => (
                    <div
                      key={palier.milestone_km}
                      className="border-l-4 border-purple-300 pl-4"
                    >
                      <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-sm">
                          {palier.milestone_km.toLocaleString("fr-FR")} km
                        </Badge>
                      </h3>
                      <ul className="space-y-1">
                        {palier.actions.map((action) => (
                          <li
                            key={action.rule_alias}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <Wrench className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                            {action.rule_label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Section 5 : CTA (statique éditorial) ── */}
        <section id="cta">
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="py-8">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Trouvez vos pieces d&apos;entretien au meilleur prix
                </h2>
                <p className="text-gray-600 max-w-xl mx-auto">
                  Selectionnez votre vehicule pour voir uniquement les pieces
                  compatibles parmi nos 4 millions de references.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {[
                    {
                      label: "Vidange & filtres",
                      href: "/pieces/huile-moteur",
                    },
                    { label: "Freinage", href: "/pieces/plaquettes-de-frein" },
                    {
                      label: "Distribution",
                      href: "/pieces/kit-de-distribution",
                    },
                    { label: "Batterie", href: "/pieces/batterie" },
                    { label: "Amortisseurs", href: "/pieces/amortisseur" },
                  ].map((cta) => (
                    <Link
                      key={cta.href}
                      to={cta.href}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-orange-200 rounded-full text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
                    >
                      <Battery className="w-3.5 h-3.5" />
                      {cta.label}
                    </Link>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Disclaimer ── */}
        <Alert className="border-gray-200">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-gray-600 text-sm">
            Ce calendrier est fourni a titre indicatif. Les intervalles
            d&apos;entretien varient selon le constructeur, le modele, le type
            de motorisation et les conditions d&apos;utilisation. Referez-vous
            toujours au carnet d&apos;entretien officiel de votre vehicule.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}
