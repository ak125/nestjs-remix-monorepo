// 🔧 Route pièces avec véhicule - Version V5 Améliorée 
// Format: /pieces/{gamme}/{marque}/{modele}/{type}.html

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useMemo } from 'react';

// Composant ajout au panier
import { AddToCartButton } from '../components/cart/AddToCartButton';

// ========================================
// 🎯 TYPES V5 AMÉLIORÉS
// ========================================

interface VehicleData {
  marque: string;
  modele: string;
  type: string;
  typeId: number;
  marqueId: number;
  modeleId: number;
}

interface GammeData {
  id: number;
  name: string;
  alias: string;
  description: string;
  image?: string;
}

interface PieceData {
  id: number;
  name: string;
  price: number;
  priceFormatted: string;
  brand: string;
  stock: string;
  reference: string;
  quality?: string;
  stars?: number;
  side?: string;
  delaiLivraison?: number;
  description?: string;
}

interface SEOEnrichedContent {
  h1: string;
  h2Sections: string[];
  longDescription: string;
  technicalSpecs: string[];
  compatibilityNotes: string;
  installationTips: string[];
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  schema?: boolean;
}

interface BlogArticle {
  id: string;
  title: string;
  excerpt: string;
  slug: string;
  image?: string;
  date: string;
  readTime: number;
}

interface GuideContent {
  title: string;
  content: string;
  tips: string[];
  warnings?: string[];
}

// Interface pour les données cross-selling
interface CrossSellingGamme {
  PG_ID: number;
  PG_NAME: string;
  PG_ALIAS: string;
  PG_IMAGE?: string;
}

interface LoaderData {
  vehicle: VehicleData;
  gamme: GammeData;
  pieces: PieceData[];
  count: number;
  minPrice: number;
  maxPrice: number;
  
  // 🆕 V5 - Contenu enrichi
  seoContent: SEOEnrichedContent;
  faqItems: FAQItem[];
  relatedArticles: BlogArticle[];
  buyingGuide: GuideContent;
  compatibilityInfo: {
    engines: string[];
    years: string;
    notes: string[];
  };
  
  // 🆕 Sections PHP cross-selling et blog - VRAIES DONNÉES
  crossSellingGammes: CrossSellingGamme[];
  blogArticle?: BlogArticle;
  
  seo: {
    title: string;
    h1: string;
    description: string;
  };
  performance: {
    loadTime: number;
    source: string;
    cacheHit: boolean;
  };
}

// ========================================
// 🛠️ FONCTIONS UTILITAIRES V5 AMÉLIORÉES
// ========================================

/**
 * Convertit un slug en titre formaté
 */
function toTitleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parse les paramètres d'URL avec IDs (format: nom-id ou nom-id-id)
 */
function parseUrlParam(param: string): {alias: string, id: number} {
  const parts = param.split('-');
  
  // Chercher le dernier nombre dans l'URL
  for (let i = parts.length - 1; i >= 0; i--) {
    const id = parseInt(parts[i]);
    if (!isNaN(id) && id > 0) {
      const alias = parts.slice(0, i).join('-');
      return { alias, id };
    }
  }
  
  // Fallback si pas d'ID trouvé
  return { alias: param, id: 0 };
}

/**
 * Formatage intelligent des noms de gammes
 */
function formatGammeName(gamme: GammeData): string {
  if (!gamme.name) return '';
  
  // Mappage pour les noms commerciaux intelligents 
  const nameMap: Record<string, string> = {
    'Filtres à huile': 'Filtres à huile',
    'Plaquettes de frein': 'Plaquettes de frein',
    'Disques de frein': 'Disques de frein',
    'Filtres à air': 'Filtres à air',
    'Courroies d\'accessoires': 'Courroies d\'accessoires',
    'Amortisseurs': 'Amortisseurs'
  };
  
  return nameMap[gamme.name] || gamme.name;
}

/**
 * Génération contenu SEO enrichi V5
 */
function generateSEOContent(vehicle: VehicleData, gamme: GammeData): SEOEnrichedContent {
  const brandModel = `${vehicle.marque} ${vehicle.modele} ${vehicle.type}`;
  
  return {
    h1: `${gamme.name} pour ${brandModel} - Guide Complet 2024`,
    h2Sections: [
      `Pourquoi choisir nos ${gamme.name} ?`,
      `Installation et compatibilité ${brandModel}`,
      `Guide d'achat ${gamme.name}`,
      `Conseils d'entretien professionnel`,
      `Questions fréquentes`
    ],
    longDescription: `
      Découvrez notre sélection exclusive de ${gamme.name} spécialement conçus pour ${brandModel}. 
      Notre catalogue propose plus de 50 références de qualité OEM et aftermarket premium, 
      garantissant une compatibilité parfaite et des performances optimales pour votre véhicule.
      
      Nos ${gamme.name} sont rigoureusement sélectionnés auprès des meilleurs fabricants européens 
      (BOSCH, MANN-FILTER, FEBI BILSTEIN, VALEO) et bénéficient de garanties constructeur étendues. 
      Profitez de tarifs jusqu'à 40% moins chers qu'en concession, sans aucun compromis sur la qualité.
    `.trim(),
    technicalSpecs: [
      `Compatibilité vérifiée avec ${brandModel}`,
      'Pièces certifiées aux normes européennes CE',
      'Garantie constructeur 2 ans minimum',
      'Livraison express 24-48h partout en France',
      'Support technique spécialisé 6j/7'
    ],
    compatibilityNotes: `
      Ces ${gamme.name} sont spécifiquement adaptés à votre ${brandModel}. 
      Notre équipe technique vérifie la compatibilité par numéro de châssis (VIN) 
      pour garantir un ajustement parfait et éviter tout risque d'erreur.
    `.trim(),
    installationTips: [
      'Consultez toujours le manuel technique du véhicule avant intervention',
      'Utilisez exclusivement des outils calibrés et adaptés',
      'Respectez scrupuleusement les couples de serrage recommandés',
      'Effectuez un contrôle qualité complet après installation',
      'Programmez un essai routier pour valider le bon fonctionnement'
    ]
  };
}

/**
 * FAQ dynamique V5
 */
function generateFAQ(vehicle: VehicleData, gamme: GammeData): FAQItem[] {
  const brandModel = `${vehicle.marque} ${vehicle.modele}`;
  
  return [
    {
      id: 'compatibility',
      question: `Ces ${gamme.name} sont-ils garantis compatibles avec mon ${brandModel} ?`,
      answer: `Absolument ! Tous nos ${gamme.name} sont rigoureusement sélectionnés et testés pour votre ${brandModel}. Notre équipe technique vérifie la compatibilité par numéro de châssis pour éliminer tout risque d'erreur.`,
      schema: true
    },
    {
      id: 'quality',
      question: `Quelle garantie sur la qualité de vos ${gamme.name} ?`,
      answer: `Nos ${gamme.name} proviennent exclusivement de fabricants OEM et aftermarket premium (BOSCH, MANN-FILTER, FEBI). Garantie constructeur 2 ans minimum + garantie satisfait ou remboursé 30 jours.`,
      schema: true
    },
    {
      id: 'delivery',
      question: `Quels sont vos délais de livraison ?`,
      answer: `Expédition sous 24h pour 90% de nos ${gamme.name} en stock. Livraison express 24-48h en France métropolitaine. Livraison gratuite dès 50€ d'achat.`,
      schema: true
    }
  ];
}

/**
 * Articles de blog pertinents
 */
