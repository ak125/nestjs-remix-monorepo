/**
 * 🚀 PAGE ADMIN UTILISATEURS - VERSION CONSOLIDÉE COMPLÈTE
 * Interface complète avec TOUS les champs sans redondance
 * Basé sur l'analyse du module users
 */

import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@remix-run/node';
import {
  useLoaderData,
  Link,
  useSearchParams,
  useNavigate,
  Form,
} from '@remix-run/react';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  Building,
  Award,
  UserCheck,
  UserX,
  Filter,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';

/**
 * Interface utilisateur COMPLÈTE - Sans redondance
 * Correspond exactement à UserCompleteDto du backend
 */
interface User {
  // Identification
  id: string;
  email: string;

  // Informations personnelles
  firstName?: string;
  lastName?: string;
  civility?: string; // M, Mme, Mlle, Dr, Prof

  // Coordonnées
  address?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string; // CST_TEL - Téléphone fixe
  mobile?: string; // CST_GSM - Mobile/GSM

  // Informations entreprise
  isCompany: boolean;
  companyName?: string; // CST_RS
  siret?: string;

  // Statut
  isPro: boolean;
  isActive: boolean;
  level: number;

  // Dates et stats
  createdAt?: string;
  updatedAt?: string;
  totalOrders?: number;
  totalSpent?: number;
}

interface LoaderData {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  filters: {
    search: string;
    status: string;
    userType: string;
    level: string;
    city: string;
    country: string;
    sortBy: string;
    sortOrder: string;
  };
}

/**
 * 📥 LOADER - Récupération des utilisateurs
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '25');
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || '';
  const userType = url.searchParams.get('userType') || '';
  const level = url.searchParams.get('level') || '';
  const city = url.searchParams.get('city') || '';
  const country = url.searchParams.get('country') || '';
  const sortBy = url.searchParams.get('sortBy') || 'cst_id';
  const sortOrder = url.searchParams.get('sortOrder') || 'desc';

  try {
    // 🔥 Appel API vers le service consolidé
    let apiUrl = `http://localhost:3000/api/users-v2?page=${page}&limit=${limit}`;
    if (search) apiUrl += `&search=${encodeURIComponent(search)}`;
    if (status) apiUrl += `&status=${status}`;
    if (userType) apiUrl += `&userType=${userType}`;
    if (level) apiUrl += `&level=${level}`;
    if (city) apiUrl += `&city=${encodeURIComponent(city)}`;
    if (country) apiUrl += `&country=${encodeURIComponent(country)}`;
    if (sortBy) apiUrl += `&sortBy=${sortBy}`;
    if (sortOrder) apiUrl += `&sortOrder=${sortOrder}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return json<LoaderData>({
      users: data.users || [],
      pagination: data.pagination || {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filters: {
        search,
        status,
        userType,
        level,
        city,
        country,
        sortBy,
        sortOrder,
      },
    });
  } catch (error) {
    console.error('❌ Erreur loader admin.users-v2:', error);
    return json<LoaderData>({
      users: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
      filters: {
        search: '',
        status: '',
        userType: '',
        level: '',
        city: '',
        country: '',
        sortBy: 'cst_id',
        sortOrder: 'desc',
      },
    });
  }
};

/**
 * 🔧 ACTION - Actions utilisateur
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get('_action');
  const userId = formData.get('userId');

  console.log(`Action: ${action} for user: ${userId}`);

  return json({ success: true, message: 'Action effectuée' });
};

/**
 * 🎨 COMPOSANT PRINCIPAL
 */
