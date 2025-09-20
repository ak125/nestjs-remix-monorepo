/**
 * Système de préchargement et mise en cache des images de marques
 */

interface PreloadCache {
  [url: string]: {
    loaded: boolean;
    image?: HTMLImageElement;
    error?: boolean;
  };
}

class ImagePreloader {
  private cache: PreloadCache = {};
  private preloadQueue: string[] = [];
  private isPreloading = false;
  private maxConcurrent = 3; // Limite de téléchargements simultanés

  /**
   * Précharge une image et la met en cache
   */
  preloadImage(url: string): Promise<HTMLImageElement> {
    // Si déjà en cache
    if (this.cache[url]) {
      if (this.cache[url].loaded && this.cache[url].image) {
        return Promise.resolve(this.cache[url].image!);
      }
      if (this.cache[url].error) {
        return Promise.reject(new Error('Image failed to load'));
      }
    }

    // Initialiser le cache
    if (!this.cache[url]) {
      this.cache[url] = { loaded: false };
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.cache[url] = { loaded: true, image: img };
        resolve(img);
      };
      
      img.onerror = () => {
        this.cache[url] = { loaded: false, error: true };
        reject(new Error(`Failed to load image: ${url}`));
      };
      
      img.src = url;
      img.decoding = 'async';
    });
  }

  /**
   * Précharge une liste d'images avec limitation de concurrence
   */
  async preloadBatch(urls: string[]): Promise<void> {
    const batches = this.chunkArray(urls, this.maxConcurrent);
    
    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(url => this.preloadImage(url))
      );
    }
  }

  /**
   * Précharge les logos de marques visibles en priorité
   */
  preloadVisibleBrands(brands: Array<{ marque_name: string }>): void {
    const urls = brands.map(brand => this.getBrandLogoUrl(brand.marque_name));
    
    // Ajouter à la queue sans bloquer l'interface
    this.addToQueue(urls);
    this.processQueue();
  }

  /**
   * Construction de l'URL du logo avec gestion des cas spéciaux
   */
  private getBrandLogoUrl(brandName: string): string {
    const getBrandFileName = (name: string): string => {
      const normalized = name.toLowerCase().replace(/\s+/g, '-');
      
      const specialCases: Record<string, string> = {
        'citroën': 'citroen',
        'land-rover': 'land-rover',
        'alfa-romeo': 'alfa-romeo',
        'mercedes': 'mercedes',
      };
      
      return specialCases[normalized] || normalized;
    };

    const brandFileName = getBrandFileName(brandName);
    return `https://cxpojprgwgubzjyqzmoq.supabase.co/storage/v1/object/public/uploads/constructeurs-automobiles/marques-logos/${brandFileName}.webp`;
  }

  /**
   * Vérifie si une image est en cache et chargée
   */
  isImageCached(url: string): boolean {
    return this.cache[url]?.loaded === true;
  }

  /**
   * Obtient une image du cache
   */
  getCachedImage(url: string): HTMLImageElement | null {
    return this.cache[url]?.image || null;
  }

  /**
   * Ajoute des URLs à la queue de préchargement
   */
  private addToQueue(urls: string[]): void {
    const newUrls = urls.filter(url => !this.cache[url] && !this.preloadQueue.includes(url));
    this.preloadQueue.push(...newUrls);
  }

  /**
   * Traite la queue de préchargement
   */
  private async processQueue(): Promise<void> {
    if (this.isPreloading || this.preloadQueue.length === 0) {
      return;
    }

    this.isPreloading = true;

    while (this.preloadQueue.length > 0) {
      const batch = this.preloadQueue.splice(0, this.maxConcurrent);
      await Promise.allSettled(
        batch.map(url => this.preloadImage(url))
      );
    }

    this.isPreloading = false;
  }

  /**
   * Divise un tableau en chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Nettoie le cache (garde les 50 dernières images)
   */
  cleanCache(): void {
    const entries = Object.entries(this.cache);
    if (entries.length > 50) {
      // Garde les 50 plus récents (approximation basée sur l'ordre)
      const toKeep = entries.slice(-50);
      this.cache = Object.fromEntries(toKeep);
    }
  }

  /**
   * Obtient les statistiques du cache
   */
  getCacheStats(): { total: number; loaded: number; errors: number } {
    const entries = Object.values(this.cache);
    return {
      total: entries.length,
      loaded: entries.filter(e => e.loaded).length,
      errors: entries.filter(e => e.error).length,
    };
  }
}

// Instance globale du préchargeur
export const imagePreloader = new ImagePreloader();

/**
 * Hook personnalisé pour le préchargement d'images
 */
export function useImagePreloader() {
  return {
    preloadImage: (url: string) => imagePreloader.preloadImage(url),
    preloadBatch: (urls: string[]) => imagePreloader.preloadBatch(urls),
    preloadVisibleBrands: (brands: Array<{ marque_name: string }>) => 
      imagePreloader.preloadVisibleBrands(brands),
    isImageCached: (url: string) => imagePreloader.isImageCached(url),
    getCachedImage: (url: string) => imagePreloader.getCachedImage(url),
    getCacheStats: () => imagePreloader.getCacheStats(),
  };
}
