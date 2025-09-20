import { redirect, type LoaderFunction } from "@remix-run/node";

// Redirection pour backward compatibility
// account.dashboard.enhanced → account.dashboard?enhanced=true
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  
  // Préserver les paramètres existants et ajouter enhanced=true
  const params = new URLSearchParams(url.searchParams);
  params.set('enhanced', 'true');
  
  return redirect(`/account/dashboard?${params.toString()}`);
};
