/**
 * Page Nouveau Message - Création d'un message client/staff
 */

import { json, type LoaderFunctionArgs, type ActionFunctionArgs, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { 
  Send,
  ArrowLeft,
  User,
  Mail,
  MessageSquare
} from "lucide-react";
import { requireAdmin } from "../auth/unified.server";

interface NewMessageData {
  customers: Array<{
    cst_id: string;
    cst_name: string;
    cst_fname: string;
    cst_mail: string;
  }>;
}

export async function action({ request, context }: ActionFunctionArgs) {
  const user = await requireAdmin({ context });
  
  const formData = await request.formData();
  const customerId = formData.get('customerId');
  const subject = formData.get('subject');
  const content = formData.get('content');

  if (!customerId || !subject || !content) {
    return json({ error: 'Tous les champs sont requis' }, { status: 400 });
  }

  try {
    const response = await fetch('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msg_cst_id: customerId,
        msg_cnfa_id: user.id,
        msg_subject: subject,
        msg_content: content,
        msg_open: '1'
      }),
    });

    if (response.ok) {
      console.log('✅ Message créé avec succès');
      return redirect('/admin/messages?created=true');
    } else {
      console.error('❌ Erreur création message:', response.status);
      return json({ error: 'Erreur lors de la création du message' }, { status: 500 });
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création du message:', error);
    return json({ error: 'Erreur technique' }, { status: 500 });
  }
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const user = await requireAdmin({ context });
  
  // Vérifier les permissions admin
  if (!user.level || user.level < 7) {
    throw new Response("Accès non autorisé", { status: 403 });
  }

  try {
    // Récupérer la liste des clients pour le sélecteur
    const response = await fetch('http://localhost:3000/api/legacy-users?role=customer&limit=100', {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return json({
        customers: data.users || [],
      } as NewMessageData);
    } else {
      console.error('❌ Erreur récupération clients:', response.status);
      return json({
        customers: [],
      } as NewMessageData);
    }
  } catch (error) {
    console.error('❌ Erreur lors du chargement des clients:', error);
    return json({
      customers: [],
    } as NewMessageData);
  }
}

export default function NewMessage() {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <a 
                href="/admin/messages"
                className="inline-flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Retour aux messages
              </a>
            </div>
          </div>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">
            Nouveau Message
          </h1>
          <p className="mt-2 text-gray-600">
            Envoyer un message à un client
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white shadow-lg rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Composer un message
            </h3>
          </div>
          
          <Form method="post" className="p-6 space-y-6">
            
            {/* Sélection du client */}
            <div>
              <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-2">
                <User className="h-4 w-4 inline mr-1" />
                Client destinataire
              </label>
              <select
                id="customerId"
                name="customerId"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Sélectionner un client...</option>
                {data.customers.map((customer) => (
                  <option key={customer.cst_id} value={customer.cst_id}>
                    {customer.cst_fname} {customer.cst_name} ({customer.cst_mail})
                  </option>
                ))}
              </select>
            </div>

            {/* Sujet */}
            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                <Mail className="h-4 w-4 inline mr-1" />
                Sujet
              </label>
              <input
                type="text"
                id="subject"
                name="subject"
                required
                placeholder="Objet de votre message..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Contenu */}
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                id="content"
                name="content"
                rows={6}
                required
                placeholder="Tapez votre message ici..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
              <a
                href="/admin/messages"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Annuler
              </a>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Envoi...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Envoyer le message
                  </>
                )}
              </button>
            </div>

          </Form>
        </div>

      </div>
    </div>
  );
}
