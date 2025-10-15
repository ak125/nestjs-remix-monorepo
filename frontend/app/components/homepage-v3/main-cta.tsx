export function MainCTA() {
  return (
    <section className="py-20 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">
          Ne manquez pas la pièce qui complète votre véhicule
        </h2>
        <p className="text-xl mb-8 opacity-90">
          Plus de 50 000 références en stock • Livraison express • Garantie constructeur
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/recherche" className="bg-white text-indigo-600 px-8 py-4 rounded-full font-semibold hover:bg-gray-100 transition text-lg">
            Je commence ma recherche →
          </a>
          <a href="/contact" className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white hover:text-indigo-600 transition text-lg">
            Contactez-nous
          </a>
        </div>
      </div>
    </section>
  );
}
