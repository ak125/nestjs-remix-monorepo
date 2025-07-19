/**
 * Système d'authentification simple pour l'admin
 * Utilise des sessions temporaires pour les tests
 */

const ADMIN_CREDENTIALS = {
  email: "admin@autoparts.com",
  password: "admin123",
  id: "admin-1",
  name: "Admin User",
  isPro: true,
  level: 9
};

export const authenticateAdmin = (email: string, password: string) => {
  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    return {
      id: ADMIN_CREDENTIALS.id,
      email: ADMIN_CREDENTIALS.email,
      name: ADMIN_CREDENTIALS.name,
      isPro: ADMIN_CREDENTIALS.isPro,
      level: ADMIN_CREDENTIALS.level
    };
  }
  return null;
};

export const mockUser = {
  id: ADMIN_CREDENTIALS.id,
  email: ADMIN_CREDENTIALS.email,
  name: ADMIN_CREDENTIALS.name,
  isPro: ADMIN_CREDENTIALS.isPro,
  level: ADMIN_CREDENTIALS.level
};
