import { redirect } from "@remix-run/node";

/**
 * Utilitaire pour récupérer l'utilisateur authentifié depuis la session
 * Compatible avec l'architecture NestJS/Passport existante
 */

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isPro?: boolean;
  isActive?: boolean;
  level?: number;
  isAdmin?: boolean;
}

/**
 * Récupère l'utilisateur depuis la session Remix/NestJS
 */
export async function getAuthUser(request: Request): Promise<AuthUser | null> {
  try {
    const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
    
    // Appel à l'endpoint profile avec les cookies de session
    const response = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || ''
      }
    });

    if (!response.ok) {
      console.log(`Auth check failed: ${response.status}`);
      return null;
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error("Erreur lors de la vérification d'authentification:", error);
    return null;
  }
}

/**
 * Require que l'utilisateur soit authentifié, sinon redirige vers login
 */
export async function requireAuth(request: Request): Promise<AuthUser> {
  const user = await getAuthUser(request);
  
  if (!user) {
    throw redirect('/login?redirect=' + encodeURIComponent(new URL(request.url).pathname));
  }
  
  return user;
}

/**
 * Require que l'utilisateur soit admin, sinon redirige vers unauthorized
 */
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireAuth(request);
  
  if (!user.isAdmin && (!user.level || user.level < 7)) {
    throw redirect('/unauthorized');
  }
  
  return user;
}
