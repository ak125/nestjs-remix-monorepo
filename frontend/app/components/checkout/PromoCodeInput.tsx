import { Tag, X, Loader2 } from "lucide-react";
import { useState } from "react";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(price);
}

interface Props {
  onPromoApplied?: () => void;
}

export function PromoCodeInput({ onPromoApplied }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
    message: string;
  } | null>(null);

  const handleApply = async () => {
    if (!code.trim()) return;
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/cart/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promoCode: code.trim().toUpperCase() }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.message || data.error || "Code promo invalide");
        return;
      }

      setAppliedPromo({
        code: code.trim().toUpperCase(),
        discount: data.data?.discount || data.discount || 0,
        message: data.data?.message || data.message || "Code applique",
      });
      setCode("");
      onPromoApplied?.();
    } catch {
      setError("Erreur de connexion. Reessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemove = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/cart/promo", { method: "DELETE" });
      setAppliedPromo(null);
      setError("");
      onPromoApplied?.();
    } catch {
      setError("Erreur lors de la suppression");
    } finally {
      setIsLoading(false);
    }
  };

  // Promo applied state
  if (appliedPromo) {
    return (
      <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-emerald-600" />
            <div>
              <span className="text-sm font-medium text-emerald-900">
                {appliedPromo.code}
              </span>
              {appliedPromo.discount > 0 && (
                <span className="ml-2 text-sm text-emerald-700">
                  -{formatPrice(appliedPromo.discount)}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isLoading}
            className="p-1 text-emerald-600 hover:text-red-500 transition-colors disabled:opacity-50"
            aria-label="Supprimer le code promo"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>
        {appliedPromo.message && (
          <p className="text-xs text-emerald-700 mt-1">
            {appliedPromo.message}
          </p>
        )}
      </div>
    );
  }

  // Collapsed state
  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full text-left text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-2 py-1"
      >
        <Tag className="h-3.5 w-3.5" />
        Vous avez un code promo ?
      </button>
    );
  }

  // Input state
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleApply();
            }
          }}
          placeholder="CODE PROMO"
          maxLength={20}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase tracking-wider"
        />
        <button
          type="button"
          onClick={handleApply}
          disabled={isLoading || !code.trim()}
          className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "OK"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
