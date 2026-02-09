import { useFetcher } from "@remix-run/react";
import {
  Check,
  CheckCircle,
  Circle,
  Clock,
  Package,
  PlayCircle,
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
  action?: string;
  permission?: keyof UserPermissions;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: "1",
    name: "En attente",
    icon: Clock,
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
  },
  {
    id: "2",
    name: "Validée",
    icon: CheckCircle,
    bgColor: "bg-primary/15",
    textColor: "text-blue-700",
    action: "validate",
    permission: "canValidate",
  },
  {
    id: "3",
    name: "Préparation",
    icon: PlayCircle,
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    action: "startProcessing",
    permission: "canValidate",
  },
  {
    id: "4",
    name: "Prête",
    icon: Package,
    bgColor: "bg-warning/15",
    textColor: "text-yellow-700",
    action: "markReady",
    permission: "canShip",
  },
  {
    id: "5",
    name: "Expédiée",
    icon: Truck,
    bgColor: "bg-indigo-100",
    textColor: "text-indigo-700",
    action: "ship",
    permission: "canShip",
  },
  {
    id: "6",
    name: "Livrée",
    icon: Check,
    bgColor: "bg-success/15",
    textColor: "text-green-700",
    action: "deliver",
    permission: "canDeliver",
  },
];

export const OrderWorkflowButtons = memo(function OrderWorkflowButtons({
  order,
  permissions,
  onStatusChange,
}: OrderWorkflowButtonsProps) {
  const fetcher = useFetcher();

  const handleStepClick = (step: WorkflowStep) => {
    if (!step.action) return;

    // Vérifier permission
    if (step.permission && !permissions[step.permission]) {
      return;
    }

    // Vérifier si c'est l'étape suivante
    const currentStepIndex = WORKFLOW_STEPS.findIndex(
      (s) => s.id === order.ord_ords_id,
    );
    const targetStepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === step.id);

    if (targetStepIndex !== currentStepIndex + 1) {
      return;
    }

    if (confirm(`Passer la commande à l'état "${step.name}" ?`)) {
      fetcher.submit(
        { intent: step.action, orderId: order.ord_id },
        { method: "post" },
      );
      onStatusChange?.(step.id);
    }
  };

  const isProcessing = fetcher.state !== "idle";

  // Si commande annulée
  if (order.ord_ords_id === "7") {
    return (
      <Alert
        className="flex items-center gap-2 px-4 py-3    rounded-lg"
        variant="error"
      >
        <XCircle className="w-5 h-5 text-red-600" />
        <span className="font-medium text-red-700">Commande annulée</span>
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
          const isNext = index === currentStepIndex + 1;
          const hasPermission =
            !step.permission || permissions[step.permission];
          const isClickable = isNext && hasPermission && !isProcessing;

          const Icon = step.icon;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => handleStepClick(step)}
                disabled={!isClickable}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isCurrent
                    ? `${step.bgColor} ${step.textColor} ring-2 ring-offset-2 ring-current font-semibold`
                    : isPast
                      ? "bg-success/10 text-success"
                      : isClickable
                        ? `${step.bgColor} ${step.textColor} hover:ring-2 hover:ring-offset-1 hover:ring-current cursor-pointer`
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
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
              </button>

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
