import { type MetaFunction } from "@remix-run/node";
import { Button } from '~/components/ui/button';
import { Link } from "@remix-run/react";
import { Phone, Mail, MapPin, Clock, MessageCircle, FileText, HelpCircle } from "lucide-react";

export const meta: MetaFunction = () => {
  return [
    { title: "Aide & Support - Automecanik" },
    { name: "description", content: "Trouvez de l'aide et du support pour vos commandes et questions" },
  ];
};

export default function Aide() {
  const faqItems = [
    {
      question: "Comment passer une commande ?",
      reponse: "Ajoutez vos articles au panier, connectez-vous ou créez un compte, puis suivez le processus de commande."
    },
    {
      question: "Quels sont les délais de livraison ?",
      reponse: "Les délais varient selon la disponibilité des pièces : 24-48h pour les pièces en stock, 3-7 jours pour les commandes spéciales."
    },
    {
      question: "Puis-je annuler ma commande ?",
      reponse: "Oui, tant que votre commande n'est pas expédiée. Contactez-nous rapidement après votre commande."
    },
    {
      question: "Comment identifier la bonne pièce ?",
      reponse: "Utilisez notre outil de recherche par véhicule ou contactez notre équipe technique avec votre numéro de châssis."
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Centre d'Aide</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Nous sommes là pour vous aider ! Trouvez rapidement les réponses à vos questions ou contactez notre équipe.
        </p>
      </div>
      
      {/* Contact rapide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-blue-50 rounded-lg p-6 text-center">
          <Phone className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Téléphone</h3>
          <p className="text-gray-600 mb-3">Lun-Ven : 8h-18h<br />Sam : 8h-12h</p>
          <a href="tel:+33123456789" className="text-blue-600 font-semibold hover:underline">
            01 23 45 67 89
          </a>
        </div>
        
        <div className="bg-green-50 rounded-lg p-6 text-center">
          <Mail className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Email</h3>
          <p className="text-gray-600 mb-3">Réponse sous 24h<br />7j/7</p>
          <a href="mailto:contact@automecanik.com" className="text-green-600 font-semibold hover:underline">
            contact@automecanik.com
          </a>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-6 text-center">
          <MessageCircle className="w-12 h-12 text-purple-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Chat en ligne</h3>
          <p className="text-gray-600 mb-3">Support instantané<br />Lun-Ven : 9h-17h</p>
          <button className="text-purple-600 font-semibold hover:underline">
            Démarrer le chat
          </button>
        </div>
      </div>
      
      {/* FAQ */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          <HelpCircle className="w-8 h-8 inline-block mr-2" />
          Questions Fréquentes
        </h2>
        
        <div className="max-w-3xl mx-auto space-y-4">
          {faqItems.map((item, index) => (
            <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{item.question}</h3>
              <p className="text-gray-600">{item.reponse}</p>
            </div>
          ))}
        </div>
      </div>
      
      {/* Liens utiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <FileText className="w-6 h-6 mr-2" />
            Guides & Tutoriels
          </h3>
          <ul className="space-y-3">
            <li>
              <Link to="/guide/installation" className="text-blue-600 hover:underline">
                Guide d'installation des pièces
              </Link>
            </li>
            <li>
              <Link to="/guide/entretien" className="text-blue-600 hover:underline">
                Conseils d'entretien véhicule
              </Link>
            </li>
            <li>
              <Link to="/guide/diagnostic" className="text-blue-600 hover:underline">
                Comment diagnostiquer une panne
              </Link>
            </li>
            <li>
              <Link to="/guide/commande" className="text-blue-600 hover:underline">
                Comment passer commande
              </Link>
            </li>
          </ul>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            <Clock className="w-6 h-6 mr-2" />
            Informations Pratiques
          </h3>
          <ul className="space-y-3">
            <li>
              <Link to="/livraison" className="text-blue-600 hover:underline">
                Informations de livraison
              </Link>
            </li>
            <li>
              <Link to="/retours" className="text-blue-600 hover:underline">
                Politique de retour
              </Link>
            </li>
            <li>
              <Link to="/garantie" className="text-blue-600 hover:underline">
                Conditions de garantie
              </Link>
            </li>
            <li>
              <Link to="/paiement" className="text-blue-600 hover:underline">
                Moyens de paiement acceptés
              </Link>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Informations de contact détaillées */}
      <div className="bg-gray-50 rounded-lg p-8">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            <MapPin className="w-8 h-8 inline-block mr-2" />
            Nous Trouver
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Adresse</h4>
              <p className="text-gray-600 mb-4">
                Automecanik SARL<br />
                123 Avenue des Mécaniciens<br />
                75000 Paris, France
              </p>
              
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Horaires</h4>
              <div className="text-gray-600 space-y-1">
                <p><strong>Lun-Ven:</strong> 8h00 - 18h00</p>
                <p><strong>Samedi:</strong> 8h00 - 12h00</p>
                <p><strong>Dimanche:</strong> Fermé</p>
              </div>
            </div>
            
            <div className="bg-gray-200 rounded-lg h-64 flex items-center justify-center">
              <p className="text-gray-500">Carte à intégrer ici</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Call to action */}
      <div className="text-center mt-12">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          Vous ne trouvez pas votre réponse ?
        </h3>
        <p className="text-gray-600 mb-6">
          Notre équipe d'experts est à votre disposition pour vous aider
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button className="px-8 py-3 rounded-lg" variant="blue">\n  Contactez-nous\n</Button>
          <Link 
            to="/profile" 
            className="border border-blue-600 text-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Mon compte
          </Link>
        </div>
      </div>
    </div>
  );
}
