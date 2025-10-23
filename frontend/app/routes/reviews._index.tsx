/**
 * Page Gestion des Avis Clients
 * Interface complète pour la modération et gestion des avis
 */
import { Badge } from "@fafa/ui";
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { Form, Link, useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { 
  Star, 
  Plus, 
  Filter, 
  Search, 
  Eye, 
  Check, 
  X, 
  MoreHorizontal,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { useState } from "react";
import { getReviewStats, getAllReviews, updateReviewStatus } from "../services/api/review.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Avis Clients - Dashboard Support" },
    { name: "description", content: "Interface de modération et gestion des avis clients" },
  ];
};

interface LoaderData {
  reviews: any[];
  stats: any;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "10");
  const statusParam = url.searchParams.get("status") || "all";
  const status = (statusParam === "pending" || statusParam === "approved" || statusParam === "rejected") ? statusParam : "all";
  const _search = url.searchParams.get("search") || "";

  try {
    const [reviewsData, stats] = await Promise.all([
      getAllReviews({ page, limit, status }, request).catch(() => ({ 
        reviews: [], 
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } 
      })),
      getReviewStats(request).catch(() => ({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        averageRating: 0,
        ratingDistribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
      }))
    ]);

    return json<LoaderData>({
      reviews: reviewsData.reviews || [],
      stats,
      pagination: 'pagination' in reviewsData ? reviewsData.pagination : { page: reviewsData.page || 1, limit: reviewsData.limit || 10, total: reviewsData.total || 0, totalPages: Math.ceil((reviewsData.total || 0) / (reviewsData.limit || 10)) }
    });
  } catch (error) {
    console.error("Erreur lors du chargement des avis:", error);
    return json<LoaderData>({
      reviews: [],
      stats: {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        averageRating: 0,
        ratingDistribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 }
      },
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
    });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const reviewId = formData.get("reviewId");

  if (intent === "updateStatus" && reviewId) {
    const statusParam = formData.get("status") as string;
    const status = (statusParam === "pending" || statusParam === "approved" || statusParam === "rejected") ? statusParam : "pending";
    try {
      await updateReviewStatus(Number(reviewId), status, request);
      return json({ success: true });
    } catch (error) {
      return json({ error: "Erreur lors de la mise à jour du statut" }, { status: 500 });
    }
  }

  return json({ error: "Action non reconnue" }, { status: 400 });
}

