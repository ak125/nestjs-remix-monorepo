/**
 * 🏢 ROUTE D'ÉDITION FOURNISSEUR - Admin Interface
 * ✅ Route dynamique pour /admin/suppliers/:id/edit
 * ✅ Redirige vers le composant de formulaire unifié
 */

import { type MetaFunction } from "react-router";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () =>
  createNoIndexMeta("Modifier Fournisseur - Admin");

export { default, loader } from "./admin.suppliers";
