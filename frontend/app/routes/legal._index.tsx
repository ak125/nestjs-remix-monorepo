import { redirect } from "react-router";

export async function loader() {
  // Rediriger vers la page CGV par défaut
  return redirect("/legal/cgv");
}
