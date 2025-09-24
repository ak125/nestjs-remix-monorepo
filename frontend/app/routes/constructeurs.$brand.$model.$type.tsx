// 🚗 Page détail véhicule - Logique métier PHP intégrée

import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { catalogFamiliesApi, type CatalogFamily as ApiCatalogFamily } from "../services/api/catalog-families.api";

// 📝 Types de données (structure PHP)
interface VehicleData {
  marque_id: number;
  marque_alias: string;
  marque_name: string;
  marque_name_meta: string;
  marque_name_meta_title: string;
  marque_logo: string;
  marque_relfollow: number;
  modele_id: number;
  modele_alias: string;
  modele_name: string;
  modele_name_meta: string;
  modele_relfollow: number;
  type_id: number;
  type_alias: string;
  type_name: string;
  type_name_meta: string;
  type_power_ps: string;
  type_body: string;
  type_fuel: string;
  type_month_from: string;
  type_year_from: string;
  type_month_to: string | null;
  type_year_to: string | null;
  type_relfollow: number;
}

interface CatalogFamily {
  mf_id: number;
  mf_name: string;
  mf_description: string;
  mf_pic: string;
  gammes: CatalogGamme[];
}

interface CatalogGamme {
  pg_id: number;
  pg_alias: string;
  pg_name: string;
}

interface PopularPart {
  cgc_pg_id: number;
  pg_alias: string;
  pg_name: string;
  pg_name_meta: string;
  pg_img: string;
  addon_content: string;
}

interface SEOData {
  title: string;
  description: string;
  keywords: string;
  h1: string;
  content: string;
  content2: string;
  robots: string;
  canonical: string;
}

interface LoaderData {
  vehicle: VehicleData;
  catalogFamilies: CatalogFamily[];
  popularParts: PopularPart[];
  seo: SEOData;
  breadcrumb: {
    brand: string;
    model: string;
    type: string;
  };
}

