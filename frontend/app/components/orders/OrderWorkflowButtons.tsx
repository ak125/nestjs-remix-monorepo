import {
  Check,
  Circle,
  Clock,
  CreditCard,
  Package,
  Truck,
  XCircle,
} from "lucide-react";
import { memo } from "react";
import { Alert } from "~/components/ui/alert";
import { type Order } from "../../types/orders.types";
import { type UserPermissions } from "../../utils/permissions";

interface OrderWorkflowButtonsProps {
  order: Order;
  permissions: UserPermissions;
  onStatusChange?: (newStatus: string) => void;
}

interface WorkflowStep {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  bgColor: string;
  textColor: string;
}

/**
 * Statuts reels de la DB ___xtr_order_status
 */
const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "1",
    name: "En cours",
    icon: Clock,
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
  },
  {
    id: "3",
    name: "Attente frais port",
    icon: Package,
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
  },
  {
    id: "4",
    name: "Frais port recu",
    icon: Truck,
    bgColor: "bg-blue-100",
    textColor: "text-blue-700",
  },
  {
    id: "5",
    name: "Payee",
    icon: CreditCard,
    bgColor: "bg-green-100",
    textColor: "text-green-700",
  },
];

export const OrderWorkflowButtons = memo(function OrderWorkflowButtons({
  order,
}: OrderWorkflowButtonsProps) {
  // Commande annulee
  if (order.ord_ords_id === "2") {
    return (
      <Alert
        className="flex items-center gap-2 px-4 py-3 rounded-lg"
        variant="error"
      >
        <XCircle className="w-5 h-5 text-red-600" />
        <span className="font-medium text-red-700">Commande annulee</span>
      </Alert>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max">
        {WORKFLOW_STEPS.map((step, index) => {
          const currentStepIndex = WORKFLOW_STEPS.findIndex(
            (s) => s.id === order.ord_ords_id,
          );
          const isCurrent = step.id === order.ord_ords_id;
          const isPast = index < currentStepIndex;

          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isCurrent
                    ? `${step.bgColor} ${step.textColor} ring-2 ring-offset-2 ring-current font-semibold`
                    : isPast
                      ? "bg-success/10 text-success"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {isPast ? (
                  <Check className="w-5 h-5" strokeWidth={2.5} />
                ) : isCurrent ? (
                  <Icon className="w-5 h-5" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
                <span className="text-sm whitespace-nowrap">{step.name}</span>
              </div>

              {index < WORKFLOW_STEPS.length - 1 && (
                <div
                  className={`w-8 h-0.5 ${isPast ? "bg-success/60" : "bg-muted/50"}`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
