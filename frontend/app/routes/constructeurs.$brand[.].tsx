// Redirection pour les anciennes URLs sans .html vers les nouvelles avec .html
// Format ancien: /constructeurs/{constructeur}-{id}
// Format nouveau: /constructeurs/{constructeur}-{id}.html
import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const { brand } = params;
  
  if (!brand) {
    throw new Response("Brand parameter missing", { status: 400 });
  }

  // Redirection permanente (301) vers la version avec .html
  return redirect(`/constructeurs/${brand}.html`, 301);
}

export default function RedirectRoute() {
  // Ce composant ne sera jamais rendu car on redirige toujours
  return null;
}
