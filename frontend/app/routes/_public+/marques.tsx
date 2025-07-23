import { type MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Marques - Automecanik" },
    { name: "description", content: "Découvrez toutes les marques automobiles disponibles" },
  ];
};

export default function Marques() {
  const marques = [
    { nom: "Renault", logo: "/images/marques/renault.png", description: "Véhicules français" },
    { nom: "Peugeot", logo: "/images/marques/peugeot.png", description: "Lion français" },
    { nom: "Citroën", logo: "/images/marques/citroen.png", description: "Chevrons français" },
    { nom: "BMW", logo: "/images/marques/bmw.png", description: "Plaisir de conduire" },
    { nom: "Mercedes-Benz", logo: "/images/marques/mercedes.png", description: "L'étoile allemande" },
    { nom: "Audi", logo: "/images/marques/audi.png", description: "Les quatre anneaux" },
    { nom: "Volkswagen", logo: "/images/marques/volkswagen.png", description: "Das Auto" },
    { nom: "Ford", logo: "/images/marques/ford.png", description: "Ford Motor Company" },
    { nom: "Opel", logo: "/images/marques/opel.png", description: "Éclair allemand" },
    { nom: "Fiat", logo: "/images/marques/fiat.png", description: "Marque italienne" },
    { nom: "Toyota", logo: "/images/marques/toyota.png", description: "Fiabilité japonaise" },
    { nom: "Nissan", logo: "/images/marques/nissan.png", description: "Innovation japonaise" }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Toutes nos Marques</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Nous proposons des pièces détachées et accessoires pour un large éventail de marques automobiles. 
          Trouvez facilement les pièces compatibles avec votre véhicule.
        </p>
      </div>
      
      {/* Grille des marques */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
        {marques.map((marque) => (
          <div 
            key={marque.nom}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer group"
          >
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-50 transition-colors">
                <span className="text-2xl font-bold text-gray-400">{marque.nom.charAt(0)}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">{marque.nom}</h3>
              <p className="text-sm text-gray-600">{marque.description}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Section recherche par marque */}
      <div className="bg-blue-50 rounded-lg p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Rechercher par marque</h2>
          <p className="text-gray-600 mb-6">
            Sélectionnez votre marque de véhicule pour accéder directement aux pièces compatibles
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 max-w-lg mx-auto">
            <select className="flex-1 p-3 border border-gray-300 rounded-lg bg-white">
              <option>Choisissez votre marque...</option>
              {marques.map((marque) => (
                <option key={marque.nom} value={marque.nom}>{marque.nom}</option>
              ))}
            </select>
            <button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              Voir les pièces
            </button>
          </div>
        </div>
      </div>
      
      {/* Informations supplémentaires */}
      <div className="mt-12 bg-gray-50 rounded-lg p-8">
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
            Votre marque ne figure pas dans la liste ?
          </h3>
          <p className="text-gray-600 text-center mb-6">
            Nous travaillons constamment pour élargir notre gamme de marques et de véhicules supportés. 
            N'hésitez pas à nous contacter pour vérifier la disponibilité des pièces pour votre véhicule.
          </p>
          <div className="text-center">
            <button className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors mr-4">
              Nous contacter
            </button>
            <button className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors">
              Demande spéciale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
