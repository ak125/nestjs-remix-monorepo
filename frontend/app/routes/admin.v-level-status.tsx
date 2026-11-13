/**
 * 📊 V-Level — indicateurs des mots-clés (contrat vlevel-global-stats.v2)
 *
 * Lecture seule de public.__seo_keywords (classement) et public.pieces_gamme
 * (catalogue, G1). Le grain est la LIGNE de mot-clé : ni véhicule unique, ni
 * audience. L'actualisation relit les indicateurs sans recalculer le
 * classement. Une réponse HTTP réussie n'est acceptée que si son enveloppe et
 * ses totaux sont cohérents ; sinon « Indicateurs indisponibles ».
 */

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  Inbox,
  Layers,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { type ReactNode } from "react";
import {
  type LoaderFunctionArgs,
  type MetaFunction,
  useLoaderData,
  useRevalidator,
} from "react-router";
import { z } from "zod";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
import { PublicBreadcrumb } from "~/components/ui/PublicBreadcrumb";
import { getInternalApiUrl } from "~/utils/internal-api.server";
import { logger } from "~/utils/logger";

export const meta: MetaFunction = () => [
  { title: "V-Level — indicateurs des mots-clés - Admin" },
  { name: "robots", content: "noindex, nofollow" },
];

// ============== CONTRAT ==============

const LEVELS = ["V1", "V2", "V3", "V4", "V5", "V6"] as const;

const count = z.number().int().nonnegative();
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "date invalide");

const VLevelGlobalStatsSchema = z
  .object({
    contract: z.literal("vlevel-global-stats.v2"),
    source: z.object({
      keywords: z.literal("__seo_keywords"),
      catalogue: z.literal("pieces_gamme"),
    }),
    read: z.object({
      startedAt: isoDate,
      completedAt: isoDate,
      pageSize: count,
      keywordPages: count,
      cataloguePages: count,
    }),
    keywords: z.object({
      total: count,
      byLevel: z.object({
        V1: count,
        V2: count,
        V3: count,
        V4: count,
        V5: count,
        V6: count,
      }),
      classified: count,
      unclassified: count,
      unexpectedLevel: count,
      unexpectedLevelValues: z
        .array(z.object({ value: z.string(), count }))
        .max(20),
      withoutCatalogueGamme: count,
    }),
    gammes: z.object({
      catalogueTotal: count,
      withClassification: count,
      g1Total: count,
      g1WithV2: count,
    }),
    freshness: z.object({
      upTo7Days: count,
      from7To30Days: count,
      over30Days: count,
      unknownOrInvalid: count,
    }),
    dates: z.object({
      latestCollectedAt: isoDate.nullable(),
      latestUpdatedAt: isoDate.nullable(),
    }),
  })
  .superRefine((s, ctx) => {
    const k = s.keywords;
    const f = s.freshness;
    const g = s.gammes;
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (LEVELS.reduce((sum, l) => sum + k.byLevel[l], 0) !== k.classified)
      fail("classified ≠ somme V1–V6");
    if (k.classified + k.unclassified + k.unexpectedLevel !== k.total)
      fail("total ≠ classés + sans niveau + inattendus");
    if (
      f.upTo7Days + f.from7To30Days + f.over30Days + f.unknownOrInvalid !==
      k.total
    )
      fail("tranches de fraîcheur ≠ total");
    if (
      k.unexpectedLevelValues.reduce((sum, u) => sum + u.count, 0) >
      k.unexpectedLevel
    )
      fail("valeurs inattendues > compteur");
    if (k.withoutCatalogueGamme > k.total) fail("hors catalogue > total");
    if (g.withClassification > g.catalogueTotal)
      fail("gammes classées > catalogue");
    if (g.g1Total > g.catalogueTotal) fail("G1 > catalogue");
    if (g.g1WithV2 > g.g1Total) fail("G1 avec V2 > G1");
  });

const VLevelGlobalStatsEnvelopeSchema = z.object({
  success: z.literal(true),
  data: VLevelGlobalStatsSchema,
});

type VLevelGlobalStats = z.infer<typeof VLevelGlobalStatsSchema>;

const UNAVAILABLE = "Indicateurs indisponibles";

// ============== LOADER ==============

