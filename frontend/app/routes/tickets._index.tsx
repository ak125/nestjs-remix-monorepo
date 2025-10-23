/**
 * Page de gestion des tickets - Liste et recherche
 * Remix Route Component pour la gestion des tickets de support
 */
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { Link, useLoaderData, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import { getAllTickets, searchTickets, getContactStats, type ContactTicket, type ContactStats } from "../services/api/contact.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Tickets - Support Client" },
    { name: "description", content: "Liste et gestion des tickets de support client" },
  ];
};

interface LoaderData {
  tickets: ContactTicket[];
  stats: ContactStats;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const status = url.searchParams.get("status") as 'open' | 'closed' | 'all' || 'all';
  const keyword = url.searchParams.get("keyword");

  try {
    let ticketsData;
    
    if (keyword) {
      // Recherche avec critères
      ticketsData = await searchTickets(
        { keyword },
        { page, limit },
        request
      );
    } else {
      // Liste normale avec filtres
      ticketsData = await getAllTickets(
        { page, limit, status },
        request
      );
    }

    const stats = await getContactStats(request);

    return json<LoaderData>({
      tickets: ticketsData.tickets,
      stats,
      pagination: {
        total: ticketsData.total,
        page: ticketsData.page,
        limit: ticketsData.limit,
        totalPages: Math.ceil(ticketsData.total / ticketsData.limit),
      },
    });
  } catch (error) {
    console.error("Erreur lors du chargement des tickets:", error);
    return json<LoaderData>({
      tickets: [],
      stats: { 
        total_tickets: 0, 
        open_tickets: 0, 
        closed_tickets: 0, 
        tickets_last_24h: 0 
      },
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  }
}

export default function TicketsPage() {
  const { tickets, stats, pagination } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get("keyword") || "");

  const currentStatus = searchParams.get("status") || "all";
  const currentPage = parseInt(searchParams.get("page") || "1");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchTerm) {
      newParams.set("keyword", searchTerm);
    } else {
      newParams.delete("keyword");
    }
    newParams.set("page", "1"); // Reset à la première page
    setSearchParams(newParams);
  };

  const handleStatusFilter = (status: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("status", status);
    newParams.set("page", "1");
    setSearchParams(newParams);
  };

  const handlePageChange = (page: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("page", page.toString());
    setSearchParams(newParams);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
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

  const getStatusColor = (isOpen: string) => {
    return isOpen === '1' ? 'success' : "bg-gray-100 text-gray-800";
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Tickets</h1>
          <Button className="px-4 py-2   rounded-md" variant="blue" asChild><Link to="/contact">Nouveau ticket</Link></Button>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Alert intent="info"><p className="text-sm text-blue-600">Total tickets</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total_tickets}</p></Alert>
          <Alert intent="success"><p className="text-sm text-green-600">Ouverts</p>
            <p className="text-2xl font-bold text-green-900">{stats.open_tickets}</p></Alert>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Fermés</p>
            <p className="text-2xl font-bold text-gray-900">{stats.closed_tickets}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600">24h</p>
            <p className="text-2xl font-bold text-orange-900">{stats.tickets_last_24h}</p>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          {/* Recherche */}
          <form onSubmit={handleSearch} className="flex gap-2 w-full lg:w-auto">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher dans les tickets..."
              className="flex-1 lg:w-80 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button className="px-4 py-2  rounded-md" variant="blue" type="submit">\n  Rechercher\n</Button>
          </form>

          {/* Filtres par statut */}
          <div className="flex gap-2">
            {[
              { value: "all", label: "Tous" },
              { value: "open", label: "Ouverts" },
              { value: "closed", label: "Fermés" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => handleStatusFilter(filter.value)}
                className={`px-3 py-1 text-sm rounded-md ${
                  currentStatus === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-gray-200 text-gray-700 hover:bg-muted/50"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Liste des tickets */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Aucun ticket trouvé.</p>
            <Button className="inline-block mt-4 px-4 py-2  rounded-md" variant="blue" asChild><Link to="/contact">Créer le premier ticket</Link></Button>
          </div>
        ) : (
          <>
            {/* En-têtes */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 text-sm font-medium text-gray-500 uppercase tracking-wider">
                <div>ID</div>
                <div className="md:col-span-2">Sujet</div>
                <div>Client</div>
                <div>Priorité</div>
                <div>Statut</div>
                <div>Date</div>
              </div>
            </div>

            {/* Lignes */}
            <div className="divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.msg_id}
                  to={`/tickets/${ticket.msg_id}`}
                  className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-center">
                    <div className="text-sm font-medium text-blue-600">
                      #{ticket.msg_id}
                    </div>
                    
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {ticket.msg_subject}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {ticket.msg_content.substring(0, 100)}...
                      </p>
                    </div>
                    
                    <div className="text-sm text-gray-900">
                      {ticket.customer ? (
                        <div>
                          <p>{ticket.customer.cst_name} {ticket.customer.cst_fname}</p>
                          <p className="text-xs text-gray-500">{ticket.customer.cst_mail}</p>
                        </div>
                      ) : (
                        <span className="text-gray-500">Client #{ticket.msg_cst_id}</span>
                      )}
                    </div>
                    
                    <div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(ticket.priority || "normal")}`}>
                        {ticket.priority || "normal"}
                      </span>
                    </div>
                    
                    <div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ticket.msg_open)}`}>
                        {ticket.msg_open === "1" ? "Ouvert" : "Fermé"}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-500">
                      {formatDate(ticket.msg_date)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Affichage de {(currentPage - 1) * pagination.limit + 1} à{" "}
            {Math.min(currentPage * pagination.limit, pagination.total)} sur{" "}
            {pagination.total} tickets
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Précédent
            </button>
            
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(page => 
                page === 1 || 
                page === pagination.totalPages || 
                Math.abs(page - currentPage) <= 2
              )
              .map((page, index, array) => (
                <div key={page} className="flex items-center">
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <span className="px-2 text-gray-500">...</span>
                  )}
                  <button
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-2 text-sm border rounded-md ${
                      currentPage === page
                        ? "bg-primary text-primary-foreground border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {page}
                  </button>
                </div>
              ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === pagination.totalPages}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
