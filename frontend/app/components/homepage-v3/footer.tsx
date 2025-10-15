import { Facebook, Twitter, Instagram, Youtube, Linkedin } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <h4 className="text-xl font-bold mb-4 text-orange-500">AutoMecanik</h4>
            <p className="text-gray-400">Votre spécialiste en pièces automobiles depuis 2010</p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Liens Utiles</h4>
            <ul className="space-y-2">
              <li><a href="/about" className="text-gray-400 hover:text-white">À propos</a></li>
              <li><a href="/cgv" className="text-gray-400 hover:text-white">CGV</a></li>
              <li><a href="/mentions-legales" className="text-gray-400 hover:text-white">Mentions légales</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Service Client</h4>
            <ul className="space-y-2">
              <li><a href="/faq" className="text-gray-400 hover:text-white">FAQ</a></li>
              <li><a href="/contact" className="text-gray-400 hover:text-white">Contact</a></li>
              <li><a href="/livraison" className="text-gray-400 hover:text-white">Livraison</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Suivez-Nous</h4>
            <div className="flex space-x-4">
              <a href="https://facebook.com/automecanik" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
              <a href="https://twitter.com/automecanik" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white" aria-label="Twitter"><Twitter className="h-6 w-6" /></a>
              <a href="https://instagram.com/automecanik" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
              <a href="https://youtube.com/automecanik" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white" aria-label="Youtube"><Youtube className="h-6 w-6" /></a>
              <a href="https://linkedin.com/company/automecanik" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white" aria-label="Linkedin"><Linkedin className="h-6 w-6" /></a>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-gray-400">
          <p>&copy; 2025 AutoMecanik. Tous droits réservés.</p>
        </div>
      </div>
    </footer>
  );
}
