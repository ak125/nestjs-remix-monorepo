/**
 * Formate une date de manière relative (il y a 2 heures, hier, etc.)
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const targetDate = new Date(date);
  const diffInMs = now.getTime() - targetDate.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) {
    return "À l'instant";
  } else if (diffInMinutes < 60) {
    return `Il y a ${diffInMinutes} minute${diffInMinutes > 1 ? "s" : ""}`;
  } else if (diffInHours < 24) {
    return `Il y a ${diffInHours} heure${diffInHours > 1 ? "s" : ""}`;
  } else if (diffInDays === 1) {
    return "Hier";
  } else if (diffInDays < 7) {
    return `Il y a ${diffInDays} jour${diffInDays > 1 ? "s" : ""}`;
  } else {
    return targetDate.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year:
        targetDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

/**
 * Formate une date en français (ex: "19 oct. 2025")
 */
export function formatDate(date: string | Date): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Formate une date avec heure (ex: "19 oct. 2025 à 14:30")
 */
export function formatDateTime(date: string | Date): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Formate une heure au format français
 */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
