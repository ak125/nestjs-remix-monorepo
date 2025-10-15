export function Newsletter() {
  return (
    <section className="py-20 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 max-w-2xl text-center">
        <h2 className="text-4xl font-bold mb-4">📧 Inscrivez-vous à notre newsletter</h2>
        <p className="text-xl mb-2 opacity-90">Rejoignez notre communauté et bénéficiez de 10% de réduction sur votre prochaine commande</p>
        <p className="text-sm opacity-75 mb-8">✓ Offres exclusives · ✓ Conseils experts · ✓ Nouveautés</p>
        <form className="flex gap-4">
          <input type="email" placeholder="votre@email.com" className="flex-1 px-6 py-4 rounded-full text-gray-900" required />
          <button type="submit" className="bg-orange-500 hover:bg-orange-600 px-8 py-4 rounded-full font-semibold transition">
            Je m'inscris
          </button>
        </form>
        <p className="text-xs opacity-75 mt-4">🔒 Vos données sont protégées. Désabonnement facile.</p>
      </div>
    </section>
  );
}
