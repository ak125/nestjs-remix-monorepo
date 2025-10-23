/**
 * Page Messages - Gestion de la messagerie client/staff
 * Utilise la table ___xtr_msg avec Context7
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { useLoaderData, Link, Form, useNavigation } from "@remix-run/react";
import { 
  MessageSquare, 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  Search,
  Filter,
  Mail,
  User,
  Calendar,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import { useState } from "react";
import { requireAdmin } from "../auth/unified.server";

// Interfaces pour les messages
interface Message {
  msg_id: string;
  msg_cst_id: string;
  msg_cnfa_id: string;
  msg_ord_id?: string;
  msg_orl_id?: string;
  msg_date: string;
  msg_subject: string;
  msg_content: string;
  msg_parent_id?: string;
  msg_open: '0' | '1';
  msg_close: '0' | '1';
  customer?: {
    cst_name: string;
    cst_fname: string;
    cst_mail: string;
  };
  staff?: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface MessageData {
  messages: Message[];
  total: number;
  page: number;
  totalPages: number;
  stats: {
    total: number;
    open: number;
    closed: number;
  };
  error?: string;
  fallbackMode?: boolean;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await requireAdmin({ context });
  
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  const formData = await request.formData();
  const action = formData.get('action');
  const messageId = formData.get('messageId');

  if (action === 'close' && messageId) {
    try {
      const response = await fetch(`http://localhost:3000/api/messages/${messageId}/close`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        console.log(`✅ Message ${messageId} fermé avec succès`);
      } else {
        console.error(`❌ Erreur fermeture message ${messageId}:`, response.status);
      }
    } catch (error) {
      console.error(`❌ Erreur réseau fermeture message:`, error);
    }
  }

  return redirect('/admin/messages');
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAdmin({ context });
  
  // Vérifier les permissions admin
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const staffFilter = url.searchParams.get('staff');
  const customerFilter = url.searchParams.get('customer');
  const statusFilter = url.searchParams.get('status') || 'all';

  try {
    console.log('📧 Chargement messages depuis l\'API...');
    
    // Construction de l'URL API avec filtres
    const apiUrl = new URL('http://localhost:3000/api/messages');
    apiUrl.searchParams.set('page', page.toString());
    apiUrl.searchParams.set('limit', limit.toString());
    
    if (staffFilter) {
      apiUrl.searchParams.set('staff', staffFilter);
    }
    if (customerFilter) {
      apiUrl.searchParams.set('customer', customerFilter);
    }
    if (statusFilter !== 'all') {
      apiUrl.searchParams.set('status', statusFilter);
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const [messagesResponse, statsResponse] = await Promise.all([
      fetch(apiUrl.toString(), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      }),
      fetch('http://localhost:3000/api/messages/stats/overview', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      })
    ]);

    clearTimeout(timeoutId);

    if (messagesResponse.ok && statsResponse.ok) {
      const messagesData = await messagesResponse.json();
      const statsData = await statsResponse.json();
      
      console.log(`✅ ${messagesData.messages?.length || 0} messages récupérés`);
      
      return json({
        messages: messagesData.messages || [],
        total: messagesData.total || 0,
        page: messagesData.page || 1,
        totalPages: messagesData.totalPages || 1,
        stats: statsData || { total: 0, open: 0, closed: 0 },
        fallbackMode: false,
      } as MessageData);
    } else {
      console.error('❌ Erreur API messages:', messagesResponse.status, statsResponse.status);
      
      return json({
        messages: [],
        total: 0,
        page: 1,
        totalPages: 1,
        stats: { total: 0, open: 0, closed: 0 },
        error: `Erreur API (${messagesResponse.status})`,
        fallbackMode: true,
      } as MessageData);
    }
  } catch (error: any) {
    console.error('❌ Erreur lors du chargement des messages:', error);
    
    return json({
      messages: [],
      total: 0,
      page: 1,
      totalPages: 1,
      stats: { total: 0, open: 0, closed: 0 },
      error: 'Erreur de connexion à l\'API messages',
      fallbackMode: true,
    } as MessageData);
  }
}

export default function AdminMessages() {
  const { messages, total, page, totalPages, stats, error, fallbackMode } = useLoaderData<MessageData>();
  const _navigation = useNavigation();
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (message: Message) => {
    if (message.msg_close === '1') return 'error';
    if (message.msg_open === '1') return 'success';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusText = (message: Message) => {
    if (message.msg_close === '1') return 'Fermé';
    if (message.msg_open === '1') return 'Ouvert';
    return 'En attente';
  };

  const getStatusIcon = (message: Message) => {
    if (message.msg_close === '1') return <XCircle className="h-4 w-4" />;
    if (message.msg_open === '1') return <CheckCircle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link 
                to="/admin/staff" 
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
              >
                <ArrowLeft className="h-5 w-5" />
                Retour Staff
              </Link>
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Messagerie Client/Staff</h1>
            </div>
            <p className="text-gray-600">
              Communication depuis la table ___xtr_msg avec Context7
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              <Filter className="h-4 w-4" />
              Filtres
            </button>
            <Link 
              to="/admin/messages/new" 
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Send className="h-4 w-4" />
              Nouveau Message
            </Link>
          </div>
        </div>
      </div>

      {/* Indicateur de source */}
      <div className={`mb-6 p-4 rounded-lg border-l-4 ${
        fallbackMode ? 'border-yellow-400 bg-yellow-50' : 'border-green-400 bg-green-50'
      }`}>
        <div className="flex items-center gap-2">
          {fallbackMode ? (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          ) : (
            <MessageSquare className="h-5 w-5 text-green-600" />
          )}
          <span className="font-medium">
            {fallbackMode 
              ? 'Mode fallback - API messages indisponible' 
              : 'Messages en temps réel depuis table ___xtr_msg'}
          </span>
        </div>
      </div>

      {/* Erreur */}
      {error && (
<Alert className="mb-6 p-4    rounded-lg" variant="error">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">{error}</span>
          </div>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Messages</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500">Depuis table ___xtr_msg</p>
            </div>
            <MessageSquare className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Messages Ouverts</p>
              <p className="text-2xl font-bold text-green-900">{stats.open}</p>
              <p className="text-xs text-gray-500">En cours de traitement</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Messages Fermés</p>
              <p className="text-2xl font-bold text-red-900">{stats.closed}</p>
              <p className="text-xs text-gray-500">Résolus</p>
            </div>
            <XCircle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Taux de Résolution</p>
              <p className="text-2xl font-bold text-blue-900">
                {stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0}%
              </p>
              <p className="text-xs text-gray-500">Messages traités</p>
            </div>
            <Clock className="h-8 w-8 text-blue-500" />
          </div>
        </div>
      </div>

      {/* Filtres (conditionnel) */}
      {showFilters && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <Form method="get" className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Staff
              </label>
              <input
                type="text"
                name="staff"
                placeholder="ID du staff"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client
              </label>
              <input
                type="text"
                name="customer"
                placeholder="ID du client"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                name="status"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                <option value="open">Ouverts</option>
                <option value="closed">Fermés</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button className="w-full px-4 py-2  rounded-md flex items-center justify-center gap-2" variant="blue" type="submit">
                <Search className="h-4 w-4" />
                Filtrer
              </Button>
            </div>
          </Form>
        </div>
      )}

      {/* Liste des messages */}
      <div className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Messages Client/Staff
              </h2>
              <p className="text-gray-600">
                {total} messages trouvés - Page {page}/{totalPages}
              </p>
            </div>
            <div className="flex items-center gap-2 text-blue-600">
              <Mail className="h-4 w-4" />
              <span className="text-sm">Table ___xtr_msg</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
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
              {messages.map((message) => (
                <tr key={message.msg_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {message.msg_subject}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {message.msg_content}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        ID: {message.msg_id}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {message.customer 
                            ? `${message.customer.cst_fname} ${message.customer.cst_name}`
                            : 'Client inconnu'
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          {message.customer?.cst_mail || message.msg_cst_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Users className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {message.staff 
                            ? `${message.staff.firstName} ${message.staff.lastName}`
                            : 'Staff inconnu'
                          }
                        </div>
                        <div className="text-sm text-gray-500">
                          {message.staff?.email || message.msg_cnfa_id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {formatDate(message.msg_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(message)}`}>
                      {getStatusIcon(message)}
                      {getStatusText(message)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedMessage(message)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Voir
                      </button>
                      {message.msg_open === '1' && (
                        <Form method="post" className="inline">
                          <input type="hidden" name="action" value="close" />
                          <input type="hidden" name="messageId" value={message.msg_id} />
                          <button
                            type="submit"
                            className="text-red-600 hover:text-red-900"
                          >
                            Fermer
                          </button>
                        </Form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {messages.length === 0 && (
            <div className="text-center py-12">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Aucun message trouvé</h3>
              <p className="mt-1 text-sm text-gray-500">
                Aucune communication client/staff n'a été trouvée.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Page {page} sur {totalPages} - {total} messages au total
              </div>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    to={`?page=${page - 1}`}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Précédent
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    to={`?page=${page + 1}`}
                    className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Suivant
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de détail du message */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Détail du Message
              </h3>
              <button
                onClick={() => setSelectedMessage(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="font-medium text-gray-700">Sujet:</span>
                <p className="text-gray-900">{selectedMessage.msg_subject}</p>
              </div>
              
              <div>
                <span className="font-medium text-gray-700">Contenu:</span>
                <div className="bg-gray-50 p-3 rounded border mt-1">
                  <p className="text-gray-900 whitespace-pre-wrap">
                    {selectedMessage.msg_content}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Client:</span>
                  <p className="text-gray-900">
                    {selectedMessage.customer 
                      ? `${selectedMessage.customer.cst_fname} ${selectedMessage.customer.cst_name}`
                      : selectedMessage.msg_cst_id
                    }
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Staff:</span>
                  <p className="text-gray-900">
                    {selectedMessage.staff 
                      ? `${selectedMessage.staff.firstName} ${selectedMessage.staff.lastName}`
                      : selectedMessage.msg_cnfa_id
                    }
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Date:</span>
                  <p className="text-gray-900">{formatDate(selectedMessage.msg_date)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Statut:</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(selectedMessage)}`}>
                    {getStatusIcon(selectedMessage)}
                    {getStatusText(selectedMessage)}
                  </span>
                </div>
              </div>
              
              {selectedMessage.msg_ord_id && (
                <div>
                  <span className="font-medium text-gray-700">Commande:</span>
                  <p className="text-gray-900">{selectedMessage.msg_ord_id}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
