/**
 * 🚀 Utilitaires de Performance
 *
 * Fonctions pour optimiser l'INP (Interaction to Next Paint)
 * - throttle: Limite la fréquence d'exécution (pour scroll/resize)
 * - debounce: Retarde l'exécution jusqu'à inactivité (pour input)
 * - scheduleIdleCallback: Diffère les tâches non-critiques
 */

/**
 * Throttle une fonction pour limiter sa fréquence d'exécution
 * Utile pour: scroll, resize, mousemove
 *
 * @param fn - Fonction à throttler
 * @param delay - Délai minimum entre exécutions (ms)
 * @returns Fonction throttlée
 *
 * @example
 * const throttledScroll = throttle(() => {
 *   setIsScrolled(window.scrollY > 40);
 * }, 100);
 */
export function throttle<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): T {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return ((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = delay - (now - lastCall);

    if (remaining <= 0) {
      // Assez de temps s'est écoulé, exécuter immédiatement
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      // Programmer une exécution pour la fin du délai
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}

/**
 * Debounce une fonction pour n'exécuter qu'après inactivité
 * Utile pour: recherche, validation, resize final
 *
 * @param fn - Fonction à debouncer
 * @param delay - Délai d'inactivité avant exécution (ms)
 * @returns Fonction debouncée avec méthode cancel()
 *
 * @example
 * const debouncedSearch = debounce((query) => {
 *   fetchResults(query);
 * }, 300);
 *
 * // Pour annuler un debounce en cours (cleanup useEffect)
 * debouncedSearch.cancel();
 */
export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, delay);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Programme une tâche non-critique pour exécution pendant temps idle
 * Utilise requestIdleCallback si disponible, sinon setTimeout fallback
 *
 * Idéal pour: localStorage, analytics, prefetch, logging
 *
 * @param callback - Fonction à exécuter pendant temps idle
 * @param options - Options (timeout max en ms)
 *
 * @example
 * scheduleIdleCallback(() => {
 *   localStorage.setItem('preferences', JSON.stringify(prefs));
 * });
 */
export function scheduleIdleCallback(
  callback: () => void,
  options: { timeout?: number } = {}
): void {
  const { timeout = 1000 } = options;

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback(callback, { timeout });
  } else {
    // Fallback pour navigateurs sans requestIdleCallback
    setTimeout(callback, 0);
  }
}

/**
 * Annule un callback idle programmé
 *
 * @param id - ID retourné par requestIdleCallback
 */
export function cancelIdleCallback(id: number): void {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    (window as Window & { cancelIdleCallback: (id: number) => void })
      .cancelIdleCallback(id);
  }
}

/**
 * Batch des lectures DOM puis des écritures pour éviter layout thrashing
 *
 * @param readFn - Fonction qui lit le DOM
 * @param writeFn - Fonction qui écrit dans le DOM
 *
 * @example
 * batchDOMUpdates(
 *   () => element.getBoundingClientRect(),
 *   (rect) => {
 *     clone.style.left = `${rect.left}px`;
 *     clone.style.top = `${rect.top}px`;
 *   }
 * );
 */
export function batchDOMUpdates<T>(
  readFn: () => T,
  writeFn: (data: T) => void
): void {
  // Lecture synchrone (avant le prochain paint)
  const data = readFn();

  // Écriture dans le prochain frame
  requestAnimationFrame(() => {
    writeFn(data);
  });
}
