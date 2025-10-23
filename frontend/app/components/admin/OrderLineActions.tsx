import { useFetcher } from '@remix-run/react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';

interface OrderLineActionsProps {
  orderId: number;
  line: any;
  onSuccess?: () => void;
}

export function OrderLineActions({ orderId, line, onSuccess }: OrderLineActionsProps) {
  const fetcher = useFetcher<{ success?: boolean; message?: string; error?: string }>();
  const [showModal, setShowModal] = useState(false);
  const [action, setAction] = useState<string>('');
  const [supplierData, setSupplierData] = useState({
    supplierId: 0,
    supplierName: '',
    priceHT: line.orl_art_price_buy_unit_ht || 0,
  });
  const [productId, setProductId] = useState('');

  const status = line.orl_orls_id;

  const handleAction = (actionType: string) => {
    setAction(actionType);
    setShowModal(true);
  };

  const confirmAction = () => {
    const lineId = line.orl_id;

    switch (action) {
      case 'reset':
        // Statut 1: Reset
        fetcher.submit(
          { resetEquiv: 'true' },
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/status/1`,
          },
        );
        break;

      case 'cancel':
        // Statut 2: Annuler
        fetcher.submit(
          {},
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/status/2`,
          },
        );
        break;

      case 'pnc':
        // Statut 3: Pièce non conforme → vers 91
        fetcher.submit(
          {},
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/status/3`,
          },
        );
        break;

      case 'pnd':
        // Statut 4: Pièce non disponible → vers 91
        fetcher.submit(
          {},
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/status/4`,
          },
        );
        break;

      case 'available':
        // Statut 5: Pièce disponible
        fetcher.submit(
          {},
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/status/5`,
          },
        );
        break;

      case 'order-supplier':
        // Statut 6: Commander fournisseur
        fetcher.submit(
          {
            supplierId: supplierData.supplierId.toString(),
            supplierName: supplierData.supplierName,
            priceHT: supplierData.priceHT.toString(),
            quantity: line.orl_art_quantity.toString(),
          },
          {
            method: 'POST',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/order-from-supplier`,
          },
        );
        break;

      case 'propose-equivalent':
        // Statut 91: Proposer équivalence
        if (!productId) {
          alert('Veuillez entrer un ID produit');
          return;
        }
        fetcher.submit(
          {
            productId,
            quantity: line.orl_art_quantity.toString(),
          },
          {
            method: 'POST',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/propose-equivalent`,
          },
        );
        break;

      case 'accept-equivalent':
        // Statut 92: Accepter équivalence
        fetcher.submit(
          {},
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/accept-equivalent`,
          },
        );
        break;

      case 'reject-equivalent':
        // Statut 93: Refuser équivalence
        fetcher.submit(
          {},
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/reject-equivalent`,
          },
        );
        break;

      case 'validate-equivalent':
        // Statut 94: Valider équivalence
        fetcher.submit(
          {},
          {
            method: 'PATCH',
            action: `/api/admin/orders/${orderId}/lines/${lineId}/validate-equivalent`,
          },
        );
        break;
    }

    setShowModal(false);
    if (onSuccess) onSuccess();
  };

  const getStatusColor = (statusId: number): string => {
    const colors: Record<number, string> = {
      1: 'warning',
      2: 'error',
      3: 'orange',
      4: 'orange',
      5: 'success',
      6: 'info',
      91: 'purple',
      92: 'success',
      93: 'error',
      94: 'info',
    };
    return colors[statusId] || 'bg-gray-100 text-gray-800';
  };

  return (
    <>
      <div className="flex gap-2 flex-wrap">
        {/* Statut actuel */}
        <Badge className={getStatusColor(status)}>Statut {status}</Badge>

        {/* Actions selon statut */}
        <Button size="sm" variant="outline" onClick={() => handleAction('reset')}>
          🔄 Reset
        </Button>

        {status === 1 && (
          <>
            <Button size="sm" variant="destructive" onClick={() => handleAction('cancel')}>
              ❌ Annuler
            </Button>
            <Button size="sm" variant="default" onClick={() => handleAction('pnc')}>
              ⚠️ PNC
            </Button>
            <Button size="sm" variant="default" onClick={() => handleAction('pnd')}>
              📦 PND
            </Button>
            <Button size="sm" variant="default" onClick={() => handleAction('available')}>
              ✅ Disponible
            </Button>
          </>
        )}

        {status === 5 && (
          <Button size="sm" variant="default" onClick={() => handleAction('order-supplier')}>
            🛒 Commander fournisseur
          </Button>
        )}

        {(status === 3 || status === 4) && (
          <Button size="sm" variant="default" onClick={() => handleAction('propose-equivalent')}>
            🔄 Proposer équivalence
          </Button>
        )}

        {status === 91 && (
          <>
            <Button size="sm" variant="default" onClick={() => handleAction('accept-equivalent')}>
              ✅ Accepter équiv
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleAction('reject-equivalent')}>
              ❌ Refuser équiv
            </Button>
          </>
        )}

        {status === 92 && (
          <Button size="sm" variant="default" onClick={() => handleAction('validate-equivalent')}>
            💰 Valider équiv
          </Button>
        )}
      </div>

      {/* Modal de confirmation */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">Confirmer l'action</h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600">
                Ligne: {line.orl_pg_name} {line.orl_pm_name}
              </p>
              <p className="text-sm text-gray-600">Réf: {line.orl_art_ref}</p>
            </div>

            {/* Formulaire selon action */}
            {action === 'order-supplier' && (
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fournisseur</label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    placeholder="Nom du fournisseur"
                    value={supplierData.supplierName}
                    onChange={(e) =>
                      setSupplierData({ ...supplierData, supplierName: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ID Fournisseur</label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2"
                    value={supplierData.supplierId}
                    onChange={(e) =>
                      setSupplierData({
                        ...supplierData,
                        supplierId: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">PA U HT</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border rounded px-3 py-2"
                    value={supplierData.priceHT}
                    onChange={(e) =>
                      setSupplierData({
                        ...supplierData,
                        priceHT: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            )}

            {action === 'propose-equivalent' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  ID Produit équivalent
                </label>
                <input
                  type="number"
                  className="w-full border rounded px-3 py-2"
                  placeholder="Ex: 12345"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={() => confirmAction()} className="flex-1">
                ✅ Confirmer
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowModal(false)}
                className="flex-1"
              >
                ❌ Annuler
              </Button>
            </div>

            {fetcher.data && typeof fetcher.data === 'object' && (
              <div
                className={`mt-4 p-2 rounded ${'success' in fetcher.data && fetcher.data.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              >
                {'message' in fetcher.data ? String((fetcher.data as any).message) : 'error' in fetcher.data ? String((fetcher.data as any).error) : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
