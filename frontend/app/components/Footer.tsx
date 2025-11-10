import { Link, NavLink } from '@remix-run/react';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Plus, Search, Star, Twitter, Users, Youtube } from 'lucide-react';

export const Footer = () => {
    return (
        <>
            {/* Footer principal desktop */}
            <footer className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white py-12 hidden md:block">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                        {/* Colonne 1: À propos */}
                        <div>
                            <h3 className="text-xl font-bold mb-4 text-semantic-info">À propos</h3>
                            <p className="text-neutral-400 mb-4 leading-relaxed">
                                Votre plateforme B2B de référence pour les pièces automobiles. 
                                Connectez-vous avec les meilleurs fournisseurs et optimisez votre activité.
                            </p>
                            <div className="flex gap-3">
                                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" 
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Facebook size={20} />
                                </a>
                                <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Twitter size={20} />
                                </a>
                                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Linkedin size={20} />
                                </a>
                                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                                   className="bg-neutral-800 hover:bg-semantic-info transition-colors p-2 rounded-full">
                                    <Instagram size={20} />
                                </a>
                                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
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
                                    <Link to="/catalog" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Catalogue produits
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/suppliers" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Nos fournisseurs
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/about" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Qui sommes-nous ?
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/contact" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        Contact
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/faq" className="text-neutral-400 hover:text-semantic-info transition-colors">
                                        FAQ
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