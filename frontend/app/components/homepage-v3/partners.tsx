export function Partners() {
  const partners = ['BOSCH', 'VALEO', 'MANN', 'SKF', 'FERODO', 'BREMBO'];
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">Nos Partenaires de Confiance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
          {partners.map((partner) => (
            <div key={partner} className="bg-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition flex items-center justify-center">
              <span className="text-2xl font-bold text-gray-800">{partner}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
