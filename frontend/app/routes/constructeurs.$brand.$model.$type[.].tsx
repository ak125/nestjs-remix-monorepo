// Redirection pour les anciennes URLs sans .html vers les nouvelles avec .html
// Format ancien: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}
// Format nouveau: /constructeurs/{marque}-{id}/{modele}-{id}/{type}-{id}.html
import { redirect, type LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ params }: LoaderFunctionArgs) {
  const { brand, model, type } = params;
  
  if (!brand || !model || !type) {
    throw new Response("Parameters missing", { status: 400 });
  }

  // Redirection permanente (301) vers la version avec .html
  return redirect(`/constructeurs/${brand}/${model}/${type}.html`, 301);
}

export default function RedirectRoute() {
  // Ce composant ne sera jamais rendu car on redirige toujours
  return null;
}
