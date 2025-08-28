// app/routes/pro.customers._index.tsx
// Interface gestion clients professionnelle appliquant "vérifier existant et utiliser le meilleur"

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus,
  Star,
  Mail,
  Phone,
  CreditCard,
  TrendingUp,
  Eye,
  Edit,
  MoreHorizontal
} from 'lucide-react';
import { useState } from 'react';
import { requireAuth } from '../auth/unified.server';

// Interfaces TypeScript
interface Customer {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  type: 'Garage Pro' | 'Concessionnaire' | 'Particulier Premium' | 'Flotte';
  status: 'Actif' | 'Inactif' | 'Prospect';
  totalOrders: number;
  totalSpent: number;
  lastOrder: string;
  rating: number;
  registrationDate: string;
  paymentTerms: string;
  credit: number;
}

interface CustomerStats {
  totalCustomers: number;
  activeCustomers: number;
  newThisMonth: number;
  totalRevenue: number;
  averageOrderValue: number;
  topSpenders: number;
  byType: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAuth(request);
  
  // Vérifier permissions professionnelles (niveau 3+)
  if (!user.level || user.level < 3) {
    throw new Response('Accès refusé - Compte professionnel requis', { status: 403 });
  }

  // En production, récupérer les vrais clients depuis l'API
  const customers: Customer[] = [
    {
      id: 'cust-001',
      company: 'Garage Central SARL',
      contact: 'Pierre Dubois',
      email: 'contact@garagecentral.fr',
      phone: '01 23 45 67 89',
      address: '15 rue de la Mécanique',
      city: 'Lyon',
      type: 'Garage Pro',
      status: 'Actif',
      totalOrders: 47,
      totalSpent: 12850.90,
      lastOrder: '2025-08-20',
      rating: 4.8,
      registrationDate: '2024-03-15',
      paymentTerms: '30 jours',
      credit: 5000
    },
    {
      id: 'cust-002',
      company: 'Auto Services Plus',
      contact: 'Marie Laurent',
      email: 'marie@autoservices.fr',
      phone: '01 34 56 78 90',
      address: '8 avenue des Réparations',
      city: 'Paris',
      type: 'Garage Pro',
      status: 'Actif',
      totalOrders: 34,
      totalSpent: 8950.40,
      lastOrder: '2025-08-19',
      rating: 4.6,
      registrationDate: '2024-01-20',
      paymentTerms: '30 jours',
      credit: 3000
    },
    {
      id: 'cust-003',
      company: 'Concession BMW Paris',
      contact: 'Jean-Michel Bernard',
      email: 'jm.bernard@bmw-paris.fr',
      phone: '01 45 67 89 01',
      address: '125 boulevard Haussmann',
      city: 'Paris',
      type: 'Concessionnaire',
      status: 'Actif',
      totalOrders: 89,
      totalSpent: 45780.20,
      lastOrder: '2025-08-21',
      rating: 4.9,
      registrationDate: '2023-11-10',
      paymentTerms: '45 jours',
      credit: 15000
    },
    {
      id: 'cust-004',
      company: 'Transport Express 67',
      contact: 'Sophie Martin',
      email: 'flotte@transport67.fr',
      phone: '03 88 12 34 56',
      address: '45 route de Strasbourg',
      city: 'Strasbourg',
      type: 'Flotte',
      status: 'Actif',
      totalOrders: 156,
      totalSpent: 78940.60,
      lastOrder: '2025-08-18',
      rating: 4.7,
      registrationDate: '2023-06-05',
      paymentTerms: '60 jours',
      credit: 25000
    },
    {
      id: 'cust-005',
      company: 'Méca Pro Expertise',
      contact: 'Thomas Leroy',
      email: 'thomas@mecapro.fr',
      phone: '02 98 76 54 32',
      address: '12 zone industrielle',
      city: 'Brest',
      type: 'Garage Pro',
      status: 'Actif',
      totalOrders: 23,
      totalSpent: 6740.30,
      lastOrder: '2025-08-17',
      rating: 4.4,
      registrationDate: '2024-07-12',
      paymentTerms: '30 jours',
      credit: 2500
    },
    {
      id: 'cust-006',
      company: 'Auto Prestige Particulier',
      contact: 'Catherine Moreau',
      email: 'cat.moreau@gmail.com',
      phone: '06 12 34 56 78',
      address: '78 rue des Lilas',
      city: 'Nice',
      type: 'Particulier Premium',
      status: 'Actif',
      totalOrders: 12,
      totalSpent: 3240.80,
      lastOrder: '2025-08-16',
      rating: 4.5,
      registrationDate: '2024-12-03',
      paymentTerms: 'Comptant',
      credit: 0
    }
  ];

