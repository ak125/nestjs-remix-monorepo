import { type MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Catalogue - Automecanik" },
    { name: "description", content: "Découvrez notre catalogue complet de pièces automobiles" },
  ];
};

export default function Catalogue() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Notre Catalogue</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {/* Catégories principales */}
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Moteur</h2>
          <p className="text-gray-600 mb-4">Pièces moteur, filtres, huiles, courroies...</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Voir les produits
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Freinage</h2>
          <p className="text-gray-600 mb-4">Plaquettes, disques, liquides de frein...</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Voir les produits
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Suspension</h2>
          <p className="text-gray-600 mb-4">Amortisseurs, ressorts, silentblocs...</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Voir les produits
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Électrique</h2>
          <p className="text-gray-600 mb-4">Batteries, alternateurs, démarreurs...</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Voir les produits
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Carrosserie</h2>
          <p className="text-gray-600 mb-4">Optiques, pare-chocs, rétroviseurs...</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Voir les produits
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Accessoires</h2>
          <p className="text-gray-600 mb-4">Outils, produits d'entretien, accessoires...</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors">
            Voir les produits
          </button>
        </div>
      </div>
      
      {/* Section recherche */}
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Recherche avancée</h2>
        <p className="text-gray-600 mb-6">Trouvez rapidement les pièces adaptées à votre véhicule</p>
        
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <select className="flex-1 p-3 border border-gray-300 rounded-lg">
              <option>Sélectionner la marque</option>
              <option>Renault</option>
              <option>Peugeot</option>
              <option>Citroën</option>
              <option>BMW</option>
              <option>Mercedes</option>
            </select>
            <select className="flex-1 p-3 border border-gray-300 rounded-lg">
              <option>Sélectionner le modèle</option>
            </select>
            <input 
              type="text" 
              placeholder="Année ou motorisation"
              className="flex-1 p-3 border border-gray-300 rounded-lg"
            />
          </div>
          <button className="w-full md:w-auto bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors">
            Rechercher les pièces
          </button>
        </div>
      </div>
    </div>
  );
}
