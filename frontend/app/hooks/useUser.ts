/**
 * Hook useUser - Gestion simple de l'utilisateur
 * Compatible avec l'architecture Remix + Session
 */
import { useState, useEffect } from 'react';

interface User {
  id: string;
  role: string;
  name?: string;
  email?: string;
}

interface UseUserReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);

  useEffect(() => {
    // Simuler un utilisateur pour la démo
    // En production, ceci viendrait de Remix loader ou session
    const mockUser: User = {
      id: 'user-demo-commercial',
      role: 'admin',
      name: 'Admin Commercial',
      email: 'admin@commercial.com'
    };

    // Simuler un délai de chargement
    const timer = setTimeout(() => {
      setUser(mockUser);
      setLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return { user, loading, error };
}
