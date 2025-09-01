/**
 * 🚀 PAGE UTILISATEURS SIMPLE AVEC PAGINATION SERVEUR
 * Gestion de 59,137 utilisateurs avec pagination côté serveur
 */

import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData, Link, useSearchParams, useNavigate } from '@remix-run/react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Input } from '~/components/ui/input';
import { Users, UserPlus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  createdAt: string;
  role?: string;
  isActive?: boolean;
}

interface LoaderData {
  users: User[];
  total: number;
  currentPage: number;
  totalPages: number;
  stats: {
    totalUsers: number;
    activeUsers: number;
    newUsersToday: number;
  };
}

// ⚡ LOADER avec pagination serveur optimisée
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '25');
  const search = url.searchParams.get('search') || '';

  try {
    // 🔥 API Call avec pagination
    const apiUrl = `http://localhost:5000/api/legacy-users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    return json<LoaderData>({
      users: data.users || [],
      total: data.total || 0,
      currentPage: page,
      totalPages: Math.ceil((data.total || 0) / limit),
      stats: {
        totalUsers: data.total || 0,
        activeUsers: data.total || 0,
        newUsersToday: 0,
      }
    });
  } catch (error) {
    console.error('🚨 Erreur lors du chargement des utilisateurs:', error);
    return json<LoaderData>({
      users: [],
      total: 0,
      currentPage: 1,
      totalPages: 1,
      stats: {
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0,
      }
    });
  }
};

export default function AdminUsersSimple() {
  const { users, total, currentPage, totalPages, stats } = useLoaderData<LoaderData>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const search = searchParams.get('search') || '';

  // 📊 Fonctions utilitaires
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateString));
  };

  // 🔍 Navigation pagination
  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', page.toString());
    navigate(`?${params.toString()}`);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const searchValue = formData.get('search') as string;
    
    const params = new URLSearchParams();
    if (searchValue) params.set('search', searchValue);
    params.set('page', '1');
    navigate(`?${params.toString()}`);
  };

  return (
    <div className="space-y-6 p-6">
      {/* 📊 En-tête avec statistiques */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground">
            {formatNumber(total)} utilisateurs au total
          </p>
        </div>
        <Link to="/admin/users/new">
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Nouvel utilisateur
          </Button>
        </Link>
      </div>

      {/* 📈 Statistiques rapides */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalUsers)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs actifs</CardTitle>
            <Badge variant="outline">Actifs</Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.activeUsers)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page actuelle</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentPage} / {totalPages}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(totalPages)} pages au total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 🔍 Barre de recherche */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Recherche et filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <Input
              name="search"
              placeholder="Rechercher par email, nom..."
              defaultValue={search}
              className="flex-1"
            />
            <Button type="submit">
              <Search className="w-4 h-4 mr-2" />
              Rechercher
            </Button>
            {search && (
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/users')}
              >
                Effacer
              </Button>
            )}
          </form>
          {search && (
            <p className="text-sm text-muted-foreground mt-2">
              Recherche : "{search}" - {formatNumber(total)} résultats
            </p>
          )}
        </CardContent>
      </Card>

      {/* 📋 Tableau des utilisateurs */}
      <Card>
        <CardHeader>
          <CardTitle>
            📋 Liste des utilisateurs
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({formatNumber(users.length)} sur {formatNumber(total)})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Email</th>
                  <th className="text-left py-2">Nom</th>
                  <th className="text-left py-2">Créé le</th>
                  <th className="text-left py-2">Statut</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 text-sm font-mono">{user.id.slice(0, 8)}...</td>
                    <td className="py-2">{user.email}</td>
                    <td className="py-2">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.name || 'Non défini'}
                    </td>
                    <td className="py-2 text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="py-2">
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Actif' : 'Inactif'}
                      </Badge>
                    </td>
                    <td className="py-2">
                      <Link to={`/admin/users/${user.id}`}>
                        <Button variant="outline" size="sm">
                          Voir
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Aucun utilisateur trouvé.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🔄 Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} sur {totalPages} - 
          {formatNumber(total)} utilisateurs au total
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
            Précédent
          </Button>
          
          {/* Pages numérotées */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = Math.max(1, Math.min(currentPage - 2 + i, totalPages - 4 + i));
            if (pageNum <= totalPages) {
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            }
            return null;
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Suivant
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