// 🔄 Loader avec logique métier PHP convertie
export async function loader({ params, request }: LoaderFunctionArgs) {
  console.log('🚨🚨🚨 LOADER CONSTRUCTEURS.$BRAND.$MODEL.$TYPE APPELÉ 🚨🚨🚨');
  console.log('🔄 Vehicle detail loader appelé avec params:', params);
  console.log('🔄 URL complète:', request.url);
  console.log('🔄 Request method:', request.method);
  
  // Validation stricte des paramètres
  const { brand, model, type } = params;
  console.log('🔍 Paramètres destructurés:', { brand, model, type });

  if (!brand || !model || !type) {
    console.error('❌ Paramètres manquants:', { brand, model, type });
    throw new Response("Paramètres manquants", { status: 400 });
  }

  if (!brand.includes('-') || !model.includes('-') || !type.includes('-')) {
    console.error('❌ Format de paramètres invalide');
    throw new Response("URL invalide", { status: 400 });
  }

  console.log('✅ Tous les paramètres sont présents, génération des données...');

  // === PARSING DES PARAMÈTRES (logique PHP adaptée) ===
  const brandParts = brand.split('-');
  const marque_id = parseInt(brandParts[brandParts.length - 1]) || 0;
  const marque_alias = brandParts.slice(0, -1).join('-');
  const marque_name = marque_alias.toUpperCase();

  const modelParts = model.split('-');
  const modele_id = parseInt(modelParts[modelParts.length - 1]) || 0;
  const modele_alias = modelParts.slice(0, -1).join('-');
  const modele_name = modelParts.slice(0, -1).join('-').toUpperCase().replace(/-/g, ' ')
    .replace(/SERIE/g, 'Série')
    .replace(/CLASSE/g, 'Classe')
    .replace(/F\d+/g, (match) => `(${match})`)
    .replace(/\s+/g, ' ')
    .trim();

  const typeParts = type.replace('.html', '').split('-');
  const type_id = parseInt(typeParts[typeParts.length - 1]) || 0;
  const type_alias = type.replace('.html', '');
  const type_name_raw = typeParts.slice(0, -1).join(' ').toUpperCase();
  const type_name = type_name_raw
    .replace(/(\d+)([A-Z])/g, '$1 $2')
    .replace(/(\d)(\d)(\w)/g, '$1.$2 $3')
    .replace(/DCI/g, 'dCi')
    .replace(/HDI/g, 'HDi')
    .replace(/TDI/g, 'TDI')
    .replace(/TSI/g, 'TSI')
    .trim();

  // === SIMULATION DES DONNÉES VÉHICULE (structure PHP) ===
  const type_power_ps = type_name_raw.includes('114') ? '95' :
                       type_name_raw.includes('116') ? '116' :
                       type_name_raw.includes('118') ? '143' :
                       type_name_raw.includes('120') ? '177' :
                       type_name_raw.includes('20') ? '150' :
                       type_name_raw.includes('16') ? '110' :
                       type_name_raw.includes('15') ? '90' :
                       type_name_raw.includes('10') ? '75' : '100';

  const type_fuel = type_name_raw.includes('DCI') || type_name_raw.includes('HDI') || 
                   type_name_raw.includes('JTDM') || type_name_raw.includes('TDI') ? 'Diesel' : 'Essence';

  const type_body = marque_name.includes('BMW') && model.includes('serie') ? 'Berline' :
                   model.includes('duster') ? 'SUV' :
                   model.includes('a3') ? 'Berline' : 'Berline';

  // === GÉNÉRATION DATE (logique PHP exacte) ===
  const type_month_from = "1";
  const type_year_from = "2010";
  const type_month_to = null;
  const type_year_to = null;

  // Logique de formatage des dates (reprend exactement le PHP)
  let type_date = "";
  if (!type_year_to) {
    type_date = `du ${type_month_from}/${type_year_from}`;
  } else {
    type_date = `de ${type_year_from} à ${type_year_to}`;
  }

  // === DONNÉES VÉHICULE SELON STRUCTURE PHP ===
  const vehicleData: VehicleData = {
    marque_id,
    marque_alias,
    marque_name,
    marque_name_meta: marque_name,
    marque_name_meta_title: marque_name,
    marque_logo: `${marque_alias}.webp`,
    marque_relfollow: 1,
    modele_id,
    modele_alias,
    modele_name,
    modele_name_meta: modele_name,
    modele_relfollow: 1,
    type_id,
    type_alias,
    type_name,
    type_name_meta: type_name,
    type_power_ps,
    type_body,
    type_fuel,
    type_month_from,
    type_year_from,
    type_month_to,
    type_year_to,
    type_relfollow: 1
  };

  // === SYSTÈME SEO AVEC SWITCH DYNAMIQUE (logique PHP adaptée) ===
  const getSeoSwitch = (alias: number, typeId: number): string => {
    const switches: Record<number, string[]> = {
      1: ["à prix discount", "pas cher", "à mini prix", "en promotion"],
      2: ["et équipements", "et accessoires", "neuves", "d'origine"],
      10: ["Toutes les pièces auto", "Trouvez toutes les pièces", "Catalogue complet", "Pièces détachées"],
      11: ["Toutes les références", "L'ensemble des pièces", "Toutes les gammes", "Tous les produits"],
      12: ["nos fournisseurs certifiés", "nos partenaires agréés", "nos distributeurs", "nos fournisseurs"]
    };

    const options = switches[alias] || [""];
    const index = typeId % options.length;
    return options[index];
  };

  // SEO avec système de switch (reprend la logique PHP exacte)
  const comp_switch_title = getSeoSwitch(1, type_id);
  const comp_switch_desc = getSeoSwitch(2, type_id);
  const comp_switch_content1 = getSeoSwitch(10, type_id);
  const comp_switch_content2 = getSeoSwitch(11, type_id);
  const comp_switch_content3 = getSeoSwitch(12, type_id);

  const seoTitle = `Pièces ${vehicleData.marque_name_meta_title} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${comp_switch_title}`;
  const seoDescription = `Catalogue pièces détachées pour ${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta} ${vehicleData.type_power_ps} ch ${type_date} neuves ${comp_switch_desc}`;
  const seoKeywords = `${vehicleData.marque_name_meta}, ${vehicleData.modele_name_meta}, ${vehicleData.type_name_meta}, ${vehicleData.type_power_ps} ch, ${type_date}`;

  // H1 et contenu (logique PHP exacte)
  const h1 = `${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name} ${vehicleData.type_power_ps} ch ${type_date}`;
  const content = `${comp_switch_content1} pour le modèle <b>${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_body}</b> <strong>${type_date}</strong> de motorisation <strong>${vehicleData.type_name} ${vehicleData.type_power_ps}</strong> ch.`;
  const content2 = `${comp_switch_content2} du catalogue sont compatibles au modèle de la voiture <strong>${vehicleData.marque_name} ${vehicleData.modele_name} ${vehicleData.type_name}</strong> que vous avez sélectionné. Choisissez les pièces correspondantes à votre recherche dans les gammes disponibles et choisissez un article proposé par ${comp_switch_content3}.`;

  // === VALIDATION ROBOTS (logique PHP) ===
  const mockFamilyCount = 4; // Simule le résultat de la requête catalog_family
  const mockGammeCount = 8;  // Simule le résultat de la requête catalog_gamme

  let pageRobots = "index, follow";
  let _relfollow = 1; // Préfixé avec _ pour indiquer intentionnellement inutilisé

  // Logique de validation SEO (exactement comme dans le PHP)
  if (vehicleData.marque_relfollow && vehicleData.modele_relfollow && vehicleData.type_relfollow) {
    if (mockFamilyCount < 3) {
      pageRobots = "noindex, nofollow";
      _relfollow = 0;
    } else if (mockGammeCount < 5) {
      pageRobots = "noindex, nofollow";
      _relfollow = 0;
    }
  } else {
    pageRobots = "noindex, nofollow";
    _relfollow = 0;
  }

  // === GÉNÉRATION CANONIQUE (logique PHP) ===
  const canonicalLink = `https://domain.com/constructeurs/${vehicleData.marque_alias}-${vehicleData.marque_id}/${vehicleData.modele_alias}-${vehicleData.modele_id}/${vehicleData.type_alias}-${vehicleData.type_id}.html`;

  // === GÉNÉRATION DES CATALOGUES (logique PHP adaptée avec vraies données FILTRÉES) ===
  let catalogFamilies: CatalogFamily[] = [];
  
  try {
    // � NOUVEAU: Récupération des familles FILTRÉES par véhicule (CGC_LEVEL=3)
    console.log(`� Récupération des familles FILTRÉES pour type_id: ${type_id}...`);
    const vehicleFilteredFamilies = await catalogFamiliesApi.getCatalogFamiliesForVehicle(type_id);
    
    if (vehicleFilteredFamilies.length > 0) {
      // Conversion vers le format attendu par le frontend
      catalogFamilies = vehicleFilteredFamilies.map((family: ApiCatalogFamily) => ({
        mf_id: family.mf_id,
        mf_name: family.mf_name,
        mf_description: family.mf_description || `Système ${family.mf_name.toLowerCase()}`,
        mf_pic: family.mf_pic || `${family.mf_name.toLowerCase()}.webp`,
        gammes: family.gammes.map(gamme => ({
          pg_id: gamme.pg_id,
          pg_alias: gamme.pg_alias,
          pg_name: gamme.pg_name
        }))
      }));
      
      console.log(`✅ ${catalogFamilies.length} familles FILTRÉES récupérées pour le véhicule`);
    } else {
      console.log('⚠️ Aucune famille filtrée, fallback vers catalogue générique...');
      
      // 🔄 Fallback: Si pas de pièces spécifiques, utiliser le catalogue générique
      const genericFamilies = await catalogFamiliesApi.getCatalogFamilies();
      catalogFamilies = genericFamilies.map((family: ApiCatalogFamily) => ({
        mf_id: family.mf_id,
        mf_name: family.mf_name,
        mf_description: family.mf_description || `Système ${family.mf_name.toLowerCase()}`,
        mf_pic: family.mf_pic || `${family.mf_name.toLowerCase()}.webp`,
        gammes: family.gammes.map(gamme => ({
          pg_id: gamme.pg_id,
          pg_alias: gamme.pg_alias,
          pg_name: gamme.pg_name
        }))
      }));
      
      console.log(`🔄 Fallback: ${catalogFamilies.length} familles génériques récupérées`);
    }
    
  } catch (error) {
    console.error('❌ Erreur récupération catalogue filtré, fallback vers données simulées:', error);
    
    // Fallback vers les données simulées en cas d'erreur totale
    catalogFamilies = [
      {
        mf_id: 1,
        mf_name: "Freinage",
        mf_description: "Système de freinage",
        mf_pic: "freinage.webp",
        gammes: [
          { pg_id: 101, pg_alias: "disques-frein", pg_name: "Disques de frein" },
          { pg_id: 102, pg_alias: "plaquettes-frein", pg_name: "Plaquettes de frein" },
          { pg_id: 103, pg_alias: "tambours-frein", pg_name: "Tambours de frein" }
        ]
      },
      {
        mf_id: 2,
        mf_name: "Moteur",
        mf_description: "Pièces moteur",
        mf_pic: "moteur.webp",
        gammes: [
          { pg_id: 201, pg_alias: "filtres-huile", pg_name: "Filtres à huile" },
          { pg_id: 202, pg_alias: "courroies", pg_name: "Courroies" },
          { pg_id: 203, pg_alias: "bougies", pg_name: "Bougies d'allumage" }
        ]
      },
      {
        mf_id: 3,
        mf_name: "Suspension",
        mf_description: "Système de suspension", 
        mf_pic: "suspension.webp",
        gammes: [
          { pg_id: 301, pg_alias: "amortisseurs", pg_name: "Amortisseurs" },
          { pg_id: 302, pg_alias: "ressorts", pg_name: "Ressorts" }
        ]
      }
    ];
    
    console.log(`🔄 Fallback final: ${catalogFamilies.length} familles simulées`);
  }

  // Simulation des pièces populaires (basé sur la requête PHP cross_gamme_car avec vraies données)
  const generateSeoContent = (pgName: string, vehicleData: VehicleData, typeId: number): string => {
    const switches = ["Achetez", "Trouvez", "Commandez", "Choisissez"];
    const qualities = ["d'origine", "de qualité", "certifiées", "garanties"];
    const switchIndex = typeId % switches.length;
    const qualityIndex = (typeId + 1) % qualities.length;
    
    return `${switches[switchIndex]} ${pgName} ${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta}, ${qualities[qualityIndex]} à prix bas.`;
  };

  // Générer les pièces populaires depuis les vraies familles
  let popularParts: PopularPart[] = [];
  
  try {
    const vehicleName = `${vehicleData.marque_name_meta} ${vehicleData.modele_name_meta} ${vehicleData.type_name_meta}`;
    popularParts = catalogFamiliesApi.generatePopularParts(catalogFamilies, vehicleName, type_id);
    console.log(`✅ ${popularParts.length} pièces populaires générées depuis les vraies données`);
  } catch (error) {
    console.error('❌ Erreur génération pièces populaires, fallback:', error);
    
    // Fallback manuel
    popularParts = [
      {
        cgc_pg_id: 101,
        pg_alias: "disques-frein",
        pg_name: "Disques de frein",
        pg_name_meta: "disques de frein",
        pg_img: "disques-frein.webp",
        addon_content: generateSeoContent("disques de frein", vehicleData, type_id)
      },
      {
        cgc_pg_id: 201,
        pg_alias: "filtres-huile",
        pg_name: "Filtres à huile",
        pg_name_meta: "filtres à huile",
        pg_img: "filtres-huile.webp",
        addon_content: generateSeoContent("filtres à huile", vehicleData, type_id + 1)
      },
      {
        cgc_pg_id: 301,
        pg_alias: "amortisseurs",
        pg_name: "Amortisseurs",
        pg_name_meta: "amortisseurs",
        pg_img: "amortisseurs.webp",
        addon_content: generateSeoContent("amortisseurs", vehicleData, type_id + 2)
      }
    ];
  }

  // === CONSTRUCTION DES DONNÉES FINALES ===
  const loaderData: LoaderData = {
    vehicle: vehicleData,
    catalogFamilies,
    popularParts,
    seo: {
      title: seoTitle,
      description: seoDescription,
      keywords: seoKeywords,
      h1,
      content,
      content2,
      robots: pageRobots,
      canonical: canonicalLink
    },
    breadcrumb: {
      brand: vehicleData.marque_name,
      model: vehicleData.modele_name,
      type: vehicleData.type_name
    }
  };

  console.log('✅ Données générées avec succès:', {
    vehicleData: vehicleData.marque_name + ' ' + vehicleData.modele_name,
    catalogFamiliesCount: catalogFamilies.length,
    popularPartsCount: popularParts.length
  });

  console.log('🚨🚨🚨 ABOUT TO RETURN JSON DATA 🚨🚨🚨');
  console.log('🔍 Loader result keys:', Object.keys(loaderData));
  console.log('🔍 Loader result vehicle:', loaderData.vehicle.marque_name);
  
  return json(loaderData);
}

