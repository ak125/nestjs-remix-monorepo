export function BlogSection() {
  const articles = [
    { title: '5 erreurs à éviter lors de l\'achat de pièces auto', date: '2025-10-10', category: 'Conseils' },
    { title: 'Comment choisir son kit de distribution', date: '2025-10-08', category: 'Guide' },
    { title: 'Entretien auto : le calendrier à respecter', date: '2025-10-05', category: 'Entretien' },
  ];
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold text-center mb-12">Blog & Conseils</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {articles.map((article, index) => (
            <article key={index} className="bg-gray-50 rounded-xl overflow-hidden hover:shadow-xl transition">
              <div className="h-48 bg-gradient-to-br from-blue-400 to-indigo-600"></div>
              <div className="p-6">
                <span className="text-sm text-indigo-600 font-semibold">{article.category}</span>
                <h3 className="text-xl font-bold mt-2 mb-4">{article.title}</h3>
                <p className="text-gray-600 text-sm">{article.date}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
