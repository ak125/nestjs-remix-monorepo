/**
 * Command Center — Owner Action Queue (Phase 2: piloted).
 * Renders the live, scored `action_queue` (rules engine). Honest by construction:
 *   business (source certified) · risk (cautious) · certification/repair (fix the source).
 * "Une action sans next_step est du bruit" — every row carries a concrete next step,
 * its score, its source, and a "prudence" flag when the data is only partial.
 * PR2: seo:opportunity:* actions carry a per-URL drill-down (`details`) shown in a
 * collapsible table (URL · page kind · impressions · clicks · CTR).
 */
import { useState } from "react";
import { type CommandCenterResponse } from "@repo/registry";
import {
  Target,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Wrench,
  TrendingUp,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type Action = CommandCenterResponse["action_queue"][number];

const TYPE_VARIANT: Record<
  Action["action_type"],
  "success" | "warning" | "info" | "destructive"
> = {
  business: "success",
  risk: "warning",
  certification: "info",
  repair: "destructive",
};
const TYPE_LABEL: Record<Action["action_type"], string> = {
  business: "Business",
  risk: "Risque",
  certification: "Certifier",
  repair: "Réparer",
};
const TYPE_ICON: Record<Action["action_type"], typeof TrendingUp> = {
  business: TrendingUp,
  risk: ShieldAlert,
  certification: Target,
  repair: Wrench,
};

const PRUDENCE_THRESHOLD = 70; // data_confidence below this → cautious

export function OwnerActionQueue({ data }: { data: CommandCenterResponse }) {
  const actions = data.action_queue; // already scored + sorted server-side
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" aria-hidden />
          Actions prioritaires ({actions.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <Alert
            variant="success"
            icon={<CheckCircle2 className="h-4 w-4" aria-hidden />}
          >
            <AlertDescription>
              Aucune action en attente — opérations alignées.
            </AlertDescription>
          </Alert>
        ) : (
          <ul className="divide-y divide-border">
            {actions.map((a) => {
              const Icon = TYPE_ICON[a.action_type];
              const prudence = a.data_confidence < PRUDENCE_THRESHOLD;
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <div>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {a.reason}
                      </p>
                      <p className="mt-1 flex items-start gap-1 text-sm">
                        <ArrowRight
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground"
                          aria-hidden
                        />
                        <span>{a.next_step}</span>
                      </p>
                      {a.details && a.details.length > 0 ? (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => toggle(a.id)}
                            aria-expanded={openIds.has(a.id)}
                            aria-controls={`seo-details-${a.id}`}
                            className="flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
                          >
                            {openIds.has(a.id) ? (
                              <ChevronDown
                                className="h-3.5 w-3.5"
                                aria-hidden
                              />
                            ) : (
                              <ChevronRight
                                className="h-3.5 w-3.5"
                                aria-hidden
                              />
                            )}
                            {openIds.has(a.id) ? "Masquer" : "Voir"} les détails
                            ({a.details.length} URL)
                          </button>
                          {openIds.has(a.id) ? (
                            <div
                              id={`seo-details-${a.id}`}
                              className="mt-1.5 overflow-x-auto"
                            >
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-muted-foreground">
                                    <th
                                      scope="col"
                                      className="py-1 pr-3 font-medium"
                                    >
                                      URL
                                    </th>
                                    <th
                                      scope="col"
                                      className="py-1 pr-3 font-medium"
                                    >
                                      Type
                                    </th>
                                    <th
                                      scope="col"
                                      className="py-1 pr-3 text-right font-medium"
                                    >
                                      Impr.
                                    </th>
                                    <th
                                      scope="col"
                                      className="py-1 pr-3 text-right font-medium"
                                    >
                                      Clics
                                    </th>
                                    <th
                                      scope="col"
                                      className="py-1 pr-3 text-right font-medium"
                                    >
                                      CTR
                                    </th>
                                    <th
                                      scope="col"
                                      className="py-1 pr-3 text-right font-medium"
                                    >
                                      Pos.
                                    </th>
                                    <th
                                      scope="col"
                                      className="py-1 font-medium"
                                    >
                                      Action SEO
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {a.details.map((d) => (
                                    <tr
                                      key={d.url}
                                      className="border-t border-border/50"
                                    >
                                      <td className="py-1 pr-3">
                                        <code className="break-all">
                                          {d.url}
                                        </code>
                                      </td>
                                      <td className="py-1 pr-3">
                                        {d.page_kind}
                                      </td>
                                      <td className="py-1 pr-3 text-right tabular-nums">
                                        {d.impressions}
                                      </td>
                                      <td className="py-1 pr-3 text-right tabular-nums">
                                        {d.clicks}
                                      </td>
                                      <td className="py-1 pr-3 text-right tabular-nums">
                                        {(d.ctr * 100).toFixed(2)}%
                                      </td>
                                      <td className="py-1 pr-3 text-right tabular-nums">
                                        {d.position == null
                                          ? "—"
                                          : d.position.toFixed(1)}
                                      </td>
                                      <td className="py-1 text-muted-foreground">
                                        {d.next_step}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      ) : a.evidence.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {a.evidence.slice(0, 3).map((e, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground"
                            >
                              <code className="break-all">{e}</code>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:justify-end sm:pl-0">
                    <Badge variant="outline" aria-label={`Score ${a.score}`}>
                      score {a.score}
                    </Badge>
                    <Badge variant={TYPE_VARIANT[a.action_type]}>
                      {TYPE_LABEL[a.action_type]}
                    </Badge>
                    <Badge variant="subtle">{a.source}</Badge>
                    {prudence ? (
                      <Badge
                        variant="warning"
                        aria-label={`Prudence : confiance donnée ${a.data_confidence}/100`}
                      >
                        prudence
                      </Badge>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
