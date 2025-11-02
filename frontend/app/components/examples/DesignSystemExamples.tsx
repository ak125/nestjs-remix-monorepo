/**
 * 🎨 Design System - Exemples de Composants
 * 
 * Ce fichier démontre l'utilisation correcte du Design System avec :
 * 
 * 🎨 COULEURS MÉTIER (Règle : 1 Couleur = 1 Fonction)
 * ──────────────────────────────────────────────────────
 * • Primary (#FF3B30)    → CTA / Actions (Ajouter panier, Payer)
 * • Secondary (#0F4C81)  → Navigation / Confiance (Menu, liens)
 * • Success (#27AE60)    → Validation (Compatible, Stock OK)
 * • Warning (#F39C12)    → Alerte (Délai livraison, Stock faible)
 * • Error (#C0392B)      → Erreur (Incompatible, Erreur paiement)
 * • Neutral (#F5F7FA)    → Fond clair / Texte principal
 * 
 * 📝 TYPOGRAPHIE MÉTIER
 * ──────────────────────────────────────────────────────
 * • font-heading  → Montserrat Bold (Titres : moderne, robuste, mobile)
 * • font-sans     → Inter Regular (Texte courant : sobre, lisible)
 * • font-mono     → Roboto Mono (Données techniques : Réf OEM, Stock, Prix)
 * 
 * 📚 UTILISATION
 * ──────────────────────────────────────────────────────
 * Importez ces composants dans Storybook ou une page de test :
 * 
 * import { DesignSystemExamples } from './DesignSystemExamples';
 * 
 * <DesignSystemExamples />
 * 
 * 📖 DOCUMENTATION COMPLÈTE
 * ──────────────────────────────────────────────────────
 * • Quick Reference : /DESIGN-SYSTEM-QUICK-REF.md
 * • Guide complet   : /DESIGN-SYSTEM-USAGE-GUIDE.md
 * • Typographie     : /DESIGN-SYSTEM-TYPOGRAPHY.md
 */

import React from 'react';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 BOUTONS CTA (Primary)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Couleur : Primary #FF3B30 (Rouge/orangé)
 * Usage   : Actions principales (Ajouter panier, Payer, Confirmer)
 * Police  : Montserrat Bold (font-heading)
 * 
 * ❌ NE PAS utiliser pour : Navigation, Info, Validation
 * ✅ À utiliser pour     : CTA, Actions urgentes, Conversions
 */
