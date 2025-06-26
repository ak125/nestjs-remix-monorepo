import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";

// Types
interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  role: 'CUSTOMER' | 'RESELLER' | 'ADMIN' | 'SA';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'EXPIRED';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserStats {
  total: number;
  byStatus: {
    active: number;
    suspended: number;
    pending: number;
  };
  byRole: {
    customers: number;
    resellers: number;
    admins: number;
  };
}

// Loader pour récupérer les données
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const role = url.searchParams.get("role") || "";
  const status = url.searchParams.get("status") || "";

  try {
    // Construction des paramètres de recherche
    const searchParams = new URLSearchParams();
    if (search) searchParams.append("name", search);
    if (role) searchParams.append("role", role);
    if (status) searchParams.append("status", status);

    // Appels API parallèles
    const [usersResponse, statsResponse] = await Promise.all([
      fetch(`http://localhost:3001/users?${searchParams.toString()}`),
      fetch(`http://localhost:3001/users/stats`)
    ]);

    if (!usersResponse.ok) {
      throw new Error(`Erreur lors de la récupération des utilisateurs: ${usersResponse.statusText}`);
    }

    if (!statsResponse.ok) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${statsResponse.statusText}`);
    }

    const users: User[] = await usersResponse.json();
    const stats: UserStats = await statsResponse.json();

    return json({ users, stats, filters: { search, role, status } });
  } catch (error) {
    console.error("Erreur loader users:", error);
    return json({ 
      users: [], 
      stats: { total: 0, byStatus: { active: 0, suspended: 0, pending: 0 }, byRole: { customers: 0, resellers: 0, admins: 0 } },
      filters: { search, role, status },
      error: "Erreur lors du chargement des utilisateurs" 
    });
  }
};

// Action pour gérer les opérations CRUD
export const action = async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const action = formData.get("_action") as string;

  try {
    switch (action) {
      case "activate": {
        const userId = formData.get("userId") as string;
        const response = await fetch(`http://localhost:3001/users/${userId}/activate`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`Erreur lors de l'activation: ${response.statusText}`);
        }

        return json({ success: true, message: "Utilisateur activé avec succès" });
      }

      case "suspend": {
        const userId = formData.get("userId") as string;
        const response = await fetch(`http://localhost:3001/users/${userId}/suspend`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`Erreur lors de la suspension: ${response.statusText}`);
        }

        return json({ success: true, message: "Utilisateur suspendu avec succès" });
      }

      case "delete": {
        const userId = formData.get("userId") as string;
        const response = await fetch(`http://localhost:3001/users/${userId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error(`Erreur lors de la suppression: ${response.statusText}`);
        }

        return json({ success: true, message: "Utilisateur supprimé avec succès" });
      }

      case "create": {
        const userData = {
          email: formData.get("email") as string,
          password: formData.get("password") as string,
          firstName: formData.get("firstName") as string,
          lastName: formData.get("lastName") as string,
          phone: formData.get("phone") as string,
          company: formData.get("company") as string,
          role: formData.get("role") as string,
          status: formData.get("status") as string
        };

        const response = await fetch('http://localhost:3001/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || `Erreur lors de la création: ${response.statusText}`);
        }

        return json({ success: true, message: "Utilisateur créé avec succès" });
      }

      default:
        return json({ success: false, message: "Action non reconnue" });
    }
  } catch (error) {
    console.error("Erreur action users:", error);
    return json({ 
      success: false, 
      message: error instanceof Error ? error.message : "Erreur lors de l'opération" 
    });
  }
};

export default function Users() {
  const { users, stats, filters, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [searchFilters, setSearchFilters] = useState({
    search: filters.search,
    role: filters.role,
    status: filters.status
  });

  const isLoading = navigation.state === "loading" || navigation.state === "submitting";

  // Gestion des filtres
  const handleFilterChange = (filterType: string, value: string) => {
    const newFilters = { ...searchFilters, [filterType]: value };
    setSearchFilters(newFilters);
    
    const searchParams = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, val]) => {
      if (val) searchParams.append(key, val);
    });
    
    submit(searchParams, { method: "get" });
  };

  // Gestion des actions utilisateur
  const handleUserAction = (action: string, userId: number) => {
    if (window.confirm(`Êtes-vous sûr de vouloir ${action === 'delete' ? 'supprimer' : action === 'activate' ? 'activer' : 'suspendre'} cet utilisateur ?`)) {
      const formData = new FormData();
      formData.append("_action", action);
      formData.append("userId", userId.toString());
      submit(formData, { method: "post" });
    }
  };

  // Fonction pour obtenir le badge de statut
  const getStatusBadge = (status: string, isActive: boolean) => {
    if (!isActive || status === 'SUSPENDED') {
      return <span style={{ padding: '4px 8px', backgroundColor: '#ff4444', color: 'white', borderRadius: '4px', fontSize: '12px' }}>Suspendu</span>;
    }
    if (status === 'ACTIVE') {
      return <span style={{ padding: '4px 8px', backgroundColor: '#44ff44', color: 'black', borderRadius: '4px', fontSize: '12px' }}>Actif</span>;
    }
    if (status === 'PENDING') {
      return <span style={{ padding: '4px 8px', backgroundColor: '#ffaa44', color: 'black', borderRadius: '4px', fontSize: '12px' }}>En attente</span>;
    }
    return <span style={{ padding: '4px 8px', backgroundColor: '#888', color: 'white', borderRadius: '4px', fontSize: '12px' }}>{status}</span>;
  };

  // Fonction pour obtenir le badge de rôle
  const getRoleBadge = (role: string) => {
    const colors = {
      'CUSTOMER': '#007bff',
      'RESELLER': '#6f42c1',
      'ADMIN': '#dc3545',
      'SA': '#fd7e14'
    };
    return <span style={{ padding: '4px 8px', backgroundColor: colors[role as keyof typeof colors] || '#6c757d', color: 'white', borderRadius: '4px', fontSize: '12px' }}>{role}</span>;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Gestion des Utilisateurs</h1>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '12px 24px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {showCreateForm ? 'Annuler' : 'Nouvel Utilisateur'}
        </button>
      </div>

      {/* Messages de statut */}
      {actionData?.message && (
        <div style={{
          padding: '1rem',
          backgroundColor: actionData.success ? '#d4edda' : '#f8d7da',
          color: actionData.success ? '#155724' : '#721c24',
          border: `1px solid ${actionData.success ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '6px',
          marginBottom: '1rem'
        }}>
          {actionData.message}
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '6px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Statistiques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>Total Utilisateurs</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#007bff' }}>{stats.total}</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>Actifs</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>{stats.byStatus.active}</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>En Attente</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffc107' }}>{stats.byStatus.pending}</div>
        </div>
        <div style={{ padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '6px', border: '1px solid #dee2e6' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#495057' }}>Suspendus</h3>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>{stats.byStatus.suspended}</div>
        </div>
      </div>

      {/* Formulaire de création */}
      {showCreateForm && (
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '2rem',
          borderRadius: '6px',
          border: '1px solid #dee2e6',
          marginBottom: '2rem'
        }}>
          <h2>Créer un Nouvel Utilisateur</h2>
          <Form method="post">
            <input type="hidden" name="_action" value="create" />
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Email *</label>
                <input
                  type="email"
                  name="email"
                  required
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Mot de passe *</label>
                <input
                  type="password"
                  name="password"
                  required
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Prénom *</label>
                <input
                  type="text"
                  name="firstName"
                  required
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Nom *</label>
                <input
                  type="text"
                  name="lastName"
                  required
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Téléphone</label>
                <input
                  type="tel"
                  name="phone"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Entreprise</label>
                <input
                  type="text"
                  name="company"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Rôle</label>
                <select
                  name="role"
                  defaultValue="CUSTOMER"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                >
                  <option value="CUSTOMER">Client</option>
                  <option value="RESELLER">Revendeur</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Statut</label>
                <select
                  name="status"
                  defaultValue="PENDING"
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
                >
                  <option value="PENDING">En attente</option>
                  <option value="ACTIVE">Actif</option>
                  <option value="SUSPENDED">Suspendu</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1
                }}
              >
                {isLoading ? 'Création...' : 'Créer l\'Utilisateur'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
            </div>
          </Form>
        </div>
      )}

      {/* Filtres */}
      <div style={{
        backgroundColor: 'white',
        padding: '1.5rem',
        borderRadius: '6px',
        border: '1px solid #dee2e6',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0' }}>Filtres</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Recherche (nom/prénom)</label>
            <input
              type="text"
              value={searchFilters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Rechercher un utilisateur..."
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Rôle</label>
            <select
              value={searchFilters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
            >
              <option value="">Tous les rôles</option>
              <option value="CUSTOMER">Client</option>
              <option value="RESELLER">Revendeur</option>
              <option value="ADMIN">Administrateur</option>
              <option value="SA">Super Admin</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Statut</label>
            <select
              value={searchFilters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #ced4da', borderRadius: '4px' }}
            >
              <option value="">Tous les statuts</option>
              <option value="ACTIVE">Actif</option>
              <option value="PENDING">En attente</option>
              <option value="SUSPENDED">Suspendu</option>
              <option value="EXPIRED">Expiré</option>
            </select>
          </div>
        </div>
      </div>

      {/* Liste des utilisateurs */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '6px',
        border: '1px solid #dee2e6',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '1rem',
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{ margin: 0 }}>Utilisateurs ({users.length})</h3>
          {isLoading && <div>Chargement...</div>}
        </div>

        {users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6c757d' }}>
            Aucun utilisateur trouvé
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Email</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Nom</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Entreprise</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Rôle</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Statut</th>
                  <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #dee2e6' }}>Créé le</th>
                  <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '1px solid #dee2e6' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '1rem' }}>{user.email}</td>
                    <td style={{ padding: '1rem' }}>{user.firstName} {user.lastName}</td>
                    <td style={{ padding: '1rem' }}>{user.company || '-'}</td>
                    <td style={{ padding: '1rem' }}>{getRoleBadge(user.role)}</td>
                    <td style={{ padding: '1rem' }}>{getStatusBadge(user.status, user.isActive)}</td>
                    <td style={{ padding: '1rem' }}>{new Date(user.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {user.status === 'SUSPENDED' || !user.isActive ? (
                          <button
                            onClick={() => handleUserAction('activate', user.id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#28a745',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Activer
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUserAction('suspend', user.id)}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#ffc107',
                              color: 'black',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            Suspendre
                          </button>
                        )}
                        <button
                          onClick={() => handleUserAction('delete', user.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
