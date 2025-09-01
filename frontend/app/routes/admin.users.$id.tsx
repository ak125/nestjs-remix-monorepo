import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { ArrowLeft, Mail, Phone, User, MapPin, ShoppingBag, Award } from 'lucide-react';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  city?: string;
  isPro: boolean;
  isCompany: boolean;
  level: number;
  isActive: boolean;
  phone?: string;
  address?: string;
  totalOrders?: number;
  totalSpent?: number;
}

interface LoaderData {
  user: User;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const userId = params.id;
  
  const mockUser: User = {
    id: userId!,
    firstName: "Jean",
    lastName: "Dupont", 
    email: "jean.dupont@example.com",
    city: "Paris",
    isPro: true,
    isCompany: false,
    level: 3,
    isActive: true,
    phone: "+33 1 23 45 67 89",
    address: "123 Rue de la Paix, 75001 Paris",
    totalOrders: 42,
    totalSpent: 2456.78,
  };
  
  return json<LoaderData>({ user: mockUser });
};

export default function UserDetails() {
  const { user } = useLoaderData<LoaderData>();
  
  const formatCurrency = (amount?: number) => {
    if (!amount) return '0 €';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/admin/users">
            <button className="flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
              <ArrowLeft className="w-4 h-4" />
              Retour à la liste
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <User className="w-8 h-8 text-blue-600" />
              {user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}`
                : 'Utilisateur sans nom'
              }
            </h1>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Link to={`/admin/users/${user.id}/edit`}>
            <button className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
              Modifier
            </button>
          </Link>
          <button className={`px-4 py-2 text-sm rounded-md text-white ${
            user.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}>
            {user.isActive ? "Désactiver" : "Activer"}
          </button>
        </div>
      </div>

      {/* Informations principales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informations personnelles */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Informations personnelles
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-600">ID Utilisateur</label>
              <p className="font-mono text-sm bg-gray-100 p-2 rounded mt-1">{user.id}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Email</label>
              <div className="flex items-center gap-2 mt-1">
                <Mail className="w-4 h-4 text-gray-500" />
                <p>{user.email}</p>
              </div>
            </div>
            
            {user.phone && (
              <div>
                <label className="text-sm font-medium text-gray-600">Téléphone</label>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <p>{user.phone}</p>
                </div>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-gray-600">Statut</label>
              <div className="mt-1">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  user.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.isActive ? "Actif" : "Inactif"}
                </span>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Type de compte</label>
              <div className="flex gap-2 mt-1">
                {user.isPro && (
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Professionnel
                  </span>
                )}
                {user.isCompany && (
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                    Entreprise
                  </span>
                )}
                {!user.isPro && !user.isCompany && (
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Particulier</span>
                )}
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Niveau</label>
              <div className="mt-1">
                <span className="font-medium">Niveau {user.level}</span>
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
            {user.city && (
              <div>
                <label className="text-sm font-medium text-gray-600">Ville</label>
                <p className="mt-1">{user.city}</p>
              </div>
            )}
            
            {user.address && (
              <div>
                <label className="text-sm font-medium text-gray-600">Adresse</label>
                <p className="mt-1">{user.address}</p>
              </div>
            )}
            
            {!user.city && !user.address && (
              <p className="text-gray-500 italic">Aucune information de localisation disponible</p>
            )}
          </div>
        </div>

        {/* Activité commerciale */}
        <div className="border rounded-lg p-6 bg-white shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Activité commerciale
          </h3>
          <div className="space-y-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-blue-600">{user.totalOrders || 0}</div>
              <div className="text-sm text-gray-600">Commandes totales</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(user.totalSpent)}</div>
              <div className="text-sm text-gray-600">Montant total dépensé</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Actions rapides</h3>
        <div className="flex gap-2">
          <button className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
            Envoyer un email
          </button>
          <button className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
            Voir les commandes
          </button>
          <button className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
            Historique des paiements
          </button>
        </div>
      </div>
    </div>
  );
}
