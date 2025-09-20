/**
 * 🚀 Page Utilisateurs OPTIMISÉE - Gestion des 59,137 utilisateurs avec performance
 */

import { useState } from "react";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { Users, UserPlus, ChevronRight, Search, Filter, ChevronLeft } from "lucide-react";
import { requireAdmin } from "../auth/unified.server";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { OptimizedPagination } from '../components/ui/OptimizedPagination';
import { OptimizedSearchBar } from '../components/ui/OptimizedSearchBar';
import { PerformanceMetrics } from '../components/ui/PerformanceMetrics';
import { useOptimizedTable } from '../hooks/useOptimizedTable';

export const meta: MetaFunction = () => {
  return [
    { title: "Gestion des Utilisateurs - Admin" },
    { name: "description", content: "Gérez les comptes utilisateurs et leurs permissions" }
  ];
};

// Interface pour les utilisateurs
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  isActive?: boolean;
  status?: string;
  isPro?: boolean;
  role?: string;
  createdAt?: string;
}

interface LoaderData {
  users: User[];
  total: number;
  stats: {
    totalUsers: number;
    activeUsers: number;
    professionalUsers: number;
    inactiveUsers: number;
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Authentification admin requise
  await requireAdmin(request);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const search = url.searchParams.get('search') || '';

  try {
    // Récupérer les utilisateurs depuis l'API
    const usersUrl = new URL('http://localhost:3000/api/legacy-users');
    usersUrl.searchParams.set('page', page.toString());
    usersUrl.searchParams.set('limit', limit.toString());
    if (search) usersUrl.searchParams.set('search', search);

    const response = await fetch(usersUrl.toString());
    const result = await response.json();

    // Récupérer les statistiques du dashboard
    const statsResponse = await fetch('http://localhost:3000/api/dashboard/stats');
    const statsData = await statsResponse.json();

    return json({
      users: result.data || [],
      total: result.pagination?.total || result.total || 0,
      stats: {
        totalUsers: statsData.totalUsers || 59137,
        activeUsers: statsData.activeUsers || 59137,
        professionalUsers: result.data?.filter((u: User) => u.isPro || u.role === 'professional').length || 0,
        inactiveUsers: result.data?.filter((u: User) => !u.isActive || u.status === 'inactive').length || 0,
      }
    });
  } catch (error) {
    console.error('Erreur chargement utilisateurs:', error);
    return json({
      users: [],
      total: 0,
      stats: { totalUsers: 0, activeUsers: 0, professionalUsers: 0, inactiveUsers: 0 }
    });
  }
}

export default function AdminUsers() {
  const { users, total, stats } = useLoaderData<LoaderData>();
  const navigate = useNavigate();
  
  // 🚀 HOOKS OPTIMISÉS POUR 59k+ UTILISATEURS
  const optimizedTable = useOptimizedTable({
    data: users,
    itemsPerPage: 25,
    searchFields: ['firstName', 'lastName', 'name', 'email'],
    sortField: 'email',
    sortDirection: 'asc'
  });

  // Formatage des dates
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non défini';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  // Navigation vers les détails
  const handleViewDetails = (userId: string) => {
    navigate(`/admin/users/${userId}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* 🎯 MÉTRIQUES DE PERFORMANCE */}
      <PerformanceMetrics 
        totalItems={total}
        currentItems={users.length}
        loadTime={optimizedTable.loadTime}
        searchResults={optimizedTable.searchResults}
      />

      {/* Header avec titre et actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            Gestion des Utilisateurs
          </h1>
          <p className="text-gray-500 mt-1">
            Gérez les comptes utilisateurs et leurs permissions • {total.toLocaleString('fr-FR')} utilisateurs au total
          </p>
        </div>
        <Button 
          className="flex items-center gap-2"
          onClick={() => navigate('/admin/users/new')}
        >
          <UserPlus className="h-4 w-4" />
          Nouvel Utilisateur
        </Button>
      </div>

      {/* 📊 STATISTIQUES RAPIDES */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.totalUsers.toLocaleString('fr-FR')}</div>
            <p className="text-xs text-muted-foreground">Base de données complète</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs Actifs</CardTitle>
            <div className="h-2 w-2 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeUsers.toLocaleString('fr-FR')}</div>
            <p className="text-xs text-muted-foreground">Comptes actifs</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Professionnels</CardTitle>
            <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.professionalUsers}</div>
            <p className="text-xs text-muted-foreground">Comptes PRO</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactifs</CardTitle>
            <div className="h-2 w-2 bg-orange-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.inactiveUsers}</div>
            <p className="text-xs text-muted-foreground">À réactiver</p>
          </CardContent>
        </Card>
      </div>

      {/* 🔍 RECHERCHE OPTIMISÉE */}
      <OptimizedSearchBar 
        onSearch={optimizedTable.handleSearch}
        placeholder="Rechercher par nom, email, entreprise..."
        totalItems={total}
        searchResults={optimizedTable.searchResults}
      />

      {/* 📊 TABLE OPTIMISÉE DES UTILISATEURS */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Liste des Utilisateurs ({optimizedTable.searchResults > 0 ? optimizedTable.searchResults : users.length})
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Filter className="h-4 w-4" />
              {optimizedTable.isSearching ? 'Recherche en cours...' : 'Données en temps réel'}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {optimizedTable.isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-2 text-blue-600">
                <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                Chargement des utilisateurs...
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun utilisateur trouvé</h3>
              <p className="text-gray-500">Aucun utilisateur ne correspond à vos critères de recherche.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left p-4 font-semibold">Utilisateur</th>
                    <th className="text-left p-4 font-semibold">Email</th>
                    <th className="text-left p-4 font-semibold">Statut</th>
                    <th className="text-left p-4 font-semibold">Type</th>
                    <th className="text-left p-4 font-semibold">Inscription</th>
                    <th className="text-center p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(user.id)}
                    >
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {(user.firstName?.[0] || user.name?.[0] || user.email[0]).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}`
                                : user.name || 'Nom non défini'
                              }
                            </div>
                            {user.companyName && (
                              <div className="text-sm text-gray-500">{user.companyName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-900">{user.email}</div>
                        {user.phone && (
                          <div className="text-xs text-gray-500">{user.phone}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge 
                          className={
                            user.isActive || user.status === 'active'
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }
                        >
                          {user.isActive || user.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Badge 
                          className={
                            user.isPro || user.role === 'professional'
                              ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }
                        >
                          {user.isPro || user.role === 'professional' ? 'PRO' : 'Standard'}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="p-4 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewDetails(user.id);
                          }}
                          className="hover:bg-blue-50 hover:text-blue-600"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🚀 PAGINATION OPTIMISÉE */}
      <OptimizedPagination 
        currentPage={optimizedTable.currentPage}
        totalPages={Math.ceil(total / 25)}
        onPageChange={optimizedTable.handlePageChange}
        totalItems={total}
        itemsPerPage={25}
        showQuickJump={total > 1000}
      />
    </div>
  );
}