export default function ReviewsPage() {
  const { reviews, stats, pagination } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [selectedReviews, setSelectedReviews] = useState<number[]>([]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const getStatusVariant = (status: string): "success" | "error" | "warning" | "default" => {
    switch (status) {
      case "approved": return "success";
      case "rejected": return "error";
      case "pending": return "warning";
      default: return "default";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved": return "Approuvé";
      case "rejected": return "Rejeté";
      case "pending": return "En attente";
      default: return "Inconnu";
    }
  };

  const handleStatusUpdate = (reviewId: number, newStatus: string) => {
    const formData = new FormData();
    formData.append("intent", "updateStatus");
    formData.append("reviewId", reviewId.toString());
    formData.append("status", newStatus);
    submit(formData, { method: "post" });
  };

  const toggleReviewSelection = (reviewId: number) => {
    setSelectedReviews(prev => 
      prev.includes(reviewId) 
        ? prev.filter(id => id !== reviewId)
        : [...prev, reviewId]
    );
  };

  const selectAllReviews = () => {
    if (selectedReviews.length === reviews.length) {
      setSelectedReviews([]);
    } else {
      setSelectedReviews(reviews.map(review => review.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Avis Clients</h1>
            <p className="text-gray-600 mt-1">
              Modération et analyse des évaluations clients
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              to="/reviews/create"
              className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvel avis
            </Link>
            <Link
              to="/reviews/analytics"
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Analytics
            </Link>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning/10 rounded-md flex items-center justify-center">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Moyenne</p>
              <div className="flex items-center">
                <p className="text-2xl font-semibold text-gray-900 mr-2">
                  {stats.averageRating.toFixed(1)}
                </p>
                {renderStars(Math.round(stats.averageRating))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning/10 rounded-md flex items-center justify-center">
                <span className="text-sm font-semibold text-yellow-600">⏳</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">En attente</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success/10 rounded-md flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Approuvés</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-destructive/10 rounded-md flex items-center justify-center">
                <X className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Rejetés</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.rejected}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <Form method="get" className="space-y-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    name="search"
                    placeholder="Rechercher par client, produit ou commentaire..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  name="status"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="approved">Approuvés</option>
                  <option value="rejected">Rejetés</option>
                </select>
                
                <select
                  name="limit"
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="10">10 par page</option>
                  <option value="25">25 par page</option>
                  <option value="50">50 par page</option>
                </select>
                
                <Button className="inline-flex items-center px-4 py-2   rounded-md" variant="blue" type="submit">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrer
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </div>

      {/* Liste des avis */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Avis Clients ({pagination.total})
            </h2>
            {selectedReviews.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">
                  {selectedReviews.length} sélectionné(s)
                </span>
                <button
                  onClick={() => {
                    selectedReviews.forEach(id => handleStatusUpdate(id, "approved"));
                    setSelectedReviews([]);
                  }}
                  className="px-3 py-1 bg-success/20 text-success text-sm rounded-md hover:bg-success/30"
                >
                  Approuver
                </button>
                <button
                  onClick={() => {
                    selectedReviews.forEach(id => handleStatusUpdate(id, "rejected"));
                    setSelectedReviews([]);
                  }}
                  className="px-3 py-1 bg-destructive/20 text-destructive text-sm rounded-md hover:bg-destructive/30"
                >
                  Rejeter
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-hidden">
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun avis trouvé</h3>
              <p className="text-gray-600 mb-6">
                Commencez par collecter des avis de vos clients.
              </p>
              <Link
                to="/reviews/create"
                className="inline-flex items-center px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Créer le premier avis
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              <div className="px-6 py-3 bg-gray-50 flex items-center">
                <input
                  type="checkbox"
                  checked={selectedReviews.length === reviews.length && reviews.length > 0}
                  onChange={selectAllReviews}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-3 text-sm font-medium text-gray-700">
                  Sélectionner tout
                </span>
              </div>
              
              {reviews.map((review) => (
                <div key={review.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedReviews.includes(review.id)}
                      onChange={() => toggleReviewSelection(review.id)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-medium text-gray-900">
                            {review.customer_name || "Client anonyme"}
                          </h3>
                          {renderStars(review.rating)}
                          <span className="text-sm text-gray-500">({review.rating}/5)</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant={getStatusVariant(review.status)} size="sm">
                            {getStatusText(review.status)}
                          </Badge>
                          
                          <div className="relative">
                            <button
                              className="p-1 text-gray-400 hover:text-gray-600"
                              onClick={() => {/* Menu contextuel */}}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {review.comment}
                        </p>
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Produit: {review.product_name || "Non spécifié"}</span>
                          <span>•</span>
                          <span>{formatDate(review.created_at)}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/reviews/${review.id}`}
                            className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Détails
                          </Link>
                          
                          {review.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleStatusUpdate(review.id, "approved")}
                                disabled={navigation.state !== "idle"}
                                className="inline-flex items-center px-2 py-1 text-xs bg-success/80 text-success-foreground hover:bg-success rounded  disabled:opacity-50"
                              >
                                <Check className="w-3 h-3 mr-1" />
                                Approuver
                              </button>
                              
                              <button
                                onClick={() => handleStatusUpdate(review.id, "rejected")}
                                disabled={navigation.state !== "idle"}
                                className="inline-flex items-center px-2 py-1 text-xs bg-destructive/15 text-red-700 rounded hover:bg-destructive/30 disabled:opacity-50"
                              >
                                <X className="w-3 h-3 mr-1" />
                                Rejeter
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Affichage de {((pagination.page - 1) * pagination.limit) + 1} à{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} sur{" "}
                {pagination.total} résultats
              </div>
              
              <div className="flex items-center space-x-2">
                {pagination.page > 1 && (
                  <Link
                    to={`?page=${pagination.page - 1}&limit=${pagination.limit}`}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Précédent
                  </Link>
                )}
                
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <Link
                      key={pageNum}
                      to={`?page=${pageNum}&limit=${pagination.limit}`}
                      className={`px-3 py-2 text-sm rounded-md ${
                        pageNum === pagination.page
                          ? "bg-primary text-primary-foreground"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}
                
                {pagination.page < pagination.totalPages && (
                  <Link
                    to={`?page=${pagination.page + 1}&limit=${pagination.limit}`}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                  >
                    Suivant
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