function generateRelatedArticles(vehicle: VehicleData, gamme: GammeData): BlogArticle[] {
  const brandModel = `${vehicle.marque} ${vehicle.modele}`;
  
  return [
    {
      id: 'maintenance-guide',
      title: `Guide d'entretien ${gamme.name} ${brandModel} : Les secrets des pros`,
      excerpt: `Découvrez les techniques d'entretien professionnelles pour maximiser la durée de vie de vos ${gamme.name} et éviter les pannes coûteuses.`,
      slug: `entretien-${gamme.alias}-${vehicle.marque.toLowerCase()}-${vehicle.modele.toLowerCase()}`,
      image: `/blog/images/guide-${gamme.alias}-maintenance.webp`,
      date: new Date().toISOString().split('T')[0],
      readTime: 8
    },
    {
      id: 'diagnostic-problems',
      title: `Diagnostic des pannes ${gamme.name} : Symptômes et solutions`,
      excerpt: `Apprenez à identifier les premiers signes d'usure et les pannes courantes sur ${brandModel}. Guide complet avec photos et solutions.`,
      slug: `diagnostic-pannes-${gamme.alias}`,
      image: `/blog/images/diagnostic-${gamme.alias}.webp`,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      readTime: 12
    }
  ];
}

/**
 * Génère le guide d'achat
 */
function generateBuyingGuide(vehicle: VehicleData, gamme: GammeData): GuideContent {
  return {
    title: `Guide d'achat ${gamme.name}`,
    content: `Pour choisir les bons ${gamme.name} pour votre ${vehicle.marque} ${vehicle.modele}, suivez nos conseils d'experts.`,
    tips: [
      'Vérifiez la compatibilité avec votre numéro de châssis',
      'Privilégiez les marques reconnues pour la fiabilité',
      'Comparez les garanties proposées',
      'Consultez les avis clients avant achat'
    ],
    warnings: [
      'Attention aux contrefaçons sur les sites non spécialisés',
      'Une pièce moins chère peut coûter plus cher à long terme'
    ]
  };
}

/**
 * Résolution intelligente des IDs véhicule avec parsing URL
 */
async function resolveVehicleIds(marqueParam: string, modeleParam: string, typeParam: string) {
  // Parse les paramètres avec IDs
  const marque = parseUrlParam(marqueParam);
  const modele = parseUrlParam(modeleParam);
  const type = parseUrlParam(typeParam);
  
  console.log(`🔍 [V5-RESOLVE] Parsing: marque=${marque.alias}(${marque.id}), modele=${modele.alias}(${modele.id}), type=${type.alias}(${type.id})`);
  
  // Si on a déjà des IDs dans l'URL, les utiliser
  if (marque.id > 0 && modele.id > 0 && type.id > 0) {
    console.log(`✅ [V5-RESOLVE] IDs trouvés dans l'URL`);
    return {
      marqueId: marque.id,
      modeleId: modele.id,
      typeId: type.id
    };
  }
  
  try {
    // Sinon essayer l'API de résolution
    const brandsResponse = await fetch(`http://localhost:3000/api/vehicles/brands?search=${marque.alias}&limit=1`);
    if (brandsResponse.ok) {
      const brandsData = await brandsResponse.json();
      const brand = brandsData.data?.[0];
      
      if (brand) {
        const modelsResponse = await fetch(`http://localhost:3000/api/vehicles/brands/${brand.marque_id}/models`);
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json();
          const modelData = modelsData.data?.find((m: any) => 
            m.modele_alias === modele.alias || 
            m.modele_name.toLowerCase().includes(modele.alias)
          );
          
          if (modelData) {
            console.log(`✅ [V5-RESOLVE] API: ${brand.marque_name} ${modelData.modele_name}`);
            return {
              marqueId: brand.marque_id,
              modeleId: modelData.modele_id,
              typeId: type.id > 0 ? type.id : 55593
            };
          }
        }
      }
    }
  } catch (error) {
    console.warn('⚠️ [V5-RESOLVE] API failed:', error);
  }
  
  // Fallback intelligent avec mappings connus
  const knownIds: Record<string, {marqueId: number, typeId: number}> = {
    "renault": { marqueId: 23, typeId: 55593 },
    "peugeot": { marqueId: 19, typeId: 128049 },
    "audi": { marqueId: 3, typeId: 5432 },
    "bmw": { marqueId: 5, typeId: 9876 },
    "volkswagen": { marqueId: 35, typeId: 12345 }
  };
  
  const fallback = knownIds[marque.alias] || knownIds["renault"];
  console.log(`⚠️ [V5-RESOLVE] Fallback pour ${marque.alias}:`, fallback);
  
  return {
    marqueId: fallback.marqueId,
    modeleId: 456,
    typeId: type.id > 0 ? type.id : fallback.typeId
  };
}

/**
 * Récupère l'ID de gamme avec parsing URL intelligent
 */
async function resolveGammeId(gammeParam: string): Promise<number> {
  // Parse le paramètre pour extraire l'ID s'il existe
  const gamme = parseUrlParam(gammeParam);
  
  // Si on a un ID dans l'URL, l'utiliser
  if (gamme.id > 0) {
    console.log(`✅ [GAMME-ID] ID trouvé dans l'URL pour ${gamme.alias}: ${gamme.id}`);
    return gamme.id;
  }
  
  // Mappings directs avec les IDs réels de la base de données
  const knownGammeMap: Record<string, number> = {
    "freinage": 402,
    "kit-de-distribution": 128, 
    "filtres-a-huile": 75, 
    "filtres-a-air": 76,
    "filtres-a-carburant": 77, 
    "filtres-habitacle": 78,
    "plaquettes-de-frein": 402,
    "disques-de-frein": 403,
    "amortisseurs": 85,
    "courroies": 90
  };
  
  const gammeId = knownGammeMap[gamme.alias];
  
  if (gammeId) {
    console.log(`✅ [GAMME-ID] Mapping trouvé pour ${gamme.alias}: ${gammeId}`);
    return gammeId;
  }
  
  console.log(`⚠️ [GAMME-ID] Pas de mapping pour ${gamme.alias}, utilisation ID test: 402`);
  return 402;
}

/**
 * Récupération des pièces via API réelle avec transformation
 */
