import { redirect, type LoaderFunction } from "@remix-run/node";

// Redirection pour backward compatibility  
// account.dashboard.authenticated → account.dashboard?strict=true
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  
  // Préserver les paramètres existants et ajouter strict=true
  const params = new URLSearchParams(url.searchParams);
  params.set('strict', 'true');
  
  return redirect(`/account/dashboard?${params.toString()}`);
};