export function ButtonCTA() {
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-4">
        Boutons CTA (Primary)
      </h2>
      
      {/* 
        Bouton CTA principal - Utilisation la plus courante
        Classes clés :
        • bg-primary-500       → Couleur CTA
        • hover:bg-primary-600 → État hover plus foncé
        • font-heading         → Montserrat Bold
        • shadow-md            → Élévation visuelle
      */}
      <button className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-lg font-heading font-semibold transition-colors shadow-md">
        Ajouter au panier
      </button>
      
      {/* 
        Bouton CTA secondaire - Moins d'emphase que le principal
        Utilise primary-600 comme base pour différenciation
      */}
      <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-heading font-semibold transition-colors">
        Payer maintenant
      </button>
      
      {/* 
        Bouton CTA outline - Action moins prioritaire
        Garde l'identité Primary mais sans remplissage
      */}
      <button className="border-2 border-primary-500 text-primary-500 hover:bg-primary-50 px-6 py-3 rounded-lg font-heading font-semibold transition-colors">
        Voir détails
      </button>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔵 NAVIGATION (Secondary)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Couleur : Secondary #0F4C81 (Bleu acier)
 * Usage   : Navigation, Liens de confiance, Breadcrumb, Menu
 * Police  : Inter Regular (font-sans)
 * 
 * ❌ NE PAS utiliser pour : Actions CTA, Validation, Erreurs
 * ✅ À utiliser pour     : Liens de navigation, Menu, Fil d'Ariane
 */
export function NavigationLinks() {
  return (
    <nav className="bg-secondary-50 p-6 rounded-lg">
      <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-4">
        Navigation (Secondary)
      </h2>
      
      <ul className="space-y-2">
        {/* 
          Lien de navigation standard
          Classes clés :
          • text-secondary-500       → Couleur navigation (confiance)
          • hover:text-secondary-600 → Hover plus foncé
          • font-sans                → Inter Regular (lisibilité)
        */}
        <li>
          <a href="/pieces" className="text-secondary-500 hover:text-secondary-600 hover:underline font-sans font-medium">
            Catalogue de pièces
          </a>
        </li>
        <li>
          <a href="/marques" className="text-secondary-500 hover:text-secondary-600 hover:underline font-sans font-medium">
            Marques
          </a>
        </li>
        <li>
          <a href="/aide" className="text-secondary-500 hover:text-secondary-600 hover:underline font-sans font-medium">
            Aide & Support
          </a>
        </li>
      </ul>
    </nav>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🟢 BADGES COMPATIBILITÉ (Success)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Couleur : Success #27AE60 (Vert mécanique)
 * Usage   : Validation, Compatibilité pièce, Stock disponible
 * Police  : Inter Regular (font-sans)
 * 
 * ❌ NE PAS utiliser pour : Actions CTA, Navigation
 * ✅ À utiliser pour     : Compatible, En stock, Livraison OK
 */
export function BadgeCompatibility() {
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-4">
        Badges Compatibilité (Success)
      </h2>
      
      {/* 
        Badge compatible avec icône
        Classes clés :
        • bg-success      → Vert validation
        • text-white      → Contraste optimal
        • rounded-full    → Badge pill style
        • font-sans       → Inter Regular
      */}
      <span className="inline-flex items-center bg-success text-white px-4 py-2 rounded-full text-sm font-sans font-medium">
        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        Compatible avec votre véhicule
      </span>
      
      {/* 
        Badge stock - Variante outline
        Classes clés :
        • bg-success/10   → Fond success avec 10% opacité
        • text-success    → Texte vert
        • border-success  → Bordure verte
      */}
      <span className="inline-flex items-center bg-success/10 text-success border border-success px-4 py-2 rounded-full text-sm font-sans font-medium">
        En stock
      </span>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🟠 ALERTES DÉLAI (Warning)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Couleur : Warning #F39C12 (Orange)
 * Usage   : Alerte délai livraison, Stock faible, Info importante
 * Police  : Inter Regular (font-sans)
 * 
 * ❌ NE PAS utiliser pour : Erreurs bloquantes, Validation
 * ✅ À utiliser pour     : Délais, Stock limité, Précautions
 */
export function AlertDelay() {
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-4">
        Alertes Délai (Warning)
      </h2>
      
      {/* 
        Alerte délai livraison avec icône
        Classes clés :
        • bg-warning/10          → Fond warning léger
        • border-l-4 border-warning → Bordure gauche accentuée
        • text-warning-foreground   → Texte contrasté auto
      */}
      <div className="bg-warning/10 border-l-4 border-warning p-4 rounded-md">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-warning mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-medium text-warning-foreground">
              Délai de livraison prolongé
            </p>
            <p className="text-sm text-neutral-700">
              Cette pièce sera livrée sous 5-7 jours ouvrés
            </p>
          </div>
        </div>
      </div>
      
      {/* 
        Badge stock faible - Format compact
        • bg-warning             → Fond orange plein
        • text-warning-foreground → Contraste auto
        • emoji ⚠️ renforce message
      */}
      <span className="inline-flex items-center bg-warning text-warning-foreground px-4 py-2 rounded-full text-sm font-sans font-medium">
        ⚠️ Stock faible (3 restants)
      </span>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 ERREURS INCOMPATIBILITÉ (Error)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Couleur : Error #C0392B (Rouge sombre)
 * Usage   : Erreur bloquante, Incompatibilité pièce, Erreur paiement
 * Police  : Inter Regular (font-sans)
 * 
 * ❌ NE PAS utiliser pour : Actions CTA, Alertes info
 * ✅ À utiliser pour     : Incompatible, Erreur critique, Blocage
 */
export function ErrorIncompatibility() {
  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-4">
        Erreurs Incompatibilité (Error)
      </h2>
      
      {/* 
        Message erreur incompatibilité
        Classes clés :
        • bg-error/10         → Fond error léger
        • border-l-4 border-error → Bordure gauche rouge
        • text-error-foreground   → Texte contrasté
      */}
      <div className="bg-error/10 border-l-4 border-error p-4 rounded-md">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-error mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="font-sans font-medium text-error-foreground">
              Pièce incompatible
            </p>
            <p className="font-sans text-sm text-neutral-700">
              Cette pièce n'est pas compatible avec votre véhicule (Renault Clio 2015)
            </p>
          </div>
        </div>
      </div>
      
      {/* 
        Badge incompatible - Format compact
        • bg-error → Rouge sombre plein
        • emoji ✗ renforce le blocage
      */}
      <span className="inline-flex items-center bg-error text-white px-4 py-2 rounded-full text-sm font-sans font-medium">
        ✗ Incompatible
      </span>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛒 CARD PRODUIT COMPLÈTE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Exemple complet intégrant TOUTES les fondations du Design System :
 * 
 * 🎨 Couleurs :
 * • Primary (CTA)      → Bouton "Ajouter au panier"
 * • Secondary (Nav)    → Lien "Voir détails"
 * • Success (Valid)    → Badge "Compatible"
 * • Warning (Alerte)   → Alerte délai livraison
 * • Neutral (Fond)     → Card background
 * 
 * 📝 Typographie :
 * • font-heading → Titre produit (Montserrat Bold)
 * • font-sans    → Description (Inter Regular)
 * • font-mono    → Réf OEM + Prix (Roboto Mono)
 */
export function ProductCard() {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-lg p-6 max-w-sm">
      {/* 
        SKU / Référence produit
        • font-mono → Roboto Mono (précision technique)
        • text-xs   → Taille discrète
      */}
      <span className="font-mono text-xs text-neutral-600 mb-2 block">
        SKU: BRK-12345-FR
      </span>
      
      {/* Image produit - Placeholder */}
      <div className="bg-neutral-100 rounded-lg h-48 mb-4 flex items-center justify-center">
        <span className="font-sans text-neutral-400 text-sm">Image produit</span>
      </div>
      
      {/* 
        Badge compatibilité (Success)
        • bg-success → Vert validation
        • emoji ✓ renforce confirmation
      */}
      <span className="inline-flex items-center bg-success text-white px-3 py-1 rounded-full text-xs font-sans font-medium mb-3">
        ✓ Compatible
      </span>
      
      {/* 
        Titre produit
        • font-heading → Montserrat Bold (moderne, robuste)
        • text-xl      → Taille adaptée card
      */}
      <h3 className="font-heading font-bold text-xl text-neutral-900 mb-2">
        Plaquettes de frein avant
      </h3>
      
      {/* 
        Référence OEM
        • font-mono → Roboto Mono (précision technique)
        • <code>    → Conteneur sémantique pour données
      */}
      <div className="flex items-center gap-2 mb-3">
        <span className="font-sans text-sm text-neutral-500">Réf OEM:</span>
        <code className="font-mono text-sm text-neutral-900 bg-neutral-100 px-2 py-1 rounded">
          7701208265
        </code>
      </div>
      
      {/* 
        Description produit
        • font-sans → Inter Regular (lisibilité optimale)
      */}
      <p className="font-sans text-sm text-neutral-700 mb-4">
        Plaquettes haute performance. Compatible Renault Clio 4 (2012-2019). 
        Certifiées ECE R90.
      </p>
      
      {/* 
        Stock disponible
        • font-mono → Roboto Mono (données précises)
        • text-success → Vert validation
      */}
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-sm font-medium text-success">
          Stock: 12 unités
        </span>
        <span className="font-sans text-xs text-neutral-500">
          Livraison 24-48h
        </span>
      </div>
      
      {/* 
        Prix
        • font-mono → Roboto Mono (précision, crédibilité)
        • text-3xl  → Mise en avant du prix
      */}
      <div className="flex items-baseline mb-4">
        <span className="font-mono text-3xl font-bold text-neutral-900">45,99 €</span>
        <span className="font-sans text-sm text-neutral-500 ml-2">TTC</span>
      </div>
      
      {/* 
        Alerte délai (Warning)
        • bg-warning/10 → Fond orange léger
      */}
      <div className="bg-warning/10 border border-warning/30 text-warning-foreground px-3 py-2 rounded-md text-sm mb-4 font-sans">
        ⚠️ Livraison sous 3-5 jours
      </div>
      
      {/* 
        Bouton CTA principal (Primary)
        • font-heading → Montserrat Bold (robustesse)
        • bg-primary-500 → Rouge/orangé CTA
      */}
      <button className="w-full bg-primary-500 hover:bg-primary-600 text-white font-heading font-semibold py-3 rounded-lg transition-colors shadow-md hover:shadow-lg">
        Ajouter au panier
      </button>
      
      {/* 
        Lien secondaire (Secondary)
        • font-sans → Inter Regular
        • text-secondary-500 → Bleu navigation
      */}
      <button className="block w-full text-center text-secondary-500 hover:text-secondary-600 font-sans text-sm mt-3 hover:underline">
        Voir les détails
      </button>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📝 TYPOGRAPHIE EXAMPLES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Showcase complet du système typographique métier :
 * 
 * 1. Montserrat Bold (font-heading) → Titres, CTA, Impact
 *    • Moderne, robuste, lisible sur mobile
 * 
 * 2. Inter Regular (font-sans) → Texte corps, descriptions
 *    • Sobre, lisibilité optimale, confort de lecture
 * 
 * 3. Roboto Mono (font-mono) → Données techniques
 *    • Références OEM, stock, prix → Expérience "catalogue constructeur"
 * 
 * Usage : Démonstration des 3 fonts avec tailles et poids variés
 */
export function TypographyExamples() {
  return (
    <div className="space-y-8">
      <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-4">
        Typographie Métier
      </h2>
      
      {/* 
        ▶ Montserrat Bold (font-heading)
        Usage : Titres, CTA, headings de section
        Caractéristiques : Moderne, robuste, lisible sur mobile
      */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200">
        <h3 className="font-sans text-sm text-neutral-500 mb-4 uppercase tracking-wide">
          Montserrat → Headings (Moderne & Robuste)
        </h3>
        
        <div className="space-y-3">
          {/* font-heading + text-5xl → Hero majeur */}
          <h1 className="font-heading font-extrabold text-5xl text-neutral-900">
            Hero Title (5XL Extra Bold)
          </h1>
          
          {/* font-heading + text-3xl → Titre de section */}
          <h2 className="font-heading font-bold text-3xl text-neutral-900">
            Section Title (3XL Bold)
          </h2>
          
          {/* font-heading + text-xl → Titre de carte */}
          <h3 className="font-heading font-semibold text-xl text-neutral-900">
            Card Title (XL Semibold)
          </h3>
          
          {/* font-heading + text-lg → Label/sous-titre */}
          <h4 className="font-heading font-medium text-lg text-neutral-700">
            Label (LG Medium)
          </h4>
        </div>
      </div>
      
      {/* 
        ▶ Inter Regular (font-sans)
        Usage : Texte corps, descriptions, paragraphes
        Caractéristiques : Sobre, lisibilité optimale, confort de lecture
      */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200">
        <h3 className="font-sans text-sm text-neutral-500 mb-4 uppercase tracking-wide">
          Inter → Body (Sobre & Lisible)
        </h3>
        
        <div className="space-y-3">
          {/* font-sans + text-lg → Texte intro */}
          <p className="font-sans text-lg text-neutral-900">
            Texte intro large : Découvrez notre catalogue de pièces automobiles.
          </p>
          
          {/* font-sans + text-base → Texte standard */}
          <p className="font-sans text-base text-neutral-700">
            Texte normal : Compatible avec Renault Clio 4 (2012-2019). 
            Plaquettes de frein certifiées ECE R90 avec garantie constructeur 2 ans.
          </p>
          
          {/* font-sans + text-sm → Petit texte */}
          <p className="font-sans text-sm text-neutral-600">
            Texte small : Livraison gratuite dès 50€ d'achat.
          </p>
          
          {/* font-sans + text-xs → Métadonnées */}
          <p className="font-sans text-xs text-neutral-500">
            Texte extra small : Mis à jour il y a 2 heures.
          </p>
        </div>
      </div>
      
      {/* 
        ▶ Roboto Mono (font-mono)
        Usage : Données techniques, références, prix, stock
        Caractéristiques : Précision, crédibilité, expérience "catalogue constructeur"
      */}
      <div className="bg-white p-6 rounded-lg border border-neutral-200">
        <h3 className="font-sans text-sm text-neutral-500 mb-4 uppercase tracking-wide">
          Roboto Mono → Data Technique (Précision & Crédibilité)
        </h3>
        
        <div className="space-y-4">
          {/* 
            font-mono + <code> → Référence OEM
            Apporte crédibilité et précision technique
          */}
          <div>
            <span className="font-sans text-xs text-neutral-500 block mb-1">
              Référence OEM
            </span>
            <code className="font-mono text-base font-semibold text-neutral-900 bg-neutral-100 px-3 py-2 rounded">
              7701208265
            </code>
          </div>
          
          {/* 
            font-mono + text-success → Stock
            Données précises avec couleur validation
          */}
          <div>
            <span className="font-sans text-xs text-neutral-500 block mb-1">
              Stock disponible
            </span>
            <span className="font-mono text-lg font-medium text-success">
              12 unités
            </span>
          </div>
          
          {/* 
            font-mono + text-3xl → Prix
            Précision maximale pour élément clé de conversion
          */}
          <div>
            <span className="font-sans text-xs text-neutral-500 block mb-1">
              Prix TTC
            </span>
            <span className="font-mono text-3xl font-bold text-neutral-900">
              45,99 €
            </span>
          </div>
          
          {/* 
            font-mono + <code> → SKU
            Format technique pour identifiant unique
          */}
          <div>
            <span className="font-sans text-xs text-neutral-500 block mb-1">
              SKU Produit
            </span>
            <code className="font-mono text-sm text-neutral-700">
              BRK-12345-FR
            </code>
          </div>
        </div>
      </div>
      
      {/* 
        ▶ Combinaison des 3 fonts
        Exemple réaliste intégrant Heading + Body + Mono
      */}
      <div className="bg-gradient-to-r from-secondary-500 to-secondary-700 text-white p-6 rounded-lg">
        {/* font-heading → Titre accrocheur */}
        <h3 className="font-heading font-extrabold text-3xl mb-3">
          Pièces Auto Neuves
        </h3>
        
        {/* font-sans → Description lisible */}
        <p className="font-sans text-lg font-light mb-4">
          + de 50 000 références en stock
        </p>
        
        <div className="flex items-center gap-4">
          {/* font-heading → Bouton CTA (Montserrat = robustesse) */}
          <button className="bg-primary-500 hover:bg-primary-600 font-heading font-bold px-6 py-3 rounded-lg">
            Voir le catalogue
          </button>
          
          {/* font-mono → Donnée temps réel (précision) */}
          <span className="font-mono text-sm">
            Stock actualisé en temps réel
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎨 DESIGN SYSTEM EXAMPLES - PAGE COMPLÈTE
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Showcase complet du Design System intégrant :
 * • 6 couleurs fonctionnelles (Primary, Secondary, Success, Warning, Error, Neutral)
 * • 3 polices métier (Montserrat, Inter, Roboto Mono)
 * • Règle fondamentale : 1 couleur = 1 fonction métier
 * 
 * Organisation de la page :
 * 1. Colonne gauche → Exemples par couleur (Button, Navigation, Badge, Typography)
 * 2. Colonne droite → Exemples d'intégration (Alert, Error, ProductCard)
 * 3. Footer → Palette de couleurs complète
 * 
 * Usage : Route `/design-system` pour démonstration et formation équipe
 */
export function DesignSystemExamples() {
  return (
      <div className="min-h-screen bg-neutral-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 
          Header de page
          • font-heading → Montserrat pour impact
          • font-sans → Inter pour description
        */}
        <header className="mb-12">
          <h1 className="font-heading text-4xl font-bold text-neutral-900 mb-2">
            Design System - Couleurs & Typographie
          </h1>
          <p className="font-sans text-neutral-600">
            Exemples d'utilisation des couleurs fonctionnelles et polices métier
          </p>
        </header>
        
        {/* 
          Grid 2 colonnes d'exemples
          Organisation : 1 exemple = 1 fonction métier
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* 
            ▶ Colonne 1 : Exemples par couleur + Typographie
          */}
          <div className="space-y-8">
            {/* Primary → CTA */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <ButtonCTA />
            </div>
            
            {/* Secondary → Navigation */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <NavigationLinks />
            </div>
            
            {/* Success → Validation */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <BadgeCompatibility />
            </div>
            
            {/* Typographie showcase */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <TypographyExamples />
            </div>
          </div>
          
          {/* 
            ▶ Colonne 2 : Exemples d'intégration complexe
          */}
          <div className="space-y-8">
            {/* Warning → Alerte */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <AlertDelay />
            </div>
            
            {/* Error → Erreur */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <ErrorIncompatibility />
            </div>
            
            {/* Intégration complète : toutes couleurs + fonts */}
            <ProductCard />
          </div>
        </div>
        
        {/* 
          ═══════════════════════════════════════════════════════════════════════
          Palette de couleurs complète
          ═══════════════════════════════════════════════════════════════════════
          Affichage de toutes les couleurs avec leurs 11 shades (50-950)
          + Couleurs sémantiques (Success, Warning, Error, Info)
        */}
        <div className="mt-12 bg-white p-8 rounded-lg shadow-md">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-6">
            Palette de Couleurs
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 
              🔴 Primary (Rouge/orangé) → CTA
              11 shades (50 clair → 950 foncé)
            */}
            <div>
              <h3 className="font-heading font-semibold text-neutral-900 mb-3">Primary (CTA)</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary-500 rounded mr-3"></div>
                  <span className="font-mono text-sm">#FF3B30 (500)</span>
                </div>
                <div className="flex gap-1">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
                    <div key={shade} className={`w-8 h-8 bg-primary-${shade} rounded`} title={`${shade}`}></div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 
              🔵 Secondary (Bleu acier) → Navigation
              11 shades (50 clair → 950 foncé)
            */}
            <div>
              <h3 className="font-heading font-semibold text-neutral-900 mb-3">Secondary (Navigation)</h3>
              <div className="space-y-2">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-secondary-500 rounded mr-3"></div>
                  <span className="font-mono text-sm">#0F4C81 (500)</span>
                </div>
                <div className="flex gap-1">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((shade) => (
                    <div key={shade} className={`w-8 h-8 bg-secondary-${shade} rounded`} title={`${shade}`}></div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 
              🟢🟡🔴 Couleurs sémantiques
              Success (Vert), Warning (Orange), Error (Rouge), Info (Bleu)
            */}
            <div>
              <h3 className="font-heading font-semibold text-neutral-900 mb-3">Semantic</h3>
              <div className="space-y-2 font-sans">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-success rounded mr-2"></div>
                  <span className="font-mono text-sm">Success #27AE60</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-warning rounded mr-2"></div>
                  <span className="font-mono text-sm">Warning #F39C12</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-error rounded mr-2"></div>
                  <span className="font-mono text-sm">Error #C0392B</span>
                </div>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-info rounded mr-2"></div>
                  <span className="font-mono text-sm">Info #3498DB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 
          ═══════════════════════════════════════════════════════════════════════
          Système d'Espacement (8px Grid)
          ═══════════════════════════════════════════════════════════════════════
          Démonstration du système d'espacement sémantique
        */}
        <div className="mt-xl bg-white p-xl rounded-lg shadow-md">
          <h2 className="font-heading text-2xl font-bold text-neutral-900 mb-lg">
            Système d'Espacement (8px Grid)
          </h2>
          
          <div className="space-y-lg">
            {/* Échelle visuelle */}
            <div>
              <h3 className="font-heading font-semibold text-neutral-900 mb-md">
                Échelle Sémantique
              </h3>
              <div className="space-y-sm font-sans">
                <div className="flex items-center gap-md">
                  <div className="w-24 font-mono text-sm text-neutral-600">XS (4px)</div>
                  <div className="bg-primary-500 h-8" style={{ width: '4px' }}></div>
                  <span className="text-sm text-neutral-600">Micro-espaces (badges, icônes)</span>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 font-mono text-sm text-neutral-600">SM (8px)</div>
                  <div className="bg-primary-500 h-8" style={{ width: '8px' }}></div>
                  <span className="text-sm text-neutral-600">Serré (label ↔ input)</span>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 font-mono text-sm text-neutral-600">MD (16px)</div>
                  <div className="bg-primary-500 h-8" style={{ width: '16px' }}></div>
                  <span className="text-sm text-neutral-600">Standard (padding cartes)</span>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 font-mono text-sm text-neutral-600">LG (24px)</div>
                  <div className="bg-primary-500 h-8" style={{ width: '24px' }}></div>
                  <span className="text-sm text-neutral-600">Sections/blocs</span>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 font-mono text-sm text-neutral-600">XL (32px)</div>
                  <div className="bg-primary-500 h-8" style={{ width: '32px' }}></div>
                  <span className="text-sm text-neutral-600">Grilles, marges</span>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 font-mono text-sm text-neutral-600">2XL (40px)</div>
                  <div className="bg-primary-500 h-8" style={{ width: '40px' }}></div>
                  <span className="text-sm text-neutral-600">Large grilles</span>
                </div>
                <div className="flex items-center gap-md">
                  <div className="w-24 font-mono text-sm text-neutral-600">3XL (48px)</div>
                  <div className="bg-primary-500 h-8" style={{ width: '48px' }}></div>
                  <span className="text-sm text-neutral-600">Hero sections</span>
                </div>
              </div>
            </div>
            
            {/* Exemples concrets */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg pt-lg border-t border-neutral-200">
              {/* Badge (XS) */}
              <div className="bg-neutral-50 p-md rounded-lg">
                <h4 className="font-heading font-semibold text-sm text-neutral-700 mb-sm">
                  Badge (XS Padding)
                </h4>
                <span className="inline-block bg-success text-white px-xs py-xs rounded-full text-xs font-sans">
                  Stock: 12 unités
                </span>
              </div>
              
              {/* Form (SM) */}
              <div className="bg-neutral-50 p-md rounded-lg">
                <h4 className="font-heading font-semibold text-sm text-neutral-700 mb-sm">
                  Form (SM Spacing)
                </h4>
                <label className="block mb-sm font-sans text-sm text-neutral-700">
                  Référence OEM
                </label>
                <input 
                  className="w-full px-sm py-sm border border-neutral-300 rounded-md font-mono text-sm" 
                  placeholder="7701208265"
                />
              </div>
              
              {/* Card (MD) */}
              <div className="bg-neutral-50 p-md rounded-lg">
                <h4 className="font-heading font-semibold text-sm text-neutral-700 mb-sm">
                  Card (MD Padding)
                </h4>
                <div className="bg-white p-md rounded-lg border border-neutral-200">
                  <h5 className="font-heading font-semibold text-neutral-900 mb-sm">
                    Plaquettes de frein
                  </h5>
                  <p className="font-sans text-sm text-neutral-600">
                    Compatible Renault Clio 4
                  </p>
                </div>
              </div>
              
              {/* Grid (LG) */}
              <div className="bg-neutral-50 p-md rounded-lg">
                <h4 className="font-heading font-semibold text-sm text-neutral-700 mb-sm">
                  Grid (LG Gap)
                </h4>
                <div className="grid grid-cols-3 gap-lg">
                  <div className="bg-primary-500 h-16 rounded"></div>
                  <div className="bg-primary-500 h-16 rounded"></div>
                  <div className="bg-primary-500 h-16 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesignSystemExamples;
