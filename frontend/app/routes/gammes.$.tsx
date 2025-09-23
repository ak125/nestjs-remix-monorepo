import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

/**
 * Route catch-all pour /gammes/*
 * Redirige automatiquement vers /pieces/*
 */
export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params["*"] || "";
  
  // Redirection permanente vers pieces
  return redirect(`/pieces/${slug}`, { status: 301 });
}

// Cette route ne rend jamais de composant car elle redirige toujours
export default function GammesRedirect() {
  return null;
}