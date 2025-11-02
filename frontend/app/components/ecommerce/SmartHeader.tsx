/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🚗 SMART HEADER E-COMMERCE - Automobile
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Header intelligent optimisé pour site e-commerce pièces auto avec :
 * • Recherche centrale (marque/modèle/moteur/année)
 * • CTA "Mon véhicule" mémorisé
 * • Sticky (visible tout le temps)
 * • Responsive mobile → desktop
 * 
 * Design System intégré :
 * • Couleurs : Secondary (navigation), Primary (CTA)
 * • Typographie : Montserrat (headings), Inter (body), Roboto Mono (data)
 * • Espacement : 8px grid (sm, md, lg, xl)
 */

import { useState, useEffect } from 'react';

// Types
export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  engine?: string;
  year: number;
}

interface SmartHeaderProps {
  savedVehicle?: Vehicle | null;
  onVehicleSelect?: (vehicle: Vehicle) => void;
  onSearch?: (query: string) => void;
  cartItemCount?: number;
  logoUrl?: string;
  companyName?: string;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 SMART HEADER COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function SmartHeader({
  savedVehicle,
  onVehicleSelect: _onVehicleSelect,
  onSearch,
  cartItemCount = 0,
  logoUrl = '/logo.svg',
  companyName = 'AutoPieces Pro',
}: SmartHeaderProps) {
  // State
  const [isSticky, setIsSticky] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sticky header on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  return (
    <>
      {/* 
        ═════════════════════════════════════════════════════════════════════
        HEADER PRINCIPAL (Sticky)
        ═════════════════════════════════════════════════════════════════════
        • bg-secondary-500 → Navigation (Bleu acier)
        • Sticky avec shadow au scroll
        • py-sm/md → Espacement vertical adaptatif
      */}
      <header
        className={`
          fixed top-0 left-0 right-0 z-50
          bg-secondary-500 text-white
          transition-all duration-300
          ${isSticky ? 'shadow-lg py-sm' : 'py-md'}
        `}
      >
        <div className="max-w-7xl mx-auto px-md">
          {/* 
            ─────────────────────────────────────────────────────────────────
            Top Bar - Desktop
            ─────────────────────────────────────────────────────────────────
          */}
          <div className="hidden lg:flex items-center justify-between gap-lg">
            {/* 
              Logo + Nom (font-heading)
              • gap-sm → Espacement serré entre logo et texte
            */}
            <a href="/" className="flex items-center gap-sm hover:opacity-90 transition-opacity">
              <img src={logoUrl} alt={companyName} className="h-8" />
              <span className="font-heading text-xl font-bold">{companyName}</span>
            </a>

            {/* 
              Recherche Centrale Intelligente
              • Largeur maximale pour visibilité
              • border-secondary-400 → Contraste subtil
              • p-sm → Padding serré input
            */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="relative">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Recherche par marque, modèle, moteur, référence..."
                  className="
                    w-full py-sm px-md
                    bg-secondary-600 border border-secondary-400
                    text-white placeholder-secondary-200
                    font-sans text-sm
                    rounded-lg
                    focus:outline-none focus:ring-2 focus:ring-primary-500
                    transition-all
                  "
                />
                
                {/* Icône recherche */}
                <button
                  type="submit"
                  className="
                    absolute right-xs top-1/2 -translate-y-1/2
                    p-sm
                    text-secondary-200 hover:text-white
                    transition-colors
                  "
                  aria-label="Rechercher"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </div>

              {/* 
                Suggestions rapides
                • gap-xs → Micro-espacement entre badges
              */}
              <div className="flex items-center gap-xs mt-xs">
                <span className="font-sans text-xs text-secondary-200">Recherches fréquentes:</span>
                {['Plaquettes frein', 'Filtre huile', 'Disques frein'].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      onSearch?.(term);
                    }}
                    className="
                      px-xs py-xs
                      bg-secondary-600 hover:bg-secondary-500
                      text-secondary-100 hover:text-white
                      font-sans text-xs
                      rounded
                      transition-colors
                    "
                  >
                    {term}
                  </button>
                ))}
              </div>
            </form>

            {/* 
              ═════════════════════════════════════════════════════════════
              CTA "Mon Véhicule" (Primary)
              ═════════════════════════════════════════════════════════════
              • bg-primary-500 → CTA Action
              • font-heading → Montserrat (robustesse)
              • p-sm → Padding compact pour header
              • Affiche véhicule mémorisé si présent
            */}
            <button
              onClick={() => setIsVehicleModalOpen(true)}
              className="
                flex items-center gap-sm
                px-md py-sm
                bg-primary-500 hover:bg-primary-600
                text-white
                font-heading font-semibold text-sm
                rounded-lg
                shadow-md hover:shadow-lg
                transition-all
                whitespace-nowrap
              "
            >
              {/* Icône voiture */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>

              {/* Texte adaptatif */}
              {savedVehicle ? (
                <div className="text-left">
                  <div className="font-heading text-sm font-bold">
                    {savedVehicle.brand} {savedVehicle.model}
                  </div>
                  <div className="font-mono text-xs opacity-90">
                    {savedVehicle.engine} • {savedVehicle.year}
                  </div>
                </div>
              ) : (
                <span>Mon véhicule</span>
              )}
            </button>

            {/* 
              Actions secondaires
              • gap-sm → Espacement serré entre icônes
            */}
            <div className="flex items-center gap-sm">
              {/* Compte */}
              <a
                href="/account"
                className="
                  p-sm
                  text-secondary-100 hover:text-white
                  transition-colors
                "
                aria-label="Mon compte"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </a>

              {/* Panier avec compteur */}
              <a
                href="/cart"
                className="
                  relative
                  p-sm
                  text-secondary-100 hover:text-white
                  transition-colors
                "
                aria-label={`Panier (${cartItemCount} articles)`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                
                {/* Badge compteur (bg-primary-500) */}
                {cartItemCount > 0 && (
                  <span className="
                    absolute -top-xs -right-xs
                    px-xs py-xs
                    min-w-[20px]
                    bg-primary-500
                    text-white
                    font-mono text-xs font-bold
                    rounded-full
                    flex items-center justify-center
                  ">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </a>
            </div>
          </div>

          {/* 
            ─────────────────────────────────────────────────────────────────
            Mobile Bar
            ─────────────────────────────────────────────────────────────────
          */}
          <div className="lg:hidden flex items-center justify-between">
            {/* Menu burger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-sm text-white"
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo mobile */}
            <a href="/" className="flex items-center gap-xs">
              <img src={logoUrl} alt={companyName} className="h-6" />
              <span className="font-heading text-lg font-bold">{companyName}</span>
            </a>

            {/* Actions mobile */}
            <div className="flex items-center gap-xs">
              <button
                onClick={() => setIsVehicleModalOpen(true)}
                className="p-sm text-white"
                aria-label="Mon véhicule"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              <a href="/cart" className="relative p-sm text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {cartItemCount > 0 && (
                  <span className="absolute -top-xs -right-xs px-xs min-w-[16px] bg-primary-500 text-white font-mono text-xs rounded-full flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </a>
            </div>
          </div>

          {/* Recherche mobile (sous le header) */}
          <form onSubmit={handleSearch} className="lg:hidden mt-sm">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Recherche..."
              className="
                w-full py-sm px-sm
                bg-secondary-600 border border-secondary-400
                text-white placeholder-secondary-200
                font-sans text-sm
                rounded-lg
              "
            />
          </form>
        </div>

        {/* 
          ═════════════════════════════════════════════════════════════════
          Navigation Secondaire (Categories)
          ═════════════════════════════════════════════════════════════════
          • bg-secondary-600 → Nuance plus foncée
          • gap-lg → Espacement sections
        */}
        {!isSticky && (
          <nav className="hidden lg:block bg-secondary-600 mt-sm">
            <div className="max-w-7xl mx-auto px-md py-sm">
              <ul className="flex items-center gap-lg font-sans text-sm">
                {[
                  'Freinage',
                  'Filtration',
                  'Moteur',
                  'Transmission',
                  'Suspension',
                  'Éclairage',
                  'Promotions',
                ].map((category) => (
                  <li key={category}>
                    <a
                      href={`/category/${category.toLowerCase()}`}
                      className="text-secondary-100 hover:text-white transition-colors"
                    >
                      {category}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}
      </header>

      {/* Spacer pour compenser le header fixed */}
      <div className={isSticky ? 'h-16' : 'h-24'} />

      {/* 
        ═════════════════════════════════════════════════════════════════════
        Mobile Menu Drawer
        ═════════════════════════════════════════════════════════════════════
      */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setIsMobileMenuOpen(false)}>
          <div
            className="absolute left-0 top-0 bottom-0 w-80 bg-white p-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-lg">
              <h2 className="font-heading text-xl font-bold text-neutral-900">Menu</h2>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav>
              <ul className="space-y-sm font-sans">
                {[
                  'Freinage',
                  'Filtration',
                  'Moteur',
                  'Transmission',
                  'Suspension',
                  'Éclairage',
                  'Promotions',
                ].map((category) => (
                  <li key={category}>
                    <a
                      href={`/category/${category.toLowerCase()}`}
                      className="block py-sm px-md text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
                    >
                      {category}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      )}

      {/* 
        ═════════════════════════════════════════════════════════════════════
        Modal Sélection Véhicule
        ═════════════════════════════════════════════════════════════════════
        TODO: Implémenter formulaire sélection véhicule
      */}
      {isVehicleModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-md"
          onClick={() => setIsVehicleModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg p-xl max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
              Sélectionnez votre véhicule
            </h2>
            <p className="font-sans text-neutral-600 mb-lg">
              Formulaire à implémenter : Marque → Modèle → Moteur → Année
            </p>
            <button
              onClick={() => setIsVehicleModalOpen(false)}
              className="px-lg py-sm bg-neutral-200 hover:bg-neutral-300 rounded-lg font-heading transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default SmartHeader;
