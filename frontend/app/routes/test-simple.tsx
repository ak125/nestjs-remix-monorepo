// Test simple pour vérifier que Remix fonctionne
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export async function loader({ params: _params }: LoaderFunctionArgs) {
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