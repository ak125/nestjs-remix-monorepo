/**
 * 🎯 INTERFACE UNIFIÉE DE GESTION DES COMMANDES - VERSION REFACTORISÉE V2
 * Adaptive selon le niveau utilisateur (Commercial → Admin → Super Admin)
 * 
 * ✅ FONCTIONNALITÉS COMPLÈTES:
 * - Statut et traitement des commandes avec workflow visuel
 * - Modale détails commande complète
 * - Formulaire d'édition
 * - Actions de workflow (valider, préparer, expédier, livrer, annuler)
 * - Permissions granulaires
 * 
 * ARCHITECTURE MODULAIRE:
 * - Types: types/orders.types.ts (14 interfaces)
 * - Utils: utils/orders.utils.ts (20+ fonctions)
 * - Hooks: hooks/use-orders-filters.ts (filtrage custom)
 * - Services: services/orders/orders.service.ts (API layer)
 * - UI Components: components/orders/* (10 composants)
 */

import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { Button } from '~/components/ui/button';
import { useActionData, useLoaderData } from '@remix-run/react';
import { useState } from 'react';
import { Alert } from '@fafa/ui';
import toast, { Toaster } from 'react-hot-toast';
import { requireUser } from '../auth/unified.server';
import { OrderDetailsModal } from '../components/orders/OrderDetailsModal';
import { OrderEditForm } from '../components/orders/OrderEditForm';
import { OrderExportButtons } from '../components/orders/OrderExportButtons';
import { OrdersFilters } from '../components/orders/OrdersFilters';
import { OrdersHeader } from '../components/orders/OrdersHeader';
import { OrdersStats } from '../components/orders/OrdersStats';
import { OrdersTable } from '../components/orders/OrdersTable';
import { OrderWorkflowButtons } from '../components/orders/OrderWorkflowButtons';
import { useOrdersFilters } from '../hooks/use-orders-filters';
import { type ActionData, type LoaderData, type Order } from '../types/orders.types';
import { getUserPermissions, getUserRole } from '../utils/permissions';

// ========================================
// 📄 META
// ========================================
export const meta = () => {
  return [
    { title: "Gestion des Commandes" },
    { name: "description", content: "Interface unifiée de gestion des commandes" },
  ];
};

