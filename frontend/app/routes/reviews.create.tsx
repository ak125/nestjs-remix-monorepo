/**
 * Page Création d'Avis Client
 * Formulaire pour soumettre un nouvel avis client
 */
import { json, redirect, type ActionFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Alert } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import { Form, Link, useActionData, useNavigation } from "@remix-run/react";
import { Star, ArrowLeft, Send } from "lucide-react";
import { useState } from "react";
import { createReview } from "../services/api/review.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Nouveau Avis Client - Dashboard Support" },
    { name: "description", content: "Formulaire de soumission d'avis client" },
  ];
};

interface ActionData {
  errors?: {
    customer_name?: string;
    customer_email?: string;
    product_name?: string;
    rating?: string;
    comment?: string;
    general?: string;
  };
  success?: boolean;
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  const reviewData = {
    customer_id: "1", // ID temporaire pour test
    customer_name: formData.get("customer_name") as string,
    customer_email: formData.get("customer_email") as string,
    product_name: formData.get("product_name") as string,
    title: `Avis sur ${formData.get("product_name")}`,
    rating: parseInt(formData.get("rating") as string) as 1 | 2 | 3 | 4 | 5,
    comment: formData.get("comment") as string,
    status: "pending" as const,
  };

  // Validation
  const errors: ActionData["errors"] = {};

  if (!reviewData.customer_name?.trim()) {
    errors.customer_name = "Le nom du client est requis";
  }

  if (!reviewData.customer_email?.trim()) {
    errors.customer_email = "L'email du client est requis";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewData.customer_email)) {
    errors.customer_email = "Format d'email invalide";
  }

  if (!reviewData.product_name?.trim()) {
    errors.product_name = "Le nom du produit est requis";
  }

  if (!reviewData.rating || reviewData.rating < 1 || reviewData.rating > 5) {
    errors.rating = "Une note entre 1 et 5 étoiles est requise";
  }

  if (!reviewData.comment?.trim()) {
    errors.comment = "Un commentaire est requis";
  } else if (reviewData.comment.length < 10) {
    errors.comment = "Le commentaire doit faire au moins 10 caractères";
  }

  if (Object.keys(errors).length > 0) {
    return json<ActionData>({ errors }, { status: 400 });
  }

  try {
    await createReview(reviewData, request);
    return redirect(`/reviews?created=true`);
  } catch (error) {
    console.error("Erreur lors de la création de l'avis:", error);
    return json<ActionData>({ 
      errors: { general: "Erreur lors de la création de l'avis. Veuillez réessayer." } 
    }, { status: 500 });
  }
}

export default function CreateReviewPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const isSubmitting = navigation.state === "submitting";

  const renderInteractiveStars = () => {
    return Array.from({ length: 5 }, (_, i) => {
      const starValue = i + 1;
      return (
        <button
          key={i}
          type="button"
          onClick={() => setRating(starValue)}
          onMouseEnter={() => setHoverRating(starValue)}
          onMouseLeave={() => setHoverRating(0)}
          className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
        >
          <Star
            className={`w-8 h-8 transition-colors ${
              starValue <= (hoverRating || rating)
                ? "text-yellow-400 fill-current"
                : "text-gray-300"
            }`}
          />
        </button>
      );
    });
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
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
        <h1 className="text-3xl font-bold text-gray-900">Nouveau Avis Client</h1>
        <p className="text-gray-600 mt-1">
          Partagez votre expérience avec nos produits
        </p>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <Form method="post" className="space-y-6">
          {/* Erreur générale */}
          {actionData?.errors?.general && (
<Alert className="rounded-md p-4" variant="error">
              <div className="text-red-800 text-sm">
                {actionData.errors.general}
              </div>
            </Alert>
          )}

          {/* Informations client */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet *
              </label>
              <input
                type="text"
                id="customer_name"
                name="customer_name"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  actionData?.errors?.customer_name
                    ? "border-destructive bg-destructive/10"
                    : "border-gray-300"
                }`}
                placeholder="Votre nom complet"
              />
              {actionData?.errors?.customer_name && (
                <p className="mt-1 text-sm text-red-600">
                  {actionData.errors.customer_name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="customer_email" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email *
              </label>
              <input
                type="email"
                id="customer_email"
                name="customer_email"
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  actionData?.errors?.customer_email
                    ? "border-destructive bg-destructive/10"
                    : "border-gray-300"
                }`}
                placeholder="votre@email.com"
              />
              {actionData?.errors?.customer_email && (
                <p className="mt-1 text-sm text-red-600">
                  {actionData.errors.customer_email}
                </p>
              )}
            </div>
          </div>

          {/* Produit */}
          <div>
            <label htmlFor="product_name" className="block text-sm font-medium text-gray-700 mb-2">
              Produit évalué *
            </label>
            <input
              type="text"
              id="product_name"
              name="product_name"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                actionData?.errors?.product_name
                  ? "border-destructive bg-destructive/10"
                  : "border-gray-300"
              }`}
              placeholder="Nom du produit ou service"
            />
            {actionData?.errors?.product_name && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.product_name}
              </p>
            )}
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Évaluation *
            </label>
            <div className="flex items-center gap-2 mb-2">
              {renderInteractiveStars()}
              {rating > 0 && (
                <span className="ml-2 text-sm text-gray-600">
                  {rating} sur 5 étoiles
                </span>
              )}
            </div>
            <input
              type="hidden"
              name="rating"
              value={rating}
            />
            {actionData?.errors?.rating && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.rating}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Cliquez sur les étoiles pour noter votre expérience
            </p>
          </div>

          {/* Commentaire */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Votre avis *
            </label>
            <textarea
              id="comment"
              name="comment"
              rows={6}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                actionData?.errors?.comment
                  ? "border-destructive bg-destructive/10"
                  : "border-gray-300"
              }`}
              placeholder="Décrivez votre expérience avec ce produit ou service. Qu'avez-vous aimé ? Qu'est-ce qui pourrait être amélioré ?"
            />
            {actionData?.errors?.comment && (
              <p className="mt-1 text-sm text-red-600">
                {actionData.errors.comment}
              </p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Minimum 10 caractères. Soyez constructif et détaillé.
            </p>
          </div>

          {/* Recommandations d'évaluation */}
<Alert className="rounded-md p-4" variant="info">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Conseils pour un avis utile
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Décrivez votre expérience avec des détails concrets</li>
              <li>• Mentionnez les points positifs et les aspects à améliorer</li>
              <li>• Soyez objectif et constructif dans vos commentaires</li>
              <li>• Évitez les propos offensants ou inappropriés</li>
            </ul>
          </Alert>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <Link
              to="/reviews"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50"
            >
              Annuler
            </Link>
            
            <Button className="inline-flex items-center px-6 py-2   rounded-md disabled:opacity-50 disabled:cursor-not-allowed" variant="blue" type="submit"
              disabled={isSubmitting || rating === 0}>
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Publier l'avis
                </>
              )}
            </Button>
          </div>
        </Form>
      </div>

      {/* Note sur la modération */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">
          Processus de modération
        </h3>
        <p className="text-sm text-gray-600">
          Votre avis sera examiné par notre équipe avant publication. Ce processus prend généralement 
          24 à 48 heures. Nous nous réservons le droit de ne pas publier les avis qui ne respectent 
          pas nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
}
