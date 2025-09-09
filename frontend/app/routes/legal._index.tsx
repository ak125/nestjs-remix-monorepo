import { redirect } from "@remix-run/node";

export async function loader() {
  // Rediriger vers la page CGV par défaut
  return redirect("/legal/cgv");
}
