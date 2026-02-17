import { Outlet } from "@remix-run/react";

/**
 * Layout parent pour toutes les routes /admin/rag/*
 * Rend simplement un <Outlet /> pour afficher les sous-routes.
 */
export default function AdminRagLayout() {
  return <Outlet />;
}
