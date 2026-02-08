/**
 * 📝 SEO HUB - CONTENT BLOG
 *
 * Gestion des articles blog (guides, conseils)
 * Re-dirige vers le gestionnaire de blog existant
 */

import {
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@remix-run/node";
import { createNoIndexMeta } from "~/utils/meta-helpers";

export const meta: MetaFunction = () => createNoIndexMeta("Blog SEO - Admin");

export async function loader({ request }: LoaderFunctionArgs) {
  // Rediriger vers la page d'admin blog existante
  return redirect("/admin/blog");
}

export default function SeoHubContentBlog() {
  return null;
}