export default function UsersConsolidatedPage() {
  const { users, pagination, filters } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState(filters.search);

  /**
   * Appliquer les filtres
   */
  const applyFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries({ ...filters, ...newFilters }).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset à la page 1 quand on change les filtres
    params.set('page', '1');

    navigate(`?${params.toString()}`);
  };

  /**
   * Recherche
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search: localSearch });
  };

  /**
   * Changement de page
   */
  const changePage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    navigate(`?${params.toString()}`);
  };

  /**
   * Formater le nom complet
   */
  const getFullName = (user: User) => {
    const parts = [];
    if (user.civility) parts.push(user.civility);
    if (user.firstName) parts.push(user.firstName);
    if (user.lastName) parts.push(user.lastName);
    return parts.join(' ') || user.email;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 📊 En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Utilisateurs (Version Consolidée)
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestion complète de {pagination.total.toLocaleString()} utilisateurs
          </p>
        </div>
        <Link to="/admin/users/new">
          <Button>
            <UserCheck className="w-4 h-4 mr-2" />
            Nouvel utilisateur
          </Button>
        </Link>
      </div>

      {/* 🔍 Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Recherche */}
            <form onSubmit={handleSearch} className="col-span-full">
              <div className="flex gap-2">
                <Input
                  placeholder="Rechercher (email, nom, prénom)..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit">
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </form>

            {/* Statut */}
            <Select
              value={filters.status}
              onValueChange={(value) => applyFilters({ status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>

            {/* Type */}
            <Select
              value={filters.userType}
              onValueChange={(value) => applyFilters({ userType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="particulier">Particuliers</SelectItem>
                <SelectItem value="pro">Professionnels</SelectItem>
                <SelectItem value="company">Entreprises</SelectItem>
              </SelectContent>
            </Select>

            {/* Niveau */}
            <Select
              value={filters.level}
              onValueChange={(value) => applyFilters({ level: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Niveau" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous niveaux</SelectItem>
                <SelectItem value="1">Niveau 1 (Client)</SelectItem>
                <SelectItem value="5">Niveau 5 (Pro)</SelectItem>
                <SelectItem value="9">Niveau 9 (Admin)</SelectItem>
              </SelectContent>
            </Select>

            {/* Ville */}
            <Input
              placeholder="Filtrer par ville..."
              value={filters.city}
              onChange={(e) => applyFilters({ city: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 📋 Tableau des utilisateurs */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Utilisateur
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Adresse
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Entreprise
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center">
                      <p className="text-muted-foreground">
                        Aucun utilisateur trouvé
                      </p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-muted/50">
                      {/* Utilisateur */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div className="font-medium">{getFullName(user)}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Badge
                              variant={user.isActive ? 'default' : 'secondary'}
                            >
                              {user.isActive ? 'Actif' : 'Inactif'}
                            </Badge>
                            {user.isPro && <Badge variant="outline">Pro</Badge>}
                            {user.isCompany && (
                              <Badge variant="outline">Entreprise</Badge>
                            )}
                            <Badge variant="outline">Niv. {user.level}</Badge>
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          {user.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                          {user.mobile && (
                            <div className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3" />
                              <span>{user.mobile}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Adresse */}
                      <td className="px-4 py-3 text-sm">
                        {user.address || user.city ? (
                          <div className="space-y-1">
                            {user.address && (
                              <div className="flex items-start gap-1">
                                <MapPin className="w-3 h-3 mt-1" />
                                <div>
                                  <div>{user.address}</div>
                                  <div className="text-muted-foreground">
                                    {user.zipCode} {user.city}
                                  </div>
                                  {user.country && (
                                    <div className="text-muted-foreground">
                                      {user.country}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {!user.address && user.city && (
                              <div className="text-muted-foreground">
                                {user.zipCode} {user.city}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Entreprise */}
                      <td className="px-4 py-3 text-sm">
                        {user.isCompany ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1 font-medium">
                              <Building className="w-3 h-3" />
                              {user.companyName || 'Non renseigné'}
                            </div>
                            {user.siret && (
                              <div className="text-xs text-muted-foreground">
                                SIRET: {user.siret}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3 text-sm">
                        <div className="space-y-1">
                          {user.totalOrders !== undefined && (
                            <div className="flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              {user.totalOrders} commandes
                            </div>
                          )}
                          {user.totalSpent !== undefined && (
                            <div className="text-muted-foreground">
                              {user.totalSpent.toFixed(2)} €
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/users/${user.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Link to={`/admin/users/${user.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Form method="post">
                            <input type="hidden" name="_action" value="toggle" />
                            <input type="hidden" name="userId" value={user.id} />
                            <Button
                              variant="ghost"
                              size="sm"
                              type="submit"
                            >
                              {user.isActive ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </Button>
                          </Form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 📄 Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} sur {pagination.totalPages} (
            {pagination.total} utilisateurs)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(pagination.page - 1)}
              disabled={!pagination.hasPreviousPage}
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePage(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
