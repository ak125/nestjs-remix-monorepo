import { Link, NavLink } from '@remix-run/react';
import { Car, Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Plus, Search, Settings, Star, Twitter, Users, Wrench, Youtube } from 'lucide-react';
import { useEffect } from 'react';
import { useSeoLinkTracking, type LinkType } from '../hooks/useSeoLinkTracking';

// 🚗 Top Marques pour le maillage interne SEO
// Ancres optimisées: "Pièces [Marque]" pour meilleur CTR et pertinence
const TOP_MARQUES = [
    { name: 'Peugeot', alias: 'peugeot', id: 128, anchor: 'Pièces auto Peugeot' },
    { name: 'Renault', alias: 'renault', id: 140, anchor: 'Pièces détachées Renault' },
    { name: 'Citroën', alias: 'citroen', id: 42, anchor: 'Pièces Citroën' },
    { name: 'Volkswagen', alias: 'volkswagen', id: 173, anchor: 'Pièces VW Golf & Polo' },
    { name: 'BMW', alias: 'bmw', id: 33, anchor: 'Pièces BMW Série 3 & 5' },
    { name: 'Mercedes', alias: 'mercedes-benz', id: 90, anchor: 'Pièces Mercedes Classe A & C' },
    { name: 'Audi', alias: 'audi', id: 22, anchor: 'Pièces Audi A3 & A4' },
    { name: 'Ford', alias: 'ford', id: 53, anchor: 'Pièces Ford Focus & Fiesta' },
];

// 🔧 Gammes populaires pour le maillage interne SEO  
// Ancres optimisées: nom gamme + mot-clé secondaire
const TOP_GAMMES = [
    { name: 'Plaquettes de frein', alias: 'plaquettes-de-frein', id: 1, anchor: 'Plaquettes de frein avant/arrière' },
    { name: 'Disque de frein', alias: 'disque-de-frein', id: 2, anchor: 'Disques de frein ventilés' },
    { name: 'Filtre à huile', alias: 'filtre-a-huile', id: 7, anchor: 'Filtres à huile moteur' },
    { name: 'Filtre à air', alias: 'filtre-a-air', id: 8, anchor: 'Filtres à air habitacle' },
    { name: 'Kit de distribution', alias: 'kit-de-distribution', id: 5, anchor: 'Kit distribution complet' },
    { name: 'Amortisseur', alias: 'amortisseur', id: 15, anchor: 'Amortisseurs avant/arrière' },
    { name: 'Kit d\'embrayage', alias: 'kit-d-embrayage', id: 12, anchor: 'Kit embrayage + volant moteur' },
    { name: 'Batterie', alias: 'batterie', id: 100, anchor: 'Batteries auto 12V' },
];