// 🎯 Meta function avec SEO optimisé (logique PHP)
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  if (!data) {
    return [
      { title: "Page non trouvée" },
      { name: "robots", content: "noindex, nofollow" }
    ];
  }

  return [
    { title: data.seo.title },
    { name: "description", content: data.seo.description },
    { name: "keywords", content: data.seo.keywords },
    { name: "robots", content: data.seo.robots },
    { name: "canonical", href: data.seo.canonical },
    { property: "og:title", content: data.seo.title },
    { property: "og:description", content: data.seo.description },
    { property: "og:type", content: "website" }
  ];
};

// 🎨 Composant principal avec logique PHP intégrée
export default function VehicleDetailPage() {
  const data = useLoaderData<LoaderData>();
  const { vehicle, catalogFamilies, popularParts, seo, breadcrumb } = data;

  console.log('🚗 Page véhicule rendue avec logique PHP:', {
    vehicle: vehicle.marque_name + ' ' + vehicle.modele_name + ' ' + vehicle.type_name,
    families: catalogFamilies.length,
    popular: popularParts.length,
    seoTitle: seo.title
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec informations véhicule (structure PHP) */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            
            {/* Informations véhicule */}
            <div className="flex-1">
              <nav className="text-blue-200 text-sm mb-4">
                <span>Constructeur</span> → 
                <span className="mx-1">{breadcrumb.brand}</span> → 
                <span className="mx-1">{breadcrumb.model}</span> → 
                <span className="text-white">{breadcrumb.type}</span>
              </nav>
              
              <h1 className="text-3xl font-bold mb-2" dangerouslySetInnerHTML={{ __html: seo.h1 }} />
              
              <div className="flex flex-wrap gap-4 text-blue-100">
                <span>🏭 {vehicle.marque_name}</span>
                <span>🚗 {vehicle.modele_name}</span>
                <span>⚡ {vehicle.type_power_ps} ch</span>
                <span>⛽ {vehicle.type_fuel}</span>
                <span>📅 {vehicle.type_month_from}/{vehicle.type_year_from}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Description SEO (logique PHP avec switches) */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="prose max-w-none">
            <p dangerouslySetInnerHTML={{ __html: seo.content }} />
            <p dangerouslySetInnerHTML={{ __html: seo.content2 }} />
          </div>
        </div>

        {/* Catalogue par familles (query catalog_family du PHP) */}
        {catalogFamilies.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Catalogue {seo.h1}</h2>
              <div className="flex-1 h-px bg-gray-300 ml-4"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalogFamilies.map((family) => (
                <div key={family.mf_id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="text-center mb-4">
                    <img 
                      src={`/upload/articles/familles-produits/${family.mf_pic}`}
                      alt={family.mf_name}
                      className="w-32 h-24 mx-auto object-cover rounded mb-3"
                      loading="lazy"
                    />
                    <h3 className="text-lg font-semibold text-gray-900">{family.mf_name}</h3>
                  </div>
                  
                  <div className="space-y-2">
                    {family.gammes.map((gamme) => (
                      <a 
                        key={gamme.pg_id}
                        href={`/pieces/${gamme.pg_alias}-${gamme.pg_id}/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`}
                        className="block text-blue-600 hover:text-blue-800 hover:underline text-sm"
                      >
                        {gamme.pg_name}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pièces populaires (query cross_gamme_car du PHP) */}
        {popularParts.length > 0 && (
          <div className="bg-gray-100 rounded-lg p-8">
            <div className="flex items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                CATALOGUE PIÈCES AUTO {vehicle.marque_name} LES PLUS vendus
              </h2>
              <div className="flex-1 h-px bg-gray-300 ml-4"></div>
            </div>
            
            {/* Carousel de pièces populaires (comme en PHP avec MultiCarousel) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {popularParts.map((part) => (
                <div key={part.cgc_pg_id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                  <div className="text-center mb-4">
                    <img 
                      src={`/upload/articles/gammes-produits/catalogue/${part.pg_img}`}
                      alt={part.pg_name_meta}
                      className="w-32 h-24 mx-auto object-cover rounded mb-3"
                      loading="lazy"
                    />
                    <h3 className="font-semibold text-gray-900">
                      {part.pg_name} pour {vehicle.marque_name} {vehicle.modele_name} {vehicle.type_name}
                    </h3>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <p dangerouslySetInnerHTML={{ __html: part.addon_content }} />
                  </div>
                  
                  <a 
                    href={`/pieces/${part.pg_alias}-${part.cgc_pg_id}/${vehicle.marque_alias}-${vehicle.marque_id}/${vehicle.modele_alias}-${vehicle.modele_id}/${vehicle.type_alias}-${vehicle.type_id}.html`}
                    className="mt-4 block bg-blue-600 text-white text-center py-2 rounded hover:bg-blue-700 transition-colors"
                  >
                    Voir les pièces
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer avec liens utiles */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Navigation</h4>
              <ul className="space-y-1 text-sm">
                <li><a href="/constructeurs" className="hover:text-blue-300">Tous les constructeurs</a></li>
                <li><a href={`/constructeurs/${vehicle.marque_alias}-${vehicle.marque_id}.html`} className="hover:text-blue-300">Modèles {vehicle.marque_name}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Informations véhicule</h4>
              <ul className="space-y-1 text-sm">
                <li>Marque: {vehicle.marque_name}</li>
                <li>Modèle: {vehicle.modele_name}</li>
                <li>Motorisation: {vehicle.type_name}</li>
                <li>Puissance: {vehicle.type_power_ps} ch</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Assistance</h4>
              <ul className="space-y-1 text-sm">
                <li><a href="/contact" className="hover:text-blue-300">Contact</a></li>
                <li><a href="/aide" className="hover:text-blue-300">Aide</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}