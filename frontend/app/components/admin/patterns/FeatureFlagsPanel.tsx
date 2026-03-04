import { Wrench, AlertTriangle } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

interface FlagEntry {
  envValue: string | null;
  override: string | null;
  effective: string;
}

const BOOL_FLAGS = [
  { key: "R1_CONTENT_PIPELINE_ENABLED", label: "R1 Pipeline" },
  { key: "PIPELINE_CHAIN_ENABLED", label: "Pipeline Chain" },
  { key: "EVIDENCE_PACK_ENABLED", label: "Evidence Pack" },
  { key: "HARD_GATES_ENABLED", label: "Hard Gates" },
  { key: "AUTO_REPAIR_ENABLED", label: "Auto Repair" },
  { key: "SAFE_FALLBACK_ENABLED", label: "Safe Fallback" },
  { key: "BRIEF_GATES_ENABLED", label: "Brief Gates" },
  { key: "BRIEF_GATES_OBSERVE_ONLY", label: "Brief Observe Only" },
  { key: "RAG_CATCHUP_ENABLED", label: "RAG Catchup" },
  { key: "CONSEIL_PACK_ENABLED", label: "Conseil Pack" },
  { key: "KEYWORD_DENSITY_GATE_ENABLED", label: "Keyword Density Gate" },
];

export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<Record<string, FlagEntry>>({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feature-flags");
      if (!res.ok) return;
      const json = await res.json();
      setFlags(json?.data ?? json ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  async function toggleFlag(key: string, newValue: boolean) {
    try {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: String(newValue) }),
      });
      if (!res.ok) {
        toast.error(`Echec toggle ${key}`);
        return;
      }
      toast.success(`${key} → ${newValue}`);
      fetchFlags();
    } catch {
      toast.error(`Erreur toggle ${key}`);
    }
  }

  async function updateCanary(value: string) {
    try {
      const res = await fetch("/api/admin/feature-flags/CANARY_GAMMES", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) {
        toast.error("Echec update CANARY_GAMMES");
        return;
      }
      toast.success("CANARY_GAMMES mis a jour");
      fetchFlags();
    } catch {
      toast.error("Erreur update CANARY_GAMMES");
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Overrides volatiles — perdus au redemarrage du serveur. Pour
          persister, modifier le fichier .env.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Wrench className="h-4 w-4" />
            Feature Flags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {BOOL_FLAGS.map(({ key, label }) => {
            const entry = flags[key];
            const effective = entry?.effective === "true";
            const hasOverride =
              entry?.override !== null && entry?.override !== undefined;

            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={effective}
                    onCheckedChange={(v) => toggleFlag(key, v)}
                  />
                  <Label className="text-sm font-medium">{label}</Label>
                  {hasOverride && (
                    <Badge
                      variant="outline"
                      className="text-xs text-orange-600 border-orange-200"
                    >
                      OVERRIDE
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  env: {entry?.envValue ?? "—"}
                </span>
              </div>
            );
          })}

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">CANARY_GAMMES</Label>
              {flags["CANARY_GAMMES"]?.override !== null &&
                flags["CANARY_GAMMES"]?.override !== undefined && (
                  <Badge
                    variant="outline"
                    className="text-xs text-orange-600 border-orange-200"
                  >
                    OVERRIDE
                  </Badge>
                )}
            </div>
            <div className="flex gap-2">
              <Input
                className="text-xs font-mono"
                defaultValue={flags["CANARY_GAMMES"]?.effective ?? ""}
                onBlur={(e) => updateCanary(e.target.value)}
                placeholder="slug1,slug2,... ou * pour tout"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {
                (flags["CANARY_GAMMES"]?.effective ?? "")
                  .split(",")
                  .filter(Boolean).length
              }{" "}
              gamme(s) canary
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