export const Footer = () => {
    const { trackClick, trackImpression } = useSeoLinkTracking();

    // Track les impressions des liens footer au montage
    useEffect(() => {
        trackImpression('TopMarques', TOP_MARQUES.length);
        trackImpression('GammesPopulaires', TOP_GAMMES.length);
        trackImpression('Footer', 10); // Liens utiles + infos légales
    }, [trackImpression]);

    // Handler pour tracker les clics
    const handleMarqueClick = (marque: typeof TOP_MARQUES[0]) => {
        trackClick('TopMarques', `/constructeurs/${marque.alias}-${marque.id}.html`, {
            anchorText: marque.anchor,
            position: 'footer'
        });
    };

    const handleGammeClick = (gamme: typeof TOP_GAMMES[0]) => {
        trackClick('GammesPopulaires', `/pieces/${gamme.alias}-${gamme.id}.html`, {
            anchorText: gamme.anchor,
            position: 'footer'
        });
    };

    const handleFooterLinkClick = (url: string, text: string) => {
        trackClick('Footer', url, {
            anchorText: text,
            position: 'footer'
        });
    };

    return (
        <>
            {/* Footer principal desktop */}
            <footer className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white py-12 hidden md:block">
                <div className="container mx-auto px-4">
                    {/* Section SEO: Top Marques & Gammes populaires */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 pb-8 border-b border-neutral-700">
                        {/* Top Marques */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                <Car size={20} className="text-semantic-info" />
                                Top Marques Automobiles
                            </h3>
                            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {TOP_MARQUES.map((marque) => (
                                    <li key={marque.id}>
                                        <Link 
                                            to={`/constructeurs/${marque.alias}-${marque.id}.html`}
                                            className="text-neutral-400 hover:text-semantic-info transition-colors text-sm"
                                            onClick={() => handleMarqueClick(marque)}
                                            title={`Toutes les pièces détachées ${marque.name}`}
                                        >
                                            {marque.anchor}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <Link 
                                to="/constructeurs"
                                className="inline-flex items-center gap-1 mt-3 text-semantic-info hover:text-white text-sm transition-colors"
                            >
                                Toutes les marques →
                            </Link>
                        </div>

                        {/* Gammes populaires */}
                        <div>
                            <h3 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
                                <Settings size={20} className="text-semantic-info" />
                                Gammes Populaires
                            </h3>
                            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {TOP_GAMMES.map((gamme) => (
                                    <li key={gamme.id}>
                                        <Link 
                                            to={`/pieces/${gamme.alias}-${gamme.id}.html`}
                                            className="text-neutral-400 hover:text-semantic-info transition-colors text-sm"
                                            onClick={() => handleGammeClick(gamme)}
                                            title={`Acheter ${gamme.name} - Prix bas`}
                                        >
                                            {gamme.anchor}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <Link 
                                to="/pieces"
                                className="inline-flex items-center gap-1 mt-3 text-semantic-info hover:text-white text-sm transition-colors"
                            >
                                Tout le catalogue →
                            </Link>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                        {/* Colonne 1: À propos */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-semantic-info">À propos</h3>
                            <p className="text-neutral-400 mb-4 leading-relaxed">
                                Votre spécialiste de pièces détachées automobiles neuves et d'origine.
                                Plus de 500 000 références pour toutes les marques et modèles.
                            </p>
                            <div className="flex gap-3">
                                <a href="https://facebook.com/automecanik" target="_blank" rel="noopener noreferrer" 
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Facebook size={20} />
                                </a>
                                <a href="https://twitter.com/automecanik" target="_blank" rel="noopener noreferrer"
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Twitter size={20} />
                                </a>
                                <a href="https://linkedin.com/company/automecanik" target="_blank" rel="noopener noreferrer"
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Linkedin size={20} />
                                </a>
                                <a href="https://instagram.com/automecanik" target="_blank" rel="noopener noreferrer"
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Instagram size={20} />
                                </a>
                                <a href="https://youtube.com/automecanik" target="_blank" rel="noopener noreferrer"
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Youtube size={20} />
                                </a>
                            </div>
                        </div>

                        {/* Colonne 2: Liens utiles */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-semantic-info">Liens utiles</h3>
                            <ul className="space-y-2">
                                <li>
                                    <Link to="/pieces" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Catalogue pièces
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/constructeurs" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Constructeurs
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/blog-pieces-auto" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Blog & Conseils
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/contact" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Contact
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/aide" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Aide & FAQ
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Colonne 3: Informations légales */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-semantic-info">Informations légales</h3>
                            <ul className="space-y-2">
                                <li>
                                    <Link to="/terms" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Conditions d'utilisation
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/privacy" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Politique de confidentialité
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/cookies" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Gestion des cookies
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/legal-notices" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Mentions légales
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/cgv" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        CGV
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        {/* Colonne 4: Contact */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-semantic-info">Contact</h3>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <MapPin size={20} className="text-semantic-info mt-1 flex-shrink-0" />
                                    <span className="text-neutral-400">
                                        123 Avenue des Pièces Auto<br />
                                        75001 Paris, France
                                    </span>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Phone size={20} className="text-semantic-info flex-shrink-0" />
                                    <a href="tel:+33123456789" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        +33 1 23 45 67 89
                                    </a>
                                </li>
                                <li className="flex items-center gap-3">
                                    <Mail size={20} className="text-semantic-info flex-shrink-0" />
                                    <a href="mailto:contact@piecesauto.fr" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        contact@piecesauto.fr
                                    </a>
                                </li>
                            </ul>
                            <div className="mt-4">
                                <p className="text-sm text-neutral-400">
                                    Horaires d'ouverture<br />
                                    <span className="text-white">Lun - Ven: 9h - 18h</span><br />
                                    <span className="text-white">Sam: 9h - 12h</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Ligne de séparation */}
                    <div className="border-t border-neutral-700 pt-6">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <p className="text-neutral-400 text-sm">
                                © {new Date().getFullYear()} Pièces Auto B2B. Tous droits réservés.
                            </p>
                            <div className="flex gap-4 text-sm">
                                <Link to="/sitemap" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                    Plan du site
                                </Link>
                                <span className="text-neutral-600">•</span>
                                <Link to="/accessibility" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                    Accessibilité
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Navigation mobile en bas (conservée pour mobile) */}
            <footer className='md:hidden overflow-x-auto px-3 py-2 flex items-center justify-between gap-4 mt-auto bg-lightTurquoise'>
                <FooterLinkItem href='/' icon={<Search />} label='Rechercher' />
                <FooterLinkItem href='/' icon={<Users />} label='Offreurs' />
                <FooterLinkItem href='/' icon={<Plus />} label='Demandes' />
                <FooterLinkItem href='/' icon={<Star />} label='Favoris' />
                <FooterLinkItem href='/' icon={<Mail />} label='Message' />
            </footer>
        </>
    );
};

const FooterLinkItem = ({
    icon,
    label,
    href,
}: {
    label: string;
    icon: React.ReactNode;
    href: string;
}) => {
    return (
        <NavLink
            className={({ isActive }) =>
                `flex flex-col items-center text-sm ${isActive ? 'text-vert' : 'text-bleu'}`
            }
            to={href}
        >
            {icon} <span className="text-bleu">{label}</span>
        </NavLink>
    );
};