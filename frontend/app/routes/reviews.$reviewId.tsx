/**
 * Page Détail d'Avis Client
 * Affichage complet et modération d'un avis spécifique
 */
import { json, redirect, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { Form, Link, useLoaderData, useActionData, useNavigation } from "@remix-run/react";
import { 
  Star, 
  ArrowLeft, 
  Check, 
  X, 
  Edit3, 
  Trash2, 
  Flag,
  Calendar,
  User,
  Package,
  MessageSquare
} from "lucide-react";
import { getReviewById, updateReviewStatus, deleteReview } from "../services/api/review.api";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: data ? `Avis #${data.review.id} - ${data.review.customer_name}` : "Avis non trouvé" },
    { name: "description", content: "Détails et modération d'avis client" },
  ];
};

interface LoaderData {
  review: any;
}

interface ActionData {
  error?: string;
  success?: boolean;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const reviewId = params.reviewId;
  
  if (!reviewId) {
    throw new Response("ID d'avis manquant", { status: 400 });
  }

  try {
    const review = await getReviewById(Number(reviewId), request);
    return json<LoaderData>({ review });
  } catch (error) {
    console.error("Erreur lors du chargement de l'avis:", error);
    throw new Response("Avis non trouvé", { status: 404 });
  }
}

export async function action({ params, request }: ActionFunctionArgs) {
  const reviewId = params.reviewId;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (!reviewId) {
    return json<ActionData>({ error: "ID d'avis manquant" }, { status: 400 });
  }

  try {
    switch (intent) {
      case "approve":
        await updateReviewStatus(Number(reviewId), "approved", request);
        return json<ActionData>({ success: true });
      
      case "reject":
        await updateReviewStatus(Number(reviewId), "rejected", request);
        return json<ActionData>({ success: true });
      
      case "pending":
        await updateReviewStatus(Number(reviewId), "pending", request);
        return json<ActionData>({ success: true });
      
      case "delete":
        await deleteReview(Number(reviewId), request);
        return redirect("/reviews?deleted=true");
      
      default:
        return json<ActionData>({ error: "Action non reconnue" }, { status: 400 });
    }
  } catch (error) {
    console.error("Erreur lors de l'action:", error);
    return json<ActionData>({ error: "Erreur lors de l'action" }, { status: 500 });
  }
}

export default function ReviewDetailPage() {
  const { review } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

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
        className={`w-5 h-5 ${
          i < rating ? "text-yellow-400 fill-current" : "text-gray-300"
        }`}
      />
    ));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return {
          className: "bg-green-100 text-green-800 border-green-200",
          label: "Approuvé",
          icon: <Check className="w-4 h-4" />
        };
      case "rejected":
        return {
          className: "bg-red-100 text-red-800 border-red-200",
          label: "Rejeté",
          icon: <X className="w-4 h-4" />
        };
      case "pending":
        return {
          className: "bg-yellow-100 text-yellow-800 border-yellow-200",
          label: "En attente",
          icon: <Flag className="w-4 h-4" />
        };
      default:
        return {
          className: "bg-gray-100 text-gray-800 border-gray-200",
          label: "Inconnu",
          icon: <Flag className="w-4 h-4" />
        };
    }
  };

  const statusBadge = getStatusBadge(review.status);

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link
            to="/reviews"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Retour aux avis
          </Link>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Avis #{review.id}
            </h1>
            <p className="text-gray-600 mt-1">
              Soumis le {formatDate(review.created_at)}
            </p>
          </div>
          
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${statusBadge.className}`}>
            {statusBadge.icon}
            <span className="ml-1">{statusBadge.label}</span>
          </div>
        </div>
      </div>

      {/* Messages d'état */}
      {actionData?.success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="text-green-800 text-sm">
            Action effectuée avec succès
          </div>
        </div>
      )}

      {actionData?.error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800 text-sm">
            {actionData.error}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Contenu principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informations de l'avis */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              {/* En-tête de l'avis */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {review.customer_name}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {review.customer_email}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {renderStars(review.rating)}
                  <span className="text-sm text-gray-600 ml-2">
                    ({review.rating}/5)
                  </span>
                </div>
              </div>

              {/* Titre de l'avis */}
              {review.title && (
                <div className="mb-4">
                  <h3 className="text-xl font-medium text-gray-900">
                    {review.title}
                  </h3>
                </div>
              )}

              {/* Produit évalué */}
              <div className="flex items-center space-x-2 mb-4 text-sm text-gray-600">
                <Package className="w-4 h-4" />
                <span>Produit évalué :</span>
                <span className="font-medium text-gray-900">
                  {review.product_name}
                </span>
              </div>

              {/* Commentaire */}
              <div className="mb-6">
                <div className="flex items-center space-x-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Commentaire</span>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {review.comment}
                  </p>
                </div>
              </div>

              {/* Métadonnées */}
              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>Créé le {formatDate(review.created_at)}</span>
                  </div>
                  
                  {review.updated_at && review.updated_at !== review.created_at && (
                    <div className="flex items-center space-x-2">
                      <Edit3 className="w-4 h-4" />
                      <span>Modifié le {formatDate(review.updated_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions de modération */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Actions de modération
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {review.status !== "approved" && (
                <Form method="post">
                  <input type="hidden" name="intent" value="approve" />
                  <Button className="w-full inline-flex items-center justify-center px-4 py-2   rounded-md disabled:opacity-50" variant="green" type="submit"
                    disabled={isSubmitting}>
                    <Check className="w-4 h-4 mr-2" />
                    Approuver
                  </Button>
                </Form>
              )}

              {review.status !== "rejected" && (
                <Form method="post">
                  <input type="hidden" name="intent" value="reject" />
                  <Button className="w-full inline-flex items-center justify-center px-4 py-2   rounded-md disabled:opacity-50" variant="red" type="submit"
                    disabled={isSubmitting}>
                    <X className="w-4 h-4 mr-2" />
                    Rejeter
                  </Button>
                </Form>
              )}

              {review.status !== "pending" && (
                <Form method="post">
                  <input type="hidden" name="intent" value="pending" />
                  <Button className="w-full inline-flex items-center justify-center px-4 py-2   rounded-md disabled:opacity-50" variant="yellow" type="submit"
                    disabled={isSubmitting}>
                    <Flag className="w-4 h-4 mr-2" />
                    Remettre en attente
                  </Button>
                </Form>
              )}
            </div>

            {/* Action de suppression */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Zone de danger</h4>
              <Form 
                method="post" 
                onSubmit={(e) => {
                  if (!confirm("Êtes-vous sûr de vouloir supprimer cet avis ? Cette action est irréversible.")) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="intent" value="delete" />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-red-700 font-medium rounded-md hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer définitivement
                </button>
              </Form>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Résumé */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Résumé
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Note</span>
                <div className="flex items-center space-x-1">
                  {renderStars(review.rating)}
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Statut</span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Longueur</span>
                <span className="text-sm font-medium">
                  {review.comment.length} caractères
                </span>
              </div>
            </div>
          </div>

          {/* Actions rapides */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Actions rapides
            </h3>
            
            <div className="space-y-3">
              <Link
                to="/reviews"
                className="block w-full text-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
              >
                Retour à la liste
              </Link>
              
              <Button className="block w-full text-center px-4 py-2   rounded-md" variant="blue" asChild><Link to="/reviews/create">Nouvel avis</Link></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
