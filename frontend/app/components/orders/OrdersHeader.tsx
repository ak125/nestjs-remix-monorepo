/**
 * 📋 Header - Gestion des Commandes
 * Composant extrait de routes/orders._index.tsx
 */

import { Package, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { type OrdersHeaderProps } from "../../types/orders.types";

export function OrdersHeader({
  permissions,
  userRole,
  totalOrders,
}: OrdersHeaderProps) {
  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Titre & Badge */}
        <div className="flex items-center gap-4">
          <div className="p-3 bg-muted rounded-lg">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Gestion des Commandes
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {totalOrders} commande{totalOrders > 1 ? "s" : ""} totale
              {totalOrders > 1 ? "s" : ""}
              {" • "}
              <span className="font-medium text-blue-600">
                {userRole.label}
              </span>
            </p>
          </div>
        </div>

        {/* Actions globales */}
        <div className="flex items-center gap-3">
          {permissions.canValidate && (
            <Button
              className="flex items-center gap-2 px-4 py-2  rounded-lg"
              variant="blue"
              onClick={() => console.log("Nouvelle commande")}
            >
              <Plus className="w-4 h-4" />
              Nouvelle commande
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
