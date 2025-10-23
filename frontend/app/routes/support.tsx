/**
 * Dashboard Support - Vue d'ensemble des tickets et statistiques
 * Page principale pour la gestion du support client
 */
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { Link, useLoaderData } from "@remix-run/react";
import { getAllTickets, getContactStats, type ContactTicket, type ContactStats } from "../services/api/contact.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard Support - Gestion Client" },
    { name: "description", content: "Dashboard principal pour la gestion du support client" },
  ];
};

interface LoaderData {
  stats: ContactStats;
  recentTickets: ContactTicket[];
  urgentTickets: ContactTicket[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const [stats, recentTicketsData, urgentTicketsData] = await Promise.all([
      getContactStats(request),
      getAllTickets({ limit: 5, status: 'all' }, request),
      getAllTickets({ limit: 10, status: 'open' }, request)
    ]);

    // Filtrer les tickets urgents
    const urgentTickets = urgentTicketsData.tickets.filter(
      ticket => ticket.priority === 'urgent' || ticket.priority === 'high'
    );

    return json<LoaderData>({
      stats,
      recentTickets: recentTicketsData.tickets,
      urgentTickets: urgentTickets.slice(0, 5),
    });
  } catch (error) {
    console.error("Erreur lors du chargement du dashboard:", error);
    return json<LoaderData>({
      stats: { 
        total_tickets: 0, 
        open_tickets: 0, 
        closed_tickets: 0, 
        tickets_last_24h: 0 
      },
      recentTickets: [],
      urgentTickets: [],
    });
  }
}

export default function SupportDashboard() {
  const { stats, recentTickets, urgentTickets } = useLoaderData<typeof loader>();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return 'error';
      case "high": return 'orange';
      case "normal": return 'info';
      case "low": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const calculateResolutionRate = () => {
    if (stats.total_tickets === 0) return 0;
    return Math.round((stats.closed_tickets / stats.total_tickets) * 100);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Support</h1>
            <p className="text-gray-600 mt-1">Vue d'ensemble de l'activité support client</p>
          </div>
          <Button className="px-4 py-2   rounded-md" variant="blue" asChild><Link to="/contact">Nouveau ticket</Link></Button>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-6a2 2 0 00-2 2v3a2 2 0 002 2h6V13z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total tickets</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_tickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success/10 rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tickets ouverts</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.open_tickets}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Dernières 24h</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.tickets_last_24h}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Taux de résolution</p>
              <p className="text-2xl font-semibold text-gray-900">{calculateResolutionRate()}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Tickets urgents */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Tickets prioritaires</h2>
              <Link 
                to="/tickets?status=open"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Voir tous →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {urgentTickets.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucun ticket urgent</p>
            ) : (
              <div className="space-y-4">
                {urgentTickets.map((ticket) => (
                  <Link
                    key={ticket.msg_id}
                    to={`/tickets/${ticket.msg_id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-blue-600">
                            #{ticket.msg_id}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(ticket.priority || "normal")}`}>
                            {ticket.priority || "normal"}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {ticket.msg_subject}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          Client #{ticket.msg_cst_id} • {formatDate(ticket.msg_date)}
                        </p>
                      </div>
                      <div className="ml-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          ticket.msg_open === '1' ? 'success' : "bg-gray-100 text-gray-800"
                        }`}>
                          {ticket.msg_open === "1" ? "Ouvert" : "Fermé"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tickets récents */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Tickets récents</h2>
              <Link 
                to="/tickets"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Voir tous →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentTickets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Aucun ticket trouvé</p>
                <Button className="px-4 py-2  text-sm  rounded-md" variant="blue" asChild><Link to="/contact">Créer le premier ticket</Link></Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTickets.map((ticket) => (
                  <Link
                    key={ticket.msg_id}
                    to={`/tickets/${ticket.msg_id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-blue-600">
                            #{ticket.msg_id}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(ticket.priority || "normal")}`}>
                            {ticket.priority || "normal"}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {ticket.msg_subject}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 truncate">
                          {ticket.msg_content.substring(0, 60)}...
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(ticket.msg_date)}
                        </p>
                      </div>
                      <div className="ml-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          ticket.msg_open === '1' ? 'success' : "bg-gray-100 text-gray-800"
                        }`}>
                          {ticket.msg_open === "1" ? "Ouvert" : "Fermé"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/contact"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Nouveau ticket</p>
              <p className="text-xs text-gray-500">Créer un ticket de support</p>
            </div>
          </Link>

          <Link
            to="/tickets?status=open"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <div className="w-8 h-8 bg-success/10 rounded-md flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Tickets ouverts</p>
              <p className="text-xs text-gray-500">Gérer les tickets en cours</p>
            </div>
          </Link>

          <Link
            to="/tickets"
            className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Rechercher</p>
              <p className="text-xs text-gray-500">Rechercher dans tous les tickets</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
