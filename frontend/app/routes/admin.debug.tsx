import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getOptionalUser } from "../auth/unified.server";

export async function loader({ context }: LoaderFunctionArgs) {
  const user = await getOptionalUser({ context });
  
  return json({
    user: user,
    context: {
      hasUser: !!context.user,
      userType: typeof context.user,
      userKeys: context.user ? Object.keys(context.user) : []
    }
  });
}

export default function AdminDebug() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">🔍 Debug Admin Access</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">👤 Utilisateur:</h2>
          <pre className="text-sm">{JSON.stringify(data.user, null, 2)}</pre>
        </div>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">📋 Context Info:</h2>
          <pre className="text-sm">{JSON.stringify(data.context, null, 2)}</pre>
        </div>
        
        <div className="bg-muted p-4 rounded">
          <h2 className="font-bold mb-2">🎯 Conditions d'accès Admin:</h2>
          <ul className="text-sm space-y-1">
            <li>✅ Utilisateur connecté: {data.user ? 'OUI' : 'NON'}</li>
            {data.user && (
              <>
                <li>🎚️ Level: {data.user.level || 'non défini'}</li>
                <li>👑 isAdmin: {data.user.isAdmin ? 'OUI' : 'NON'}</li>
                <li>📧 Email: {data.user.email}</li>
                <li>🆔 ID: {data.user.id}</li>
                <li>✅ Level {'>'}= 5: {(data.user.level || 0) >= 5 ? 'OUI' : 'NON'}</li>
                <li>✅ Level {'>'}= 7: {(data.user.level || 0) >= 7 ? 'OUI' : 'NON'}</li>
              </>
            )}
          </ul>
        </div>
        
        <div className="bg-success/10 p-4 rounded">
          <h2 className="font-bold mb-2">🚀 Test des routes:</h2>
          <div className="space-y-2">
            <a href="/admin" className="block text-blue-600 hover:underline">
              📍 /admin (layout principal)
            </a>
            <a href="/admin/orders" className="block text-blue-600 hover:underline">
              📦 /admin/orders (commandes complètes)
            </a>
            <a href="/admin/orders" className="block text-blue-600 hover:underline">
              📦 /admin/orders (version consolidée)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
