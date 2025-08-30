/**
 * Route pour créer un nouvel article
 * Redirige vers l'interface d'édition avec le paramètre 'new'
 */

import { redirect } from "@remix-run/node";

export function loader() {
  return redirect("/admin/articles/new/edit");
}
