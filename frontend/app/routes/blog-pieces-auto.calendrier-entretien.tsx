/**
 * Route : /blog-pieces-auto/calendrier-entretien
 * Calendrier d'entretien automobile — DYNAMIQUE (ADR-032 PR-7)
 *
 * Single fetch loader → /api/diagnostic-engine/calendar (D9 agrégé) qui
 * retourne schedule (kg_*) + alerts paliers (kg_*) + controles_mensuels (wiki/support/).
 *
 * Query string : ?type_id=X&current_km=Y&fuel_type=Z (tous optionnels).
 * Intervalles génériques : ces paramètres ne remplacent pas un historique
 * par opération et ne vérifient pas une applicabilité constructeur.
 */

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
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  Link,
  useLoaderData,
} from "react-router";

import { z } from "zod";

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

// Validate the fields rendered by this page before accessing nested arrays.
// A successful HTTP status alone does not establish usable calendar data.
const interval = z.number().int().positive().nullable();
const rule = z.object({
  rule_alias: z.string().trim().min(1),
  rule_label: z.string().trim().min(1),
  km_interval: interval,
  maintenance_priority: z.enum(["critique", "important", "normal"]).nullable(),
});
const CalendarPayloadSchema = z.object({
  type_id: z.number().int().positive().nullable(),
  current_km: z.number().int().nonnegative(),
  fuel_type: z.string().nullable(),
  schedule: z
    .array(
      rule
        .extend({
          month_interval: interval,
          applies_to_fuel: z.enum(["essence", "diesel"]).nullable(),
        })
        .refine(
          (item) => item.km_interval !== null || item.month_interval !== null,
        ),
    )
    .refine(
      (items) =>
        new Set(items.map((item) => item.rule_alias)).size === items.length,
    ),
  alerts: z.array(
    z.object({
      milestone_km: z.number().int().positive(),
      actions: z.array(rule),
    }),
  ),
  controles_mensuels: z.array(
    z.object({
      element: z.string().trim().min(1),
      icon: z.string(),
      detail: z.string(),
    }),
  ),
});

/* ===========================================================================
   LOADER — single fetch /api/diagnostic-engine/calendar
   =========================================================================== */

const API_BASE =
  process.env.BACKEND_API_URL ?? "http://localhost:3000/api/diagnostic-engine";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  for (const k of ["type_id", "current_km", "fuel_type"]) {
    for (const value of url.searchParams.getAll(k)) params.append(k, value);
  }
  const qs = params.toString();
  const apiUrl = `${API_BASE}/calendar${qs ? `?${qs}` : ""}`;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const calendar = CalendarPayloadSchema.parse(await res.json());
    return { calendar, error: null };
  } catch {
    return {
      calendar: null,
      error:
        "Calendrier temporairement indisponible. Réessayez ultérieurement ; les échéances d'entretien n'ont pas pu être vérifiées.",
    };
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

/* ===========================================================================
   PAGE
   =========================================================================== */

export default function CalendrierEntretienPage() {
  const { calendar, error } = useLoaderData<typeof loader>();

  if (!calendar) {
    return (
      <div className="min-h-screen bg-gray-50">
        <BlogPiecesAutoNavigation />
        <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
          <h1 className="text-2xl font-bold">
            Calendrier d'entretien automobile
          </h1>
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BlogPiecesAutoNavigation />

      <CompactBlogHeader
        title="Calendrier d'entretien automobile"
        description="Repères génériques de remplacement en kilomètres et en mois, à vérifier dans le carnet d’entretien de votre véhicule."
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
              <Alert className="mb-6 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  Sans historique des interventions, le compteur total ne permet
                  pas de savoir si une opération est à jour ou en retard. Ces
                  intervalles sont génériques : leur applicabilité à votre
                  véhicule n&apos;est pas vérifiée. Consultez le carnet
                  d&apos;entretien pour les préconisations du constructeur.
                </AlertDescription>
              </Alert>

              {calendar.schedule.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Aucun intervalle d&apos;entretien disponible pour ces
                  paramètres. Cela ne permet pas de conclure qu&apos;aucun
                  entretien n&apos;est nécessaire.
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
                            {item.rule_label}
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
                            {item.applies_to_fuel ?? "non précisé"}
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
                  Aucun contrôle mensuel disponible.
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
                <Gauge className="w-5 h-5 text-foreground" />
                Repères par palier kilométrique
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-gray-600">
                Ces paliers regroupent des intervalles génériques. Ils ne
                tiennent pas compte des interventions déjà réalisées et ne
                constituent pas une liste de remplacements à effectuer.
              </p>
              {calendar.alerts.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Aucun palier kilométrique disponible.
                </p>
              ) : (
                <div className="space-y-6">
                  {calendar.alerts.map((palier) => (
                    <div key={palier.milestone_km} className="pl-4">
                      <h3 className="font-semibold text-lg flex items-center gap-2 mb-2">
                        <Badge className="bg-muted text-foreground text-sm">
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
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50">
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
                    "Vidange & filtres",
                    "Freinage",
                    "Distribution",
                    "Batterie",
                    "Amortisseurs",
                  ].map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-orange-200 rounded-full text-sm font-medium text-orange-700"
                    >
                      <Battery className="w-3.5 h-3.5" />
                      {label}
                    </span>
                  ))}
                </div>
                <Link
                  to="/#catalogue"
                  className="inline-flex px-4 py-2 bg-white border border-orange-200 rounded-full text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
                >
                  Voir le catalogue de pièces
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ── Disclaimer ── */}
        <Alert className="">
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
