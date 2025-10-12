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
  targetUser: User;
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = params.id;
  
  if (!userId) {
    throw new Response("Utilisateur non trouvé", { status: 404 });
  }

  console.log(`🔍 [Frontend] Chargement utilisateur avec ID: ${userId}`);

  try {
    // Transmettre le cookie de session pour l'authentification
    const cookie = request.headers.get("Cookie") || "";
    
    // Récupérer les détails de l'utilisateur depuis l'API admin legacy
    const response = await fetch(`http://localhost:3000/api/legacy-users/${userId}`, {
      headers: {
        "Cookie": cookie,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Frontend] API /api/legacy-users/${userId} returned ${response.status}:`, errorText);
      
      throw new Response(
        `Utilisateur non trouvé avec l'ID: ${userId}. Vérifiez que cet ID existe dans la base de données.`, 
        { status: 404 }
      );
    }

    const data = await response.json();
    console.log(`✅ [Frontend] Utilisateur chargé:`, { id: userId, email: data.data?.email || data.email });
    const user = data.data || data;

    // Récupérer les commandes de l'utilisateur depuis l'API admin legacy
    let totalOrders = 0;
    let totalSpent = 0;
    
    try {
      const ordersResponse = await fetch(`http://localhost:3000/api/legacy-users/${userId}/orders`, {
        headers: {
          "Cookie": cookie,
        },
      });
      
      console.log(`📦 [Frontend] Orders response status: ${ordersResponse.status}`);
      
      if (ordersResponse.ok) {
        const contentType = ordersResponse.headers.get("content-type");
        console.log(`📦 [Frontend] Orders content-type: ${contentType}`);
        
        if (contentType && contentType.includes("application/json")) {
          const ordersData = await ordersResponse.json();
          const orders = ordersData.data || ordersData.orders || [];
          totalOrders = orders.length;
          totalSpent = orders.reduce((sum: number, order: any) => {
            const amount = parseFloat(order.total || order.ord_total_ttc || order.totalTTC || 0);
            return sum + amount;
          }, 0);
          console.log(`✅ [Frontend] Orders chargées: ${totalOrders} commandes, total: ${totalSpent}€`);
        } else {
          const text = await ordersResponse.text();
          console.error(`❌ [Frontend] Response n'est pas JSON:`, text.substring(0, 200));
        }
      } else {
        const errorText = await ordersResponse.text();
        console.error(`❌ [Frontend] Erreur orders (${ordersResponse.status}):`, errorText.substring(0, 200));
      }
    } catch (error) {
      console.warn("⚠️ [Frontend] Impossible de récupérer les commandes:", error);
      // Ne pas faire échouer toute la page si les commandes ne se chargent pas
    }
    
    return json<LoaderData>({ 
      targetUser: {
        ...user,
        totalOrders,
        totalSpent
      }
    });
  } catch (error) {
    console.error("Erreur lors du chargement de l'utilisateur:", error);
    throw new Response("Erreur lors du chargement de l'utilisateur", { status: 500 });
  }
};

export function ErrorBoundary() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/users">
          <button className="flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-gray-50">
            <ArrowLeft className="w-4 h-4" />
            Retour à la liste
          </button>
        </Link>
      </div>
      
      <div className="border rounded-lg p-8 bg-red-50 border-red-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <User className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-red-900">Utilisateur non trouvé</h1>
            <p className="text-red-700 mt-1">
              L'ID utilisateur spécifié n'existe pas dans la base de données.
            </p>
          </div>
        </div>
        
        <div className="bg-white border border-red-200 rounded p-4 mt-4">
          <h3 className="font-semibold mb-2">Suggestions :</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>Vérifiez que l'ID utilisateur est correct</li>
            <li>L'utilisateur a peut-être été supprimé</li>
            <li>Retournez à la liste des utilisateurs pour en sélectionner un autre</li>
          </ul>
        </div>
        
        <div className="mt-6">
          <Link to="/admin/users">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Voir tous les utilisateurs
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UserDetails() {
  const { targetUser: user } = useLoaderData<LoaderData>();
  
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
                <a href={`mailto:${user.email}`} className="text-blue-600 hover:underline">
                  {user.email}
                </a>
              </div>
            </div>
            
            {user.phone && (
              <div>
                <label className="text-sm font-medium text-gray-600">Téléphone fixe</label>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <a href={`tel:${user.phone}`} className="text-blue-600 hover:underline">
                    {user.phone}
                  </a>
                </div>
              </div>
            )}
            
            {(user as any).mobile && (
              <div>
                <label className="text-sm font-medium text-gray-600">Téléphone mobile</label>
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <a href={`tel:${(user as any).mobile}`} className="text-blue-600 hover:underline">
                    {(user as any).mobile}
                  </a>
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
            Adresse
          </h3>
          <div className="space-y-3">
            {user.address && (
              <div>
                <label className="text-sm font-medium text-gray-600">Rue</label>
                <p className="mt-1">{user.address}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              {(user as any).zipCode && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Code postal</label>
                  <p className="mt-1">{(user as any).zipCode}</p>
                </div>
              )}
              
              {user.city && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Ville</label>
                  <p className="mt-1">{user.city}</p>
                </div>
              )}
            </div>
            
            {(user as any).country && (
              <div>
                <label className="text-sm font-medium text-gray-600">Pays</label>
                <p className="mt-1">{(user as any).country}</p>
              </div>
            )}
            
            {!user.city && !user.address && (
              <p className="text-gray-500 italic">Aucune adresse renseignée</p>
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
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-600">{user.totalOrders || 0}</div>
              <div className="text-sm text-gray-700 mt-1">Commandes</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{formatCurrency(user.totalSpent)}</div>
              <div className="text-sm text-gray-700 mt-1">Total dépensé</div>
            </div>
            {user.totalOrders && user.totalOrders > 0 && (
              <div className="text-center p-3 bg-gray-50 rounded">
                <div className="text-lg font-semibold text-gray-700">
                  {formatCurrency((user.totalSpent || 0) / (user.totalOrders || 1))}
                </div>
                <div className="text-xs text-gray-600 mt-1">Panier moyen</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border rounded-lg p-6 bg-white shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Actions rapides</h3>
        <div className="flex gap-2 flex-wrap">
          <a 
            href={`mailto:${user.email}`}
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50 inline-flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Envoyer un email
          </a>
          <Link 
            to={`/admin/orders?userId=${user.id}`}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 inline-flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            Voir ses commandes ({user.totalOrders || 0})
          </Link>
          <Link 
            to={`/admin/users/${user.id}/edit`}
            className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
          >
            Modifier le profil
          </Link>
        </div>
      </div>
    </div>
  );
}
