/**
 * Page de contact - Création de tickets de support
 * Remix Route Component avec formulaire interactif
 */
import { json, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Form, useActionData, useNavigation, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { createContact, getContactStats, type ContactFormData, type ContactStats } from "../services/api/contact.api";

export const meta: MetaFunction = () => {
  return [
    { title: "Contact - Support Client" },
    { name: "description", content: "Formulaire de contact pour le support client" },
  ];
};

interface LoaderData {
  stats: ContactStats;
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const stats = await getContactStats(request);
    return json<LoaderData>({ stats });
  } catch (error) {
    console.error("Erreur lors du chargement des statistiques:", error);
    return json<LoaderData>({ 
      stats: { 
        total_tickets: 0, 
        open_tickets: 0, 
        closed_tickets: 0, 
        tickets_last_24h: 0 
      } 
    });
  }
}

interface ActionData {
  success?: boolean;
  error?: string;
  ticket?: {
    msg_id: string;
    msg_subject: string;
    msg_date: string;
  };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    
    const contactData: ContactFormData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      phone: (formData.get("phone") as string) || undefined,
      subject: formData.get("subject") as string,
      message: formData.get("message") as string,
      priority: (formData.get("priority") as string) as ContactFormData["priority"],
      category: (formData.get("category") as string) as ContactFormData["category"],
      order_number: (formData.get("order_number") as string) || undefined,
      customer_id: (formData.get("customer_id") as string) || undefined,
    };

    // Validation côté serveur
    if (!contactData.name || !contactData.email || !contactData.subject || !contactData.message) {
      return json<ActionData>({
        error: "Tous les champs obligatoires doivent être remplis"
      }, { status: 400 });
    }

    const ticket = await createContact(contactData, request);
    
    return json<ActionData>({
      success: true,
      ticket: {
        msg_id: ticket.msg_id,
        msg_subject: ticket.msg_subject,
        msg_date: ticket.msg_date,
      }
    });
  } catch (error) {
    console.error("Erreur lors de la création du ticket:", error);
    return json<ActionData>({
      error: error instanceof Error ? error.message : "Une erreur inattendue s'est produite"
    }, { status: 500 });
  }
}

export default function ContactPage() {
  const { stats } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header avec statistiques */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Support Client</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">Total tickets</p>
            <p className="text-2xl font-bold text-blue-900">{stats.total_tickets}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">Tickets ouverts</p>
            <p className="text-2xl font-bold text-green-900">{stats.open_tickets}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Tickets fermés</p>
            <p className="text-2xl font-bold text-gray-900">{stats.closed_tickets}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <p className="text-sm text-orange-600">Dernières 24h</p>
            <p className="text-2xl font-bold text-orange-900">{stats.tickets_last_24h}</p>
          </div>
        </div>
      </div>

      {/* Messages de retour */}
      {actionData?.success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            Ticket créé avec succès !
          </h3>
          <p className="text-green-700">
            Votre ticket <strong>#{actionData.ticket?.msg_id}</strong> a été créé.
          </p>
          <p className="text-sm text-green-600 mt-1">
            Sujet: {actionData.ticket?.msg_subject}
          </p>
        </div>
      )}

      {actionData?.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900 mb-2">Erreur</h3>
          <p className="text-red-700">{actionData.error}</p>
        </div>
      )}

      {/* Formulaire de contact */}
      <div className="bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Créer un nouveau ticket
        </h2>

        <Form method="post" className="space-y-6">
          {/* Informations personnelles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Nom complet *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Votre nom complet"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="votre.email@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Téléphone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0123456789"
              />
            </div>

            <div>
              <label htmlFor="customer_id" className="block text-sm font-medium text-gray-700 mb-2">
                ID Client
              </label>
              <input
                id="customer_id"
                name="customer_id"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ID client (optionnel)"
              />
            </div>
          </div>

          {/* Détails du ticket */}
          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
              Sujet *
            </label>
            <input
              id="subject"
              name="subject"
              type="text"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Résumé de votre demande"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priorité
              </label>
              <select
                id="priority"
                name="priority"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue="normal"
              >
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Catégorie
              </label>
              <select
                id="category"
                name="category"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue="general"
              >
                <option value="general">Général</option>
                <option value="technical">Technique</option>
                <option value="billing">Facturation</option>
                <option value="complaint">Réclamation</option>
                <option value="suggestion">Suggestion</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
              Message *
            </label>
            <textarea
              id="message"
              name="message"
              rows={6}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Décrivez votre demande en détail..."
            />
          </div>

          {/* Options avancées */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {showAdvanced ? "Masquer" : "Afficher"} les options avancées
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label htmlFor="order_number" className="block text-sm font-medium text-gray-700 mb-2">
                  Numéro de commande
                </label>
                <input
                  id="order_number"
                  name="order_number"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Numéro de commande associé"
                />
              </div>
            </div>
          )}

          {/* Bouton de soumission */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Envoi en cours..." : "Créer le ticket"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
