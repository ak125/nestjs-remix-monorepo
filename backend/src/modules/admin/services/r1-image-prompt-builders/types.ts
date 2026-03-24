/**
 * Types partagés entre les 5 builders R1 image prompt.
 *
 * Charte visuelle OEM premium — cohérente entre toutes les gammes.
 */

// RagData centralisé — source unique dans rag-data.types.ts
import { type RagData } from '../rag-data.types';
export { type RagData } from '../rag-data.types';

export interface BuilderResult {
  prompt: string;
  neg: string;
  alt: string;
  caption: string | null;
  ragFieldsUsed: string[];
  richnessScore: number;
}

export type SlotBuilder = (
  pgName: string,
  rag: RagData | null,
) => BuilderResult;

// ── Negative prompts par intention visuelle ──

export const NEG_PHOTO =
  'cartoon, illustration, clipart, sketch, diagram, infographic, low quality, watermark, blurry, text overlay, human hands holding part, visible logo, brand name text, 3D render, CGI, anime, painting, collage, multiple unrelated objects';

export const NEG_SCHEMA =
  'photograph, photo, photorealistic, product catalog shot, studio lighting, depth of field, bokeh, cartoon, low quality, watermark, blurry, human hands, visible logo, brand name text, anime, painting';

export const NEG_SOCIAL =
  'cartoon, clipart, sketch, low quality, watermark, blurry, text overlay, brand name text, cluttered background, multiple products, collage, anime';

// ── Ambiance visuelle par famille de pièce ──

export interface FamilyAmbiance {
  /** Fond / environnement contextuel */
  background: string;
  /** Éclairage adapté */
  lighting: string;
  /** Détails techniques à montrer */
  technicalDetails: string;
  /** Intention émotionnelle */
  intention: string;
  /** Couleur dominante secondaire */
  accentTone: string;
}

const FAMILY_AMBIANCE: Record<string, FamilyAmbiance> = {
  filtration: {
    background:
      'surface métallique brossée avec reflet subtil de fluide doré (huile)',
    lighting:
      'éclairage studio chaud latéral, température 4500K, reflets dorés sur le métal',
    technicalDetails:
      'média filtrant visible, joint torique, filetage ou boîtier',
    intention: 'pureté, protection moteur, précision industrielle',
    accentTone: 'doré ambré',
  },
  freinage: {
    background:
      'surface métallique anthracite avec micro-particules de poussière de frein',
    lighting:
      'éclairage studio froid contrasté, température 5500K, ombres marquées',
    technicalDetails:
      'surface de friction, rainures, points de fixation, épaisseur',
    intention: 'sécurité, fiabilité, performance de freinage',
    accentTone: 'gris acier froid',
  },
  suspension: {
    background: 'fond gris neutre technique avec ligne de sol suggérée',
    lighting: 'éclairage studio neutre enveloppant, température 5000K',
    technicalDetails: 'ressort, tige, silent-bloc, points de montage',
    intention: 'stabilité, confort, tenue de route',
    accentTone: 'bleu acier',
  },
  electrique: {
    background:
      'fond sombre avec lueur bleue subtile suggérant le circuit électrique',
    lighting: 'éclairage studio froid avec accent bleu, température 6000K',
    technicalDetails: 'connecteurs, bobinage, bornes, ventilation',
    intention: 'fiabilité électrique, puissance, technologie',
    accentTone: 'bleu électrique',
  },
  allumage: {
    background: 'fond sombre avec micro-étincelle orange suggérée',
    lighting: 'éclairage dramatique chaud-froid, contraste fort',
    technicalDetails: 'électrode, isolant céramique, culot fileté',
    intention: 'performance moteur, combustion, précision',
    accentTone: 'orange cuivre',
  },
  direction: {
    background: 'fond gris neutre technique',
    lighting: 'éclairage studio neutre, température 5000K',
    technicalDetails: 'biellette, rotule, soufflet, pas de vis',
    intention: 'précision, contrôle, sécurité de direction',
    accentTone: 'gris neutre',
  },
  embrayage: {
    background: 'fond anthracite avec reflet métallique',
    lighting: 'éclairage studio neutre-chaud, température 4800K',
    technicalDetails: 'disque de friction, mécanisme, butée',
    intention: 'transmission de puissance, progressivité, endurance',
    accentTone: 'bronze',
  },
  refroidissement: {
    background: 'fond bleu-gris froid avec suggestion de flux de liquide',
    lighting: 'éclairage froid bleuté, température 6500K',
    technicalDetails: 'ailettes, raccords, joints, tubulures',
    intention: 'régulation thermique, circulation, protection',
    accentTone: 'bleu glacier',
  },
  distribution: {
    background:
      'fond sombre technique avec suggestion de mécanisme en mouvement',
    lighting: 'éclairage contrasté latéral, température 5000K',
    technicalDetails: 'dents, tension, galets, marquages de calage',
    intention: 'synchronisation, précision, fiabilité moteur',
    accentTone: 'noir technique',
  },
  echappement: {
    background: 'fond gris chaud avec suggestion de chaleur et vapeur',
    lighting: 'éclairage chaud latéral, température 4000K',
    technicalDetails: 'catalyseur, soudures, brides, isolant thermique',
    intention: 'évacuation, normes antipollution, résistance thermique',
    accentTone: 'gris chaud',
  },
  climatisation: {
    background: 'fond bleu givré subtil',
    lighting: 'éclairage froid et net, température 6500K',
    technicalDetails: 'raccords, ailettes, compresseur, joints',
    intention: 'confort thermique, pression, étanchéité',
    accentTone: 'bleu givré',
  },
  capteurs: {
    background: 'fond sombre avec micro-lueur LED verte',
    lighting: 'éclairage technique précis, température 5500K',
    technicalDetails: 'connecteur, sonde, câblage, boîtier étanche',
    intention: 'précision de mesure, technologie embarquée',
    accentTone: 'vert technique',
  },
  transmission: {
    background: 'fond anthracite métallique',
    lighting: 'éclairage neutre-froid, température 5200K',
    technicalDetails: 'cannelures, joints, soufflets, roulements',
    intention: 'transfert de puissance, robustesse',
    accentTone: 'gris métallique',
  },
  eclairage: {
    background: 'fond sombre avec halo lumineux chaud',
    lighting: 'éclairage dramatique avec halo visible, température mixte',
    technicalDetails: 'ampoule, réflecteur, connecteur, lentille',
    intention: 'visibilité, sécurité routière, technologie LED',
    accentTone: 'blanc chaud',
  },
  turbo: {
    background: "fond sombre avec suggestion de flux d'air et chaleur",
    lighting: 'éclairage dramatique chaud-froid, contraste fort',
    technicalDetails: 'turbine, compresseur, carter, wastegate',
    intention: 'puissance, performance, ingénierie de pointe',
    accentTone: 'rouge titane',
  },
};

