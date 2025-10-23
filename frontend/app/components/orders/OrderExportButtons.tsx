import { useFetcher } from '@remix-run/react';
import { Download, FileText, Mail, Printer } from 'lucide-react';
import { type Order, type OrderFilters } from '../../types/orders.types';
import { downloadCSV, generateOrdersCSV } from '../../utils/orders.utils';

interface OrderExportButtonsProps {
  filters: OrderFilters;
  selectedOrders: string[];
  allOrders?: Order[];
}

export function OrderExportButtons({
  filters: _filters,
  selectedOrders,
  allOrders = [],
}: OrderExportButtonsProps) {
  const fetcher = useFetcher();

  const handleExportCSV = () => {
    const ordersToExport =
      selectedOrders.length > 0
        ? allOrders.filter((o) => selectedOrders.includes(o.ord_id))
        : allOrders;

    if (ordersToExport.length === 0) {
      alert('Aucune commande à exporter');
      return;
    }

    const csv = generateOrdersCSV(ordersToExport);
    downloadCSV(csv, 'commandes');
  };

  const handleGenerateInvoice = () => {
    if (selectedOrders.length === 0) {
      alert('Veuillez sélectionner au moins une commande');
      return;
    }

    if (selectedOrders.length > 1) {
      alert('Sélectionnez une seule commande pour générer une facture');
      return;
    }

    fetcher.submit(
      { intent: 'generateInvoice', orderId: selectedOrders[0] },
      { method: 'post' },
    );
  };

  const handleSendEmail = () => {
    if (selectedOrders.length === 0) {
      alert('Veuillez sélectionner au moins une commande');
      return;
    }

    // Ouvrir modal email (à implémenter plus tard)
    alert(
      `Envoi d'email pour ${selectedOrders.length} commande(s) - Fonctionnalité à venir`,
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const isProcessing = fetcher.state !== 'idle';
  const hasOrders = allOrders.length > 0;
  const hasSelection = selectedOrders.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Export CSV */}
      <button
        onClick={handleExportCSV}
        disabled={!hasOrders || isProcessing}
        className="flex items-center gap-2 px-3 py-2 bg-success/80 text-success-foreground hover:bg-success rounded-lg  transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download className="w-4 h-4" />
        Export CSV
        {hasSelection && ` (${selectedOrders.length})`}
      </button>

      {/* Générer facture */}
      <button
        onClick={handleGenerateInvoice}
        disabled={selectedOrders.length !== 1 || isProcessing}
        className="flex items-center gap-2 px-3 py-2 bg-info/80 text-info-foreground hover:bg-info rounded-lg  transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FileText className="w-4 h-4" />
        Facture PDF
      </button>

      {/* Envoyer email */}
      <button
        onClick={handleSendEmail}
        disabled={!hasSelection || isProcessing}
        className="flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg  transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Mail className="w-4 h-4" />
        Envoyer email
      </button>

      {/* Imprimer */}
      <button
        onClick={handlePrint}
        disabled={!hasOrders}
        className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Printer className="w-4 h-4" />
        Imprimer
      </button>

      {/* Info sélection */}
      {hasSelection && (
        <span className="text-sm text-gray-600 ml-2">
          {selectedOrders.length} commande(s) sélectionnée(s)
        </span>
      )}
    </div>
  );
}
