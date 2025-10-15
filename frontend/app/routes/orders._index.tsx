/**
 * 🎯 INTERFACE UNIFIÉE DE GESTION DES COMMANDES
 * Adaptive selon le niveau utilisateur (Commercial → Admin → Super Admin)
 * Conserve toutes les améliorations : emails, badges REF, affichage références
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, useSearchParams, useNavigate, useFetcher, Form } from '@remix-run/react';
import { 
  Package, ShoppingCart, Search, ChevronLeft, ChevronRight, Eye, Plus,
  DollarSign, TrendingUp, AlertCircle, Filter, Download, RefreshCw, Mail, Phone,
  CheckCircle, Clock, Truck, XCircle, Users, MapPin, Info, Send, Ban, Shield
} from 'lucide-react';
import { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { requireUser } from '../auth/unified.server';
import { getUserPermissions, getUserRole, type UserPermissions } from '../utils/permissions';

export const meta = () => {
  return [
    { title: "Gestion des Commandes" },
    { name: "description", content: "Interface unifiée de gestion des commandes" },
  ];
};

// 📊 TYPES FORMAT BDD SUPABASE
interface Order {
  ord_id: string;
  ord_cst_id: string;
  ord_date: string;
  ord_amount_ht?: string;
  ord_total_ht?: string;
  ord_amount_ttc?: string;
  ord_total_ttc: string;
  ord_deposit_ht?: string;
  ord_deposit_ttc?: string;
  ord_shipping_fee_ht?: string;
  ord_shipping_fee_ttc?: string;
  ord_tva?: string;
  ord_is_pay: string; // "0" ou "1"
  ord_ords_id: string; // ID statut commande
  ord_info?: string;
  customerName?: string;
  customerEmail?: string;
  customer?: {
    cst_id?: string;
    cst_fname?: string;
    cst_name?: string;
    cst_mail?: string;
    cst_tel?: string;
    cst_gsm?: string;
    cst_city?: string;
    cst_zip_code?: string;
    cst_country?: string;
    cst_address?: string;
  };
  statusDetails?: {
    ords_id: string;
    ords_named: string;
    ords_color: string;
  };
}

interface OrdersStats {
  totalOrders: number;
  totalRevenue: number;
  monthRevenue: number;
  averageBasket: number;
  unpaidAmount: number;
  pendingOrders: number;
}

interface LoaderData {
  orders: Order[];
  stats: OrdersStats;
  filters: {
    search: string;
    orderStatus: string;
    paymentStatus: string;
    dateRange: string;
  };
  error?: string;
  total: number;
  currentPage: number;
  totalPages: number;
  // 🆕 Ajout des permissions et info utilisateur
  permissions: UserPermissions;
  user: {
    level: number;
    email: string;
    role: ReturnType<typeof getUserRole>;
  };
}

interface ActionData {
  success?: boolean;
  message?: string;
  error?: string;
}

// 🔧 ACTION pour opérations CRUD et workflow - 🔐 SÉCURISÉ
export const action = async ({ request, context }: ActionFunctionArgs) => {
  // 🔐 VÉRIFICATION AUTHENTIFICATION
  const user = await requireUser({ context });
  if (!user || !user.level || user.level < 3) {
    console.error(`🚫 [Action] Accès refusé - Utilisateur non authentifié ou niveau insuffisant`);
    return json<ActionData>({ error: 'Accès refusé' }, { status: 403 });
  }
  
  // 🔐 CALCULER LES PERMISSIONS
  const permissions = getUserPermissions(user.level);
  const userRole = getUserRole(user.level);
  
  const formData = await request.formData();
  const _action = formData.get("_action");
  const orderId = formData.get("orderId");
  
  console.log(`🔒 [Action] Utilisateur: ${user.email} | Niveau: ${user.level} | Rôle: ${userRole.label} | Action: ${_action}`);
  
  try {
    switch (_action) {
      case "markPaid":
        // 🔐 Vérifier permission
        if (!permissions.canMarkPaid) {
          console.error(`🚫 [Action] Permission refusée - canMarkPaid requis`);
          return json<ActionData>({ error: 'Permission refusée - Action réservée aux administrateurs' }, { status: 403 });
        }
        console.log(`💰 Marquer commande #${orderId} comme payée`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} marquée comme payée` });
      
      case "validate":
        // 🔐 Vérifier permission
        if (!permissions.canValidate) {
          console.error(`🚫 [Action] Permission refusée - canValidate requis`);
          return json<ActionData>({ error: 'Permission refusée - Action réservée aux administrateurs' }, { status: 403 });
        }
        console.log(`✅ Valider commande #${orderId}`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} validée` });
      
      case "startProcessing":
        // 🔐 Vérifier permission
        if (!permissions.canValidate) {
          console.error(`🚫 [Action] Permission refusée - canValidate requis`);
          return json<ActionData>({ error: 'Permission refusée - Action réservée aux administrateurs' }, { status: 403 });
        }
        console.log(`📦 Mettre commande #${orderId} en préparation`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} mise en préparation` });
      
      case "markReady":
        // 🔐 Vérifier permission
        if (!permissions.canShip) {
          console.error(`🚫 [Action] Permission refusée - canShip requis`);
          return json<ActionData>({ error: 'Permission refusée - Action réservée aux administrateurs' }, { status: 403 });
        }
        console.log(`✅ Marquer commande #${orderId} prête`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} prête à expédier` });
      
      case "ship":
        // 🔐 Vérifier permission
        if (!permissions.canShip) {
          console.error(`🚫 [Action] Permission refusée - canShip requis`);
          return json<ActionData>({ error: 'Permission refusée - Action réservée aux administrateurs' }, { status: 403 });
        }
        console.log(`🚚 Expédier commande #${orderId}`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} expédiée` });
      
      case "deliver":
        // 🔐 Vérifier permission
        if (!permissions.canDeliver) {
          console.error(`🚫 [Action] Permission refusée - canDeliver requis`);
          return json<ActionData>({ error: 'Permission refusée - Action réservée aux administrateurs' }, { status: 403 });
        }
        console.log(`✅ Livrer commande #${orderId}`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} livrée` });
      
      case "cancel":
        // 🔐 Vérifier permission
        if (!permissions.canCancel) {
          console.error(`🚫 [Action] Permission refusée - canCancel requis`);
          return json<ActionData>({ error: 'Permission refusée - Action réservée aux administrateurs' }, { status: 403 });
        }
        console.log(`❌ Annuler commande #${orderId}`);
        return json<ActionData>({ success: true, message: `Commande #${orderId} annulée` });
      
      case "export":
        // 🔐 Vérifier permission
        if (!permissions.canExport) {
          console.error(`🚫 [Action] Permission refusée - canExport requis`);
          return json<ActionData>({ error: 'Permission refusée - Export réservé aux utilisateurs niveau 3+' }, { status: 403 });
        }
        console.log(`📄 Export CSV par ${user.email}`);
        return json<ActionData>({ 
          success: true, 
          message: 'Export CSV généré (fonctionnalité à compléter)'
        });
      
      default:
        console.error(`🚫 [Action] Action non reconnue: ${_action}`);
        return json<ActionData>({ error: 'Action non reconnue' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Erreur action:', error);
    return json<ActionData>({ error: `Erreur: ${error instanceof Error ? error.message : 'Unknown'}` }, { status: 500 });
  }
};

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  // 🔐 AUTHENTIFICATION - Niveau 3 minimum (Commercial)
  const user = await requireUser({ context });
  if (!user || (user.level && user.level < 3)) {
    throw new Response("Accès refusé - Niveau Commercial (3+) requis", { status: 403 });
  }
  
  // 🎯 CALCULER LES PERMISSIONS
  const permissions = getUserPermissions(user.level || 0);
  const userRole = getUserRole(user.level || 0);
  
  console.log(`👤 [Orders] Utilisateur: ${user.email} | Niveau: ${user.level} | Rôle: ${userRole.label}`);
  console.log(`🔐 [Orders] Permissions:`, {
    canValidate: permissions.canValidate,
    canShip: permissions.canShip,
    canSendEmails: permissions.canSendEmails,
    showActionButtons: permissions.showActionButtons,
  });
  
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '25');
    
    // 🔍 Récupérer les filtres
    const search = url.searchParams.get('search') || '';
    const orderStatus = url.searchParams.get('orderStatus') || '';
    // Par défaut, afficher uniquement les commandes payées
    const paymentStatus = url.searchParams.get('paymentStatus') || '1';
    const dateRange = url.searchParams.get('dateRange') || '';
    
    // ✅ Charger toutes les commandes depuis l'API
    const ordersResponse = await fetch('http://localhost:3000/api/legacy-orders?limit=10000', {
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
      },
    });
    
    if (!ordersResponse.ok) {
      throw new Error('Erreur lors du chargement des commandes');
    }
    
    const ordersData = await ordersResponse.json();
    let orders = ordersData?.data || [];
    
    // ✅ Enrichir avec noms clients
    orders = orders.map((order: any) => {
      const customer = order.customer;
      return {
        ...order,
        customerName: customer 
          ? `${customer.cst_fname || ''} ${customer.cst_name || ''}`.trim() || 'Client inconnu'
          : 'Client inconnu',
        customerEmail: customer?.cst_mail || '',
      };
    });
    
    // 🔍 APPLIQUER LES FILTRES
    let filteredOrders = orders;
    
    // Filtre recherche (client, numéro commande, email)
    if (search) {
      const searchLower = search.toLowerCase();
      filteredOrders = filteredOrders.filter((order: any) => 
        order.customerName.toLowerCase().includes(searchLower) ||
        order.customerEmail.toLowerCase().includes(searchLower) ||
        order.ord_id.toString().includes(search)
      );
    }
    
    // Filtre statut commande
    if (orderStatus) {
      filteredOrders = filteredOrders.filter((order: any) => order.ord_ords_id === orderStatus);
    }
    
    // Filtre statut paiement
    if (paymentStatus) {
      filteredOrders = filteredOrders.filter((order: any) => {
        // Si on filtre sur "Payé", exclure les commandes en attente (statut 1)
        if (paymentStatus === '1') {
          return order.ord_is_pay === '1' && order.ord_ords_id !== '1';
        }
        // Si on filtre sur "Non payé", inclure toutes les commandes en attente + les non payées
        if (paymentStatus === '0') {
          return order.ord_is_pay === '0' || order.ord_ords_id === '1';
        }
        return order.ord_is_pay === paymentStatus;
      });
    }
    
    // Filtre période
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
      
      filteredOrders = filteredOrders.filter((order: any) => {
        const orderDate = new Date(order.ord_date);
        return orderDate >= startDate;
      });
    }
    
    // 💰 CALCULER LES VRAIES STATISTIQUES
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const totalRevenue = filteredOrders.reduce((sum: number, order: any) => 
      sum + parseFloat(order.ord_total_ttc || '0'), 0);
    
    const monthRevenue = filteredOrders
      .filter((order: any) => new Date(order.ord_date) >= startOfMonth)
      .reduce((sum: number, order: any) => sum + parseFloat(order.ord_total_ttc || '0'), 0);
    
    const unpaidAmount = filteredOrders
      .filter((order: any) => order.ord_is_pay === "0")
      .reduce((sum: number, order: any) => sum + parseFloat(order.ord_total_ttc || '0'), 0);
    
    const pendingOrders = filteredOrders.filter((order: any) => order.ord_ords_id === "1").length;
    
    const averageBasket = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;
    
    const stats: OrdersStats = {
      totalOrders: filteredOrders.length,
      totalRevenue,
      monthRevenue,
      averageBasket,
      unpaidAmount,
      pendingOrders,
    };
    
    // Trier par date décroissante
    const sortedOrders = filteredOrders.sort((a: any, b: any) => {
      const dateA = new Date(a.ord_date || 0).getTime();
      const dateB = new Date(b.ord_date || 0).getTime();
      return dateB - dateA;
    });
    
    // Pagination
    const totalPages = Math.ceil(sortedOrders.length / limit);
    const startIndex = (page - 1) * limit;
    const paginatedOrders = sortedOrders.slice(startIndex, startIndex + limit);
    
    console.log(`📄 [Frontend] Page ${page}/${totalPages} - Affichage de ${paginatedOrders.length}/${filteredOrders.length} commandes`);
    
    return json<LoaderData>({
      orders: paginatedOrders,
      stats,
      filters: { search, orderStatus, paymentStatus, dateRange },
      total: filteredOrders.length,
      currentPage: page,
      totalPages,
      // 🆕 Ajout des permissions et utilisateur
      permissions,
      user: {
        level: user.level || 0,
        email: user.email,
        role: userRole,
      },
    });
  } catch (error) {
    console.error('❌ [Frontend] Erreur loader:', error);
    return json<LoaderData>({
      orders: [],
      stats: { 
        totalOrders: 0, 
        totalRevenue: 0, 
        monthRevenue: 0, 
        averageBasket: 0, 
        unpaidAmount: 0, 
        pendingOrders: 0 
      },
      filters: { search: '', orderStatus: '', paymentStatus: '', dateRange: '' },
      error: error instanceof Error ? error.message : 'Unknown error',
      total: 0,
      currentPage: 1,
      totalPages: 0,
      // 🆕 Même en cas d'erreur, retourner les permissions
      permissions,
      user: {
        level: user.level || 0,
        email: user.email,
        role: userRole,
      },
    });
  }
};

// Composant principal
export default function UnifiedOrders() {
  const { orders, stats, filters, error, currentPage, totalPages, permissions, user } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetcher = useFetcher<ActionData>();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // États pour les modals d'action
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [actionOrderId, setActionOrderId] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 🚀 Actions sur commandes avec envoi d'emails
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
  
  const handlePaymentReminder = async (orderId: string) => {
    if (!confirm('Envoyer un rappel de paiement par email au client ?')) {
      return;
    }
    
    setIsLoading(true);
    toast.loading('Envoi du rappel...', { id: 'reminder' });
    
    try {
      const response = await fetch(`http://localhost:3000/api/orders/${orderId}/payment-reminder`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        toast.success('💳 Rappel de paiement envoyé par email', { id: 'reminder' });
      } else {
        const error = await response.json();
        toast.error(`❌ Erreur: ${error.message || 'Envoi échoué'}`, { id: 'reminder' });
      }
    } catch (error) {
      console.error('Erreur rappel:', error);
      toast.error('❌ Erreur réseau lors de l\'envoi', { id: 'reminder' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };
  
  // Navigation pagination
  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    navigate(`?${params.toString()}`);
  };
  
  // Appliquer filtres
  const applyFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams();
    Object.entries({ ...filters, ...newFilters }).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', '1'); // Reset à la page 1 lors du filtrage
    navigate(`?${params.toString()}`);
  };
  
  const getStatusBadge = (statusId: string) => {
    const statusMap: Record<string, { label: string; class: string }> = {
      "1": { label: "En cours", class: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      "2": { label: "Confirmée", class: "bg-blue-100 text-blue-800 border-blue-200" },
      "3": { label: "En traitement", class: "bg-orange-100 text-orange-800 border-orange-200" },
      "4": { label: "Expédiée", class: "bg-purple-100 text-purple-800 border-purple-200" },
      "5": { label: "Livrée", class: "bg-green-100 text-green-800 border-green-200" },
      "6": { label: "Annulée", class: "bg-red-100 text-red-800 border-red-200" },
    };
    return statusMap[statusId] || { label: `Statut ${statusId}`, class: "bg-gray-100 text-gray-800 border-gray-200" };
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Badges de statut de commande avec icônes
  const getOrderStatusBadge = (statusId: string) => {
    const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
      "1": { label: "En attente", color: "text-amber-700", bgColor: "bg-amber-100 border-amber-300", icon: Clock },
      "2": { label: "Confirmée", color: "text-blue-700", bgColor: "bg-blue-100 border-blue-300", icon: CheckCircle },
      "3": { label: "En préparation", color: "text-orange-700", bgColor: "bg-orange-100 border-orange-300", icon: Package },
      "4": { label: "Prête", color: "text-indigo-700", bgColor: "bg-indigo-100 border-indigo-300", icon: CheckCircle },
      "5": { label: "Expédiée", color: "text-purple-700", bgColor: "bg-purple-100 border-purple-300", icon: ShoppingCart },
      "6": { label: "Livrée", color: "text-green-700", bgColor: "bg-green-100 border-green-300", icon: CheckCircle },
      "91": { label: "Annulée", color: "text-red-700", bgColor: "bg-red-100 border-red-300", icon: Clock },
      "92": { label: "Rupture stock", color: "text-red-700", bgColor: "bg-red-100 border-red-300", icon: Clock },
    };
    const config = statusConfig[statusId] || { label: `Statut ${statusId}`, color: "text-gray-700", bgColor: "bg-gray-100 border-gray-300", icon: Clock };
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bgColor} ${config.color}`}>
        <Icon className="h-3 w-3" />
        <span>{config.label}</span>
      </span>
    );
  };

  // Badge de paiement
  const getPaymentBadge = (isPaid: string) => {
    if (isPaid === "1") {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-green-100 border-green-300 text-green-700">
          <CheckCircle className="h-3 w-3" />
          <span>Payé</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-100 border-red-300 text-red-700">
        <Clock className="h-3 w-3" />
        <span>Non payé</span>
      </span>
    );
  };

  // Actions contextuelles disponibles selon l'état de la commande
  const getAvailableActions = (order: Order) => {
    const actions: Array<{ intent: string; label: string; color: string }> = [];
    
    // Marquer comme payé (si non payé)
    if (order.ord_is_pay === "0") {
      actions.push({ intent: "markPaid", label: "Marquer payé", color: "text-green-600 hover:text-green-700" });
    }
    
    // Actions selon le statut
    switch (order.ord_ords_id) {
      case "1": // En attente
        actions.push({ intent: "validate", label: "Confirmer", color: "text-blue-600 hover:text-blue-700" });
        actions.push({ intent: "cancel", label: "Annuler", color: "text-red-600 hover:text-red-700" });
        break;
      case "2": // Confirmée
        actions.push({ intent: "startProcessing", label: "En préparation", color: "text-orange-600 hover:text-orange-700" });
        actions.push({ intent: "cancel", label: "Annuler", color: "text-red-600 hover:text-red-700" });
        break;
      case "3": // En préparation
        actions.push({ intent: "markReady", label: "Prête", color: "text-indigo-600 hover:text-indigo-700" });
        break;
      case "4": // Prête
        actions.push({ intent: "ship", label: "Expédier", color: "text-purple-600 hover:text-purple-700" });
        break;
      case "5": // Expédiée
        actions.push({ intent: "deliver", label: "Livrer", color: "text-green-600 hover:text-green-700" });
        break;
    }
    
    return actions;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      
      <style>{`
        .card {
          background: white;
          border-radius: 8px;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          border: 1px solid #e5e7eb;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          font-size: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
          text-decoration: none;
        }
        .btn-primary {
          background-color: #2563eb;
          color: white;
        }
        .btn-primary:hover {
          background-color: #1d4ed8;
        }
        .btn-outline {
          background-color: white;
          color: #374151;
          border: 1px solid #d1d5db;
        }
        .btn-outline:hover {
          background-color: #f9fafb;
        }
        .btn-sm {
          padding: 4px 8px;
          font-size: 12px;
        }
        .badge {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid;
        }
        .input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
        }
        .input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .textarea {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          resize: vertical;
          min-height: 80px;
        }
        .textarea:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 4px;
        }
        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 50;
        }
        .modal-content {
          background: white;
          border-radius: 8px;
          max-width: 2xl;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }
        .alert {
          padding: 12px 16px;
          border-radius: 6px;
          margin-bottom: 24px;
          border: 1px solid;
        }
        .alert-success {
          background-color: #dcfce7;
          color: #166534;
          border-color: #bbf7d0;
        }
        .alert-error {
          background-color: #fee2e2;
          color: #991b1b;
          border-color: #fecaca;
        }
      `}</style>
      
      {/* Toast Notifications */}
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShoppingCart className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Gestion des Commandes</h1>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-gray-600">Dashboard</p>
                  {/* 🆕 BADGE DE RÔLE */}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${user.role.bgColor} ${user.role.color}`}>
                    <span>{user.role.badge}</span>
                    <span>{user.role.label}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex space-x-3">
              {/* 🔐 Bouton "Nouvelle Commande" - Admin seulement */}
              {permissions.canCreateOrders && (
                <button 
                  onClick={() => setShowCreateForm(true)}
                  className="btn btn-primary"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle Commande
                </button>
              )}
              {/* 🔐 Export CSV - Niveau 3+ */}
              {permissions.canExport && (
                <Form method="post">
                  <input type="hidden" name="intent" value="export" />
                  <button type="submit" className="btn btn-outline">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter CSV
                  </button>
                </Form>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {fetcher.data?.success && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
            <div className="bg-green-50 border-l-4 border-green-500 rounded-lg p-4 shadow-lg max-w-md">
              <div className="flex items-start">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Succès</p>
                  <p className="text-sm text-green-700 mt-1">{fetcher.data.message}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {fetcher.data?.error && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5 fade-in duration-300">
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-lg max-w-md">
              <div className="flex items-start">
                <Plus className="h-5 w-5 text-red-500 mt-0.5 mr-3 flex-shrink-0 rotate-45" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Erreur</p>
                  <p className="text-sm text-red-700 mt-1">{fetcher.data.error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="alert alert-error">
            Erreur de chargement: {error}
          </div>
        )}

        {/* 📊 Statistiques - Adaptatives selon permissions */}
        {permissions.canSeeFullStats ? (
          /* 🔑 ADMIN/RESPONSABLE - 6 statistiques complètes */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Total Commandes */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-orange-700 uppercase tracking-wide">Total Commandes</div>
                <div className="p-2 bg-orange-200 rounded-lg">
                  <Package className="h-5 w-5 text-orange-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-orange-900">{stats.totalOrders}</div>
              <div className="text-xs text-orange-600 mt-2">Toutes périodes</div>
            </div>
            
            {/* CA Total */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-green-700 uppercase tracking-wide">CA Total</div>
                <div className="p-2 bg-green-200 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-900">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-xs text-green-600 mt-2">Chiffre d'affaires global</div>
            </div>
            
            {/* CA du Mois */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-blue-700 uppercase tracking-wide">CA du Mois</div>
                <div className="p-2 bg-blue-200 rounded-lg">
                  <ShoppingCart className="h-5 w-5 text-blue-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-900">{formatCurrency(stats.monthRevenue)}</div>
              <div className="text-xs text-blue-600 mt-2">Mois en cours</div>
            </div>
            
            {/* Panier Moyen */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Panier Moyen</div>
                <div className="p-2 bg-purple-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-purple-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-900">{formatCurrency(stats.averageBasket)}</div>
              <div className="text-xs text-purple-600 mt-2">Par commande</div>
            </div>
            
            {/* Impayé */}
            <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-red-700 uppercase tracking-wide">Impayé</div>
                <div className="p-2 bg-red-200 rounded-lg">
                  <DollarSign className="h-5 w-5 text-red-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-red-900">{formatCurrency(stats.unpaidAmount)}</div>
              <div className="text-xs text-red-600 mt-2">À encaisser</div>
            </div>
            
            {/* En Attente */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-amber-700 uppercase tracking-wide">En Attente</div>
                <div className="p-2 bg-amber-200 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-amber-900">{stats.pendingOrders}</div>
              <div className="text-xs text-amber-600 mt-2">À traiter</div>
            </div>
          </div>
        ) : (
          /* 👔 COMMERCIAL - 4 statistiques basiques */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Commandes */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Commandes</div>
                <div className="p-2 bg-blue-200 rounded-lg">
                  <Package className="h-5 w-5 text-blue-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-blue-900">{stats.totalOrders}</div>
              <div className="text-xs text-blue-600 mt-2">Total</div>
            </div>
            
            {/* En Attente */}
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-amber-700 uppercase tracking-wide">En Attente</div>
                <div className="p-2 bg-amber-200 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-amber-900">{stats.pendingOrders}</div>
              <div className="text-xs text-amber-600 mt-2">À traiter</div>
            </div>
            
            {/* Complétées */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-green-700 uppercase tracking-wide">Complétées</div>
                <div className="p-2 bg-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-900">{stats.totalOrders - stats.pendingOrders}</div>
              <div className="text-xs text-green-600 mt-2">Traitées</div>
            </div>
            
            {/* CA Total (sans détails) */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-purple-700 uppercase tracking-wide">Chiffre d'affaires</div>
                <div className="p-2 bg-purple-200 rounded-lg">
                  <DollarSign className="h-5 w-5 text-purple-700" />
                </div>
              </div>
              <div className="text-3xl font-bold text-purple-900">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-xs text-purple-600 mt-2">Total</div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Plus className="h-5 w-5 text-blue-600 rotate-45" />
              </div>
              <h3 className="text-lg font-bold text-gray-800">Filtres de recherche</h3>
              {(filters.search || filters.orderStatus || (filters.paymentStatus && filters.paymentStatus !== '1') || filters.dateRange) && (
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  {[filters.search, filters.orderStatus, (filters.paymentStatus !== '1' ? filters.paymentStatus : ''), filters.dateRange].filter(Boolean).length} actif(s)
                </span>
              )}
            </div>
            {(filters.search || filters.orderStatus || (filters.paymentStatus && filters.paymentStatus !== '1') || filters.dateRange) && (
              <button
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('search');
                  params.delete('orderStatus');
                  params.set('paymentStatus', '1'); // Remettre sur "Payé" par défaut
                  params.delete('dateRange');
                  params.set('page', '1');
                  navigate(`?${params.toString()}`);
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center space-x-1"
              >
                <span>Effacer les filtres</span>
              </button>
            )}
          </div>
          
          {/* 🔍 Filtres adaptatifs - 2 basiques (commercial) ou 4 avancés (admin) */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${permissions.showAdvancedFilters ? 'lg:grid-cols-4' : ''}`}>
            {/* 🔎 Recherche - Tous niveaux */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recherche
              </label>
              <input
                type="text"
                placeholder="Client, email, ID..."
                defaultValue={filters.search}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    params.set('search', e.target.value);
                  } else {
                    params.delete('search');
                  }
                  params.set('page', '1');
                  navigate(`?${params.toString()}`);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* 📋 Statut Commande - Tous niveaux */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut commande
              </label>
              <select
                value={filters.orderStatus}
                onChange={(e) => {
                  const params = new URLSearchParams(searchParams);
                  if (e.target.value) {
                    params.set('orderStatus', e.target.value);
                  } else {
                    params.delete('orderStatus');
                  }
                  params.set('page', '1');
                  navigate(`?${params.toString()}`);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les statuts</option>
                <option value="1">En attente</option>
                <option value="2">Confirmée</option>
                <option value="3">En préparation</option>
                <option value="4">Prête</option>
                <option value="5">Expédiée</option>
                <option value="6">Livrée</option>
                <option value="91">Annulée</option>
                <option value="92">Rupture stock</option>
              </select>
            </div>
            
            {/* 🔐 FILTRES AVANCÉS - Admin/Responsable uniquement (niveau 5+) */}
            {permissions.showAdvancedFilters && (
              <>
                {/* 💳 Statut Paiement */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Paiement
                  </label>
                  <select
                    value={filters.paymentStatus}
                    onChange={(e) => {
                      const params = new URLSearchParams(searchParams);
                      if (e.target.value) {
                        params.set('paymentStatus', e.target.value);
                      } else {
                        params.delete('paymentStatus');
                      }
                      params.set('page', '1');
                      navigate(`?${params.toString()}`);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Tous</option>
                    <option value="1">Payé</option>
                    <option value="0">Non payé</option>
                  </select>
                </div>
                
                {/* 📅 Période */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Période
                  </label>
                  <select
                    value={filters.dateRange}
                    onChange={(e) => {
                      const params = new URLSearchParams(searchParams);
                      if (e.target.value) {
                        params.set('dateRange', e.target.value);
                      } else {
                        params.delete('dateRange');
                      }
                      params.set('page', '1');
                      navigate(`?${params.toString()}`);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Toutes les périodes</option>
                    <option value="today">Aujourd'hui</option>
                    <option value="week">Cette semaine</option>
                    <option value="month">Ce mois</option>
                    <option value="year">Cette année</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Formulaire de création */}
        {showCreateForm && (
          <div className="card mb-8">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold">Créer une nouvelle commande</h3>
            </div>
            <div className="p-6">
              <Form method="post" className="space-y-4">
                <input type="hidden" name="intent" value="create" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="customerId">ID Client</label>
                    <input 
                      id="customerId"
                      name="customerId" 
                      placeholder="ex: CUST-123"
                      className="input"
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="label" htmlFor="productName">Nom du Produit</label>
                    <input 
                      id="productName"
                      name="productName" 
                      placeholder="ex: Produit Test"
                      className="input"
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="label" htmlFor="quantity">Quantité</label>
                    <input 
                      id="quantity"
                      name="quantity" 
                      type="number"
                      min="1"
                      defaultValue="1"
                      className="input"
                      required 
                    />
                  </div>
                  
                  <div>
                    <label className="label" htmlFor="price">Prix unitaire (€)</label>
                    <input 
                      id="price"
                      name="price" 
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      className="input"
                      required 
                    />
                  </div>
                </div>
                
                <div>
                  <label className="label" htmlFor="notes">Notes (optionnel)</label>
                  <textarea 
                    id="notes"
                    name="notes" 
                    placeholder="Informations complémentaires..."
                    className="textarea"
                    rows={3}
                  />
                </div>
                
                <div className="flex space-x-3">
                  <button type="submit" className="btn btn-primary">
                    Créer la Commande
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-outline"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Annuler
                  </button>
                </div>
              </Form>
            </div>
          </div>
        )}

        {/* Indicateur filtre par défaut */}
        {filters.paymentStatus === '1' && !filters.search && !filters.orderStatus && !filters.dateRange && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">Filtre par défaut actif</p>
              <p className="text-sm text-green-700">Affichage uniquement des commandes payées et confirmées (hors statut "En attente"). Modifiez le filtre "Paiement" pour voir toutes les commandes.</p>
            </div>
          </div>
        )}

        {/* Liste des commandes */}
        <div className="card">
          <div className="p-6 border-b flex justify-between items-center">
            <h3 className="text-xl font-bold">Commandes ({stats.totalOrders} total)</h3>
            <div className="text-sm text-gray-600">
              Page {currentPage} sur {totalPages} · Affichage de {orders.length} commandes
            </div>
          </div>
          <div className="p-6">
            {orders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune commande trouvée
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-semibold text-gray-700">N° Commande</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Nom Prénom</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Contact</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Ville</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Montant</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Date</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Statut</th>
                      <th className="text-left p-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.ord_id} className="border-b hover:bg-gray-50 transition-colors">
                        {/* 1. N° Commande */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-sm font-medium text-blue-600">
                              {order.ord_id}
                            </div>
                            {order.ord_info && order.ord_info.toLowerCase().includes('ref') && (
                              <span 
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold"
                                title="Contient des références de pièces"
                              >
                                <Package className="w-3 h-3" />
                                REF
                              </span>
                            )}
                          </div>
                        </td>
                        
                        {/* 2. Nom Prénom */}
                        <td className="p-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">
                              {order.customerName || `Client #${order.ord_cst_id}`}
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              <a 
                                href={`/admin/users/${order.ord_cst_id}`}
                                className="text-blue-600 hover:underline"
                                title="Voir le profil client"
                              >
                                Voir profil →
                              </a>
                            </div>
                          </div>
                        </td>
                        
                        {/* 3. Contact */}
                        <td className="p-3">
                          <div className="space-y-1">
                            {order.customerEmail && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Mail className="w-3 h-3" />
                                <a 
                                  href={`mailto:${order.customerEmail}`}
                                  className="hover:text-blue-600 hover:underline truncate max-w-[150px]"
                                  title={order.customerEmail}
                                >
                                  {order.customerEmail}
                                </a>
                              </div>
                            )}
                            {(order.customer?.cst_tel || order.customer?.cst_gsm) && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Phone className="w-3 h-3" />
                                <a 
                                  href={`tel:${order.customer?.cst_tel || order.customer?.cst_gsm}`}
                                  className="hover:text-blue-600 hover:underline"
                                  title="Appeler"
                                >
                                  {order.customer?.cst_tel || order.customer?.cst_gsm}
                                </a>
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* 4. Ville */}
                        <td className="p-3">
                          <div className="space-y-0.5">
                            {order.customer?.cst_city && (
                              <div className="text-sm font-medium text-gray-900">
                                {order.customer.cst_city}
                              </div>
                            )}
                            {order.customer?.cst_zip_code && (
                              <div className="text-xs text-gray-500">
                                {order.customer.cst_zip_code}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        {/* 5. Montant */}
                        <td className="p-3">
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(parseFloat(order.ord_total_ttc))}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            TTC
                          </div>
                        </td>
                        
                        {/* 6. Date */}
                        <td className="p-3">
                          <div className="text-sm text-gray-900">
                            {new Date(order.ord_date).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {new Date(order.ord_date).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </td>
                        
                        {/* 7. Statut */}
                        <td className="p-3">
                          <div className="flex flex-col space-y-2">
                            {getOrderStatusBadge(order.ord_ords_id)}
                            {/* Badge de paiement affiché uniquement si non payé */}
                            {order.ord_is_pay === "0" && getPaymentBadge(order.ord_is_pay)}
                          </div>
                        </td>
                        
                        {/* 8. Actions - 🔐 Adaptatives selon permissions */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {/* 👁️ Voir - Tous les niveaux */}
                            <a 
                              href={`/orders/${order.ord_id}`}
                              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                              title="Voir les détails"
                            >
                              <Eye className="w-3 h-3" />
                              Voir
                            </a>
                            
                            {/* ℹ️ Infos - Tous les niveaux */}
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                              title="Voir adresses complètes"
                            >
                              <Info className="w-3 h-3" />
                              Infos
                            </button>
                            
                            {/* 🔐 ACTIONS RÉSERVÉES ADMIN (niveau 7+) */}
                            {permissions.showActionButtons && (
                              <>
                                {/* ✅ Valider (statut 2 → 3) */}
                                {permissions.canValidate && order.ord_ords_id === '2' && (
                                  <button
                                    onClick={() => handleValidateOrder(order.ord_id)}
                                    className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                                    title="Valider la commande et envoyer email"
                                  >
                                    <CheckCircle className="w-3 h-3" />
                                    Valider
                                  </button>
                                )}
                                
                                {/* 🚚 Expédier (statut 3 → 4) */}
                                {permissions.canShip && order.ord_ords_id === '3' && (
                                  <button
                                    onClick={() => {
                                      setActionOrderId(order.ord_id);
                                      setShipModalOpen(true);
                                    }}
                                    className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                                    title="Expédier et envoyer email avec suivi"
                                  >
                                    <Truck className="w-3 h-3" />
                                    Expédier
                                  </button>
                                )}
                                
                                {/* 📧 Rappel paiement (statut 1) */}
                                {permissions.canSendEmails && order.ord_ords_id === '1' && order.ord_is_pay === '0' && (
                                  <button
                                    onClick={() => handlePaymentReminder(order.ord_id)}
                                    className="text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                                    title="Envoyer rappel de paiement"
                                  >
                                    <Mail className="w-3 h-3" />
                                    Rappel
                                  </button>
                                )}
                                
                                {/* ❌ Annuler (tous sauf 5 et 6) */}
                                {permissions.canCancel && !['5', '6'].includes(order.ord_ords_id) && (
                                  <button
                                    onClick={() => {
                                      setActionOrderId(order.ord_id);
                                      setCancelModalOpen(true);
                                    }}
                                    className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors inline-flex items-center gap-1"
                                    title="Annuler la commande et envoyer email"
                                  >
                                    <Ban className="w-3 h-3" />
                                    Annuler
                                  </button>
                                )}
                              </>
                            )}
                            
                            {getAvailableActions(order).map((action) => (
                              <fetcher.Form method="post" key={action.intent} className="inline">
                                <input type="hidden" name="intent" value={action.intent} />
                                <input type="hidden" name="orderId" value={order.ord_id} />
                                <button
                                  type="submit"
                                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${action.color}`}
                                  disabled={fetcher.state !== "idle"}
                                >
                                  {action.label}
                                </button>
                              </fetcher.Form>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-6 border-t flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Page {currentPage} sur {totalPages}
              </div>
              <div className="flex space-x-2">
                {currentPage > 1 && (
                  <>
                    <button 
                      onClick={() => goToPage(1)}
                      className="btn btn-outline btn-sm"
                    >
                      ⏮️ Première
                    </button>
                    <button 
                      onClick={() => goToPage(currentPage - 1)}
                      className="btn btn-outline btn-sm"
                    >
                      ← Précédente
                    </button>
                  </>
                )}
                
                {/* Pages autour de la page actuelle */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const startPage = Math.max(1, currentPage - 2);
                  const pageNum = startPage + i;
                  if (pageNum > totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`btn btn-sm ${pageNum === currentPage ? 'btn-primary' : 'btn-outline'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {currentPage < totalPages && (
                  <>
                    <button 
                      onClick={() => goToPage(currentPage + 1)}
                      className="btn btn-outline btn-sm"
                    >
                      Suivante →
                    </button>
                    <button 
                      onClick={() => goToPage(totalPages)}
                      className="btn btn-outline btn-sm"
                    >
                      ⏭️ Dernière
                    </button>
                  </>
                )}
              </div>
              <div className="text-sm text-gray-500">
                25 commandes par page
              </div>
            </div>
          )}
        </div>

        {/* Modal informations complètes de la commande */}
        {selectedOrder && (
          <div className="modal" onClick={() => setSelectedOrder(null)}>
            <div className="modal-content max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Info className="w-6 h-6 text-blue-600" />
                    Informations Commande #{selectedOrder.ord_id}
                  </h3>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedOrder(null)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Informations générales */}
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                      <div className="text-xs text-blue-600 uppercase font-semibold mb-2">💰 Montant Total</div>
                      <div className="text-3xl font-bold text-blue-900">{formatCurrency(parseFloat(selectedOrder.ord_total_ttc))}</div>
                      <div className="text-sm text-blue-700 mt-1">TTC</div>
                    </div>

                    <div className="border-b pb-3">
                      <div className="text-xs text-gray-500 uppercase mb-2 font-semibold">📅 Date de commande</div>
                      <div className="font-medium">{formatDate(selectedOrder.ord_date)}</div>
                    </div>

                    <div className="border-b pb-3">
                      <div className="text-xs text-gray-500 uppercase mb-2 font-semibold">📊 Statut</div>
                      {getOrderStatusBadge(selectedOrder.ord_ords_id)}
                    </div>

                    <div className="border-b pb-3">
                      <div className="text-xs text-gray-500 uppercase mb-2 font-semibold">💳 Paiement</div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          selectedOrder.ord_is_pay === "1"
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {selectedOrder.ord_is_pay === "1" ? '✅ Payé' : '⏳ En attente'}
                        </span>
                      </div>
                    </div>

                    {selectedOrder.ord_info && (
                      <div>
                        <div className="text-xs text-gray-500 uppercase mb-2 font-semibold flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Informations sur les pièces
                        </div>
                        <div className="mt-1 border border-blue-200 bg-blue-50 rounded-lg overflow-hidden">
                          <div className="space-y-0">
                            {selectedOrder.ord_info.split('<br>').filter(line => line.trim()).map((line, idx) => {
                              const parts = line.split(':').map(p => p.trim());
                              const label = parts[0];
                              const value = parts.slice(1).join(':').trim();
                              
                              // Mise en évidence spéciale pour les références
                              const isReference = label.toLowerCase().includes('ref') || 
                                                 label.toLowerCase().includes('référence') ||
                                                 label.toLowerCase().includes('immatriculation') ||
                                                 label.toLowerCase().includes('vin') ||
                                                 label.toLowerCase().includes('chassis');
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={`px-4 py-2.5 flex border-b border-blue-100 last:border-b-0 ${
                                    isReference ? 'bg-gradient-to-r from-blue-100 to-blue-50' : 'bg-white'
                                  }`}
                                >
                                  <div className={`font-semibold min-w-[180px] ${
                                    isReference ? 'text-blue-900' : 'text-gray-700'
                                  }`}>
                                    {isReference && <span className="mr-1">📋</span>}
                                    {label}
                                  </div>
                                  <div className={`flex-1 ${
                                    isReference 
                                      ? 'font-mono font-bold text-blue-800 text-base' 
                                      : value.toLowerCase() === 'non' 
                                        ? 'text-gray-500 italic'
                                        : 'text-gray-900'
                                  }`}>
                                    {value || <span className="text-gray-400 italic">Non renseigné</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Informations Client et Adresses */}
                  <div className="space-y-4">
                    {/* Info Client */}
                    <div className="border rounded-lg p-4 bg-gradient-to-br from-gray-50 to-white">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="w-5 h-5 text-gray-600" />
                        <h4 className="font-semibold text-gray-900">Informations Client</h4>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs text-gray-500">Nom</div>
                          <div className="font-medium">{selectedOrder.customerName || `Client #${selectedOrder.ord_cst_id}`}</div>
                        </div>
                        {selectedOrder.customerEmail && (
                          <div>
                            <div className="text-xs text-gray-500">Email</div>
                            <div className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-gray-400" />
                              <a href={`mailto:${selectedOrder.customerEmail}`} className="text-blue-600 hover:underline text-sm">
                                {selectedOrder.customerEmail}
                              </a>
                            </div>
                          </div>
                        )}
                        {(selectedOrder.customer?.cst_tel || selectedOrder.customer?.cst_gsm) && (
                          <div>
                            <div className="text-xs text-gray-500">Téléphone</div>
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-gray-400" />
                              <a href={`tel:${selectedOrder.customer?.cst_tel || selectedOrder.customer?.cst_gsm}`} className="text-blue-600 hover:underline text-sm">
                                {selectedOrder.customer?.cst_tel || selectedOrder.customer?.cst_gsm}
                              </a>
                            </div>
                          </div>
                        )}
                        <div className="pt-2 border-t">
                          <a 
                            href={`/admin/users/${selectedOrder.ord_cst_id}`}
                            className="text-xs text-blue-600 hover:underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Voir le profil complet →
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Adresse du client */}
                    {selectedOrder.customer && (selectedOrder.customer.cst_address || selectedOrder.customer.cst_city) && (
                      <div className="border rounded-lg p-4 bg-gradient-to-br from-green-50 to-white">
                        <div className="flex items-center gap-2 mb-3">
                          <MapPin className="w-5 h-5 text-green-600" />
                          <h4 className="font-semibold text-gray-900">Adresse Client</h4>
                        </div>
                        <div className="space-y-1 text-sm">
                          {selectedOrder.customer.cst_address && (
                            <div className="text-gray-700">{selectedOrder.customer.cst_address}</div>
                          )}
                          <div className="text-gray-700">
                            {selectedOrder.customer.cst_zip_code} {selectedOrder.customer.cst_city}
                          </div>
                          {selectedOrder.customer.cst_country && (
                            <div className="text-gray-600">{selectedOrder.customer.cst_country}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions de traitement */}
                <div className="border-t pt-4 mt-6">
                  <div className="text-sm font-semibold mb-3">Actions disponibles</div>
                  <div className="flex flex-col space-y-2">
                    <a 
                      href={`/orders/${selectedOrder.ord_id}`}
                      className="btn btn-primary w-full"
                    >
                      📋 Voir les détails complets
                    </a>
                    
                    {selectedOrder.ord_is_pay === "0" && (
                      <Form method="post" className="w-full">
                        <input type="hidden" name="intent" value="updateStatus" />
                        <input type="hidden" name="orderId" value={selectedOrder.ord_id} />
                        <input type="hidden" name="status" value="confirmed" />
                        <button 
                          type="submit" 
                          className="btn btn-outline w-full"
                        >
                          ✅ Confirmer la commande
                        </button>
                      </Form>
                    )}
                    
                    <Form method="post" className="w-full">
                      <input type="hidden" name="intent" value="updateStatus" />
                      <input type="hidden" name="orderId" value={selectedOrder.ord_id} />
                      <input type="hidden" name="status" value="processing" />
                      <button 
                        type="submit" 
                        className="btn btn-outline w-full"
                      >
                        ⚙️ Mettre en traitement
                      </button>
                    </Form>
                    
                    <button 
                      className="btn btn-outline w-full"
                      onClick={() => setSelectedOrder(null)}
                    >
                      ❌ Fermer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* � Modals - Réservées Admin avec permissions d'envoi d'emails */}
        {permissions.canSendEmails && (
          <>
            {/* �📦 Modal Expédition */}
            {shipModalOpen && (
              <div className="modal" onClick={() => setShipModalOpen(false)}>
            <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Truck className="w-6 h-6 text-blue-600" />
                    Expédier la commande
                  </h3>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => setShipModalOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de suivi *
                    </label>
                    <input
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="FR1234567890"
                      autoFocus
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Le client recevra un email avec ce numéro de suivi
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleShipOrder}
                      disabled={!trackingNumber.trim() || isLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? '⏳ Envoi...' : '📦 Confirmer l\'expédition'}
                    </button>
                    <button
                      onClick={() => {
                        setShipModalOpen(false);
                        setTrackingNumber('');
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* ❌ Modal Annulation */}
        {cancelModalOpen && (
          <div className="modal" onClick={() => setCancelModalOpen(false)}>
            <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Ban className="w-6 h-6 text-red-600" />
                    Annuler la commande
                  </h3>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => setCancelModalOpen(false)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      ⚠️ Cette action est irréversible. Le client sera notifié par email.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Raison de l'annulation *
                    </label>
                    <textarea
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      placeholder="Ex: Produit temporairement indisponible"
                      rows={3}
                      autoFocus
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Cette raison sera communiquée au client dans l'email
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelOrder}
                      disabled={!cancelReason.trim() || isLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoading ? '⏳ Annulation...' : '❌ Confirmer l\'annulation'}
                    </button>
                    <button
                      onClick={() => {
                        setCancelModalOpen(false);
                        setCancelReason('');
                      }}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                    >
                      Fermer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
