/**
 * Table Commandes - avec navigation vers detail
 */

import { useNavigate } from "@remix-run/react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Truck,
  XCircle,
} from "lucide-react";
import { memo } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { type OrdersTableProps } from "../../types/orders.types";
import {
  formatDate,
  formatPrice,
  getPaymentBadgeColor,
  getPaymentLabel,
  getPaymentMethodInfo,
  getStatusBadgeColor,
  getStatusLabel,
} from "../../utils/orders.utils";

export const OrdersTable = memo(function OrdersTable({
  orders,
  permissions,
  currentPage,
  totalPages,
  onPageChange,
  onViewOrder: _onViewOrder,
  onEditOrder,
  onMarkPaid,
  onShip: _onShip,
  onCancel,
  basePath = "/admin/orders",
}: OrdersTableProps & { basePath?: string }) {
  const navigate = useNavigate();

  if (orders.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground text-lg">Aucune commande trouvee</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Commande
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Montant
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Statut
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Paiement
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider w-12">
                {/* Actions */}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((order) => {
              const customerName =
                order.customerName ||
                (order.customer
                  ? `${order.customer.cst_fname || ""} ${order.customer.cst_name || ""}`.trim()
                  : "—");

              return (
                <tr
                  key={order.ord_id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => navigate(`${basePath}/${order.ord_id}`)}
                >
                  {/* ID */}
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono font-medium text-primary group-hover:underline">
                      {order.ord_id}
                    </span>
                  </td>

                  {/* Client */}
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium">{customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.customerEmail || order.customer?.cst_mail || ""}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-muted-foreground">
                      {formatDate(order.ord_date)}
                    </span>
                  </td>

                  {/* Montant */}
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className="text-sm font-semibold">
                      {formatPrice(order.ord_total_ttc)}
                    </span>
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <Badge
                      variant="outline"
                      className={`text-xs ${getStatusBadgeColor(order.ord_ords_id)}`}
                    >
                      {getStatusLabel(order.ord_ords_id)}
                    </Badge>
                  </td>

                  {/* Paiement */}
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <div className="flex flex-col items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getPaymentBadgeColor(order.ord_is_pay)}`}
                      >
                        {getPaymentLabel(order.ord_is_pay)}
                      </Badge>
                      {order.postback?.paymentmethod && (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getPaymentMethodInfo(order.postback.paymentmethod).color}`}
                        >
                          {getPaymentMethodInfo(order.postback.paymentmethod)
                            .type === "paypal"
                            ? "PayPal"
                            : "CB"}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions dropdown */}
                  <td className="px-4 py-3 text-right">
                    {permissions.canValidate && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${basePath}/${order.ord_id}`);
                            }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Voir le detail
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditOrder?.(order.ord_id);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          {order.ord_is_pay !== "1" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onMarkPaid?.(order.ord_id);
                              }}
                            >
                              <Truck className="w-4 h-4 mr-2" />
                              Marquer paye
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              onCancel?.(order.ord_id);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Annuler
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <p className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => onPageChange(1)}
              className="h-8 w-8 p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className="h-8 w-8 p-0"
                >
                  {page}
                </Button>
              );
            })}

            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => onPageChange(totalPages)}
              className="h-8 w-8 p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
