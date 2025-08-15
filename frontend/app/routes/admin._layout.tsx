import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import { AdminSidebar } from "~/components/AdminSidebar";
import { getOptionalUser } from "../auth/unified.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  if (!user) throw redirect("/login");
  if (!user.level || user.level < 5) throw redirect("/unauthorized");
  return { user };
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="lg:pl-64">
        <main className="min-h-screen p-6">
          <div className="mb-4 text-sm text-gray-600">
            Connecté en tant que: {user.firstName} {user.lastName} ({user.email})
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
