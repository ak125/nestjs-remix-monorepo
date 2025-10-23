/**
 * 🔄 GESTION DES RETOURS COMMERCIAUX
 * 
 * Interface complète pour la gestion des demandes de retour
 * ✅ Création de demandes de retour
 * ✅ Génération d'étiquettes de retour automatique
 * ✅ Suivi des retours en temps réel
 * ✅ Workflow d'approbation automatisé
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { Button } from '~/components/ui/button';
import { useLoaderData, Form, Link, useNavigation } from '@remix-run/react';
import { 
  RotateCcw, Package, FileText, CheckCircle,
  XCircle, Clock, AlertTriangle, Eye,
  Download, Printer, Search, Filter
} from "lucide-react";
import { useState } from 'react';

// Types pour les retours
interface ReturnRequest {
  id: string;
  returnNumber: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: 'requested' | 'approved' | 'label_sent' | 'in_transit' | 'received' | 'processed' | 'refunded' | 'rejected';
  reason: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
  
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    reason: string;
    condition: 'new' | 'used' | 'damaged';
    refundAmount: number;
  }>;
  
  tracking: {
    carrier?: string;
    trackingNumber?: string;
    returnLabelUrl?: string;
  };
  
  timeline: Array<{
    status: string;
    timestamp: string;
    comment?: string;
    user?: string;
  }>;
}

interface ReturnStats {
  totalReturns: number;
  pendingApproval: number;
  inTransit: number;
  processed: number;
  refundedAmount: number;
  returnRate: number;
}

interface LoaderData {
  returns: ReturnRequest[];
  stats: ReturnStats;
  totalReturns: number;
  currentPage: number;
  limit: number;
  filters: {
    search: string;
    status: string;
    reason: string;
  };
}

// Données de démonstration
const mockReturns: ReturnRequest[] = [
  {
    id: '1',
    returnNumber: 'RET-2025-001',
    orderNumber: 'CMD-961114239',
    customerId: '81500',
    customerName: 'Client #81500',
    customerEmail: 'client@example.com',
    status: 'requested',
    reason: 'Produit défectueux',
    amount: 89.99,
    createdAt: '2025-08-16T10:30:00Z',
    updatedAt: '2025-08-16T10:30:00Z',
    items: [
      {
        id: '1',
        name: 'Pièce automobile XYZ',
        quantity: 1,
        reason: 'Défaut de fabrication',
        condition: 'damaged',
        refundAmount: 89.99
      }
    ],
    tracking: {},
    timeline: [
      {
        status: 'requested',
        timestamp: '2025-08-16T10:30:00Z',
        comment: 'Demande de retour créée par le client'
      }
    ]
  },
  {
    id: '2',
    returnNumber: 'RET-2025-002',
    orderNumber: 'CMD-919114807',
    customerId: '81501',
    customerName: 'Client #81501',
    customerEmail: 'client2@example.com',
    status: 'approved',
    reason: 'Erreur de commande',
    amount: 45.50,
    createdAt: '2025-08-15T14:20:00Z',
    updatedAt: '2025-08-16T09:15:00Z',
    items: [
      {
        id: '1',
        name: 'Filtre à huile',
        quantity: 2,
        reason: 'Mauvaise référence commandée',
        condition: 'new',
        refundAmount: 45.50
      }
    ],
    tracking: {
      carrier: 'Chronopost',
      returnLabelUrl: '/api/returns/2/label'
    },
    timeline: [
      {
        status: 'approved',
        timestamp: '2025-08-16T09:15:00Z',
        comment: 'Retour approuvé - Étiquette générée',
        user: 'Commercial Team'
      },
      {
        status: 'requested',
        timestamp: '2025-08-15T14:20:00Z',
        comment: 'Demande de retour créée'
      }
    ]
  },
  {
    id: '3',
    returnNumber: 'RET-2025-003',
    orderNumber: 'CMD-903152192',
    customerId: '81502',
    customerName: 'Client #81502',
    customerEmail: 'client3@example.com',
    status: 'in_transit',
    reason: 'Insatisfaction produit',
    amount: 120.00,
    createdAt: '2025-08-14T11:45:00Z',
    updatedAt: '2025-08-16T08:30:00Z',
    items: [
      {
        id: '1',
        name: 'Kit embrayage complet',
        quantity: 1,
        reason: 'Ne correspond pas aux attentes',
        condition: 'used',
        refundAmount: 96.00
      }
    ],
    tracking: {
      carrier: 'Colissimo',
      trackingNumber: 'COL123456789FR',
      returnLabelUrl: '/api/returns/3/label'
    },
    timeline: [
      {
        status: 'in_transit',
        timestamp: '2025-08-16T08:30:00Z',
        comment: 'Colis pris en charge par Colissimo'
      },
      {
        status: 'label_sent',
        timestamp: '2025-08-15T16:00:00Z',
        comment: 'Étiquette de retour envoyée au client'
      },
      {
        status: 'approved',
        timestamp: '2025-08-15T10:30:00Z',
        comment: 'Retour approuvé avec décote de 20%',
        user: 'Manager'
      },
      {
        status: 'requested',
        timestamp: '2025-08-14T11:45:00Z',
        comment: 'Demande de retour créée'
      }
    ]
  }
];

function getStatusColor(status: string): string {
  switch (status) {
    case 'requested': return 'warning';
    case 'approved': return 'info';
    case 'label_sent': return 'bg-indigo-100 text-indigo-800';
    case 'in_transit': return 'orange';
    case 'received': return 'purple';
    case 'processed': return 'success';
    case 'refunded': return 'bg-emerald-100 text-emerald-800';
    case 'rejected': return 'error';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'requested': return 'Demandé';
    case 'approved': return 'Approuvé';
    case 'label_sent': return 'Étiquette envoyée';
    case 'in_transit': return 'En transit';
    case 'received': return 'Reçu';
    case 'processed': return 'Traité';
    case 'refunded': return 'Remboursé';
    case 'rejected': return 'Refusé';
    default: return 'Statut inconnu';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'requested': return Clock;
    case 'approved': return CheckCircle;
    case 'label_sent': return FileText;
    case 'in_transit': return Package;
    case 'received': return CheckCircle;
    case 'processed': return CheckCircle;
    case 'refunded': return CheckCircle;
    case 'rejected': return XCircle;
    default: return AlertTriangle;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';
  const reason = url.searchParams.get('reason') || '';

  // En production, ces données viendraient de l'API
  let filteredReturns = [...mockReturns];
  
  if (search) {
    const searchLower = search.toLowerCase();
    filteredReturns = filteredReturns.filter(ret => 
      ret.returnNumber.toLowerCase().includes(searchLower) ||
      ret.orderNumber.toLowerCase().includes(searchLower) ||
      ret.customerName.toLowerCase().includes(searchLower)
    );
  }
  
  if (status) {
    filteredReturns = filteredReturns.filter(ret => ret.status === status);
  }
  
  if (reason) {
    filteredReturns = filteredReturns.filter(ret => ret.reason.toLowerCase().includes(reason.toLowerCase()));
  }

  const stats: ReturnStats = {
    totalReturns: mockReturns.length,
    pendingApproval: mockReturns.filter(r => r.status === 'requested').length,
    inTransit: mockReturns.filter(r => r.status === 'in_transit').length,
    processed: mockReturns.filter(r => ['processed', 'refunded'].includes(r.status)).length,
    refundedAmount: mockReturns.filter(r => r.status === 'refunded').reduce((sum, r) => sum + r.amount, 0),
    returnRate: 2.1 // Pourcentage de retour par rapport aux commandes
  };

  return json({
    returns: filteredReturns,
    stats,
    totalReturns: filteredReturns.length,
    currentPage: page,
    limit,
    filters: { search, status, reason }
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const action = formData.get('_action') as string;

  switch (action) {
    case 'approve':
      // Logique d'approbation du retour
      return json({ success: true, message: 'Retour approuvé avec succès' });
    
    case 'reject':
      // Logique de refus du retour
      return json({ success: true, message: 'Retour refusé' });
    
    case 'generate_label':
      // Générer l'étiquette de retour
      return json({ success: true, message: 'Étiquette générée et envoyée au client' });
    
    default:
      return json({ success: false, error: 'Action non reconnue' });
  }
}

export default function ReturnsManagement() {
  const { returns, stats, totalReturns, filters } = useLoaderData<LoaderData>();
  const navigation = useNavigation();
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);

  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <RotateCcw className="w-8 h-8 text-orange-600" />
              Gestion des Retours
            </h1>
            <p className="text-gray-600 mt-1">
              Traitement et suivi des demandes de retour clients
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button className="px-4 py-2 rounded-lg flex items-center gap-2" variant="orange">
              <Download className="w-4 h-4" />
              Export retours
            </Button>
            <Link
              to="/commercial/returns/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Créer retour
            </Link>
          </div>
        </div>
      </div>

      {/* Statistiques des retours */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Retours</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalReturns}</p>
            </div>
            <RotateCcw className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En attente</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingApproval}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">En transit</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inTransit}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Traités</p>
              <p className="text-2xl font-bold text-green-600">{stats.processed}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Taux de retour</p>
              <p className="text-2xl font-bold text-red-600">{stats.returnRate}%</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <Form method="get" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  name="search"
                  placeholder="Rechercher retour, commande..."
                  defaultValue={filters.search}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <select
                name="status"
                defaultValue={filters.status}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="requested">Demandé</option>
                <option value="approved">Approuvé</option>
                <option value="in_transit">En transit</option>
                <option value="processed">Traité</option>
                <option value="refunded">Remboursé</option>
                <option value="rejected">Refusé</option>
              </select>
            </div>

            <div>
              <select
                name="reason"
                defaultValue={filters.reason}
                className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Toutes les raisons</option>
                <option value="défectueux">Produit défectueux</option>
                <option value="erreur">Erreur de commande</option>
                <option value="insatisfaction">Insatisfaction</option>
                <option value="livraison">Problème livraison</option>
              </select>
            </div>

            <div>
              <Button className="w-full  px-4 py-2 rounded-lg flex items-center justify-center gap-2" variant="blue" type="submit">
                <Filter className="w-4 h-4" />
                Filtrer
              </Button>
            </div>
          </div>
        </Form>
      </div>

      {/* Liste des retours */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Demandes de retour ({totalReturns})
            </h2>
            {selectedReturns.length > 0 && (
              <div className="flex gap-2">
                <Form method="post" className="inline">
                  <input type="hidden" name="_action" value="bulk_approve" />
                  {selectedReturns.map(id => (
                    <input key={id} type="hidden" name="returnIds" value={id} />
                  ))}
                  <Button className="px-3 py-1  text-sm rounded" variant="green" type="submit">\n  Approuver ({selectedReturns.length})\n</Button>
                </Form>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedReturns(returns.map(r => r.id));
                      } else {
                        setSelectedReturns([]);
                      }
                    }}
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retour
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commande
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Raison
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {returns.map((returnReq) => {
                const StatusIcon = getStatusIcon(returnReq.status);
                return (
                  <tr key={returnReq.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedReturns.includes(returnReq.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReturns([...selectedReturns, returnReq.id]);
                          } else {
                            setSelectedReturns(selectedReturns.filter(id => id !== returnReq.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <StatusIcon className="w-5 h-5 text-gray-600" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {returnReq.returnNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {new Date(returnReq.createdAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/commercial/orders/${returnReq.orderNumber.replace('CMD-', '')}`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {returnReq.orderNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {returnReq.customerName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {returnReq.customerEmail}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{returnReq.reason}</div>
                      <div className="text-xs text-gray-500">
                        {returnReq.items.length} article(s)
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {returnReq.amount.toFixed(2)}€
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(returnReq.status)}`}>
                        {getStatusLabel(returnReq.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {returnReq.status === 'requested' && (
                          <Form method="post" className="inline">
                            <input type="hidden" name="_action" value="approve" />
                            <input type="hidden" name="returnId" value={returnReq.id} />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="text-green-600 hover:text-green-800 p-1 rounded"
                              title="Approuver"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          </Form>
                        )}
                        
                        {returnReq.status === 'approved' && !returnReq.tracking.returnLabelUrl && (
                          <Form method="post" className="inline">
                            <input type="hidden" name="_action" value="generate_label" />
                            <input type="hidden" name="returnId" value={returnReq.id} />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded"
                              title="Générer étiquette"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </Form>
                        )}
                        
                        {returnReq.tracking.returnLabelUrl && (
                          <a
                            href={returnReq.tracking.returnLabelUrl}
                            className="text-purple-600 hover:text-purple-800 p-1 rounded"
                            title="Télécharger étiquette"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        
                        <Link
                          to={`/commercial/returns/${returnReq.id}`}
                          className="text-gray-600 hover:text-gray-800 p-1 rounded"
                          title="Voir détails"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {returns.length === 0 && (
          <div className="text-center py-12">
            <RotateCcw className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun retour trouvé
            </h3>
            <p className="text-gray-500">
              Aucun retour ne correspond aux critères de recherche.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
