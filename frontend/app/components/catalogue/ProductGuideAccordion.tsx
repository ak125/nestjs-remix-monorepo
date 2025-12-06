// 🎯 ProductGuideAccordion - Guide d'achat interactif réutilisable
// Utilise Design Tokens + shadcn/ui Accordion pour cohérence

import { CheckCircle2, Shield } from 'lucide-react';
import { AccordionTrigger } from '../ui/accordion';

export interface GuideSection {
  id: string;
  title: string;
  icon?: '✅' | '🏆' | '🛡️' | '💡' | '⚠️';
  iconColor?: string;
  items: Array<{
    icon?: React.ReactNode;
    text: string;
  }>;
}

export interface ProductGuideAccordionProps {
  // 📋 Contenu
  title?: string;
  productName?: string; // Ex: "plaquettes de frein"
  sections: GuideSection[];
  
  // 🔗 CTA optionnel
  ctaText?: string;
  ctaHref?: string;
  
  // 🎨 Style et thème adapté à la gamme
  className?: string;
  colorTheme?: 'braking' | 'suspension' | 'lighting' | 'engine' | 'transmission' | 'default';
  familleColor?: string; // Gradient Tailwind existant ex: "from-red-600 to-rose-700"
}

/**
 * 🎨 Convertit un gradient de famille existant en thème de guide
 * Extrait les couleurs principales pour créer un thème cohérent
 */
function familleColorToTheme(familleColor?: string): 'braking' | 'suspension' | 'lighting' | 'engine' | 'transmission' | 'default' {
  if (!familleColor) return 'default';
  
  // Détection par mots-clés de couleur dans le gradient
  if (familleColor.includes('red') || familleColor.includes('rose') || familleColor.includes('orange-6')) {
    return 'braking'; // Rouge/Orange = Freinage
  }
  if (familleColor.includes('slate') || familleColor.includes('gray') || familleColor.includes('neutral')) {
    return 'suspension'; // Gris = Suspension/Mécanique
  }
  if (familleColor.includes('yellow') || familleColor.includes('amber-6')) {
    return 'lighting'; // Jaune/Ambre = Éclairage/Électrique
  }
  if (familleColor.includes('emerald') || familleColor.includes('green') || familleColor.includes('lime')) {
    return 'engine'; // Vert = Moteur/Alimentation
  }
  if (familleColor.includes('cyan') || familleColor.includes('sky') || familleColor.includes('teal')) {
    return 'transmission'; // Cyan/Bleu clair = Transmission/Refroidissement
  }
  
  return 'default'; // Bleu/Indigo/Violet par défaut
}

/**
 * 🎯 Génère automatiquement des sections de guide adaptées à la famille de produit
 * Basé sur le nom de la famille ou son ID
 */
