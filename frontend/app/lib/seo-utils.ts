/**
 * Utilitaires SEO pour e-commerce automobile
 * Gère la pluralisation des noms de pièces pour les titres H2
 */

/**
 * Convertit un nom de pièce au pluriel pour SEO e-commerce auto
 * @param name - Nom de la pièce au singulier (ex: "plaquette de frein")
 * @returns Le nom au pluriel (ex: "plaquettes de frein")
 * @example pluralizePieceName("plaquette de frein") // "plaquettes de frein"
 */
export function pluralizePieceName(name: string): string {
  const lower = name.toLowerCase().trim();

  // Dictionnaire des pluriels pour les gammes auto
  const pluralMap: Record<string, string> = {
    // Freinage (16 gammes)
    'plaquette de frein': 'plaquettes de frein',
    'disque de frein': 'disques de frein',
    'étrier de frein': 'étriers de frein',
    "témoin d'usure": "témoins d'usure",
    'mâchoire de frein': 'mâchoires de frein',
    'cylindre de roue': 'cylindres de roue',
    'flexible de frein': 'flexibles de frein',
    'câble de frein à main': 'câbles de frein à main',
    'tambour de frein': 'tambours de frein',
    'maître-cylindre': 'maîtres-cylindres',
    'servo-frein': 'servo-freins',
    'agrégat abs': 'agrégats ABS',
    'vis de disque': 'vis de disque', // invariable
    'répartiteur de freinage': 'répartiteurs de freinage',
    'pompe à vide': 'pompes à vide',
    'kit freins arrière': 'kits freins arrière',
    // Distribution
    'kit de distribution': 'kits de distribution',
    'courroie de distribution': 'courroies de distribution',
    'galet tendeur': 'galets tendeurs',
    'pompe à eau': 'pompes à eau',
    // Moteur
    'filtre à huile': 'filtres à huile',
    'filtre à air': 'filtres à air',
    "bougie d'allumage": "bougies d'allumage",
    'alternateur': 'alternateurs',
    'démarreur': 'démarreurs',
    // Embrayage
    'kit embrayage': 'kits embrayage',
    'volant moteur': 'volants moteur',
    // Direction/Suspension
    'amortisseur': 'amortisseurs',
    'rotule de direction': 'rotules de direction',
    'biellette de direction': 'biellettes de direction',
  };

  // Chercher correspondance exacte
  if (pluralMap[lower]) {
    return pluralMap[lower];
  }

  // Fallback: ajouter 's' si pas déjà pluriel
  if (!lower.endsWith('s') && !lower.endsWith('x')) {
    return name + 's';
  }

  return name;
}
