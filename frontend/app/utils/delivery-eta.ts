/**
 * 📦 CALCUL ETA LIVRAISON DYNAMIQUE
 * 
 * Calcule la date estimée de livraison en fonction:
 * - Du statut stock (en stock, stock limité, sur commande)
 * - Du mode de livraison (standard, express, retrait)
 * - Des jours ouvrés (excluant week-ends)
 */

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock';
export type DeliveryMode = 'standard' | 'express' | 'pickup';

interface ETACalculation {
  estimatedDate: Date;
  estimatedDays: number;
  formattedDate: string;
  formattedRange: string;
}

/**
 * Calcule le nombre de jours de délai selon le stock
 */
function getStockDelay(stockStatus: StockStatus): number {
  switch (stockStatus) {
    case 'in-stock':
      return 0; // Disponible immédiatement
    case 'low-stock':
      return 1; // 1 jour de préparation supplémentaire
    case 'out-of-stock':
      return 7; // 7 jours délai fournisseur
    default:
      return 2;
  }
}

/**
 * Calcule le nombre de jours de transport selon le mode
 */
function getDeliveryDelay(mode: DeliveryMode): number {
  switch (mode) {
    case 'express':
      return 1; // 1 jour
    case 'standard':
      return 3; // 3 jours
    case 'pickup':
      return 0; // Immédiat
    default:
      return 3;
  }
}

/**
 * Ajoute des jours ouvrés à une date (exclut samedi/dimanche)
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    
    // Ignorer les week-ends (0 = dimanche, 6 = samedi)
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Formate une date en français
 */
function formatDateFR(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

/**
 * Calcule l'ETA de livraison pour un panier
 */
export function calculateDeliveryETA(
  stockStatuses: StockStatus[],
  deliveryMode: DeliveryMode = 'standard'
): ETACalculation {
  // Trouver le pire stock (le plus long délai)
  const maxStockDelay = Math.max(...stockStatuses.map(getStockDelay));
  
  // Délai de transport
  const transportDelay = getDeliveryDelay(deliveryMode);
  
  // Délai total en jours ouvrés
  const totalDays = maxStockDelay + transportDelay;
  
  // Date de départ: aujourd'hui
  const today = new Date();
  
  // Date estimée (jours ouvrés)
  const estimatedDate = addBusinessDays(today, totalDays);
  
  // Date max (marge de sécurité +2 jours)
  const maxDate = addBusinessDays(estimatedDate, 2);
  
  return {
    estimatedDate,
    estimatedDays: totalDays,
    formattedDate: formatDateFR(estimatedDate),
    formattedRange: `${formatDateFR(estimatedDate)} - ${formatDateFR(maxDate)}`,
  };
}

/**
 * Formate un délai en texte lisible
 */
export function formatDeliveryText(days: number, mode: DeliveryMode): string {
  if (mode === 'pickup') {
    return 'Disponible immédiatement';
  }

  if (days === 0) {
    return "Aujourd'hui";
  }

  if (days === 1) {
    return 'Demain';
  }

  if (days <= 3) {
    return `Dans ${days} jours`;
  }

  return `Dans ${days} jours ouvrés`;
}
