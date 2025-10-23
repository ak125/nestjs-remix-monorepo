/**
 * Page de détail d'un ticket - Consultation et gestion
 * Remix Route Component pour voir et modifier un ticket spécifique
 */
import {  Badge, Alert } from '@fafa/ui';
import { json, type LoaderFunctionArgs, type ActionFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { getTicket, updateTicketStatus, type ContactTicket } from "../services/api/contact.api";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: data ? `Ticket #${data.ticket.msg_id} - Support Client` : "Ticket non trouvé" },
    { name: "description", content: "Détails du ticket de support client" },
  ];
};

interface LoaderData {
  ticket: ContactTicket;
}

export async function loader({ params, request }: LoaderFunctionArgs) {
  const ticketId = params.ticketId;
  
  if (!ticketId) {
    throw new Response("ID de ticket manquant", { status: 400 });
  }

  try {
    const ticket = await getTicket(ticketId, request);
    return json<LoaderData>({ ticket });
  } catch (error) {
    console.error("Erreur lors du chargement du ticket:", error);
    throw new Response("Ticket non trouvé", { status: 404 });
  }
}

interface ActionData {
  success?: boolean;
  error?: string;
}

export async function action({ params, request }: ActionFunctionArgs) {
  const ticketId = params.ticketId;
  
  if (!ticketId) {
    return json<ActionData>({ error: "ID de ticket manquant" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const action = formData.get("_action");

    if (action === "updateStatus") {
      const newStatus = formData.get("status") as 'open' | 'closed';
      
      if (!newStatus || !['open', 'closed'].includes(newStatus)) {
        return json<ActionData>({ error: "Statut invalide" }, { status: 400 });
      }

      await updateTicketStatus(ticketId, newStatus, request);
      
      return json<ActionData>({ success: true });
    }

    return json<ActionData>({ error: "Action non reconnue" }, { status: 400 });
  } catch (error) {
    console.error("Erreur lors de l'action:", error);
    return json<ActionData>({
      error: error instanceof Error ? error.message : "Une erreur inattendue s'est produite"
    }, { status: 500 });
  }
}

export default function TicketDetailPage() {
  const { ticket } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";
  const isOpen = ticket.msg_open === "1";

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "normal": return "bg-blue-100 text-blue-800 border-blue-200";
      case "low": return "bg-gray-100 text-gray-800 border-gray-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getCategoryLabel = (category: string) => {
    const categories = {
      general: "Général",
      technical: "Technique",
      billing: "Facturation",
      complaint: "Réclamation",
      suggestion: "Suggestion",
    };
    return categories[category as keyof typeof categories] || category;
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Navigation */}
      <div className="mb-6">
        <Link
          to="/tickets"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ← Retour à la liste des tickets
        </Link>
      </div>

      {/* Messages de retour */}
      {actionData?.success && (
        <Alert intent="success"><p>Ticket mis à jour avec succès !</p></Alert>
      )}

      {actionData?.error && (
        <Alert intent="error"><p>{actionData.error}</p></Alert>
      )}

      {/* Header du ticket */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Ticket #{ticket.msg_id}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Créé le {formatDate(ticket.msg_date)}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Statut */}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                isOpen 
                  ? "bg-green-100 text-green-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {isOpen ? "Ouvert" : "Fermé"}
              </span>

              {/* Actions rapides */}
              <Form method="post" className="inline">
                <input type="hidden" name="_action" value="updateStatus" />
                <input type="hidden" name="status" value={isOpen ? "closed" : "open"} />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 text-sm font-medium rounded-md ${
                    isOpen
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-green-600 text-white hover:bg-green-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isSubmitting 
                    ? "Mise à jour..." 
                    : isOpen 
                      ? "Fermer le ticket" 
                      : "Rouvrir le ticket"}
                </button>
              </Form>
            </div>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="p-6">
          {/* Informations du ticket */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Détails du ticket */}
            <div className="lg:col-span-2">
              <div className="space-y-6">
                {/* Sujet */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">
                    {ticket.msg_subject}
                  </h2>
                </div>

                {/* Message */}
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Message</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-900 whitespace-pre-wrap">{ticket.msg_content}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Métadonnées */}
            <div className="space-y-4">
              {/* Priorité */}
              {ticket.priority && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Priorité</h3>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${getPriorityColor(ticket.priority)}`}>
                    {ticket.priority}
                  </span>
                </div>
              )}

              {/* Catégorie */}
              {ticket.category && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Catégorie</h3>
                  <Badge variant="info">
                    {getCategoryLabel(ticket.category)}
                  </Badge>
                </div>
              )}

              {/* ID Client */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">ID Client</h3>
                <p className="text-sm text-gray-900">{ticket.msg_cst_id}</p>
              </div>

              {/* Commande associée */}
              {ticket.msg_ord_id && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Commande</h3>
                  <p className="text-sm text-gray-900">#{ticket.msg_ord_id}</p>
                </div>
              )}

              {/* Configuration associée */}
              {ticket.msg_cnfa_id && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Configuration</h3>
                  <p className="text-sm text-gray-900">#{ticket.msg_cnfa_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Informations client */}
          {ticket.customer && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informations du client
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Nom</p>
                    <p className="text-sm text-gray-900">
                      {ticket.customer.cst_name} {ticket.customer.cst_fname}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email</p>
                    <p className="text-sm text-gray-900">
                      <a 
                        href={`mailto:${ticket.customer.cst_mail}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {ticket.customer.cst_mail}
                      </a>
                    </p>
                  </div>
                  {ticket.customer.cst_phone && (
                    <div>
                      <p className="text-sm font-medium text-gray-700">Téléphone</p>
                      <p className="text-sm text-gray-900">
                        <a 
                          href={`tel:${ticket.customer.cst_phone}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {ticket.customer.cst_phone}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <Link
              to="/tickets"
              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
            >
              Retour à la liste
            </Link>
            
            <div className="flex gap-3">
              <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                Imprimer
              </button>
              <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                Répondre
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
