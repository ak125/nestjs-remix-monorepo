/**
 * Route de redirection legacy : /blog-pieces-auto/conseils/:pg_alias
 * Redirige vers : /blog/article/:ba_alias
 * 
 * Exemple :
 * /blog-pieces-auto/conseils/alternateur 
 * → /blog/article/comment-changer-votre-alternateur
 */

import { type LoaderFunctionArgs, redirect } from "@remix-run/node";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const { pg_alias } = params;
  
  if (!pg_alias) {
    // Pas de gamme spécifiée, rediriger vers homepage blog
    return redirect('/blog', 301);
  }

  try {
    // Appeler l'API pour trouver l'article correspondant à cette gamme
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/blog/article/by-gamme/${pg_alias}`,
      {
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );

    if (!response.ok) {
      // Article non trouvé, rediriger vers homepage blog
      console.warn(`[Legacy URL] Article not found for gamme: ${pg_alias}`);
      return redirect('/blog', 301);
    }

    const { data: article } = await response.json();

    if (!article || !article.slug) {
      return redirect('/blog', 301);
    }

    // Redirection 301 permanente vers la nouvelle URL
    console.log(`[Legacy URL] Redirecting ${pg_alias} → ${article.slug}`);
    return redirect(`/blog/article/${article.slug}`, 301);
    
  } catch (error) {
    console.error(`[Legacy URL] Error redirecting ${pg_alias}:`, error);
    // En cas d'erreur, rediriger vers homepage
    return redirect('/blog', 301);
  }
}

// Composant par défaut (ne sera jamais rendu à cause de la redirection)
export default function LegacyBlogRedirect() {
  return null;
}
