import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, useActionData, Form, Link } from '@remix-run/react';
import { ArrowLeft, User, Save, Mail, Phone, MapPin } from 'lucide-react';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  city?: string;
  address?: string;
  isPro: boolean;
  isCompany: boolean;
  level: number;
  isActive: boolean;
  notes?: string;
}

interface LoaderData {
  user: User;
}

interface ActionData {
  success?: boolean;
  error?: string;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const userId = params.id;
  
  const mockUser: User = {
    id: userId!,
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@example.com",
    phone: "+33 1 23 45 67 89",
    city: "Paris",
    address: "123 Rue de la Paix, 75001 Paris",
    isPro: true,
    isCompany: false,
    level: 3,
    isActive: true,
    notes: "Client privilégié, excellent historique de commandes."
  };
  
  return json<LoaderData>({ user: mockUser });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  
  // Simuler la sauvegarde
  try {
    // En production : await updateUser(userId, formData);
    return json<ActionData>({ success: true });
  } catch (error) {
    return json<ActionData>({ error: 'Erreur lors de la sauvegarde' });
  }
};

export default function EditUser() {
  const { user } = useLoaderData<LoaderData>();
  const actionData = useActionData<ActionData>();
  
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/admin/users/${user.id}`}>
            <button className="flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />
              Retour aux détails
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <User className="w-8 h-8 text-blue-600" />
              Modifier l'utilisateur
            </h1>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      {actionData?.success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 text-green-800">
            <User className="w-5 h-5" />
            <strong>Utilisateur mis à jour avec succès !</strong>
          </div>
        </div>
      )}

      {actionData?.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800">
            <strong>{actionData.error}</strong>
          </div>
        </div>
      )}

      <Form method="post" className="space-y-6">
        {/* Informations personnelles */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Informations personnelles
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                  Prénom
                </label>
                <input 
                  id="firstName" 
                  name="firstName" 
                  defaultValue={user.firstName || ''} 
                  placeholder="Prénom"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                  Nom
                </label>
                <input 
                  id="lastName" 
                  name="lastName" 
                  defaultValue={user.lastName || ''} 
                  placeholder="Nom de famille"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  id="email" 
                  name="email" 
                  type="email" 
                  defaultValue={user.email} 
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="email@exemple.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  id="phone" 
                  name="phone" 
                  defaultValue={user.phone || ''} 
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="+33 1 23 45 67 89" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Localisation */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Localisation
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                Ville
              </label>
              <input 
                id="city" 
                name="city" 
                defaultValue={user.city || ''} 
                placeholder="Paris"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Adresse complète
              </label>
              <textarea 
                id="address" 
                name="address" 
                defaultValue={user.address || ''} 
                placeholder="123 Rue de la Paix, 75001 Paris" 
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Configuration du compte */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Configuration du compte</h3>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input 
                id="isActive" 
                name="isActive" 
                type="checkbox"
                defaultChecked={user.isActive}
                className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Compte actif
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input 
                id="isPro" 
                name="isPro" 
                type="checkbox"
                defaultChecked={user.isPro}
                className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="isPro" className="text-sm font-medium text-gray-700">
                Compte professionnel
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input 
                id="isCompany" 
                name="isCompany" 
                type="checkbox"
                defaultChecked={user.isCompany}
                className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="isCompany" className="text-sm font-medium text-gray-700">
                Entreprise
              </label>
            </div>
            
            <div>
              <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
                Niveau utilisateur
              </label>
              <select 
                name="level" 
                defaultValue={user.level.toString()}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1">Niveau 1 - Débutant</option>
                <option value="2">Niveau 2 - Intermédiaire</option>
                <option value="3">Niveau 3 - Avancé</option>
                <option value="4">Niveau 4 - Expert</option>
                <option value="5">Niveau 5 - VIP</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notes internes */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Notes internes</h3>
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes administratives
            </label>
            <textarea 
              id="notes" 
              name="notes" 
              defaultValue={user.notes || ''} 
              placeholder="Notes internes sur ce client..." 
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-2">
              Ces notes ne sont visibles que par les administrateurs
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button 
            type="submit" 
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Sauvegarder les modifications
          </button>
          <Link to={`/admin/users/${user.id}`}>
            <button 
              type="button"
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annuler
            </button>
          </Link>
        </div>
      </Form>
    </div>
  );
}