export function generateGuideSectionsByFamily(
  familleName?: string,
  familleId?: string
): GuideSection[] {
  const name = familleName?.toLowerCase() || '';
  
  // === FREINAGE ===
  if (name.includes('frein') || name.includes('brake') || familleId === '2') {
    return [
      {
        id: 'compatibility',
        title: 'Vérifiez la compatibilité',
        items: [
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Utilisez notre sélecteur pour garantir la compatibilité',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: "Vérifiez votre type mine sur la carte grise",
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Toutes nos pièces sont certifiées R90',
          },
        ],
      },
      {
        id: 'quality-tiers',
        title: 'Choisissez votre gamme',
        items: [
          {
            icon: <span className="text-lg">🥉</span>,
            text: 'Économique - Usage urbain modéré',
          },
          {
            icon: <span className="text-lg">🥈</span>,
            text: 'Qualité+ - Usage mixte recommandé',
          },
          {
            icon: <span className="text-lg">🥇</span>,
            text: 'Premium - Performances maximales',
          },
        ],
      },
      {
        id: 'safety',
        title: 'Sécurité essentielle',
        items: [
          {
            icon: <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />,
            text: 'Changez toujours les deux côtés (avant ou arrière)',
          },
          {
            icon: <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />,
            text: "Remplacez si moins de 3mm d'épaisseur",
          },
          {
            icon: <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />,
            text: "Contrôle tous les 20 000 km recommandé",
          },
        ],
      },
    ];
  }
  
  // === SUSPENSION / AMORTISSEURS ===
  if (name.includes('amorti') || name.includes('suspension') || familleId === '6') {
    return [
      {
        id: 'compatibility',
        title: 'Vérifiez votre véhicule',
        items: [
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Identifiez votre modèle exact et motorisation',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: "Vérifiez l'année de mise en circulation",
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Kit complet recommandé pour un meilleur équilibre',
          },
        ],
      },
      {
        id: 'quality-tiers',
        title: 'Type de conduite',
        items: [
          {
            icon: <span className="text-lg">🚗</span>,
            text: 'Standard - Confort optimal pour usage quotidien',
          },
          {
            icon: <span className="text-lg">🏎️</span>,
            text: 'Sport - Tenue de route renforcée',
          },
          {
            icon: <span className="text-lg">🏁</span>,
            text: 'Performance - Contrôle maximal en conduite sportive',
          },
        ],
      },
      {
        id: 'maintenance',
        title: 'Signes d\'usure',
        items: [
          {
            icon: <Shield className="w-4 h-4 text-orange-500 flex-shrink-0" />,
            text: 'Fuite d\'huile sur l\'amortisseur',
          },
          {
            icon: <Shield className="w-4 h-4 text-orange-500 flex-shrink-0" />,
            text: 'Usure irrégulière des pneumatiques',
          },
          {
            icon: <Shield className="w-4 h-4 text-orange-500 flex-shrink-0" />,
            text: 'Remplacement recommandé tous les 80 000 km',
          },
        ],
      },
    ];
  }
  
  // === ÉCLAIRAGE ===
  if (name.includes('éclair') || name.includes('ampoule') || name.includes('phare') || familleId === '7') {
    return [
      {
        id: 'compatibility',
        title: 'Type de culot',
        items: [
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Vérifiez le type de culot (H1, H4, H7, etc.)',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Consultez le manuel de votre véhicule',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Changez les deux ampoules simultanément',
          },
        ],
      },
      {
        id: 'technology',
        title: 'Technologies disponibles',
        items: [
          {
            icon: <span className="text-lg">💡</span>,
            text: 'Halogène - Standard, économique',
          },
          {
            icon: <span className="text-lg">⚡</span>,
            text: 'Xénon - Luminosité supérieure',
          },
          {
            icon: <span className="text-lg">✨</span>,
            text: 'LED - Performance et durabilité maximales',
          },
        ],
      },
      {
        id: 'safety',
        title: 'Réglementation',
        items: [
          {
            icon: <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />,
            text: 'Ampoules homologuées CE obligatoires',
          },
          {
            icon: <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />,
            text: 'Réglage des phares après installation',
          },
          {
            icon: <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />,
            text: 'Contrôle technique : éclairage fonctionnel requis',
          },
        ],
      },
    ];
  }
  
  // === FILTRATION ===
  if (name.includes('filtre') || familleId === '1') {
    return [
      {
        id: 'compatibility',
        title: 'Type de filtre',
        items: [
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Filtre à air, à huile, à carburant ou habitacle',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Vérifiez les dimensions et références',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Compatible avec votre motorisation',
          },
        ],
      },
      {
        id: 'quality-tiers',
        title: 'Niveau de filtration',
        items: [
          {
            icon: <span className="text-lg">🔵</span>,
            text: 'Standard - Filtration efficace',
          },
          {
            icon: <span className="text-lg">🟢</span>,
            text: 'Premium - Meilleure protection moteur',
          },
          {
            icon: <span className="text-lg">⚫</span>,
            text: 'Carbone actif - Filtre habitacle anti-allergènes',
          },
        ],
      },
      {
        id: 'maintenance',
        title: 'Fréquence de remplacement',
        items: [
          {
            icon: <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />,
            text: 'Filtre à air : tous les 20 000 km',
          },
          {
            icon: <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />,
            text: 'Filtre à huile : à chaque vidange',
          },
          {
            icon: <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />,
            text: 'Filtre habitacle : tous les ans',
          },
        ],
      },
    ];
  }
  
  // === MOTEUR / DISTRIBUTION ===
  if (name.includes('moteur') || name.includes('distribution') || name.includes('courroie') || familleId === '10' || familleId === '3') {
    return [
      {
        id: 'compatibility',
        title: 'Vérifications critiques',
        items: [
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Type de moteur (essence, diesel, hybride)',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Puissance exacte en chevaux ou kW',
          },
          {
            icon: <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />,
            text: 'Kit complet recommandé pour la distribution',
          },
        ],
      },
      {
        id: 'quality-tiers',
        title: 'Qualité des pièces',
        items: [
          {
            icon: <span className="text-lg">🔧</span>,
            text: 'OE Quality - Équivalent origine constructeur',
          },
          {
            icon: <span className="text-lg">⚙️</span>,
            text: 'Premium - Durabilité renforcée',
          },
          {
            icon: <span className="text-lg">🏆</span>,
            text: 'Performance - Optimisation moteur',
          },
        ],
      },
      {
        id: 'maintenance',
        title: 'Entretien préventif',
        items: [
          {
            icon: <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />,
            text: 'Courroie de distribution : tous les 5 ans ou 100 000 km',
          },
          {
            icon: <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />,
            text: 'Respectez les préconisations constructeur',
          },
          {
            icon: <Shield className="w-4 h-4 text-red-500 flex-shrink-0" />,
            text: 'Rupture = casse moteur, ne pas négliger',
          },
        ],
      },
    ];
  }
  
    // === GUIDE GÉNÉRIQUE PAR DÉFAUT ===
  return generateGenericGuideSections('cette pièce');
}

