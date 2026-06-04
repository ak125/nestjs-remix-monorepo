/**
 * Command Center — Owner Action Queue.
 * The decision panel: every alert yields one concrete, owned action (file + decision).
 * Ordered by the backing alert severity (error → warn → info). "Une alerte sans
 * action est du bruit" — so this renders actions, not raw alerts.
 */
import { type CommandCenterResponse } from "@repo/registry";
import { CircleDashed, Target, FileCode2, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { severityVariant } from "./badges";

const SEV_RANK: Record<string, number> = { error: 0, warn: 1, info: 2 };

export function OwnerActionQueue({ data }: { data: CommandCenterResponse }) {
  const sevByCode = new Map<string, string>();
  for (const a of data.alerts)
    sevByCode.set(a.code + ":" + a.target_id, a.severity);

  const actions = [...data.owner_actions]
    .map((a) => ({
      ...a,
      severity: sevByCode.get(a.from_alert + ":" + a.target_id) ?? "info",
    }))
    .sort((x, y) => (SEV_RANK[x.severity] ?? 9) - (SEV_RANK[y.severity] ?? 9));

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
            {actions.map((a, i) => (
              <li
                key={`${a.from_alert}:${a.target_id}:${i}`}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <CircleDashed
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div>
                    <p className="font-medium">{a.action}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.decision}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <FileCode2 className="h-3 w-3" aria-hidden />
                      <code className="break-all">{a.file}</code>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">
                  <Badge variant={severityVariant[a.severity] ?? "info"}>
                    {a.from_alert}
                  </Badge>
                  <Badge
                    variant="outline"
                    aria-label={`Responsable : ${a.owner}`}
                  >
                    {a.owner}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
