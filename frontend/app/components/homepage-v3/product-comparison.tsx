export function ProductComparison() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">Comparaison de Produits</h2>
        <div className="overflow-x-auto">
          <table className="w-full bg-white rounded-xl shadow-lg overflow-hidden">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="px-6 py-4">Produit</th>
                <th className="px-6 py-4">Prix</th>
                <th className="px-6 py-4">Garantie</th>
                <th className="px-6 py-4">Note</th>
                <th className="px-6 py-4">Livraison</th>
                <th className="px-6 py-4">Stock</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-semibold">Kit de distribution</td>
                <td className="px-6 py-4">89.99€</td>
                <td className="px-6 py-4">2 ans</td>
                <td className="px-6 py-4">⭐ 4.8</td>
                <td className="px-6 py-4">24h</td>
                <td className="px-6 py-4 text-green-600">✓ En stock</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
