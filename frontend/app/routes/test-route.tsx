// Test simple pour vérifier que les routes fonctionnent
export async function loader() {
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