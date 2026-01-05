import { Badge } from '~/components/ui';
import { Form, useNavigate } from "@remix-run/react";
import { useState } from "react";
import { Button } from '~/components/ui/button';

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  level?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  role?: string;
  isActive?: boolean;
  isPro?: boolean;
  createdAt?: string;
}

interface UserListProps {
  users: User[];
  total: number;
  currentPage: number;
  itemsPerPage: number;
  searchQuery?: string;
}

export function UserList({ 
  users, 
  total, 
  currentPage, 
  itemsPerPage, 
  searchQuery = "" 
}: UserListProps) {
  const navigate = useNavigate();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const totalPages = Math.ceil(total / itemsPerPage);
  
  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };
  
  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(users.map(u => u.id));
    }
  };
  
  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <Form method="get" className="flex gap-4">
        <input
          type="text"
          name="search"
          defaultValue={searchQuery}
          placeholder="Rechercher par email, nom..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Button className="px-6 py-2  rounded-lg" variant="blue" type="submit">\n  Rechercher\n</Button>
      </Form>
      
      {/* Tableau des utilisateurs */}
      <div className="bg-white shadow-sm rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === users.length && users.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nom
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Téléphone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ville
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
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
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={() => handleSelectUser(user.id)}
                    className="rounded"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {user.email}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {user.firstName} {user.lastName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.phone || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.city || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.isPro ? (
                    <Badge variant="default">PRO</Badge>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                      Standard
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {user.isActive !== false ? (
                    <Badge variant="success">Actif</Badge>
                  ) : (
                    <Badge variant="error">Inactif</Badge>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => navigate(`/admin/users/${user.id}`)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    Voir
                  </button>
                  <button
                    onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {users.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Affichage de {((currentPage - 1) * itemsPerPage) + 1} à{' '}
            {Math.min(currentPage * itemsPerPage, total)} sur {total} utilisateurs
          </div>
          
          <div className="flex gap-2">
            <Form method="get">
              <input type="hidden" name="search" value={searchQuery} />
              <input type="hidden" name="page" value={Math.max(1, currentPage - 1)} />
              <button
                type="submit"
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
            </Form>
            
            <span className="px-3 py-1 text-sm">
              Page {currentPage} sur {totalPages}
            </span>
            
            <Form method="get">
              <input type="hidden" name="search" value={searchQuery} />
              <input type="hidden" name="page" value={Math.min(totalPages, currentPage + 1)} />
              <button
                type="submit"
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </Form>
          </div>
        </div>
      )}
    </div>
  );
}