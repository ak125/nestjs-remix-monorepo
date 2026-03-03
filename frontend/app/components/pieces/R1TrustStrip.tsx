/**
 * R1 Trust Strip — 4 items de réassurance purs (statiques).
 * Aucune donnée dynamique — KPI séparé dans R1KpiCoverage.
 */
import { Lock, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { memo } from "react";

export const R1TrustStrip = memo(function R1TrustStrip() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* 1. Compatibilité vérifiée */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-green-50 p-3 sm:p-4">
        <ShieldCheck className="w-6 h-6 text-green-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            Compatibilité vérifiée
          </p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            Par code moteur et Type Mine
          </p>
        </div>
      </div>

      {/* 2. Livraison */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-blue-50 p-3 sm:p-4">
        <Truck className="w-6 h-6 text-blue-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            Livraison 24–48h
          </p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            Expédition le jour même avant 15h
          </p>
        </div>
      </div>

      {/* 3. Retours */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-amber-50 p-3 sm:p-4">
        <RotateCcw className="w-6 h-6 text-amber-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            Retours 30 jours
          </p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            Satisfait ou remboursé
          </p>
        </div>
      </div>

      {/* 4. Paiement sécurisé */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-purple-50 p-3 sm:p-4">
        <Lock className="w-6 h-6 text-purple-600 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-tight">
            Paiement sécurisé
          </p>
          <p className="text-xs text-gray-500 leading-tight mt-0.5">
            CB, Paybox, virement
          </p>
        </div>
      </div>
    </div>
  );
});