/**
 * @deprecated Utiliser generateGuideSectionsByFamily à la place
 */
export function generateBrakingGuideSections(): GuideSection[] {
  return generateGuideSectionsByFamily('Freinage', '2');
}

export function ProductGuideAccordion({
  title,
  productName,
  sections,
  ctaText = "Voir le guide d'achat complet",
  ctaHref = '#guide',
  className = '',
  colorTheme,
  familleColor,
}: ProductGuideAccordionProps) {
  
  const guideTitle = title || `Comment choisir ${productName ? `vos ${productName.toLowerCase()}` : 'vos pièces'} ?`;
  
  // 🎨 Utilise familleColor en priorité, sinon colorTheme, sinon default
  const resolvedTheme = colorTheme || familleColorToTheme(familleColor);
  
  // 🎨 Thèmes de couleurs adaptés à chaque famille de produits
  const themeColors = {
    braking: {
      header: 'from-red-50 via-orange-50/40 to-red-50/30',
      badge: 'from-red-600 to-orange-600',
      steps: [
        { 
          bg: 'hover:bg-gradient-to-br hover:from-red-50/50 hover:to-red-100/40',
          badge: 'from-red-600 to-red-700',
          badgeBg: 'bg-red-500/20',
          iconBg: 'bg-red-50',
          iconText: 'text-red-600',
          iconHover: 'group-hover/item:bg-red-100',
          bar: 'from-red-600 to-red-700',
          line: 'group-hover:via-red-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-orange-50/50 hover:to-orange-100/40',
          badge: 'from-orange-600 to-orange-700',
          badgeBg: 'bg-orange-500/20',
          iconBg: 'bg-orange-50',
          iconText: 'text-orange-600',
          iconHover: 'group-hover/item:bg-orange-100',
          bar: 'from-orange-600 to-orange-700',
          line: 'group-hover:via-orange-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-amber-50/50 hover:to-amber-100/40',
          badge: 'from-amber-600 to-amber-700',
          badgeBg: 'bg-amber-500/20',
          iconBg: 'bg-amber-50',
          iconText: 'text-amber-600',
          iconHover: 'group-hover/item:bg-amber-100',
          bar: 'from-amber-600 to-amber-700',
          line: 'group-hover:via-amber-500/50'
        }
      ]
    },
    suspension: {
      header: 'from-slate-50 via-gray-50/40 to-slate-50/30',
      badge: 'from-slate-600 to-gray-700',
      steps: [
        { 
          bg: 'hover:bg-gradient-to-br hover:from-slate-50/50 hover:to-slate-100/40',
          badge: 'from-slate-600 to-slate-700',
          badgeBg: 'bg-slate-500/20',
          iconBg: 'bg-slate-50',
          iconText: 'text-slate-600',
          iconHover: 'group-hover/item:bg-slate-100',
          bar: 'from-slate-600 to-slate-700',
          line: 'group-hover:via-slate-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-zinc-50/50 hover:to-zinc-100/40',
          badge: 'from-zinc-600 to-zinc-700',
          badgeBg: 'bg-zinc-500/20',
          iconBg: 'bg-zinc-50',
          iconText: 'text-zinc-600',
          iconHover: 'group-hover/item:bg-zinc-100',
          bar: 'from-zinc-600 to-zinc-700',
          line: 'group-hover:via-zinc-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-gray-50/50 hover:to-gray-100/40',
          badge: 'from-gray-600 to-gray-700',
          badgeBg: 'bg-gray-500/20',
          iconBg: 'bg-gray-50',
          iconText: 'text-gray-600',
          iconHover: 'group-hover/item:bg-gray-100',
          bar: 'from-gray-600 to-gray-700',
          line: 'group-hover:via-gray-500/50'
        }
      ]
    },
    lighting: {
      header: 'from-yellow-50 via-amber-50/40 to-yellow-50/30',
      badge: 'from-yellow-600 to-amber-600',
      steps: [
        { 
          bg: 'hover:bg-gradient-to-br hover:from-yellow-50/50 hover:to-yellow-100/40',
          badge: 'from-yellow-600 to-yellow-700',
          badgeBg: 'bg-yellow-500/20',
          iconBg: 'bg-yellow-50',
          iconText: 'text-yellow-600',
          iconHover: 'group-hover/item:bg-yellow-100',
          bar: 'from-yellow-600 to-yellow-700',
          line: 'group-hover:via-yellow-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-amber-50/50 hover:to-amber-100/40',
          badge: 'from-amber-600 to-amber-700',
          badgeBg: 'bg-amber-500/20',
          iconBg: 'bg-amber-50',
          iconText: 'text-amber-600',
          iconHover: 'group-hover/item:bg-amber-100',
          bar: 'from-amber-600 to-amber-700',
          line: 'group-hover:via-amber-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-orange-50/50 hover:to-orange-100/40',
          badge: 'from-orange-600 to-orange-700',
          badgeBg: 'bg-orange-500/20',
          iconBg: 'bg-orange-50',
          iconText: 'text-orange-600',
          iconHover: 'group-hover/item:bg-orange-100',
          bar: 'from-orange-600 to-orange-700',
          line: 'group-hover:via-orange-500/50'
        }
      ]
    },
    engine: {
      header: 'from-emerald-50 via-green-50/40 to-emerald-50/30',
      badge: 'from-emerald-600 to-green-600',
      steps: [
        { 
          bg: 'hover:bg-gradient-to-br hover:from-emerald-50/50 hover:to-emerald-100/40',
          badge: 'from-emerald-600 to-emerald-700',
          badgeBg: 'bg-emerald-500/20',
          iconBg: 'bg-emerald-50',
          iconText: 'text-emerald-600',
          iconHover: 'group-hover/item:bg-emerald-100',
          bar: 'from-emerald-600 to-emerald-700',
          line: 'group-hover:via-emerald-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-green-50/50 hover:to-green-100/40',
          badge: 'from-green-600 to-green-700',
          badgeBg: 'bg-green-500/20',
          iconBg: 'bg-green-50',
          iconText: 'text-green-600',
          iconHover: 'group-hover/item:bg-green-100',
          bar: 'from-green-600 to-green-700',
          line: 'group-hover:via-green-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-teal-50/50 hover:to-teal-100/40',
          badge: 'from-teal-600 to-teal-700',
          badgeBg: 'bg-teal-500/20',
          iconBg: 'bg-teal-50',
          iconText: 'text-teal-600',
          iconHover: 'group-hover/item:bg-teal-100',
          bar: 'from-teal-600 to-teal-700',
          line: 'group-hover:via-teal-500/50'
        }
      ]
    },
    transmission: {
      header: 'from-cyan-50 via-sky-50/40 to-cyan-50/30',
      badge: 'from-cyan-600 to-sky-600',
      steps: [
        { 
          bg: 'hover:bg-gradient-to-br hover:from-cyan-50/50 hover:to-cyan-100/40',
          badge: 'from-cyan-600 to-cyan-700',
          badgeBg: 'bg-cyan-500/20',
          iconBg: 'bg-cyan-50',
          iconText: 'text-cyan-600',
          iconHover: 'group-hover/item:bg-cyan-100',
          bar: 'from-cyan-600 to-cyan-700',
          line: 'group-hover:via-cyan-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-sky-50/50 hover:to-sky-100/40',
          badge: 'from-sky-600 to-sky-700',
          badgeBg: 'bg-sky-500/20',
          iconBg: 'bg-sky-50',
          iconText: 'text-sky-600',
          iconHover: 'group-hover/item:bg-sky-100',
          bar: 'from-sky-600 to-sky-700',
          line: 'group-hover:via-sky-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-blue-100/40',
          badge: 'from-blue-600 to-blue-700',
          badgeBg: 'bg-blue-500/20',
          iconBg: 'bg-blue-50',
          iconText: 'text-blue-600',
          iconHover: 'group-hover/item:bg-blue-100',
          bar: 'from-blue-600 to-blue-700',
          line: 'group-hover:via-blue-500/50'
        }
      ]
    },
    default: {
      header: 'from-slate-50 via-blue-50/40 to-indigo-50/30',
      badge: 'from-blue-600 to-indigo-600',
      steps: [
        { 
          bg: 'hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-blue-100/40',
          badge: 'from-blue-600 to-blue-700',
          badgeBg: 'bg-blue-500/20',
          iconBg: 'bg-blue-50',
          iconText: 'text-blue-600',
          iconHover: 'group-hover/item:bg-blue-100',
          bar: 'from-blue-600 to-blue-700',
          line: 'group-hover:via-blue-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-indigo-50/50 hover:to-indigo-100/40',
          badge: 'from-indigo-600 to-indigo-700',
          badgeBg: 'bg-indigo-500/20',
          iconBg: 'bg-indigo-50',
          iconText: 'text-indigo-600',
          iconHover: 'group-hover/item:bg-indigo-100',
          bar: 'from-indigo-600 to-indigo-700',
          line: 'group-hover:via-indigo-500/50'
        },
        { 
          bg: 'hover:bg-gradient-to-br hover:from-purple-50/50 hover:to-purple-100/40',
          badge: 'from-purple-600 to-purple-700',
          badgeBg: 'bg-purple-500/20',
          iconBg: 'bg-purple-50',
          iconText: 'text-purple-600',
          iconHover: 'group-hover/item:bg-purple-100',
          bar: 'from-purple-600 to-purple-700',
          line: 'group-hover:via-purple-500/50'
        }
      ]
    }
  };
  
  const theme = themeColors[resolvedTheme];
  
  return (
    <section className={`container mx-auto px-4 relative z-10 ${className}`}>
      <div className="max-w-7xl mx-auto">
        {/* Container principal avec fond moderne */}
        <div className="relative bg-white rounded-3xl shadow-2xl border border-neutral-100 overflow-hidden">
          
          {/* Header premium avec badge centré - Couleur adaptée */}
          <div className={`relative bg-gradient-to-br ${theme.header} px-6 py-10 md:px-10 md:py-12 border-b border-neutral-100`}>
            <div className="max-w-3xl mx-auto text-center">
              
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 mb-3 leading-tight">
                {guideTitle}
              </h2>
              
              {/* Badge expert centré sous le titre - Couleur thématique */}
              <div className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${theme.badge} rounded-full shadow-lg mb-3`}>
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-sm font-bold text-white">Guide Expert</span>
              </div>
              
              <p className="text-base md:text-lg text-slate-600 font-medium max-w-2xl mx-auto">
                Suivez nos 3 étapes simples pour choisir vos équipements en toute confiance
              </p>
            </div>
          </div>
          
          {/* Grid 3 colonnes avec couleurs thématiques */}
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-100">
            {sections.map((section, index) => {
              const color = theme.steps[index % theme.steps.length];
              
              return (
                <div
                  key={section.id}
                  className={`group relative p-8 md:p-10 ${color.bg} transition-all duration-500`}
                >
                  {/* Ligne lumineuse colorée au hover */}
                  <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/0 to-transparent ${color.line} transition-all duration-500`} />
                  
                  {/* Numéro premium avec couleur dédiée */}
                  <div className="flex items-center gap-4 mb-7">
                    <div className="relative flex-shrink-0">
                      {/* Cercle lumineux coloré en arrière-plan */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${color.badge} rounded-2xl blur-lg ${color.badgeBg} group-hover:opacity-60 transition-opacity duration-500`} />
                      
                      {/* Badge numéro avec couleur */}
                      <div className={`relative w-14 h-14 rounded-2xl bg-gradient-to-br ${color.badge} text-white flex items-center justify-center font-bold text-2xl shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                        {index + 1}
                      </div>
                    </div>
                    
                    <h3 className="flex-1 font-bold text-xl text-slate-900 leading-tight group-hover:text-slate-700 transition-colors duration-300">
                      {section.title}
                    </h3>
                  </div>
                  
                  {/* Liste premium avec icônes colorées par étape */}
                  <ul className="space-y-5">
                    {section.items.map((item, itemIndex) => (
                      <li 
                        key={itemIndex} 
                        className="flex items-start gap-3.5 text-slate-700 text-sm leading-relaxed group/item"
                        style={{ animationDelay: `${itemIndex * 50}ms` }}
                      >
                        {/* Icône avec fond coloré selon l'étape */}
                        <span className={`flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-lg ${color.iconBg} ${color.iconText} ${color.iconHover} group-hover/item:scale-110 transition-all duration-300`}>
                          {item.icon}
                        </span>
                        <span className="group-hover/item:text-slate-900 group-hover/item:translate-x-0.5 transition-all duration-300 font-medium">
                          {item.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Barre de progression colorée par étape */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${color.bar} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left`} />
                </div>
              );
            })}
          </div>

          {/* Footer premium avec CTA et stats */}
          {ctaText && ctaHref && (
            <div className="relative bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 px-6 py-10 md:px-10 md:py-12 border-t border-neutral-100">
              
              {/* Stats rapides */}
              <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">Conseils vérifiés</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  <span className="font-medium">+10 000 clients satisfaits</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="font-medium">4.8/5 · 2 347 avis</span>
                </div>
              </div>

              {/* CTA principal */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <p className="text-slate-700 font-semibold text-lg text-center sm:text-left">
                  Besoin d'aide pour choisir ?
                </p>
                <a 
                  href={ctaHref} 
                  className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white font-bold text-base rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 group relative overflow-hidden"
                >
                  {/* Effet shimmer amélioré */}
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                  
                  <span className="relative">{ctaText}</span>
                  <svg className="relative w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </section>
  );
}

/**
 * Helper: Génère des sections de guide génériques
 */
export function generateGenericGuideSections(productName: string): GuideSection[] {
  return [
    {
      id: 'compatibility',
      title: 'Vérifiez la compatibilité',
      icon: '✅',
      iconColor: 'bg-green-100 text-green-600',
      items: [
        {
          icon: <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />,
          text: 'Utilisez notre sélecteur pour garantir la compatibilité',
        },
        {
          icon: <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />,
          text: 'Vérifiez les spécifications techniques',
        },
      ],
    },
    {
      id: 'quality',
      title: 'Choisissez la bonne qualité',
      icon: '🏆',
      iconColor: 'bg-blue-100 text-blue-600',
      items: [
        {
          icon: <span className="text-xl">🥉</span>,
          text: 'Gamme Économique - Usage standard',
        },
        {
          icon: <span className="text-xl">🥈</span>,
          text: 'Gamme Qualité+ - Usage intensif',
        },
        {
          icon: <span className="text-xl">🥇</span>,
          text: 'Gamme Premium - Performances optimales',
        },
      ],
    },
  ];
}
