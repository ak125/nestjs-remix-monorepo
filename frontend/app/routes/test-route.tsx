// Test simple pour vérifier que les routes fonctionnent
export async function loader() {
  // 🛡️ Production Guard: Cette route est uniquement pour dev/test
  if (process.env.NODE_ENV === "production") {
    throw new Response("Not Found", { status: 404 });
  }
  
  return { message: "Route test fonctionne!" };
}

export default function TestRoute() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Route de test</h1>
      <p>Si vous voyez cette page, les routes fonctionnent correctement.</p>
    </div>
  );
}