  const stats: CustomerStats = {
    totalCustomers: 1247,
    activeCustomers: 1089,
    newThisMonth: 67,
    totalRevenue: 486750.80,
    averageOrderValue: 257.30,
    topSpenders: 89,
    byType: [
      { type: 'Garages Pro', count: 456, percentage: 36.6 },
      { type: 'Concessionnaires', count: 123, percentage: 9.9 },
      { type: 'Particuliers Premium', count: 398, percentage: 31.9 },
      { type: 'Flottes', count: 270, percentage: 21.6 }
    ]
  };

  return json({ user, customers, stats });
}

export default function ProCustomersIndex() {
  const { customers, stats } = useLoaderData<typeof loader>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Actif': return 'bg-green-100 text-green-800';
      case 'Inactif': return 'bg-gray-100 text-gray-800';
      case 'Prospect': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Garage Pro': return 'bg-blue-100 text-blue-800';
      case 'Concessionnaire': return 'bg-purple-100 text-purple-800';
      case 'Particulier Premium': return 'bg-green-100 text-green-800';
      case 'Flotte': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < Math.floor(rating) 
            ? 'fill-yellow-400 text-yellow-400' 
            : 'text-gray-300'
        }`}
      />
    ));
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || customer.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-lg shadow-lg p-8 text-white mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Users className="h-12 w-12" />
            <div>
              <h1 className="text-4xl font-bold">Gestion Clients PRO</h1>
              <p className="text-green-100 text-lg mt-1">
                Base client professionnelle complète
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold">{formatNumber(stats.totalCustomers)}</div>
            <div className="text-green-200">Clients totaux</div>
            <div className="text-sm text-green-100 mt-1">
              +{stats.newThisMonth} ce mois
            </div>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Clients Actifs</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.activeCustomers)}</p>
            </div>
            <Users className="h-8 w-8 text-green-500" />
          </div>
          <div className="mt-2 text-sm text-green-600">
            {((stats.activeCustomers / stats.totalCustomers) * 100).toFixed(1)}% du total
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CA Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalRevenue)}</p>
            </div>
            <CreditCard className="h-8 w-8 text-blue-500" />
          </div>
          <div className="mt-2 text-sm text-blue-600">
            Performance excellente
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Panier Moyen</p>
              <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.averageOrderValue)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
          <div className="mt-2 text-sm text-purple-600">
            +8.3% vs mois dernier
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Top Clients</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.topSpenders)}</p>
            </div>
            <Star className="h-8 w-8 text-yellow-500" />
          </div>
          <div className="mt-2 text-sm text-yellow-600">
            Clients premium fidèles
          </div>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Rechercher un client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-3 items-center">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Tous les types</option>
              <option value="Garage Pro">Garages Pro</option>
              <option value="Concessionnaire">Concessionnaires</option>
              <option value="Particulier Premium">Particuliers Premium</option>
              <option value="Flotte">Flottes</option>
            </select>
            
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Filter className="h-4 w-4" />
              Filtres
            </button>
            
            <Link
              to="/pro/customers/new"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nouveau Client
            </Link>
          </div>
        </div>
      </div>

      {/* Répartition par type */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Répartition par Type de Client</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.byType.map((type) => (
            <div key={type.type} className="p-4 rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900 mb-1">{formatNumber(type.count)}</div>
                <div className="text-sm text-gray-600 mb-2">{type.type}</div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${type.percentage}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">{type.percentage.toFixed(1)}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Liste des clients */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Clients ({formatNumber(filteredCustomers.length)})
            </h2>
            <div className="text-sm text-gray-500">
              {filteredCustomers.length} résultat{filteredCustomers.length > 1 ? 's' : ''}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Commandes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CA Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Note
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {customer.company}
                      </div>
                      <div className="text-sm text-gray-500">
                        {customer.contact}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {customer.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(customer.type)}`}>
                      {customer.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {customer.totalOrders}
                    </div>
                    <div className="text-xs text-gray-500">
                      Dernière: {new Date(customer.lastOrder).toLocaleDateString('fr-FR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatPrice(customer.totalSpent)}
                    </div>
                    {customer.credit > 0 && (
                      <div className="text-xs text-blue-500">
                        Crédit: {formatPrice(customer.credit)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {renderStars(customer.rating)}
                      <span className="text-sm text-gray-600 ml-1">
                        {customer.rating.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(customer.status)}`}>
                      {customer.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/pro/customers/${customer.id}`}
                        className="text-green-600 hover:text-green-500 p-1 rounded hover:bg-green-50"
                        title="Voir détails"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/pro/customers/${customer.id}/edit`}
                        className="text-blue-600 hover:text-blue-500 p-1 rounded hover:bg-blue-50"
                        title="Modifier"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button
                        className="text-gray-600 hover:text-gray-500 p-1 rounded hover:bg-gray-50"
                        title="Plus d'actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
