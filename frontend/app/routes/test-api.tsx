// Simple test pour diagnostiquer le problème
export default function TestAPIPage() {
  const handleTestDirect = async () => {
    try {
      console.log('🔥 Test direct fetch /api/orders');
      const response = await fetch('/api/orders');
      console.log('🔥 Response status:', response.status);
      console.log('🔥 Response headers:', Object.fromEntries(response.headers));
      
      const data = await response.json();
      console.log('🔥 Response data:', {
        hasOrders: !!data.orders,
        ordersLength: data.orders?.length,
        total: data.total,
        firstOrder: data.orders?.[0]
      });
      
      alert(`SUCCESS! Got ${data.total} orders`);
    } catch (error) {
      console.error('🔥 Error:', error);
      alert(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test API Direct</h1>
      <button 
        onClick={handleTestDirect}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Tester fetch('/api/orders') directement
      </button>
    </div>
  );
}
