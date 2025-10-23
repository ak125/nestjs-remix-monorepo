/**
 * Dashboard Support Étendu - Vue d'ensemble complète
 * Dashboard principal avec tous les services de support
 */
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { Link, useLoaderData } from "@remix-run/react";
import { 
  MessageSquare, 
  Star, 
  HelpCircle, 
  FileText, 
  Receipt, 
  AlertTriangle,
  TrendingUp,
  Users,
  Clock,
  CheckCircle
} from "lucide-react";
import { getAllTickets, getContactStats } from "../services/api/contact.api";
import { getReviewStats } from "../services/api/review.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Dashboard Support Complet - Gestion Client" },
    { name: "description", content: "Dashboard principal pour tous les services de support client" },
  ];
};

interface LoaderData {
  contactStats: any;
  reviewStats: any;
  recentTickets: any[];
  recentReviews: any[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const [contactStats, reviewStats, recentTicketsData] = await Promise.all([
      getContactStats(request).catch(() => ({ 
        total_tickets: 0, 
        open_tickets: 0, 
        closed_tickets: 0, 
        tickets_last_24h: 0 
      })),
      getReviewStats(request).catch(() => ({ 
        total_reviews: 0, 
        pending_reviews: 0, 
        approved_reviews: 0, 
        average_rating: 0,
        rating_distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
      })),
      getAllTickets({ limit: 5, status: 'all' }, request).catch(() => ({ tickets: [] }))
    ]);

    return json<LoaderData>({
      contactStats,
      reviewStats,
      recentTickets: recentTicketsData.tickets || [],
      recentReviews: [], // À implémenter avec l'API reviews
    });
  } catch (error) {
    console.error("Erreur lors du chargement du dashboard:", error);
    return json<LoaderData>({
      contactStats: { 
        total_tickets: 0, 
        open_tickets: 0, 
        closed_tickets: 0, 
        tickets_last_24h: 0 
      },
      reviewStats: { 
        total_reviews: 0, 
        pending_reviews: 0, 
        approved_reviews: 0, 
        average_rating: 0,
        rating_distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
      },
      recentTickets: [],
      recentReviews: [],
    });
  }
}

export default function ExtendedSupportDashboard() {
  const { contactStats, reviewStats, recentTickets } = useLoaderData<typeof loader>();

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
      case "urgent": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "normal": return "bg-blue-100 text-blue-800";
      case "low": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
        }`}
      />
    ));
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard Support Complet</h1>
            <p className="text-gray-600 mt-1">Centre de contrôle pour tous les services de support client</p>
          </div>
          <div className="flex gap-3">
            <Button className="px-4 py-2   rounded-md" variant="blue" asChild><Link to="/contact">Nouveau ticket</Link></Button>
            <Button className="px-4 py-2   rounded-md" variant="green" asChild><Link to="/reviews/create">Nouvel avis</Link></Button>
          </div>
        </div>
      </div>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Tickets */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tickets Support</p>
              <p className="text-2xl font-semibold text-gray-900">{contactStats.total_tickets}</p>
              <p className="text-sm text-green-600">{contactStats.open_tickets} ouverts</p>
            </div>
          </div>
        </div>

        {/* Avis clients */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-md flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avis Clients</p>
              <p className="text-2xl font-semibold text-gray-900">{reviewStats.total_reviews}</p>
              <div className="flex items-center">
                {renderStars(Math.round(reviewStats.average_rating))}
                <span className="ml-1 text-sm text-gray-600">
                  {reviewStats.average_rating.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-md flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Base de Connaissances</p>
              <p className="text-2xl font-semibold text-gray-900">125</p>
              <p className="text-sm text-gray-600">Articles disponibles</p>
            </div>
          </div>
        </div>

        {/* Activité globale */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-md flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Activité 24h</p>
              <p className="text-2xl font-semibold text-gray-900">{contactStats.tickets_last_24h}</p>
              <p className="text-sm text-gray-600">Nouvelles demandes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services disponibles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Services principaux */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Services de Support</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4">
              <Link
                to="/tickets"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <MessageSquare className="w-8 h-8 text-blue-600 mr-4" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Support Technique</h3>
                  <p className="text-xs text-gray-500">Gestion des tickets et demandes</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600">{contactStats.open_tickets}</p>
                  <p className="text-xs text-gray-500">En cours</p>
                </div>
              </Link>

              <Link
                to="/reviews"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Star className="w-8 h-8 text-yellow-600 mr-4" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Avis Clients</h3>
                  <p className="text-xs text-gray-500">Évaluations et commentaires</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-yellow-600">{reviewStats.pending_reviews}</p>
                  <p className="text-xs text-gray-500">À modérer</p>
                </div>
              </Link>

              <Link
                to="/faq"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <HelpCircle className="w-8 h-8 text-green-600 mr-4" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Base de Connaissances</h3>
                  <p className="text-xs text-gray-500">FAQ et guides d'aide</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">125</p>
                  <p className="text-xs text-gray-500">Articles</p>
                </div>
              </Link>

              <Link
                to="/quotes"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Receipt className="w-8 h-8 text-indigo-600 mr-4" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Demandes de Devis</h3>
                  <p className="text-xs text-gray-500">Devis personnalisés</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-indigo-600">12</p>
                  <p className="text-xs text-gray-500">En attente</p>
                </div>
              </Link>

              <Link
                to="/claims"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <AlertTriangle className="w-8 h-8 text-red-600 mr-4" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Réclamations</h3>
                  <p className="text-xs text-gray-500">Gestion des litiges</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-red-600">3</p>
                  <p className="text-xs text-gray-500">Actives</p>
                </div>
              </Link>

              <Link
                to="/legal"
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-8 h-8 text-gray-600 mr-4" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Documents Légaux</h3>
                  <p className="text-xs text-gray-500">CGV, mentions légales</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-600">8</p>
                  <p className="text-xs text-gray-500">Documents</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Activité Récente</h2>
              <Link 
                to="/tickets"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Voir tout →
              </Link>
            </div>
          </div>
          <div className="p-6">
            {recentTickets.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">Aucune activité récente</p>
                <Button className="px-4 py-2  text-sm  rounded-md" variant="blue" asChild><Link to="/contact">Créer le premier ticket</Link></Button>
              </div>
            ) : (
              <div className="space-y-4">
                {recentTickets.slice(0, 5).map((ticket) => (
                  <Link
                    key={ticket.msg_id}
                    to={`/tickets/${ticket.msg_id}`}
                    className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
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
                          {formatDate(ticket.msg_date)}
                        </p>
                      </div>
                      <div className="ml-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          ticket.msg_open === "1" 
                            ? "bg-green-100 text-green-800" 
                            : "bg-gray-100 text-gray-800"
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

      {/* Métriques de performance */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Métriques de Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">2.4h</p>
            <p className="text-sm text-gray-600">Temps de réponse moyen</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">96%</p>
            <p className="text-sm text-gray-600">Taux de résolution</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mx-auto mb-3">
              <Users className="w-6 h-6 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">4.2/5</p>
            <p className="text-sm text-gray-600">Satisfaction client</p>
          </div>
          
          <div className="text-center">
            <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">+12%</p>
            <p className="text-sm text-gray-600">Croissance mensuelle</p>
          </div>
        </div>
      </div>
    </div>
  );
}
