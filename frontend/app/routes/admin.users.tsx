/**
 * Page Utilisateurs - Gestion des utilisateurs avec vraies données
 */

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { Users, UserPlus, Search, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { requireAdmin } from "../auth/unified.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Utilisateurs - Admin" },
    { name: "description", content: "Interface d'administration pour la gestion des utilisateurs" },
  ];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  await requireAdmin({ context });
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const search = url.searchParams.get("search") || "";

  try {
    console.log("🔄 Chargement des utilisateurs depuis l'API...");
    
    // Utiliser l'endpoint legacy users qui fonctionne avec les vraies données
    const apiUrl = `http://localhost:3000/api/legacy-users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log(`✅ ${result.data?.length || 0} utilisateurs chargés (total: ${result.pagination?.total || result.total || 0})`);
    
    return json({
      users: result.data || [],
      total: result.pagination?.total || result.total || 0,
      page,
      limit,
      search
    });
  } catch (error) {
    console.error("❌ Erreur lors du chargement des utilisateurs:", error);
    
    // Retourner des données vides en cas d'erreur
    return json({
      users: [],
      total: 0,
      page,
      limit,
      search
    });
  }
}

export default function AdminUsers() {
  const { users, total, page, limit, search } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState(search || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (localSearch.trim()) {
      params.set('search', localSearch.trim());
    } else {
      params.delete('search');
    }
    params.set('page', '1'); // Reset à la page 1 lors d'une recherche
    navigate(`/admin/users?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    navigate(`/admin/users?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-muted-foreground">
            Gérez les comptes utilisateurs et leurs permissions
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <UserPlus className="h-4 w-4" />
          Nouvel Utilisateur
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">Depuis les vraies données</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actifs</CardTitle>
            <div className="h-2 w-2 bg-green-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter((u: any) => u.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">Comptes actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Professionnels</CardTitle>
            <div className="h-2 w-2 bg-blue-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter((u: any) => u.role === 'professional').length}</div>
            <p className="text-xs text-muted-foreground">Comptes pro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactifs</CardTitle>
            <div className="h-2 w-2 bg-red-500 rounded-full" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.filter((u: any) => u.status === 'inactive').length}</div>
            <p className="text-xs text-muted-foreground">Comptes désactivés</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions et recherche */}
      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Rechercher un utilisateur..."
            className="px-3 py-2 border rounded-md w-64"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
          <Button type="submit" size="sm">
            Rechercher
          </Button>
          {search && (
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => {
                setLocalSearch('');
                navigate('/admin/users');
              }}
            >
              Effacer
            </Button>
          )}
        </form>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Filtres
        </Button>
      </div>

      {/* Liste des utilisateurs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Liste des Utilisateurs</CardTitle>
              <CardDescription>
                {search ? 
                  `Résultats pour "${search}" - ${total} utilisateur(s) trouvé(s)` :
                  `Tous les comptes utilisateurs depuis la base de données - ${total} utilisateurs`
                }
              </CardDescription>
            </div>
            {Math.ceil(total / limit) > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} sur {Math.ceil(total / limit)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page * limit >= total}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun utilisateur trouvé</p>
              <p className="text-sm text-muted-foreground">
                Vérifiez la configuration de l'API ou créez votre premier utilisateur
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Liste des utilisateurs */}
              <div className="space-y-2">
                {users.map((user: any) => (
                  <div key={user.id} className="border rounded-lg p-4 bg-white hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold">
                            {user.firstName?.[0] || user.email[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {user.firstName} {user.lastName || user.name}
                          </h3>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          user.level >= 7 ? 'bg-purple-100 text-purple-800' : 
                          user.isPro ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          Niveau {user.level || 1}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination simple */}
              {total > limit && (
                <div className="flex justify-between items-center mt-6">
                  <div className="text-sm text-gray-500">
                    Affichage de {((page - 1) * limit) + 1} à {Math.min(page * limit, total)} sur {total} utilisateurs
                  </div>
                  <div className="flex space-x-2">
                    {page > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/users?page=${page - 1}&limit=${limit}&search=${search}`)}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Précédent
                      </Button>
                    )}
                    {page * limit < total && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/users?page=${page + 1}&limit=${limit}&search=${search}`)}
                      >
                        Suivant
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