/** Fallback ambiance pour les familles non mappées */
const DEFAULT_AMBIANCE: FamilyAmbiance = {
  background: 'fond gris neutre technique légèrement texturé',
  lighting: 'éclairage studio professionnel neutre, température 5000K',
  technicalDetails: 'points de fixation, connecteurs, surfaces fonctionnelles',
  intention: 'qualité OEM, précision industrielle, fiabilité',
  accentTone: 'gris neutre',
};

/**
 * Résout l'ambiance visuelle pour une gamme à partir du RAG.
 * Cherche : completeness_profile → category → fallback default.
 */
export function resolveAmbiance(rag: RagData | null): FamilyAmbiance {
  const profile = rag?.completeness_profile;
  if (profile && FAMILY_AMBIANCE[profile]) return FAMILY_AMBIANCE[profile];

  const cat = rag?.category?.toLowerCase();
  if (cat) {
    // Mapping category → famille
    if (cat.includes('filtr')) return FAMILY_AMBIANCE['filtration'];
    if (cat.includes('frein')) return FAMILY_AMBIANCE['freinage'];
    if (cat.includes('suspen') || cat.includes('amortis'))
      return FAMILY_AMBIANCE['suspension'];
    if (cat.includes('allum') || cat.includes('bougie'))
      return FAMILY_AMBIANCE['allumage'];
    if (
      cat.includes('altern') ||
      cat.includes('démarr') ||
      cat.includes('batter')
    )
      return FAMILY_AMBIANCE['electrique'];
    if (cat.includes('embray')) return FAMILY_AMBIANCE['embrayage'];
    if (cat.includes('refroid') || cat.includes('radiat'))
      return FAMILY_AMBIANCE['refroidissement'];
    if (cat.includes('distrib') || cat.includes('courr'))
      return FAMILY_AMBIANCE['distribution'];
    if (cat.includes('echappe') || cat.includes('cataly'))
      return FAMILY_AMBIANCE['echappement'];
    if (cat.includes('clim') || cat.includes('compress'))
      return FAMILY_AMBIANCE['climatisation'];
    if (cat.includes('capteur') || cat.includes('sonde'))
      return FAMILY_AMBIANCE['capteurs'];
    if (cat.includes('direct') || cat.includes('biell'))
      return FAMILY_AMBIANCE['direction'];
    if (cat.includes('cardan') || cat.includes('transm'))
      return FAMILY_AMBIANCE['transmission'];
    if (cat.includes('eclair') || cat.includes('phare') || cat.includes('feu'))
      return FAMILY_AMBIANCE['eclairage'];
    if (cat.includes('turbo')) return FAMILY_AMBIANCE['turbo'];
  }

  return DEFAULT_AMBIANCE;
}
