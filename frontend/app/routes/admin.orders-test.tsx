import { useOrders } from '~/hooks/api-hooks';

export default function AdminOrdersTestPage() {
  const { data, loading, error } = useOrders();
  
  console.log('🔍 Test Simple - useOrders:', {
    data,
    loading,
    error,
    ordersArray: data?.orders,
    ordersLength: data?.orders?.length,
    total: data?.total
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Simple - useOrders</h1>
      
      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-bold">État du hook:</h2>
        <p>Loading: {loading ? 'OUI' : 'NON'}</p>
        <p>Error: {error || 'AUCUNE'}</p>
        <p>Data: {data ? 'PRÉSENT' : 'ABSENT'}</p>
        <p>Orders: {data?.orders?.length || 0}</p>
        <p>Total: {data?.total || 0}</p>
      </div>

      {loading && <p>Chargement...</p>}
      {error && <p className="text-red-500">Erreur: {error}</p>}
      {data && (
        <div>
          <h2 className="font-bold">Données reçues:</h2>
          <pre className="bg-gray-800 text-white p-4 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
