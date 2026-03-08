/**
 * ResultDisclaimer — Block 7: Professional disclaimer + allowed claims
 */
import { ShieldCheck } from "lucide-react";

interface Props {
  claims: string[];
}

export function ResultDisclaimer({ claims }: Props) {
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-gray-500" />
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
          Avertissement
        </p>
      </div>

      <div className="space-y-1.5">
        {claims.map((claim, i) => (
          <p key={i} className="text-xs text-gray-500 leading-relaxed">
            {claim}
          </p>
        ))}
        <p className="text-xs text-gray-400 italic mt-2">
          Ce diagnostic est fourni à titre indicatif et ne remplace pas
          l'expertise d'un professionnel de l'automobile.
        </p>
      </div>
    </div>
  );
}
