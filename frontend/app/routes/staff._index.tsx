/**
 * 👥 STAFF INDEX - Route moderne alignée sur les autres modules
 * 
 * Route principale pour la gestion du staff administratif
 * Utilise remixService.getStaff() et remixService.getStaffStatistics()
 * Architecture moderne alignée avec orders, users, suppliers
 */

import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { Plus, Edit, Trash, Eye, Users, Crown, Shield, Settings } from "lucide-react";
import { requireUser } from "../auth/unified.server";
import { Button } from "../components/ui/button";
import { getRemixApiService } from "../server/remix-api.server";

// Interface pour les données staff modernes
interface StaffMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  department?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StaffStatistics {
  total: number;
  active: number;
  inactive: number;
  departments: number;
  byLevel?: Record<string, number>;
  byDepartment?: Record<string, number>;
}

interface StaffData {
  staff: StaffMember[];
  statistics: StaffStatistics;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
  };
}

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  await requireUser({ context });
  
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const status = url.searchParams.get("status");
  const department = url.searchParams.get("department");
  const search = url.searchParams.get("search");
  
  try {
    const remixService = await getRemixApiService(context);
    
    // Récupération des données staff via l'API moderne
    const staffResult = await remixService.getStaff({ 
      page, 
      limit, 
      status, 
      department, 
      search 
    });
    
    const statisticsResult = await remixService.getStaffStatistics();
    
    if (!staffResult.success) {
      throw new Error(staffResult.error || 'Erreur lors du chargement du staff');
    }
    
    return json({
      staff: staffResult.staff || [],
      statistics: statisticsResult.statistics || {
        total: 0,
        active: 0,
        inactive: 0,
        departments: 0
      },
      pagination: staffResult.pagination,
      success: true,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    console.error('Erreur loader staff:', error);
    
    return json({
      staff: [],
      statistics: {
        total: 0,
        active: 0,
        inactive: 0,
        departments: 0
      },
      pagination: { page: 1, totalPages: 1, total: 0 },
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      timestamp: new Date().toISOString(),
    });
  }
};

export default function StaffIndex() {
  const { staff, statistics, error } = useLoaderData<StaffData & { error?: string; success?: boolean }>();
  
  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800 border-green-200' 
      : 'bg-red-100 text-red-800 border-red-200';
  };

  const getRoleColor = (role: string) => {
    if (role.includes('Super')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (role.includes('Admin')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (role.includes('Manager')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };
  
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion du Personnel</h1>
          <p className="text-gray-600 mt-1">Administration et supervision du staff</p>
        </div>
        <Link to="/staff/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Ajouter un membre
          </Button>
        </Link>
      </div>

      {/* Erreur */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <span className="font-medium">Erreur : {error}</span>
          </div>
        </div>
      )}
      
      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total}</p>
              <p className="text-xs text-gray-500">Membres</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Actifs</p>
              <p className="text-2xl font-bold text-green-600">{statistics.active}</p>
              <p className="text-xs text-gray-500">En service</p>
            </div>
            <Shield className="h-8 w-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inactifs</p>
              <p className="text-2xl font-bold text-gray-600">{statistics.inactive}</p>
              <p className="text-xs text-gray-500">Hors service</p>
            </div>
            <Settings className="h-8 w-8 text-gray-500" />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Départements</p>
              <p className="text-2xl font-bold text-purple-600">{statistics.departments}</p>
              <p className="text-xs text-gray-500">Services</p>
            </div>
            <Crown className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>
      
      {/* Liste du personnel */}
      <div className="bg-white rounded-lg shadow overflow-hidden border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Personnel Administratif</h3>
          <p className="text-sm text-gray-500 mt-1">
            {staff.length} membre{staff.length > 1 ? 's' : ''} affiché{staff.length > 1 ? 's' : ''}
          </p>
        </div>
        
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nom
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rôle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Département
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
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="h-12 w-12 text-gray-300" />
                    <span className="text-lg font-medium">Aucun membre trouvé</span>
                    <span className="text-sm">Aucun personnel n'est configuré pour le moment</span>
                  </div>
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {member.firstName?.[0]}{member.lastName?.[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {member.firstName} {member.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {member.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getRoleColor(member.role)}`}>
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.department || 'Non assigné'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full border ${getStatusColor(member.isActive)}`}>
                      {member.isActive ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link to={`/staff/${member.id}`}>
                        <Button variant="outline" size="sm" className="hover:bg-blue-50">
                          <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                      </Link>
                      <Link to={`/staff/${member.id}/edit`}>
                        <Button variant="outline" size="sm" className="hover:bg-yellow-50">
                          <Edit className="h-4 w-4 text-yellow-600" />
                        </Button>
                      </Link>
                      <Button variant="outline" size="sm" className="hover:bg-red-50">
                        <Trash className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Message informatif */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2 text-blue-700">
          <Users className="h-5 w-5" />
          <span className="font-medium">Interface Staff Moderne</span>
          <span className="text-blue-600 text-sm">
            - Utilise remixService.getStaff() et remixService.getStaffStatistics()
          </span>
        </div>
      </div>
    </div>
  );
}
