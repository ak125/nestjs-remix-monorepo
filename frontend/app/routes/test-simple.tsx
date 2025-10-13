// Test simple pour vérifier que Remix fonctionne
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ params: _params }: LoaderFunctionArgs) {
  // 🛡️ Production Guard: Cette route est uniquement pour dev/test
  if (process.env.NODE_ENV === "production") {
    throw new Response("Not Found", { status: 404 });
  }
  
  console.log('🔄 Test simple loader called');
  return json({ message: 'Test réussi !', timestamp: new Date().toISOString() });
}

export default function TestSimple() {
  console.log('🎨 Test simple component rendering');
  const data = useLoaderData<typeof loader>();
  
  return (
    <div style={{ padding: '20px', backgroundColor: 'lightgreen' }}>
      <h1>Page de test simple</h1>
      <p>Message : {data.message}</p>
      <p>Timestamp : {data.timestamp}</p>
    </div>
  );
}