// ========================================
// 🔧 ACTION - Opérations CRUD et workflow
// ========================================
export const action = async ({ request, context }: ActionFunctionArgs) => {
  // 🔐 Authentification
  const user = await requireUser({ context });
  if (!user || !user.level || user.level < 3) {
    console.error(`🚫 [Action] Accès refusé`);
    return json<ActionData>({ error: 'Accès refusé' }, { status: 403 });
  }
  
  const permissions = getUserPermissions(user.level);
  const userRole = getUserRole(user.level);
  
  const formData = await request.formData();
  const intent = formData.get("intent") || formData.get("_action");
  const orderId = formData.get("orderId");
  
  console.log(`🔒 [Action] User: ${user.email} | Level: ${user.level} | Role: ${userRole.label} | Intent: ${intent}`);
  
  try {
    // Récupérer le cookie pour les appels API
    const cookie = request.headers.get('Cookie') || '';
    
    switch (intent) {
      case "markPaid":
        if (!permissions.canMarkPaid) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const markPaidResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/mark-paid`, {
          method: 'POST',
          headers: { 'Cookie': cookie },
        });
        if (!markPaidResponse.ok) {
          const error = await markPaidResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors du paiement' }, { status: 500 });
        }
        console.log(`💰 Order #${orderId} marked as paid`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} marquée comme payée` });
      
      case "validate":
        if (!permissions.canValidate) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const validateResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/validate`, {
          method: 'POST',
          headers: { 'Cookie': cookie },
        });
        if (!validateResponse.ok) {
          const error = await validateResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors de la validation' }, { status: 500 });
        }
        console.log(`✅ Order #${orderId} validated`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} validée` });
      
      case "startProcessing":
        if (!permissions.canValidate) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const processingResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 
            'Cookie': cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ statusId: '3' }), // En préparation
        });
        if (!processingResponse.ok) {
          const error = await processingResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors du passage en préparation' }, { status: 500 });
        }
        console.log(`📦 Order #${orderId} processing started`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} mise en préparation` });
      
      case "markReady":
        if (!permissions.canShip) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const readyResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/status`, {
          method: 'PATCH',
          headers: { 
            'Cookie': cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ statusId: '4' }), // Prête
        });
        if (!readyResponse.ok) {
          const error = await readyResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors du marquage prête' }, { status: 500 });
        }
        console.log(`✅ Order #${orderId} marked as ready`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} prête à expédier` });
      
      case "ship":
        if (!permissions.canShip) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const shipResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/ship`, {
          method: 'POST',
          headers: { 'Cookie': cookie },
        });
        if (!shipResponse.ok) {
          const error = await shipResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors de l\'expédition' }, { status: 500 });
        }
        console.log(`🚚 Order #${orderId} shipped`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} expédiée` });
      
      case "deliver":
        if (!permissions.canDeliver) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const deliverResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/deliver`, {
          method: 'POST',
          headers: { 'Cookie': cookie },
        });
        if (!deliverResponse.ok) {
          const error = await deliverResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors de la livraison' }, { status: 500 });
        }
        console.log(`✅ Order #${orderId} delivered`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} livrée` });
      
      case "cancel":
        if (!permissions.canCancel) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const cancelResponse = await fetch(`http://localhost:3000/api/orders/${orderId}/cancel`, {
          method: 'POST',
          headers: { 'Cookie': cookie },
        });
        if (!cancelResponse.ok) {
          const error = await cancelResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors de l\'annulation' }, { status: 500 });
        }
        console.log(`❌ Order #${orderId} cancelled`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} annulée` });
      
      case "delete":
        if (!permissions.canCancel) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const deleteResponse = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
          method: 'DELETE',
          headers: { 'Cookie': cookie },
        });
        if (!deleteResponse.ok) {
          const error = await deleteResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors de la suppression' }, { status: 500 });
        }
        console.log(`🗑️ Order #${orderId} deleted`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} supprimée` });
      
      case "updateOrder":
        if (!permissions.canValidate) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        const orderStatus = formData.get("orderStatus");
        const isPaid = formData.get("isPaid") === 'on' ? '1' : '0';
        const totalAmount = formData.get("totalAmount");
        const orderInfo = formData.get("orderInfo");
        
        const updateResponse = await fetch(`http://localhost:3000/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 
            'Cookie': cookie,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            statusId: orderStatus,
            isPaid,
            totalTtc: totalAmount,
            info: orderInfo,
          }),
        });
        if (!updateResponse.ok) {
          const error = await updateResponse.json();
          return json<ActionData>({ error: error.message || 'Erreur lors de la modification' }, { status: 500 });
        }
        console.log(`✏️ Order #${orderId} updated`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} modifiée avec succès` });
      
      case "export":
        if (!permissions.canExport) {
          return json<ActionData>({ error: 'Permission refusée' }, { status: 403 });
        }
        console.log(`📄 Export CSV by ${user.email}`);
        return json<ActionData>({ success: true, message: 'Export CSV généré' });
      
      default:
        return json<ActionData>({ error: 'Action inconnue' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Action error:', error);
    return json<ActionData>({ 
      error: error instanceof Error ? error.message : 'Erreur inconnue' 
    }, { status: 500 });
  }
};

// ========================================
// 📊 LOADER - Chargement des données
// ========================================
export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // 🔐 Authentification (niveau 3+ = Commercial)
  const user = await requireUser({ context });
  if (!user || (user.level && user.level < 3)) {
    throw new Response("Accès refusé", { status: 403 });
  }
  
  const permissions = getUserPermissions(user.level || 0);
  const userRole = getUserRole(user.level || 0);
  
  console.log(`👤 [Orders] ${user.email} | Level ${user.level} | ${userRole.label}`);
  
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '25');
    
    // Récupérer filtres
    const search = url.searchParams.get('search') || '';
    const orderStatus = url.searchParams.get('orderStatus') || '';
    const paymentStatus = url.searchParams.get('paymentStatus') || '1'; // Par défaut: payées
    const dateRange = url.searchParams.get('dateRange') || '';
    
    // Charger commandes depuis API
    const ordersResponse = await fetch('http://localhost:3000/api/legacy-orders?limit=10000', {
      headers: { 'Cookie': request.headers.get('Cookie') || '' },
    });
    
    if (!ordersResponse.ok) {
      throw new Error('Erreur chargement commandes');
    }
    
    const ordersData = await ordersResponse.json();
    let orders = ordersData?.data || [];
    
    // Enrichir avec noms clients
    orders = orders.map((order: any) => ({
      ...order,
      customerName: order.customer 
        ? `${order.customer.cst_fname || ''} ${order.customer.cst_name || ''}`.trim() || 'Client inconnu'
        : 'Client inconnu',
      customerEmail: order.customer?.cst_mail || '',
    }));
    
    // Appliquer filtres
    let filteredOrders = orders;
    
    // Recherche
    if (search) {
      const s = search.toLowerCase();
      filteredOrders = filteredOrders.filter((o: any) => 
        o.customerName.toLowerCase().includes(s) ||
        o.customerEmail.toLowerCase().includes(s) ||
        o.ord_id.toString().includes(search)
      );
    }
    
    // Statut commande
    if (orderStatus) {
      filteredOrders = filteredOrders.filter((o: any) => o.ord_ords_id === orderStatus);
    }
    
    // Statut paiement
    if (paymentStatus) {
      filteredOrders = filteredOrders.filter((o: any) => {
        if (paymentStatus === '1') {
          return o.ord_is_pay === '1' && o.ord_ords_id !== '1';
        }
        if (paymentStatus === '0') {
          return o.ord_is_pay === '0' || o.ord_ords_id === '1';
        }
        return o.ord_is_pay === paymentStatus;
      });
    }
    
    // Période
    if (dateRange) {
      const now = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - now.getDay()));
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(0);
      }
      
      filteredOrders = filteredOrders.filter((o: any) => new Date(o.ord_date) >= startDate);
    }
    
    // Calculer statistiques
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalRevenue = filteredOrders.reduce((sum: number, o: any) => 
      sum + parseFloat(o.ord_total_ttc || '0'), 0);
    
    const monthRevenue = filteredOrders
      .filter((o: any) => new Date(o.ord_date) >= startOfMonth)
      .reduce((sum: number, o: any) => sum + parseFloat(o.ord_total_ttc || '0'), 0);
    
    const unpaidAmount = filteredOrders
      .filter((o: any) => o.ord_is_pay === "0")
      .reduce((sum: number, o: any) => sum + parseFloat(o.ord_total_ttc || '0'), 0);
    
    const pendingOrders = filteredOrders.filter((o: any) => o.ord_ords_id === "1").length;
    const averageBasket = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
    
    const stats = {
      totalOrders: filteredOrders.length,
      totalRevenue,
      monthRevenue,
      averageBasket,
      unpaidAmount,
      pendingOrders,
    };
    
    // Tri par date décroissante
    const sortedOrders = filteredOrders.sort((a: any, b: any) => 
      new Date(b.ord_date || 0).getTime() - new Date(a.ord_date || 0).getTime()
    );
    
    // Pagination
    const totalPages = Math.ceil(sortedOrders.length / limit);
    const startIndex = (page - 1) * limit;
    const paginatedOrders = sortedOrders.slice(startIndex, startIndex + limit);
    
    console.log(`📄 Page ${page}/${totalPages} - ${paginatedOrders.length}/${filteredOrders.length} orders`);
    
    return json<LoaderData>({
      orders: paginatedOrders,
      stats,
      filters: { search, orderStatus, paymentStatus, dateRange },
      total: filteredOrders.length,
      currentPage: page,
      totalPages,
      permissions,
      user: { level: user.level || 0, email: user.email, role: userRole },
    });
  } catch (error) {
    console.error('❌ Loader error:', error);
    return json<LoaderData>({
      orders: [],
      stats: { totalOrders: 0, totalRevenue: 0, monthRevenue: 0, averageBasket: 0, unpaidAmount: 0, pendingOrders: 0 },
      filters: { search: '', orderStatus: '', paymentStatus: '', dateRange: '' },
      error: error instanceof Error ? error.message : 'Unknown error',
      total: 0,
      currentPage: 1,
      totalPages: 0,
      permissions,
      user: { level: user.level || 0, email: user.email, role: userRole },
    });
  }
};

