// 🏭 Layout principal pour toutes les routes constructeurs
import { Outlet } from "@remix-run/react";

export default function ConstructeursLayout() {
  return (
    <div className="constructeurs-layout">
      <Outlet />
    </div>
  );
}