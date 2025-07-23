import { Outlet, Link } from "@remix-run/react";

const adminLinks = [
  { to: "/admin/dashboard", name: "Dashboard" },
  { to: "/admin/staff", name: "Personnel" },
  { to: "/admin/suppliers", name: "Fournisseurs" },
  { to: "/admin/customers", name: "Clients" },
  { to: "/admin/orders", name: "Commandes" },
  { to: "/admin/payments", name: "Paiements" },
  { to: "/admin/reports", name: "Rapports" },
];

export default function AdminLayout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Admin</h1>
        <nav>
          <ul>
            {adminLinks.map((link) => (
              <li key={link.to} className="mb-2">
                <Link
                  to={link.to}
                  className="block p-2 rounded hover:bg-gray-700"
                >
                  {link.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
