import { useNavigate } from "@remix-run/react";
import { ScanLine, ArrowRight } from "lucide-react";
import { useState } from "react";
import { Card } from "~/components/ui/card";

const DTC_RE = /^[PCBU]\d{4}$/i;

export function DtcQuickLookup() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!DTC_RE.test(trimmed)) {
      setErr("Format invalide. Exemple : P0300, C0035, B1001");
      return;
    }
    setErr(null);
    navigate(`/diagnostic-auto/dtc/${trimmed}`);
  };

  return (
    <Card className="p-5 border-2 border-purple-200 bg-purple-50/40">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shrink-0">
          <ScanLine className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-purple-900 mb-1">
            Code OBD-II (valise diagnostic)
          </h3>
          <p className="text-xs text-purple-700/80 mb-3">
            Tapez le code remonté par la valise (ex: P0300, C0035)
          </p>
          <form onSubmit={submit} className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (err) setErr(null);
              }}
              placeholder="P0300"
              maxLength={5}
              pattern="[PCBUpcbu]\d{4}"
              className="flex-1 h-10 px-3 rounded-md border border-purple-300 bg-white text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
              aria-label="Code OBD-II"
            />
            <button
              type="submit"
              className="h-10 px-4 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 inline-flex items-center gap-1.5"
            >
              Chercher
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
          {err && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {err}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
