/**
 * Route de déconnexion
 * Utilise seulement la méthode POST pour déconnecter l'utilisateur
 */

import { redirect, type ActionFunction } from "@remix-run/node";

export const action: ActionFunction = async ({ request, context }) => {
  // ✅ Approche intégrée : appel direct au service via Remix
  if (!context.remixService?.integration) {
    return redirect('/?error=service-unavailable');
  }

  try {
    const result = await context.remixService.integration.logoutUserForRemix();

    if (result.success) {
      // Suivre la redirection vers la page d'accueil
      return redirect('/', {
        headers: {
          'Set-Cookie': 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly'
        }
      });
    } else {
      console.error('❌ Erreur logout:', result.error);
      return redirect('/?error=logout-failed');
    }
  } catch (error) {
    console.error('❌ Erreur dans logout action:', error);
    return redirect('/?error=logout-error');
  }
};

export default function Logout() {
  return null;
}