// ========================================
// 🎨 COMPOSANT PRINCIPAL
// ========================================
export default function OrdersRoute() {
  const data = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  
  // États pour modales et sélection
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  
  // Hook personnalisé pour gérer les filtres
  const {
    filteredOrders,
    activeFilters,
    setActiveFilters,
    resetAllFilters,
  } = useOrdersFilters(data.orders);
  
  // États supplémentaires pour les modals d'action
  const [isLoading, setIsLoading] = useState(false);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  
  // ========================================
  // 🎯 HANDLERS AVEC TOASTS ET CONFIRMATIONS
  // ========================================
  
  const handleViewOrder = (orderId: string) => {
    const order = data.orders.find(o => o.ord_id === orderId);
    if (order) {
      setSelectedOrder(order);
      setIsDetailsModalOpen(true);
    }
  };
  
  const handleEditOrder = (orderId: string) => {
    const order = data.orders.find(o => o.ord_id === orderId);
    if (order) {
      setSelectedOrder(order);
      setIsEditFormOpen(true);
    }
  };
  
  const handleMarkPaid = async (orderId: string) => {
    if (!confirm('Marquer cette commande comme payée ?')) {
      return;
    }
    
    setIsLoading(true);
    toast.loading('Enregistrement du paiement...', { id: 'markPaid' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}/mark-paid`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast.success('💰 Paiement enregistré avec succès !', { id: 'markPaid' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Enregistrement échoué'}`, { id: 'markPaid' });
      }
    } catch (error) {
      console.error('Erreur paiement:', error);
      toast.error('❌ Erreur réseau lors de l\'enregistrement', { id: 'markPaid' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleValidateOrder = async (orderId: string) => {
    if (!confirm('Valider cette commande et envoyer un email de confirmation au client ?')) {
      return;
    }
    
    setIsLoading(true);
    toast.loading('Validation en cours...', { id: 'validate' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}/validate`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast.success('✅ Commande validée et client notifié par email !', { id: 'validate' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Validation échouée'}`, { id: 'validate' });
      }
    } catch (error) {
      console.error('Erreur validation:', error);
      toast.error('❌ Erreur réseau lors de la validation', { id: 'validate' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleShipOrder = async () => {
    if (!actionOrderId || !trackingNumber.trim()) {
      toast.error('❌ Numéro de suivi requis');
      return;
    }
    
    setIsLoading(true);
    toast.loading('Expédition en cours...', { id: 'ship' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${actionOrderId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ trackingNumber: trackingNumber.trim() }),
      });
      
      if (response.ok) {
        toast.success('📦 Commande expédiée et client notifié par email !', { id: 'ship' });
        setShipModalOpen(false);
        setTrackingNumber('');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Expédition échouée'}`, { id: 'ship' });
      }
    } catch (error) {
      console.error('Erreur expédition:', error);
      toast.error('❌ Erreur réseau lors de l\'expédition', { id: 'ship' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancelOrder = async () => {
    if (!actionOrderId || !cancelReason.trim()) {
      toast.error('❌ Raison d\'annulation requise');
      return;
    }
    
    setIsLoading(true);
    toast.loading('Annulation en cours...', { id: 'cancel' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${actionOrderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      
      if (response.ok) {
        toast.success('❌ Commande annulée et client notifié par email', { id: 'cancel' });
        setCancelModalOpen(false);
        setCancelReason('');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Annulation échouée'}`, { id: 'cancel' });
      }
    } catch (error) {
      console.error('Erreur annulation:', error);
      toast.error('❌ Erreur réseau lors de l\'annulation', { id: 'cancel' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCancel = (orderId: string) => {
    setActionOrderId(orderId);
    setCancelModalOpen(true);
  };
  
  const handleShip = (orderId: string) => {
    setActionOrderId(orderId);
    setShipModalOpen(true);
  };
  
  const handleStartProcessing = async (orderId: string) => {
    if (!confirm('Démarrer la préparation de cette commande ?')) {
      return;
    }
    
    setIsLoading(true);
    toast.loading('Mise à jour en cours...', { id: 'startProcessing' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statusId: '3' }), // En préparation
      });
      
      if (response.ok) {
        toast.success('🔧 Commande en préparation !', { id: 'startProcessing' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Mise à jour échouée'}`, { id: 'startProcessing' });
      }
    } catch (error) {
      console.error('Erreur startProcessing:', error);
      toast.error('❌ Erreur réseau', { id: 'startProcessing' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleMarkReady = async (orderId: string) => {
    if (!confirm('Marquer cette commande comme prête à expédier ?')) {
      return;
    }
    
    setIsLoading(true);
    toast.loading('Mise à jour en cours...', { id: 'markReady' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statusId: '4' }), // Prête
      });
      
      if (response.ok) {
        toast.success('📦 Commande prête à expédier !', { id: 'markReady' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Mise à jour échouée'}`, { id: 'markReady' });
      }
    } catch (error) {
      console.error('Erreur markReady:', error);
      toast.error('❌ Erreur réseau', { id: 'markReady' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeliver = async (orderId: string) => {
    if (!confirm('Marquer cette commande comme livrée ?')) {
      return;
    }
    
    setIsLoading(true);
    toast.loading('Mise à jour en cours...', { id: 'deliver' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}/deliver`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast.success('✅ Commande livrée et client notifié !', { id: 'deliver' });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Mise à jour échouée'}`, { id: 'deliver' });
      }
    } catch (error) {
      console.error('Erreur deliver:', error);
      toast.error('❌ Erreur réseau', { id: 'deliver' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set('page', page.toString());
    window.location.href = `?${params.toString()}`;
  };
  
  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedOrder(null);
  };
  
  const handleCloseEditForm = () => {
    setIsEditFormOpen(false);
    setSelectedOrder(null);
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <OrdersHeader
          permissions={data.permissions}
          userRole={data.user.role}
          totalOrders={data.stats.totalOrders}
        />
        
        {/* Messages succès/erreur */}
        {actionData?.success && (
          <Alert intent="success"><p>{actionData.message}</p></Alert>
        )}
        {actionData?.error && (
          <Alert intent="error"><p>{actionData.error}</p></Alert>
        )}
        
        {/* Statistiques */}
        <div className="mt-6">
          <OrdersStats stats={data.stats} />
        </div>
        
        {/* Filtres */}
        <div className="mt-6">
          <OrdersFilters
            filters={activeFilters}
            onFilterChange={setActiveFilters}
            onReset={resetAllFilters}
          />
        </div>
        
        {/* Boutons d'export */}
        <div className="mt-4">
          <OrderExportButtons
            filters={activeFilters}
            selectedOrders={[]}
            allOrders={data.orders}
          />
        </div>
        
        {/* Tableau des commandes */}
        <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
          <OrdersTable
            orders={filteredOrders}
            permissions={data.permissions}
            currentPage={data.currentPage}
            totalPages={data.totalPages}
            onPageChange={handlePageChange}
            onViewOrder={handleViewOrder}
            onEditOrder={handleEditOrder}
            onMarkPaid={handleMarkPaid}
            onValidate={handleValidateOrder}
            onStartProcessing={handleStartProcessing}
            onMarkReady={handleMarkReady}
            onShip={handleShip}
            onDeliver={handleDeliver}
            onCancel={handleCancel}
          />
        </div>
        
        {/* Workflow visuel pour commande sélectionnée */}
        {selectedOrder && isDetailsModalOpen && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📊 Workflow de traitement - Commande #{selectedOrder.ord_id}
            </h3>
            <OrderWorkflowButtons
              order={selectedOrder}
              permissions={data.permissions}
              onStatusChange={() => {
                toast.success('Statut mis à jour');
                setTimeout(() => window.location.reload(), 1500);
              }}
            />
          </div>
        )}
      </div>
      
      {/* Modale de détails */}
      <OrderDetailsModal
        order={selectedOrder}
        permissions={data.permissions}
        isOpen={isDetailsModalOpen}
        onClose={handleCloseDetailsModal}
        onMarkPaid={handleMarkPaid}
        onCancel={handleCancel}
      />
      
      {/* Formulaire d'édition */}
      {selectedOrder && (
        <OrderEditForm
          order={selectedOrder}
          isOpen={isEditFormOpen}
          onClose={handleCloseEditForm}
          onSuccess={() => {
            toast.success('Commande modifiée avec succès');
            handleCloseEditForm();
            setTimeout(() => window.location.reload(), 1500);
          }}
        />
      )}
      
      {/* Modal Expédition avec numéro de suivi */}
      {shipModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              📦 Expédier la commande #{actionOrderId}
            </h3>
            <div className="mb-4">
              <label htmlFor="trackingNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Numéro de suivi *
              </label>
              <input
                type="text"
                id="trackingNumber"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ex: 1Z999AA10123456784"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-500">
                Le client recevra un email avec ce numéro de suivi.
              </p>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1 px-4 py-2  rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" variant="blue" onClick={handleShipOrder}
                disabled={!trackingNumber.trim() || isLoading}>\n  {isLoading ? 'Expédition...' : 'Confirmer l\'expédition'}\n</Button>
              <button
                onClick={() => {
                  setShipModalOpen(false);
                  setTrackingNumber('');
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-muted/50 disabled:opacity-50 font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Annulation avec raison */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              ❌ Annuler la commande #{actionOrderId}
            </h3>
            <div className="mb-4">
              <label htmlFor="cancelReason" className="block text-sm font-medium text-gray-700 mb-2">
                Raison de l'annulation *
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
                placeholder="Ex: Rupture de stock, demande client, erreur de commande..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
              <p className="mt-2 text-sm text-gray-500">
                Le client recevra un email avec cette raison.
              </p>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1 px-4 py-2  rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium" variant="red" onClick={handleCancelOrder}
                disabled={!cancelReason.trim() || isLoading}>\n  {isLoading ? 'Annulation...' : 'Confirmer l\'annulation'}\n</Button>
              <button
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancelReason('');
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-muted/50 disabled:opacity-50 font-medium"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
