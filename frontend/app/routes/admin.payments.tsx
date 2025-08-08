import { Outlet } from "@remix-run/react";

// Parent layout pour /admin/payments: délègue l'affichage aux routes enfants (_index, transactions, ...)
export default function AdminPaymentsLayout() {
  return <Outlet />;
}
