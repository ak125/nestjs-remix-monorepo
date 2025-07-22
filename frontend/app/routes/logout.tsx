/**
 * Route de déconnexion
 * Utilise seulement la méthode POST pour déconnecter l'utilisateur
 */

import { redirect, type ActionFunction } from "@remix-run/node";

export const action: ActionFunction = async ({ request }) => {
  // Faire un POST vers le contrôleur backend pour déconnecter l'utilisateur
  try {
    const response = await fetch(`http://localhost:3000/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') || '',
      },
    });

    if (response.ok) {
      // Suivre la redirection du contrôleur backend
      return redirect('/', {
        headers: {
          'Set-Cookie': response.headers.get('Set-Cookie') || 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly'
        }
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Fallback: rediriger vers la page d'accueil
  return redirect('/');
};

export default function Logout() {
  return null;
}