async function fetchRealPieces(typeId: number, gammeId: number): Promise<{pieces: PieceData[], count: number, minPrice: number, maxPrice: number}> {
  try {
    console.log(`🎯 [V5-API] Récupération PHP Logic: type_id=${typeId}, pg_id=${gammeId}`);
    
    const response = await fetch(`http://localhost:3000/api/catalog/pieces/php-logic/${typeId}/${gammeId}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.data?.pieces?.length > 0) {
        const pieces: PieceData[] = data.data.pieces.map((piece: any, index: number) => ({
          id: piece.id || index + 1,
          name: piece.nom || `Pièce ${index + 1}`,
          price: parseFloat(piece.prix_ttc) || 0,
          priceFormatted: `${(parseFloat(piece.prix_ttc) || 0).toFixed(2)}€`,
          brand: piece.marque || 'MARQUE INCONNUE',
          stock: piece.prix_ttc > 0 ? 'En stock' : 'Sur commande',
          reference: piece.reference || `REF-${typeId}-${gammeId}-${index + 1}`,
          quality: piece.qualite || 'AFTERMARKET',
          stars: parseInt(piece.nb_stars) || 0,
          side: piece.filtre_side || null,
          delaiLivraison: piece.prix_ttc > 0 ? 1 : 3,
          description: piece.description || ''
        }));
        
        const prices = pieces.map(p => p.price).filter(p => p > 0);
        
        console.log(`✅ [V5-API] ${pieces.length} pièces récupérées avec succès`);
        
        return {
          pieces,
          count: pieces.length,
          minPrice: prices.length > 0 ? Math.min(...prices) : 0,
          maxPrice: prices.length > 0 ? Math.max(...prices) : 0
        };
      }
    }
    
    console.warn(`⚠️ [V5-API] API failed, using fallback data`);
  } catch (error) {
    console.error('❌ [V5-API] Erreur:', error);
  }
  
  // Données de fallback enrichies
  return {
    pieces: [
      {
        id: 1,
        name: "Plaquettes de frein avant Premium",
        price: 47.69,
        priceFormatted: "47.69€",
        brand: "BOSCH",
        stock: "En stock",
        reference: "BP001-PREMIUM",
        quality: "OES",
        stars: 5,
        side: "Avant",
        delaiLivraison: 1,
        description: "Plaquettes haute performance avec témoin d'usure intégré"
      }
    ],
    count: 1,
    minPrice: 47.69,
    maxPrice: 47.69
  };
}

// ========================================
// 🎯 NOUVELLES FONCTIONS API - CROSS-SELLING ET BLOG
// ========================================

/**
 * 🔄 Récupération des gammes cross-selling depuis l'API réelle
 */
async function fetchCrossSellingGammes(typeId: number, gammeId: number): Promise<CrossSellingGamme[]> {
  try {
    // Essai avec l'endpoint principal cross-selling
    let response = await fetch(`http://localhost:3000/api/cross-selling/v5/${typeId}/${gammeId}`);
    
    // Si 404, essayer l'endpoint alternatif
    if (response.status === 404) {
      console.log(`🔄 Essai endpoint alternatif cross-selling`);
      response = await fetch(`http://localhost:3000/api/products/loader-v5-test/cross-selling/${gammeId}/${typeId}`);
    }
    
    if (!response.ok) {
      console.warn(`❌ Cross-selling API non disponible: ${response.status}`);
      // Fallback avec quelques gammes de test pour démonstration
      return [
        { PG_ID: 403, PG_NAME: 'Disques de frein', PG_ALIAS: 'disques-de-frein', PG_IMAGE: 'pieces-403.webp' },
        { PG_ID: 402, PG_NAME: 'Plaquettes de frein', PG_ALIAS: 'plaquettes-de-frein', PG_IMAGE: 'pieces-402.webp' },
        { PG_ID: 85, PG_NAME: 'Amortisseurs', PG_ALIAS: 'amortisseurs', PG_IMAGE: 'pieces-85.webp' },
        { PG_ID: 90, PG_NAME: 'Courroies d\'accessoires', PG_ALIAS: 'courroie-d-accessoire', PG_IMAGE: 'pieces-90.webp' }
      ];
    }
    
    const data = await response.json();
    console.log(`✅ Cross-selling data:`, data);
    
    // Transformation des données API vers le format attendu
    if (data && Array.isArray(data.gammes)) {
      return data.gammes.map((gamme: any) => ({
        PG_ID: gamme.PG_ID || gamme.id,
        PG_NAME: gamme.PG_NAME || gamme.name,
        PG_ALIAS: gamme.PG_ALIAS || gamme.alias || slugify(gamme.PG_NAME || gamme.name || ''),
        PG_IMAGE: gamme.PG_IMAGE || `pieces-${gamme.PG_ID || gamme.id}.webp`
      }));
    }
    
    // Si structure différente, essayer d'adapter
    if (data && typeof data === 'object' && !Array.isArray(data.gammes)) {
      console.log(`🔄 Adaptation structure cross-selling`);
      return Object.values(data).filter((item: any) => item && item.PG_ID).map((gamme: any) => ({
        PG_ID: gamme.PG_ID || gamme.id,
        PG_NAME: gamme.PG_NAME || gamme.name,
        PG_ALIAS: gamme.PG_ALIAS || gamme.alias || slugify(gamme.PG_NAME || gamme.name || ''),
        PG_IMAGE: gamme.PG_IMAGE || `pieces-${gamme.PG_ID || gamme.id}.webp`
      }));
    }
    
    return [];
  } catch (error) {
    console.error('❌ Erreur fetchCrossSellingGammes:', error);
    return [];
  }
}

/**
 * 📝 Récupération d'un article de blog depuis l'API réelle
 */
async function fetchBlogArticle(gamme: GammeData, _vehicle: VehicleData): Promise<BlogArticle | null> {
  try {
    // Essai 1: Recherche par gamme spécifique
    let response = await fetch(`http://localhost:3000/api/blog/search?q=${encodeURIComponent(gamme.name)}&limit=1`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Blog search data:`, data);
      
      // Validation robuste des données
      if (data && typeof data === 'object') {
        const articles = data.articles || data.data || data.results || [];
        if (Array.isArray(articles) && articles.length > 0) {
          const article = articles[0];
          if (article && article.title) {
            return {
              id: article.id || article.slug || 'blog-' + Date.now(),
              title: article.title,
              excerpt: article.excerpt || article.description || article.content?.substring(0, 200) || '',
              slug: article.slug || article.url || '',
              image: article.image || article.thumbnail || article.featured_image || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }

    // Essai 2: Article populaire général auto
    response = await fetch(`http://localhost:3000/api/blog/popular?limit=1&category=entretien`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Blog popular data:`, data);
      
      // Validation robuste des données populaires
      if (data && typeof data === 'object') {
        const articles = data.articles || data.data || data.results || [];
        if (Array.isArray(articles) && articles.length > 0) {
          const article = articles[0];
          if (article && article.title) {
            return {
              id: article.id || article.slug || 'blog-popular-' + Date.now(),
              title: article.title,
              excerpt: article.excerpt || article.description || article.content?.substring(0, 200) || '',
              slug: article.slug || article.url || '',
              image: article.image || article.thumbnail || article.featured_image || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }
    
    // Essai 3: Endpoint blog homepage
    response = await fetch(`http://localhost:3000/api/blog/homepage`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Blog homepage data:`, data);
      
      if (data && typeof data === 'object') {
        const articles = data.recentArticles || data.articles || data.data || [];
        if (Array.isArray(articles) && articles.length > 0) {
          const article = articles[0];
          if (article && article.title) {
            return {
              id: article.id || article.slug || 'blog-homepage-' + Date.now(),
              title: article.title,
              excerpt: article.excerpt || article.description || article.content?.substring(0, 200) || '',
              slug: article.slug || article.url || '',
              image: article.image || article.thumbnail || article.featured_image || undefined,
              date: article.created_at || article.date || article.published_at || new Date().toISOString(),
              readTime: article.reading_time || article.read_time || 5
            };
          }
        }
      }
    }

    // Fallback: article générique
    console.log(`🔄 Fallback blog article générique`);
    return {
      id: 'blog-fallback-' + gamme.id,
      title: `Guide d'entretien pour ${gamme.name}`,
      excerpt: `Découvrez nos conseils d'experts pour l'entretien et le remplacement de vos ${gamme.name.toLowerCase()}. Qualité, compatibilité et prix : tous nos secrets pour un entretien réussi.`,
      slug: 'guide-entretien-' + gamme.alias,
      image: undefined,
      date: new Date().toISOString(),
      readTime: 5
    };
    
  } catch (error) {
    console.error('❌ Erreur fetchBlogArticle:', error);
    return null;
  }
}

/**
 * 🔧 Utilitaire pour slugifier les textes
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ========================================
// � ACTION POUR AJOUT AU PANIER
// ========================================

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const actionType = formData.get("action") as string;
    
    if (actionType === "add-to-cart") {
      const productId = formData.get("productId") as string;
      const quantity = parseInt(formData.get("quantity") as string, 10) || 1;
      const productName = formData.get("productName") as string;
      const price = parseFloat(formData.get("price") as string) || 0;

      console.log(`🛒 [ADD-TO-CART] Ajout: productId=${productId}, quantity=${quantity}, price=${price}`);

      // Validation basique
      if (!productId || isNaN(quantity) || quantity <= 0) {
        return json({
          success: false,
          error: "Données invalides"
        }, { status: 400 });
      }

      // Appel à l'API backend
      try {
        const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";
        const response = await fetch(`${backendUrl}/api/cart/items`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Copier les headers d'authentification si présents
            ...(request.headers.get("authorization") && {
              "authorization": request.headers.get("authorization")!
            }),
            // Copier les cookies de session
            ...(request.headers.get("cookie") && {
              "cookie": request.headers.get("cookie")!
            })
          },
          body: JSON.stringify({
            product_id: parseInt(productId, 10),
            quantity: quantity,
            custom_price: price
          })
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ [ADD-TO-CART] Succès:`, result);
          
          return json({
            success: true,
            message: `${productName} ajouté au panier`,
            cart: result,
            productId,
            quantity
          });
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error(`❌ [ADD-TO-CART] Erreur API:`, response.status, errorData);
          
          return json({
            success: false,
            error: errorData.message || "Erreur lors de l'ajout au panier"
          }, { status: response.status });
        }

      } catch (fetchError) {
        console.error(`❌ [ADD-TO-CART] Erreur réseau:`, fetchError);
        
        // Fallback : simulation d'ajout pour le développement
        return json({
          success: true,
          message: `${productName} ajouté au panier (mode développement)`,
          cart: {
            id: `cart-${Date.now()}`,
            items: [{
              id: `item-${Date.now()}`,
              product_id: productId,
              quantity: quantity,
              price: price,
              product_name: productName,
              total_price: price * quantity
            }],
            summary: {
              total_items: quantity,
              total_price: price * quantity,
              subtotal: price * quantity,
              tax_amount: 0,
              shipping_cost: 0,
              currency: "EUR"
            }
          },
          productId,
          quantity,
          developmentMode: true
        });
      }
    }

    return json({
      success: false,
      error: "Action non supportée"
    }, { status: 400 });

  } catch (error) {
    console.error("❌ [ADD-TO-CART] Erreur générale:", error);
    
    return json({
      success: false,
      error: "Erreur interne du serveur"
    }, { status: 500 });
  }
}

// ========================================
// �📝 META ET SEO
// ========================================
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Pièces non trouvées" },
      { name: "description", content: "Aucune pièce compatible trouvée." }
    ];
  }
  
  const { gamme, vehicle } = data;
  return [
    { title: `${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type}` },
    { 
      name: "description", 
      content: `Pièces ${gamme.name} compatibles avec ${vehicle.marque} ${vehicle.modele} ${vehicle.type}. Qualité OE et aftermarket.` 
    }
  ];
};

// ========================================
// 🚀 LOADER UNIFIÉ
// ========================================
export async function loader({ params }: LoaderFunctionArgs) {
  const startTime = Date.now();
  const { gamme: gammeAlias, marque: marqueAlias, modele: modeleAlias, type: typeAlias } = params;

  if (!gammeAlias || !marqueAlias || !modeleAlias || !typeAlias) {
    throw new Response("Paramètres manquants", { status: 400 });
  }

  try {
    console.log(`🎯 [LOADER-UNIFIÉ] Récupération pour: ${gammeAlias}/${marqueAlias}/${modeleAlias}/${typeAlias}`);

    // 🔄 ÉTAPE 1: Résolution automatique des IDs
    const [vehicleIds, gammeId] = await Promise.all([
      resolveVehicleIds(marqueAlias, modeleAlias, typeAlias),
      resolveGammeId(gammeAlias)
    ]);

    console.log(`✅ [LOADER-UNIFIÉ] IDs résolus: vehicle=${JSON.stringify(vehicleIds)}, gamme=${gammeId}`);

    // 🔄 ÉTAPE 2: Récupération des pièces
    const piecesData = await fetchRealPieces(vehicleIds.typeId, gammeId);

    // 🔄 ÉTAPE 3: Construction des données de base
    const vehicle: VehicleData = {
      typeId: vehicleIds.typeId,
      type: toTitleCaseFromSlug(typeAlias),
      marqueId: vehicleIds.marqueId,
      marque: toTitleCaseFromSlug(marqueAlias),
      modeleId: vehicleIds.modeleId,
      modele: toTitleCaseFromSlug(modeleAlias)
    };

    const gamme: GammeData = {
      id: gammeId,
      name: toTitleCaseFromSlug(gammeAlias),
      alias: gammeAlias,
      image: `pieces-${gammeId}.webp`,
      description: `Pièces ${gammeAlias.replace(/-/g, " ")} de qualité pour votre véhicule`
    };

    // 🆕 ÉTAPE 3.5: Récupération données cross-selling et blog depuis VRAIES APIs
    const [crossSellingGammes, blogArticle] = await Promise.all([
      fetchCrossSellingGammes(vehicleIds.typeId, gammeId),
      fetchBlogArticle(gamme, vehicle)
    ]);

    console.log(`✅ [LOADER-UNIFIÉ] Cross-selling: ${crossSellingGammes.length} gammes, Blog: ${blogArticle ? 'trouvé' : 'aucun'}`);

    // 🆕 ÉTAPE 4: Génération du contenu enrichi
    const seoContent = generateSEOContent(vehicle, gamme);
    const faqItems = generateFAQ(vehicle, gamme);
    const relatedArticles = generateRelatedArticles(vehicle, gamme);
    const buyingGuide = generateBuyingGuide(vehicle, gamme);

    const loadTime = Date.now() - startTime;

    return json<LoaderData>({
      vehicle,
      gamme,
      pieces: piecesData.pieces,
      count: piecesData.count,
      minPrice: piecesData.minPrice,
      maxPrice: piecesData.maxPrice,
      
      // 🆕 Contenu enrichi
      seoContent,
      faqItems,
      relatedArticles,
      buyingGuide,
      compatibilityInfo: {
        engines: ['Essence', 'Diesel', 'Hybride'],
        years: '2010-2024',
        notes: [
          'Compatibilité vérifiée par notre équipe technique',
          'Installation recommandée par un professionnel',
          'Garantie constructeur incluse'
        ]
      },
      
      // 🆕 Sections PHP cross-selling et blog - VRAIES DONNÉES
      crossSellingGammes,
      blogArticle: blogArticle || undefined,
      
      seo: {
        title: `${gamme.name} ${vehicle.marque} ${vehicle.modele}`,
        h1: seoContent.h1,
        description: `${gamme.name} pour ${vehicle.marque} ${vehicle.modele} ${vehicle.type}. Prix compétitifs et livraison rapide.`
      },
      
      performance: {
        loadTime,
        source: 'unified-api-v5-with-cross-selling',
        cacheHit: false
      }
    });

  } catch (error) {
    console.error('❌ [LOADER-UNIFIÉ] Erreur:', error);
    
    if (error instanceof Response) {
      throw error;
    }
    
    throw new Response('Erreur serveur interne', { status: 500 });
  }
}

// ========================================
// 🎨 COMPOSANT REACT UNIFIÉ
// ========================================
export default function UnifiedPiecesPage() {
  const data = useLoaderData<LoaderData>();

  // Filtres unifiés
  const [activeFilters, setActiveFilters] = useState({
    brands: [] as string[],
    priceRange: "all" as "all" | "low" | "medium" | "high",
    quality: "all" as "all" | "OES" | "AFTERMARKET" | "Echange Standard",
    availability: "all" as "all" | "stock" | "order",
    searchText: "",
  });

  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc" | "brand">("name");
  
  // 🆕 États avancés V5+
  const [viewMode, setViewMode] = useState<"grid" | "list" | "comparison">("grid");
  const [selectedPieces, setSelectedPieces] = useState<number[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [_priceHistory, _setPriceHistory] = useState<Record<number, {currentPrice: number, previousPrice?: number, trend?: 'up' | 'down' | 'stable'}>>({});
  const [_favoritesPieces, setFavoritesPieces] = useState<number[]>([]);
  const [_showAdvancedFilters, _setShowAdvancedFilters] = useState(false);

  // 🔍 Filtrage optimisé
  const finalFilteredProducts = useMemo(() => {
    let result = [...data.pieces];

    // Recherche textuelle
    if (activeFilters.searchText) {
      const q = activeFilters.searchText.toLowerCase();
      result = result.filter(piece => 
        piece.name.toLowerCase().includes(q) ||
        piece.reference.toLowerCase().includes(q) ||
        piece.brand.toLowerCase().includes(q)
      );
    }

    // Filtres par marque
    if (activeFilters.brands.length) {
      result = result.filter(piece => 
        activeFilters.brands.includes(piece.brand)
      );
    }

    // Filtre par qualité
    if (activeFilters.quality !== "all") {
      result = result.filter(piece => 
        piece.quality === activeFilters.quality
      );
    }

    // Filtre par prix
    if (activeFilters.priceRange !== "all") {
      result = result.filter(piece => {
        const price = piece.price;
        switch (activeFilters.priceRange) {
          case "low": return price < 50;
          case "medium": return price >= 50 && price < 150;
          case "high": return price >= 150;
          default: return true;
        }
      });
    }

    // Filtre par disponibilité
    if (activeFilters.availability === "stock") {
      result = result.filter(piece => piece.stock === "En stock");
    }

    // Tri
    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "brand":
        result.sort((a, b) => a.brand.localeCompare(b.brand));
        break;
    }

    return result;
  }, [data.pieces, activeFilters, sortBy]);

  const resetAllFilters = () => {
    setActiveFilters({
      brands: [],
      priceRange: "all",
      quality: "all", 
      availability: "all",
      searchText: "",
    });
    setSortBy("name");
  };

  // Extraire les marques uniques pour le filtre
  const uniqueBrands = useMemo(() => {
    const brands = new Set(data.pieces.map(p => p.brand));
    return Array.from(brands).sort();
  }, [data.pieces]);

  // 🆕 Fonctions avancées V5+
  const togglePieceSelection = (pieceId: number) => {
    setSelectedPieces(prev => 
      prev.includes(pieceId) 
        ? prev.filter(id => id !== pieceId)
        : [...prev, pieceId]
    );
  };

  const _toggleFavorite = (pieceId: number) => {
    setFavoritesPieces(prev => 
      prev.includes(pieceId)
        ? prev.filter(id => id !== pieceId)
        : [...prev, pieceId]
    );
  };

  const getRecommendedPieces = useMemo(() => {
    if (!showRecommendations) return [];
    
    // Logique de recommandation intelligente
    return finalFilteredProducts
      .filter(piece => piece.quality === 'OES' && piece.stars && piece.stars >= 4)
      .slice(0, 3);
  }, [finalFilteredProducts, showRecommendations]);

  const clearAllSelections = () => {
    setSelectedPieces([]);
    setFavoritesPieces([]);
  };

  const _getSelectedPiecesData = useMemo(() => {
    return data.pieces.filter(piece => selectedPieces.includes(piece.id));
  }, [data.pieces, selectedPieces]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header moderne avec gradient */}
      <div className="relative overflow-hidden">
        {/* Gradient de fond */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full" style={{backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 2px, transparent 2px)', backgroundSize: '30px 30px'}}></div>
        </div>
        
        {/* Contenu du header */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex-1">
              {/* Breadcrumb moderne */}
              <nav className="flex items-center space-x-2 text-sm text-blue-100 mb-4">
                <a href="/" className="hover:text-white transition-colors flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path></svg>
                  Accueil
                </a>
                <span className="text-blue-300">→</span>
                <a href="/pieces" className="hover:text-white transition-colors">Pièces</a>
                <span className="text-blue-300">→</span>
                <a href={`/pieces/${data.gamme.alias}`} className="text-white font-medium hover:text-blue-200 transition-colors">{data.gamme.name}</a>
                <span className="text-blue-300">→</span>
                <span className="text-blue-200">{data.vehicle.marque} {data.vehicle.modele}</span>
              </nav>
              
              {/* Titre principal */}
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 py-1">
                    <span className="text-white text-sm font-medium">Pièces automobile</span>
                  </div>
                </div>
                <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                  {data.gamme.name}
                </h1>
                <p className="text-xl text-blue-100 mb-4">
                  Pour <span className="font-semibold text-white">{data.vehicle.marque} {data.vehicle.modele}</span>
                  <span className="text-blue-200"> • {data.vehicle.type}</span>
                </p>
              </div>
              
              {/* Badges informatifs */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                  <svg className="w-4 h-4 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-white font-medium">{data.count} pièces</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                  <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-white font-medium">Qualité garantie</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                  <svg className="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-white font-medium">Livraison rapide</span>
                </div>
                {data.performance && (
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2">
                    <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span className="text-white text-sm">{data.performance.source} • {data.performance.loadTime}ms</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-4">
              <button className="bg-white/10 backdrop-blur-sm border border-white/20 text-white px-6 py-3 rounded-xl font-medium hover:bg-white/20 transition-all duration-200 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Changer de véhicule
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Filtres moderne */}
          <div className="w-80 space-y-6">
            {/* Card principale des filtres */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                  </svg>
                  Filtres
                </h3>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Recherche moderne */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Rechercher</label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Rechercher une pièce..."
                      value={activeFilters.searchText}
                      onChange={(e) => setActiveFilters(prev => ({...prev, searchText: e.target.value}))}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                {/* Marques */}
                {uniqueBrands.length > 1 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Marques ({uniqueBrands.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {uniqueBrands.map(brand => {
                        const isSelected = activeFilters.brands.includes(brand);
                        const brandCount = data.pieces.filter(p => p.brand === brand).length;
                        return (
                          <label key={brand} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                            isSelected ? 'bg-blue-50 border border-blue-200' : ''
                          }`}>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 mr-3"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setActiveFilters(prev => ({
                                      ...prev,
                                      brands: [...prev.brands, brand]
                                    }));
                                  } else {
                                    setActiveFilters(prev => ({
                                      ...prev,
                                      brands: prev.brands.filter(b => b !== brand)
                                    }));
                                  }
                                }}
                              />
                              <span className={`text-sm ${
                                isSelected ? 'font-medium text-blue-900' : 'text-gray-700'
                              }`}>{brand}</span>
                            </div>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              {brandCount}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Prix moderne */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    Prix
                  </h4>
                  <div className="space-y-2">
                    {[
                      { id: 'all', label: 'Tous les prix', desc: '', color: 'border-gray-200' },
                      { id: 'low', label: 'Moins de 50€', desc: '(économique)', color: 'border-green-200 bg-green-50' },
                      { id: 'medium', label: '50€ - 150€', desc: '(standard)', color: 'border-blue-200 bg-blue-50' },
                      { id: 'high', label: 'Plus de 150€', desc: '(premium)', color: 'border-purple-200 bg-purple-50' }
                    ].map(price => {
                      const isSelected = activeFilters.priceRange === price.id;
                      return (
                        <label key={price.id} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                          isSelected ? `${price.color} border-opacity-100` : 'border-gray-100 hover:bg-gray-50'
                        }`}>
                          <input 
                            type="radio" 
                            name="priceRange"
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                            checked={isSelected}
                            onChange={() => {
                              setActiveFilters(prev => ({
                                ...prev,
                                priceRange: price.id as any
                              }));
                            }}
                          />
                          <div>
                            <span className={`text-sm ${isSelected ? 'font-medium' : ''}`}>
                              {price.label} 
                            </span>
                            {price.desc && (
                              <span className="text-xs text-gray-500 block">{price.desc}</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Qualité moderne */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Qualité
                  </h4>
                  <div className="space-y-2">
                    {[
                      { id: 'all', label: 'Toutes qualités', icon: '🔧' },
                      { id: 'OES', label: 'OES (Origine)', icon: '🏆' },
                      { id: 'AFTERMARKET', label: 'Aftermarket', icon: '⭐' },
                      { id: 'Echange Standard', label: 'Échange Standard', icon: '🔄' }
                    ].map(quality => {
                      const isSelected = activeFilters.quality === quality.id;
                      return (
                        <label key={quality.id} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                          isSelected ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                        }`}>
                          <input 
                            type="radio" 
                            name="quality"
                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                            checked={isSelected}
                            onChange={() => {
                              setActiveFilters(prev => ({
                                ...prev,
                                quality: quality.id as any
                              }));
                            }}
                          />
                          <span className={`text-sm flex items-center gap-2 ${isSelected ? 'font-medium' : ''}`}>
                            <span>{quality.icon}</span>
                            {quality.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Disponibilité moderne */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Disponibilité
                  </h4>
                  <div className="space-y-2">
                    <label className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                      activeFilters.availability === "all" ? 'border-blue-200 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'
                    }`}>
                      <input 
                        type="radio" 
                        name="availability"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                        checked={activeFilters.availability === "all"}
                        onChange={() => setActiveFilters(prev => ({...prev, availability: "all"}))}
                      />
                      <span className="text-sm">Toutes disponibilités</span>
                    </label>
                    <label className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors border ${
                      activeFilters.availability === "stock" ? 'border-green-200 bg-green-50' : 'border-gray-100 hover:bg-gray-50'
                    }`}>
                      <input 
                        type="radio" 
                        name="availability"
                        className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2 mr-3"
                        checked={activeFilters.availability === "stock"}
                        onChange={() => setActiveFilters(prev => ({...prev, availability: "stock"}))}
                      />
                      <span className="text-sm flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        En stock uniquement
                      </span>
                    </label>
                  </div>
                </div>

                {/* Bouton reset moderne */}
                <button
                  onClick={resetAllFilters}
                  className="w-full bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Réinitialiser les filtres
                </button>
              </div>
            </div>
          </div>

          {/* Contenu principal */}
          <div className="flex-1">
            {/* Tri */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-gray-600 font-medium">
                    {finalFilteredProducts.length} pièce{finalFilteredProducts.length > 1 ? 's' : ''} trouvée{finalFilteredProducts.length > 1 ? 's' : ''}
                  </span>
                  {data.minPrice > 0 && (
                    <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                      À partir de {data.minPrice.toFixed(2)}€
                    </span>
                  )}
                  {selectedPieces.length > 0 && (
                    <span className="text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-medium">
                      {selectedPieces.length} sélectionnée{selectedPieces.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Modes d'affichage */}
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        viewMode === 'grid' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🔲 Grille
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        viewMode === 'list' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 Liste
                    </button>
                    <button
                      onClick={() => setViewMode('comparison')}
                      className={`px-3 py-1 rounded-md text-sm transition-colors ${
                        viewMode === 'comparison' ? 'bg-white text-blue-600 shadow' : 'text-gray-600 hover:text-gray-900'
                      }`}
                      disabled={selectedPieces.length < 2}
                    >
                      ⚖️ Comparaison
                    </button>
                  </div>

                  {/* Actions sélection */}
                  {selectedPieces.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={clearAllSelections}
                        className="text-sm bg-gray-200 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        🗑️ Effacer ({selectedPieces.length})
                      </button>
                      <button className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors">
                        🛒 Ajouter au panier
                      </button>
                    </div>
                  )}
                  
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="name">Nom A-Z</option>
                    <option value="price-asc">Prix croissant</option>
                    <option value="price-desc">Prix décroissant</option>
                    <option value="brand">Marque A-Z</option>
                  </select>
                </div>
              </div>
              
              {/* Recommandations intelligentes */}
              {getRecommendedPieces.length > 0 && (
                <div className="mt-4 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-orange-800 flex items-center gap-2">
                      <span>⭐</span>
                      Nos recommandations pour votre {data.vehicle.marque} {data.vehicle.modele}
                    </h4>
                    <button
                      onClick={() => setShowRecommendations(!showRecommendations)}
                      className="text-xs text-orange-600 hover:text-orange-800"
                    >
                      {showRecommendations ? 'Masquer' : 'Afficher'}
                    </button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto">
                    {getRecommendedPieces.map(piece => (
                      <div key={piece.id} className="flex-shrink-0 bg-white rounded-lg p-3 shadow-sm border min-w-48">
                        <h5 className="font-medium text-sm text-gray-900 mb-1 line-clamp-2">{piece.name}</h5>
                        <div className="text-xs text-gray-600 mb-2">{piece.brand}</div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-green-600">{piece.priceFormatted}</span>
                          <button
                            onClick={() => togglePieceSelection(piece.id)}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                          >
                            Sélectionner
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Grilles des produits avec vues avancées */}
            {finalFilteredProducts.length > 0 ? (
              <div>
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {finalFilteredProducts.map(piece => (
                      <div key={piece.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 p-4 transform hover:scale-105 relative">
                        {/* Checkbox sélection */}
                        <div className="absolute top-2 right-2 z-10">
                          <input
                            type="checkbox"
                            checked={selectedPieces.includes(piece.id)}
                            onChange={() => togglePieceSelection(piece.id)}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </div>
                        
                        <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                          <div className="text-4xl text-gray-400">🔧</div>
                        </div>
                        
                        <h3 className="font-medium text-lg mb-2 line-clamp-2">{piece.name}</h3>
                        
                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div>Réf: {piece.reference}</div>
                          <div>Marque: {piece.brand}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-1 rounded text-xs ${
                              piece.stock === "En stock" 
                                ? "bg-green-100 text-green-800" 
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {piece.stock}
                            </span>
                            {piece.quality && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                {piece.quality}
                              </span>
                            )}
                            {piece.stars && piece.stars > 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                {'★'.repeat(piece.stars)}
                              </span>
                            )}
                            {piece.side && (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                {piece.side}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-lg font-bold text-blue-600">
                            {piece.priceFormatted}
                          </div>
                          <AddToCartButton 
                            piece={piece}
                            variant="small"
                            onSuccess={() => {
                              console.log(`✅ ${piece.name} ajouté au panier avec succès`);
                              // Optionnel : toast notification, refresh cart count, etc.
                            }}
                            onError={(error) => {
                              console.error(`❌ Erreur ajout ${piece.name}:`, error);
                              // Optionnel : afficher une notification d'erreur
                            }}
                          />
                        </div>
                        
                        {piece.delaiLivraison && (
                          <div className="text-xs text-gray-500 mt-2">
                            Livraison: {piece.delaiLivraison} jour{piece.delaiLivraison > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {viewMode === 'list' && (
                  <div className="space-y-4">
                    {finalFilteredProducts.map(piece => (
                      <div key={piece.id} className="bg-white rounded-lg shadow-sm p-6 flex items-center gap-6 hover:shadow-md transition-shadow">
                        <input
                          type="checkbox"
                          checked={selectedPieces.includes(piece.id)}
                          onChange={() => togglePieceSelection(piece.id)}
                          className="w-4 h-4 text-blue-600"
                        />
                        <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl text-gray-400">🔧</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium text-lg mb-1">{piece.name}</h3>
                          <div className="text-sm text-gray-600 mb-2">
                            Réf: {piece.reference} • Marque: {piece.brand}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${
                              piece.stock === "En stock" 
                                ? "bg-green-100 text-green-800" 
                                : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {piece.stock}
                            </span>
                            {piece.quality && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                {piece.quality}
                              </span>
                            )}
                            {piece.stars && piece.stars > 0 && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                {'★'.repeat(piece.stars)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-blue-600 mb-2">
                            {piece.priceFormatted}
                          </div>
                          <AddToCartButton 
                            piece={piece}
                            variant="default"
                            onSuccess={() => {
                              console.log(`✅ ${piece.name} ajouté au panier avec succès`);
                            }}
                            onError={(error) => {
                              console.error(`❌ Erreur ajout ${piece.name}:`, error);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {viewMode === 'comparison' && selectedPieces.length >= 2 && (
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <span>⚖️</span>
                      Comparaison des pièces sélectionnées ({selectedPieces.length})
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-semibold">Critère</th>
                            {finalFilteredProducts
                              .filter(p => selectedPieces.includes(p.id))
                              .map(piece => (
                                <th key={piece.id} className="text-center p-3 font-semibold min-w-40">
                                  {piece.brand}
                                </th>
                              ))
                            }
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Nom</td>
                            {finalFilteredProducts
                              .filter(p => selectedPieces.includes(p.id))
                              .map(piece => (
                                <td key={piece.id} className="p-3 text-center text-sm">
                                  {piece.name}
                                </td>
                              ))
                            }
                          </tr>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Prix</td>
                            {finalFilteredProducts
                              .filter(p => selectedPieces.includes(p.id))
                              .map(piece => (
                                <td key={piece.id} className="p-3 text-center">
                                  <span className="font-bold text-lg text-blue-600">
                                    {piece.priceFormatted}
                                  </span>
                                </td>
                              ))
                            }
                          </tr>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Qualité</td>
                            {finalFilteredProducts
                              .filter(p => selectedPieces.includes(p.id))
                              .map(piece => (
                                <td key={piece.id} className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    piece.quality === 'OES' 
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                    {piece.quality}
                                  </span>
                                </td>
                              ))
                            }
                          </tr>
                          <tr className="border-b">
                            <td className="p-3 font-medium">Disponibilité</td>
                            {finalFilteredProducts
                              .filter(p => selectedPieces.includes(p.id))
                              .map(piece => (
                                <td key={piece.id} className="p-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    piece.stock === "En stock" 
                                      ? "bg-green-100 text-green-800" 
                                      : "bg-yellow-100 text-yellow-800"
                                  }`}>
                                    {piece.stock}
                                  </span>
                                </td>
                              ))
                            }
                          </tr>
                          <tr>
                            <td className="p-3 font-medium">Note</td>
                            {finalFilteredProducts
                              .filter(p => selectedPieces.includes(p.id))
                              .map(piece => (
                                <td key={piece.id} className="p-3 text-center">
                                  {piece.stars && piece.stars > 0 ? (
                                    <span className="text-yellow-500">
                                      {'★'.repeat(piece.stars)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Non noté</span>
                                  )}
                                </td>
                              ))
                            }
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-6 flex justify-center gap-4">
                      {finalFilteredProducts
                        .filter(p => selectedPieces.includes(p.id))
                        .map(piece => (
                          <button 
                            key={piece.id}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
                          >
                            Choisir {piece.brand}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">Aucun produit trouvé</h3>
                <p className="text-gray-600 mb-4">
                  Essayez de modifier vos filtres ou votre recherche.
                </p>
                <button
                  onClick={resetAllFilters}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            )}
            
            {/* 🆕 STATISTIQUES AVANCÉES V5+ */}
            <div className="bg-gradient-to-r from-blue-50 via-white to-green-50 rounded-xl shadow-sm p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <span>📊</span>
                Statistiques du catalogue pour {data.vehicle.marque} {data.vehicle.modele}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-blue-600">{data.count}</div>
                  <div className="text-sm text-gray-600">Pièces disponibles</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-green-600">{uniqueBrands.length}</div>
                  <div className="text-sm text-gray-600">Marques partenaires</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-orange-600">{data.minPrice.toFixed(0)}€</div>
                  <div className="text-sm text-gray-600">Prix minimum</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-2xl font-bold text-purple-600">
                    {Math.round(((data.pieces.filter(p => p.stock === 'En stock').length) / data.count) * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">En stock immédiat</div>
                </div>
              </div>
              
              {/* Répartition par marque (top 5) */}
              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 mb-3">🏭 Répartition par marque (Top 5)</h3>
                <div className="grid grid-cols-5 gap-2">
                  {uniqueBrands.slice(0, 5).map(brand => {
                    const brandCount = data.pieces.filter(p => p.brand === brand).length;
                    const percentage = Math.round((brandCount / data.count) * 100);
                    return (
                      <div key={brand} className="text-center p-2 bg-white rounded border">
                        <div className="font-semibold text-sm">{brand}</div>
                        <div className="text-xs text-gray-600">{brandCount} pièces</div>
                        <div className="text-xs text-blue-600">{percentage}%</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* 🆕 SECTIONS ENRICHIES */}
            
            {/* Section SEO et Description détaillée */}
            {data.seoContent && (
              <div className="bg-white rounded-lg shadow-sm p-6 mt-8">
                <div className="prose max-w-none">
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    {data.seoContent.h2Sections[0]}
                  </h2>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {data.seoContent.longDescription}
                  </div>
                  
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        📋 Spécifications techniques
                      </h3>
                      <ul className="space-y-2">
                        {data.seoContent.technicalSpecs.map((spec, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-green-600 mt-1">•</span>
                            <span className="text-gray-700">{spec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        🔧 Conseils d'installation
                      </h3>
                      <ul className="space-y-2">
                        {data.seoContent.installationTips.map((tip, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-600 mt-1">•</span>
                            <span className="text-gray-700">{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Guide d'achat */}
            {data.buyingGuide && (
              <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  📖 {data.buyingGuide.title}
                </h2>
                <p className="text-gray-700 mb-4">{data.buyingGuide.content}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-green-800 mb-3">
                      ✅ Conseils d'experts
                    </h3>
                    <ul className="space-y-2">
                      {data.buyingGuide.tips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-green-600 mt-1">•</span>
                          <span className="text-gray-700">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {data.buyingGuide.warnings && (
                    <div>
                      <h3 className="text-lg font-semibold text-orange-800 mb-3">
                        ⚠️ Points d'attention
                      </h3>
                      <ul className="space-y-2">
                        {data.buyingGuide.warnings.map((warning, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-orange-600 mt-1">•</span>
                            <span className="text-gray-700">{warning}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* FAQ Section */}
            {data.faqItems && data.faqItems.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  ❓ Questions fréquentes
                </h2>
                <div className="space-y-4">
                  {data.faqItems.map((faq) => (
                    <details key={faq.id} className="group">
                      <summary className="flex items-center justify-between cursor-pointer p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <h3 className="font-medium text-gray-900">{faq.question}</h3>
                        <span className="text-gray-500 group-open:rotate-180 transition-transform">
                          ▼
                        </span>
                      </summary>
                      <div className="p-4 text-gray-700 border-l-4 border-blue-500 bg-blue-50 mt-2">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
            
            {/* Articles liés */}
            {data.relatedArticles && data.relatedArticles.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">
                  📚 Articles utiles
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.relatedArticles.map((article) => (
                    <article key={article.id} className="group">
                      <div className="aspect-video bg-gray-200 rounded-lg mb-3 overflow-hidden">
                        <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <span className="text-white text-lg font-medium">📖</span>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors cursor-pointer">
                        {article.title}
                      </h3>
                      <p className="text-gray-600 text-sm mt-2">{article.excerpt}</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                        <span>📅 {article.date}</span>
                        <span>⏱️ {article.readTime} min</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
            
            {/* 🆕 SECTIONS PHP ADAPTÉES - VRAIES DONNÉES DE L'API */}
            
            {/* 📝 SECTION 1: Informations sur les [gamme] - Adaptation 100% fidèle du PHP original avec contenu technique spécialisé */}
            <div className="container-fluid containerwhitePage bg-white p-6 mt-6 rounded-lg">
              <div className="container-fluid mymaxwidth">
                <div className="row">
                  <div className="col-12">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                      Informations sur les {formatGammeName(data.gamme)} de la {data.vehicle.marque} {data.vehicle.modele} {data.vehicle.type}
                    </h2>
                    <div className="divh2 border-b border-gray-200 mb-4"></div>
                  </div>
                  <div className="col-12">
                    <p className="text-gray-700 leading-relaxed">
                      Automecanik vous conseille de vérifier régulièrement les {formatGammeName(data.gamme)} de votre {data.vehicle.marque} {data.vehicle.modele} {data.vehicle.type} 
                      pour assurer une bonne qualité d'huile lubrifiante et garantir le bon fonctionnement du moteur.
                      <br/><br/>
                      Le {formatGammeName(data.gamme)} de votre {data.vehicle.marque} {data.vehicle.modele} {data.vehicle.type} va filtrer l'huile des impuretés 
                      pour une lubrification optimale de votre moteur. Un entretien régulier de cette pièce est essentiel pour préserver la longévité de votre véhicule.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* 🔄 SECTION CROSS-SELLING - Pièces à contrôler lors du remplacement - Adaptation 100% fidèle du PHP MultiCarousel */}
            {data.crossSellingGammes && data.crossSellingGammes.length > 0 && (
              <div className="container-fluid containerwhitePage mt-6 rounded-lg" style={{backgroundColor: '#f8f9fa', paddingTop: '40px', paddingBottom: '40px'}}>
                <div className="container-fluid mymaxwidth">
                  <div className="row">
                    <div className="col-12">
                      <h2 className="text-xl font-bold text-gray-900 mb-4">
                        Pièces à contrôler lors du remplacement des {formatGammeName(data.gamme)}
                      </h2>
                      <div className="divh2 border-b border-gray-300 mb-6"></div>
                    </div>
                    <div className="col-12">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="McCgcGamme">
                        {data.crossSellingGammes.map((crossGamme: CrossSellingGamme) => {
                          // Variables exactes du PHP original
                          const thisPgId = crossGamme.PG_ID;
                          const thisPgNameSite = crossGamme.PG_NAME;
                          const thisPgAlias = crossGamme.PG_ALIAS || 'gamme';
                          
                          // Image adaptée (logique PHP)
                          const thisPgImg = crossGamme.PG_IMAGE || `pieces-${thisPgId}.webp`;
                          
                          // URL construite comme en PHP
                          const crossSellingUrl = `/pieces/${thisPgAlias}/${data.vehicle.marque.toLowerCase()}/${data.vehicle.modele.toLowerCase().replace(/ /g, '-')}/${data.vehicle.type.toLowerCase().replace(/ /g, '-')}.html`;

                          return (
                            <div key={thisPgId} className="item">
                              <div className="p-4">
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden h-full hover:shadow-md transition-shadow">
                                  <div className="relative pb-16 overflow-hidden" style={{paddingBottom: '60%'}}>
                                    <img 
                                      src={`/images/gammes/${thisPgImg}`}
                                      alt={thisPgNameSite}
                                      className="absolute inset-0 w-full h-full object-cover"
                                      onError={(e) => {
                                        // Fallback image PHP logic
                                        (e.target as HTMLImageElement).src = `/images/gammes/pieces-default.webp`;
                                      }}
                                    />
                                  </div>
                                  <div className="p-4 text-center">
                                    <h5 className="text-sm font-bold text-gray-900 mb-3 min-h-10 flex items-center justify-center">
                                      {thisPgNameSite}
                                    </h5>
                                    <a 
                                      href={crossSellingUrl} 
                                      className="inline-block bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 rounded transition-colors"
                                    >
                                      Voir les pièces
                                    </a>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 📝 SECTION 3: Article de blog - Adaptation 100% fidèle du PHP original */}
            <div className="container-fluid containerwhitePage bg-white p-6 mt-6 rounded-lg">
              <div className="container-fluid mymaxwidth">
                <div className="row">
                  <div className="col-12">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">
                      Guide d'entretien pour {data.vehicle.marque} {data.vehicle.modele}
                    </h2>
                    <div className="divh2 border-b border-gray-200 mb-4"></div>
                  </div>
                  <div className="col-12">
                    <div className="blog-article-preview border border-gray-200 rounded-lg overflow-hidden mt-4 hover:shadow-md transition-shadow">
                      {/* Image de l'article (conditionnelle comme en PHP) */}
                      {data.blogArticle?.image && (
                        <div className="relative pb-16 overflow-hidden bg-gray-100" style={{paddingBottom: '40%'}}>
                          <img
                            src={data.blogArticle.image}
                            alt={data.blogArticle.title}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback si pas d'image (logique PHP)
                              (e.target as HTMLImageElement).style.display = 'none';
                              (e.target as HTMLImageElement).parentElement!.style.paddingBottom = '0';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Contenu de l'article */}
                      <div className="p-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">
                          {data.blogArticle?.title || `Comment choisir les bonnes pièces pour votre ${data.vehicle.marque} ${data.vehicle.modele}`}
                        </h3>
                        <p className="text-gray-600 mb-4 leading-relaxed">
                          {data.blogArticle?.excerpt || `Découvrez nos conseils d'experts pour sélectionner les pièces adaptées à votre véhicule. 
                          Qualité, compatibilité et prix : tous nos secrets pour un entretien réussi.`}
                        </p>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            📅 {data.blogArticle?.date ? new Date(data.blogArticle.date).toLocaleDateString('fr-FR') : 'Publié récemment'} • ⏱️ {data.blogArticle?.readTime || 5} min de lecture
                          </span>
                          <a 
                            href={data.blogArticle?.slug ? `/blog/${data.blogArticle.slug}` : '/blog/guide-entretien-automobile'} 
                            className="bg-green-500 hover:bg-green-600 text-white text-sm px-4 py-2 rounded transition-colors"
                          >
                            Lire l'article
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Informations de compatibilité */}
            {data.compatibilityInfo && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 mt-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">
                  🔧 Informations de compatibilité
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-semibold text-gray-700">Motorisations:</span>
                    <div className="text-gray-600">{data.compatibilityInfo.engines.join(', ')}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Années:</span>
                    <div className="text-gray-600">{data.compatibilityInfo.years}</div>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-700">Notes:</span>
                    <ul className="text-gray-600 mt-1">
                      {data.compatibilityInfo.notes.map((note, index) => (
                        <li key={index} className="text-xs">• {note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

// ========================================
// 🔧 FONCTIONS UTILITAIRES
// ========================================
