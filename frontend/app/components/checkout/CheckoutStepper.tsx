import { Check, ShoppingCart, ClipboardList, CreditCard } from "lucide-react";

type Step = "cart" | "checkout" | "payment";

const STEPS: { key: Step; label: string; icon: typeof ShoppingCart }[] = [
  { key: "cart", label: "Panier", icon: ShoppingCart },
  { key: "checkout", label: "Commande", icon: ClipboardList },
  { key: "payment", label: "Paiement", icon: CreditCard },
];

function getStepIndex(current: Step): number {
  return STEPS.findIndex((s) => s.key === current);
}

export function CheckoutStepper({ current }: { current: Step }) {
  const currentIndex = getStepIndex(current);

  return (
    <nav aria-label="Étapes de la commande" className="mb-8">
      <ol className="flex items-center justify-center gap-0">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;

          return (
            <li key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                    isCompleted
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : isCurrent
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-slate-300 text-slate-400"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    isCompleted
                      ? "text-emerald-600"
                      : isCurrent
                        ? "text-blue-600"
                        : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`w-12 sm:w-20 h-0.5 mx-2 mb-6 ${
                    index < currentIndex ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
