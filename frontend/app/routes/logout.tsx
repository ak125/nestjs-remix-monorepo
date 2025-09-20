import { type ActionFunctionArgs, redirect } from "@remix-run/node";

export const action = async ({ request, context: _context }: ActionFunctionArgs) => {
  console.log('--- Remix Logout Action ---');
  
  try {
    // Faire un POST vers le backend pour déconnecter
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(`${backendUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Cookie': request.headers.get('Cookie') || '',
        'Content-Type': 'application/json'
      },
    });
    
    console.log('Réponse backend logout:', response.status, response.statusText);
    
    // Récupérer les headers de réponse pour les cookies
    const setCookieHeader = response.headers.get('Set-Cookie');
    
    // Rediriger vers la page d'accueil avec les nouveaux cookies
    return redirect('/', {
      headers: setCookieHeader ? {
        'Set-Cookie': setCookieHeader
      } : undefined
    });
    
  } catch (error) {
    console.error('Erreur lors du logout:', error);
    // En cas d'erreur, rediriger quand même
    return redirect('/');
  }
};

// Loader pour rediriger les accès GET
export const loader = async () => {
  return redirect('/');
};

export default function Logout() {
  return null;
}
