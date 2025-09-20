import { type MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Business Intelligence - Dashboard" },
    { name: "description", content: "Tableau de bord Business Intelligence" },
  ];
};

export default function BusinessRoute() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Outlet />
    </div>
  );
}
