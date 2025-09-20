import { redirect } from "@remix-run/node";

export async function loader() {
  // Redirection automatique de /order vers /orders
  return redirect("/orders", 301);
}

export default function OrderRedirect() {
  // Ce composant ne sera jamais rendu car on redirige toujours
  return null;
}
