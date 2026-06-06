/**
 * Command Center — Owner Action Queue (Phase 2: piloted).
 * Renders the live, scored `action_queue` (rules engine). Honest by construction:
 *   business (source certified) · risk (cautious) · certification/repair (fix the source).
 * "Une action sans next_step est du bruit" — every row carries a concrete next step,
 * its score, its source, and a "prudence" flag when the data is only partial.
 */
import { type CommandCenterResponse } from "@repo/registry";
import {
  Target,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Wrench,
  TrendingUp,
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
                      {a.evidence.length > 0 ? (
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
