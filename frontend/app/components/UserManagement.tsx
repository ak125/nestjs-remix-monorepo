/**
 * Composant UserManagement - Interface complète de gestion des utilisateurs
 * Basé sur l'analyse legacy PHP et aligné avec le backend NestJS
 */

import React, { useState, useEffect } from 'react';
import { useUsers, useUserActions, useActiveUsers, useUsersByLevel } from '~/hooks/api-hooks';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tel: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  level: number;
  isActive: boolean;
  isPro: boolean;
  createdAt: string;
  lastLogin?: string;
}

interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  tel: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  isPro: boolean;
  level: number;
  password?: string;
}

export default function UserManagement() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Hooks pour les données
  const { data: usersData, loading: usersLoading, error: usersError, refetch: refetchUsers } = useUsers({
    page: currentPage,
    limit: 20,
    search: searchTerm || undefined,
  });

  const { data: activeUsersData, loading: activeLoading } = useActiveUsers({
    page: currentPage,
    limit: 20,
  });

  const { data: levelUsersData, loading: levelLoading } = useUsersByLevel(selectedLevel || 0);

  // Hooks pour les actions
  const {
    createUser,
    updateUser,
    updateUserLevel,
    deactivateUser,
    activateUser,
    loading: actionLoading,
    error: actionError,
  } = useUserActions();

  // Données à afficher selon les filtres
  const displayData = showActiveOnly ? activeUsersData : usersData;
  const displayUsers = selectedLevel !== null ? levelUsersData : displayData?.users || [];

  // Form state
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    firstName: '',
    lastName: '',
    tel: '',
    address: '',
    city: '',
    zipCode: '',
    country: 'FR',
    isPro: false,
    level: 1,
    password: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData);
      } else {
        await createUser({ ...formData, password: formData.password || 'defaultPassword123' });
      }
      
      setShowCreateForm(false);
      setEditingUser(null);
      setFormData({
        email: '',
        firstName: '',
        lastName: '',
        tel: '',
        address: '',
        city: '',
        zipCode: '',
        country: 'FR',
        isPro: false,
        level: 1,
        password: '',
      });
      
      refetchUsers();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tel: user.tel,
      address: user.address,
      city: user.city,
      zipCode: user.zipCode,
      country: user.country,
      isPro: user.isPro,
      level: user.level,
    });
    setShowCreateForm(true);
  };

  const handleLevelChange = async (userId: string, newLevel: number) => {
    try {
      await updateUserLevel(userId, newLevel);
      refetchUsers();
    } catch (error) {
      console.error('Erreur lors du changement de niveau:', error);
    }
  };

  const handleDeactivateUser = async (userId: string, reason?: string) => {
    try {
      await deactivateUser(userId, reason);
      refetchUsers();
    } catch (error) {
      console.error('Erreur lors de la désactivation:', error);
    }
  };

  const handleActivateUser = async (userId: string) => {
    try {
      await activateUser(userId);
      refetchUsers();
    } catch (error) {
      console.error('Erreur lors de l\'activation:', error);
    }
  };

  const getLevelLabel = (level: number) => {
    const levels = {
      0: 'Invité',
      1: 'Client',
      2: 'Client Pro',
      5: 'Revendeur',
      8: 'Staff',
      9: 'Admin',
    };
    return levels[level as keyof typeof levels] || `Niveau ${level}`;
  };

  const getStatusColor = (user: User) => {
    if (!user.isActive) return 'bg-red-100 text-red-800';
    if (user.level >= 8) return 'bg-purple-100 text-purple-800';
    if (user.level >= 5) return 'bg-blue-100 text-blue-800';
    if (user.isPro) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestion des Utilisateurs</h1>
        <p className="text-gray-600">
          Gestion complète des comptes utilisateurs basée sur le système legacy
        </p>
      </div>

      {/* Filtres et Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Recherche */}
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher par email, nom..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Filtre par niveau */}
            <select
              value={selectedLevel || ''}
              onChange={(e) => setSelectedLevel(e.target.value ? parseInt(e.target.value) : null)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les niveaux</option>
              <option value="0">Invités (0)</option>
              <option value="1">Clients (1)</option>
              <option value="2">Clients Pro (2)</option>
              <option value="5">Revendeurs (5)</option>
              <option value="8">Staff (8)</option>
              <option value="9">Admins (9)</option>
            </select>

            {/* Filtre actifs uniquement */}
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Actifs uniquement</span>
            </label>
          </div>

          {/* Bouton Nouveau */}
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Nouvel Utilisateur
          </button>
        </div>
      </div>

      {/* Messages d'erreur */}
      {(usersError || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="text-red-800">
            {usersError || actionError}
          </div>
        </div>
      )}

      {/* Tableau des utilisateurs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Niveau
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Dernière connexion
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(usersLoading || activeLoading || levelLoading) ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : !displayUsers || displayUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                displayUsers.map((user: User) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.tel}</div>
                      <div className="text-sm text-gray-500">
                        {user.city}, {user.country}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user)}`}>
                        {user.isActive ? 'Actif' : 'Inactif'}
                      </span>
                      {user.isPro && (
                        <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          Pro
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={user.level}
                        onChange={(e) => handleLevelChange(user.id, parseInt(e.target.value))}
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
                        disabled={actionLoading}
                      >
                        <option value={0}>Invité (0)</option>
                        <option value={1}>Client (1)</option>
                        <option value={2}>Client Pro (2)</option>
                        <option value={5}>Revendeur (5)</option>
                        <option value={8}>Staff (8)</option>
                        <option value={9}>Admin (9)</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-blue-600 hover:text-blue-900"
                        disabled={actionLoading}
                      >
                        Modifier
                      </button>
                      {user.isActive ? (
                        <button
                          onClick={() => handleDeactivateUser(user.id, 'Désactivation manuelle')}
                          className="text-red-600 hover:text-red-900"
                          disabled={actionLoading}
                        >
                          Désactiver
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivateUser(user.id)}
                          className="text-green-600 hover:text-green-900"
                          disabled={actionLoading}
                        >
                          Activer
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {displayData && displayData.total > 20 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage * 20 >= displayData.total}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Suivant
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{((currentPage - 1) * 20) + 1}</span> à{' '}
                  <span className="font-medium">{Math.min(currentPage * 20, displayData.total)}</span> sur{' '}
                  <span className="font-medium">{displayData.total}</span> utilisateurs
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    disabled={currentPage * 20 >= displayData.total}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  >
                    Suivant
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de création/édition */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingUser ? 'Modifier l\'utilisateur' : 'Créer un nouvel utilisateur'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {!editingUser && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        required={!editingUser}
                        className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Prénom</label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom</label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                    <input
                      type="tel"
                      name="tel"
                      value={formData.tel}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Adresse</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Ville</label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Code postal</label>
                    <input
                      type="text"
                      name="zipCode"
                      value={formData.zipCode}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pays</label>
                    <select
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="FR">France</option>
                      <option value="BE">Belgique</option>
                      <option value="CH">Suisse</option>
                      <option value="LU">Luxembourg</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Niveau</label>
                    <select
                      name="level"
                      value={formData.level}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value={0}>Invité (0)</option>
                      <option value={1}>Client (1)</option>
                      <option value={2}>Client Pro (2)</option>
                      <option value={5}>Revendeur (5)</option>
                      <option value={8}>Staff (8)</option>
                      <option value={9}>Admin (9)</option>
                    </select>
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="isPro"
                        checked={formData.isPro}
                        onChange={handleInputChange}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Compte professionnel</span>
                    </label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setEditingUser(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Sauvegarde...' : editingUser ? 'Modifier' : 'Créer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