export async function loader({ request }: LoaderFunctionArgs) {
  const unavailable = (detail: string) => ({
    stats: null as VLevelGlobalStats | null,
    error: { title: UNAVAILABLE, detail },
  });
  try {
    const apiUrl = `${getInternalApiUrl("")}/api/admin/gammes-seo/v-level/global-stats`;
    const response = await fetch(apiUrl, {
      headers: { Cookie: request.headers.get("Cookie") || "" },
    });

    if (response.status === 401 || response.status === 403) {
      return unavailable("Session administrateur requise.");
    }
    if (!response.ok) {
      logger.error(`[v-level-status] API ${response.status}`);
      return unavailable(
        `Le serveur n'a pas pu lire les indicateurs (HTTP ${response.status}).`,
      );
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      logger.error("[v-level-status] réponse non JSON");
      return unavailable("Réponse du serveur illisible.");
    }

    const parsed = VLevelGlobalStatsEnvelopeSchema.safeParse(body);
    if (!parsed.success) {
      logger.error(
        `[v-level-status] contrat invalide: ${parsed.error.issues
          .map((i) => i.message)
          .join("; ")}`,
      );
      return unavailable("Réponse du serveur incomplète ou incohérente.");
    }
    return { stats: parsed.data.data, error: null };
  } catch (error) {
    logger.error("[v-level-status] serveur injoignable:", error);
    return unavailable("Serveur injoignable.");
  }
}

// ============== FORMAT ==============

const numberFr = new Intl.NumberFormat("fr-FR");
const percentFr = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 1,
});
const dateFr = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const n = (value: number) => numberFr.format(value);

/** Taux ou « Non applicable » quand le dénominateur est nul (ni NaN ni Infinity). */
function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return "Non applicable";
  return percentFr.format(numerator / denominator);
}

function formatDate(value: string | null): string {
  if (!value) return "Inconnue";
  return `${dateFr.format(new Date(value))} (heure de Paris)`;
}

const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  V1: "Champions modèle (multi-gammes)",
  V2: "Champions de la gamme",
  V3: "Champions du groupe modèle/énergie",
  V4: "Autres mots-clés du groupe",
  V5: "Famille enregistrée",
  V6: "Véhicule absent des recherches",
};

// ============== VUE ==============

function Kpi({
  icon,
  title,
  value,
  unit,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  unit: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-600">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-gray-600">{unit}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function StatsView({ stats }: { stats: VLevelGlobalStats }) {
  const k = stats.keywords;
  const g = stats.gammes;
  const f = stats.freshness;
  const hasAnomaly = k.unexpectedLevel > 0 || k.withoutCatalogueGamme > 0;

  return (
    <>
      {k.total === 0 && (
        <Card>
          <CardContent className="flex items-start gap-3 p-4">
            <Inbox className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              <strong>Aucun mot-clé enregistré.</strong> La source a été lue
              intégralement et ne contient aucune ligne : les compteurs à zéro
              sont mesurés, pas substitués.
            </p>
          </CardContent>
        </Card>
      )}

      <section
        aria-label="Indicateurs principaux"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Kpi
          icon={<Database className="h-4 w-4" aria-hidden="true" />}
          title="Mots-clés enregistrés"
          value={n(k.total)}
          unit="lignes de mots-clés — ni véhicules uniques, ni audience"
        />
        <Kpi
          icon={<Layers className="h-4 w-4" aria-hidden="true" />}
          title="Mots-clés classés"
          value={n(k.classified)}
          unit="lignes au niveau V1 à V6"
        >
          <p className="text-sm text-gray-600">
            Sans niveau : {n(k.unclassified)} · Niveau inattendu :{" "}
            {n(k.unexpectedLevel)}
          </p>
        </Kpi>
        <Kpi
          icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />}
          title="Gammes G1 avec V2 enregistré"
          value={formatRate(g.g1WithV2, g.g1Total)}
          unit={`${n(g.g1WithV2)} gammes G1 sur ${n(g.g1Total)} ont au moins un mot-clé V2`}
        >
          <p className="text-xs text-gray-600">
            « Enregistré » ne signifie pas « sélection V2 validée ».
          </p>
        </Kpi>
        <Kpi
          icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />}
          title="Gammes du catalogue avec classement"
          value={formatRate(g.withClassification, g.catalogueTotal)}
          unit={`${n(g.withClassification)} gammes sur ${n(g.catalogueTotal)} portent au moins un mot-clé V1 à V6`}
        />
      </section>

      {hasAnomaly && (
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-amber-900">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              Anomalies signalées
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900">
            {k.unexpectedLevel > 0 && (
              <div>
                <p>
                  {n(k.unexpectedLevel)} mot(s)-clé(s) portent un niveau hors V1
                  à V6 : ni assimilés à « Sans niveau », ni omis.
                </p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {k.unexpectedLevelValues.map((u) => (
                    <li
                      key={u.value}
                      className="rounded border border-amber-300 bg-white px-2 py-0.5 font-mono"
                    >
                      {u.value === "" ? "(chaîne vide)" : u.value} :{" "}
                      {n(u.count)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {k.withoutCatalogueGamme > 0 && (
              <p>
                {n(k.withoutCatalogueGamme)} mot(s)-clé(s) sans gamme joignable
                dans le catalogue (pg_id absent ou inconnu) : comptés dans les
                totaux, exclus des taux de gammes.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" aria-hidden="true" />
            Répartition des mots-clés par niveau
          </CardTitle>
          <CardDescription>
            Pourcentages calculés sur les {n(k.classified)} mots-clés classés
            (V1 à V6). Un niveau à zéro ne démontre pas que sa fonction est
            construite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {LEVELS.map((level) => {
              const value = k.byLevel[level];
              return (
                <li key={level} className="space-y-1">
                  <div className="flex flex-wrap justify-between gap-x-4 text-sm">
                    <span>
                      <strong>{level}</strong> — {LEVEL_LABELS[level]}
                    </span>
                    <span className="font-medium tabular-nums">
                      {n(value)} mots-clés ({formatRate(value, k.classified)})
                    </span>
                  </div>
                  <Progress
                    aria-hidden="true"
                    value={k.classified > 0 ? (value / k.classified) * 100 : 0}
                    className="h-2"
                  />
                </li>
              );
            })}
          </ul>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 border-t pt-4 text-sm sm:grid-cols-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2">
              <dt>Sans niveau (hors pourcentages)</dt>
              <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">
                {n(k.unclassified)} mots-clés
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md bg-muted/50 px-3 py-2">
              <dt>Niveau inattendu (hors pourcentages)</dt>
              <dd className="shrink-0 whitespace-nowrap font-medium tabular-nums">
                {n(k.unexpectedLevel)} mots-clés
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" aria-hidden="true" />
            Dates et fraîcheur
          </CardTitle>
          <CardDescription>
            Âge de la date de collecte enregistrée de chaque mot-clé, mesuré à
            l'instant de lecture. Tranches d'âge, pas une validation du
            classement ; une date stockée ne prouve pas la date d'une mesure
            Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-gray-600">Dernière collecte enregistrée</dt>
              <dd className="font-medium">
                {formatDate(stats.dates.latestCollectedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-600">
                Dernière modification des mots-clés
              </dt>
              <dd className="font-medium">
                {formatDate(stats.dates.latestUpdatedAt)}
              </dd>
              <dd className="text-xs text-gray-600">
                Pas une date de collecte Google.
              </dd>
            </div>
            <div>
              <dt className="text-gray-600">Indicateurs lus le</dt>
              <dd className="font-medium">
                {formatDate(stats.read.completedAt)}
              </dd>
              <dd className="text-xs text-gray-600">
                Lecture, pas un recalcul du classement.
              </dd>
            </div>
          </dl>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Jusqu'à 7 jours inclus", value: f.upTo7Days },
              { label: "Plus de 7 à 30 jours inclus", value: f.from7To30Days },
              { label: "Plus de 30 jours", value: f.over30Days },
              {
                label: "Date inconnue ou invalide",
                value: f.unknownOrInvalid,
              },
            ].map((tier) => (
              <div
                key={tier.label}
                className="flex flex-col-reverse rounded-lg border bg-gray-50 p-3 text-center"
              >
                <dt className="text-sm text-gray-700">{tier.label}</dt>
                <dd className="text-2xl font-bold tabular-nums">
                  {n(tier.value)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-gray-600">
            Unité : mots-clés. Total des tranches : {n(k.total)}.
          </p>
        </CardContent>
      </Card>
    </>
  );
}

export default function VLevelStatusPage() {
  const { stats, error } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const loading = revalidator.state === "loading";
  const refresh = () => {
    if (!loading) void revalidator.revalidate();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PublicBreadcrumb
        items={[{ label: "Admin", href: "/admin" }, { label: "V-Level" }]}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            V-Level — indicateurs des mots-clés
          </h1>
          <p className="text-gray-600">
            Source : public.__seo_keywords (classement) et public.pieces_gamme
            (catalogue, G1). L'actualisation relit les indicateurs sans
            recalculer le classement.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={loading}
          aria-busy={loading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {loading ? "Lecture en cours…" : "Actualiser les indicateurs"}
        </Button>
      </div>
      <p className="sr-only" aria-live="polite">
        {loading ? "Lecture des indicateurs en cours" : ""}
      </p>

      {error && (
        <Card className="border-red-200 bg-red-50" role="alert">
          <CardContent className="flex flex-col gap-3 p-4 text-red-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertCircle
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
              <p>
                <strong>{error.title}.</strong> {error.detail} Aucune valeur
                n'est affichée pour cette tentative.
              </p>
            </div>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {stats && <StatsView stats={stats} />}
    </div>
  );
}
