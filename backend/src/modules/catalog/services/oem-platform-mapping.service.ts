import { Injectable, Logger } from '@nestjs/common';

/**
 * 🔧 Service de filtrage OEM par préfixes dominants - VERSION OPTIMISÉE
 *
 * Objectif SEO: Afficher uniquement les refs OEM "exactes" du véhicule
 * dans le contenu SEO de la page liste, plutôt que toutes les refs
 * compatibles aftermarket.
 *
 * APPROCHE OPTIMISÉE (sans requêtes DB supplémentaires):
 * 1. Reçoit les refs OEM déjà récupérées par le batch-loader (pieces[].oemRefs)
 * 2. Extrait les préfixes dominants LOCALEMENT depuis ce tableau (>15% des refs)
 * 3. Filtre pour ne garder que les refs avec ces préfixes
 * 4. Cache les préfixes découverts pour éviter le recalcul
 *
 * Exemple: Pour Audi A4 B6 + Plaquettes, détecte que 8E0, 4B0 sont dominants
 *          et filtre les refs pour ne garder que celles commençant par ces préfixes
 *
 * AVANTAGES:
 * - Aucune requête Supabase supplémentaire (zéro latence réseau)
 * - Fonctionne même si la RPC OEM est lente/timeout
 * - Cache intelligent par typeId:gammeId:marqueName
 * - Extraction de préfixes depuis les données déjà chargées
 */
@Injectable()
export class OemPlatformMappingService {
  private readonly logger = new Logger(OemPlatformMappingService.name);

  // Cache en mémoire des préfixes découverts par clé composite "typeId:gammeId:marqueName"
  private readonly prefixCache: Map<
    string,
    { prefixes: string[]; timestamp: number }
  > = new Map();
  private readonly CACHE_TTL_MS = 3600000; // 1 heure

  // Seuil minimum pour considérer un préfixe comme "dominant"
  private readonly MIN_PREFIX_THRESHOLD = 0.15; // 15%
  private readonly MIN_PREFIX_COUNT = 3; // Au moins 3 occurrences
  private readonly MAX_PREFIXES = 3; // Maximum 3 préfixes dominants

  constructor() {
    // Aucune dépendance externe - tout est fait localement
  }

  /**
   * Génère la clé de cache composite
   */
  private getCacheKey(
    typeId: number,
    gammeId: number,
    marqueName: string,
  ): string {
    return `${typeId}:${gammeId}:${marqueName.toUpperCase()}`;
  }

  /**
   * Extrait le préfixe d'une ref OEM (3 premiers caractères alphanumériques)
   * @example "8E0 915 105" → "8E0"
   * @example "4B0915105A" → "4B0"
   * @example "8K0-199-381-BM" → "8K0"
   * @example "7701469442" → "770"
   */
  extractOemPrefix(ref: string): string | null {
    if (!ref || ref.length < 3) return null;

    // Nettoyer la ref (supprimer espaces, tirets, au début/fin)
    const cleanRef = ref
      .trim()
      .toUpperCase()
      .replace(/[\s\-]/g, '');

    // Prendre les 3 premiers caractères si format alphanumerique valide
    if (/^[A-Z0-9]{3}/.test(cleanRef)) {
      return cleanRef.substring(0, 3);
    }

    return null;
  }

  /**
   * 🧹 Normalise une référence OEM (supprime espaces, tirets, met en majuscules)
   * @example "77 01 206 343" → "7701206343"
   * @example "44 06 035 11R" → "440603511R"
   */
  normalizeOemRef(ref: string): string {
    if (!ref) return '';
    return ref
      .trim()
      .toUpperCase()
      .replace(/[\s\-]/g, '');
  }

  /**
   * 🔧 Formate une référence OEM avec espaces (format Renault standard)
   * Uniformise toutes les refs au format "XX XX XXX XXR" pour la lisibilité
   * @example "7701206343" → "77 01 206 343"
   * @example "410600379R" → "41 06 003 79R"
   * @example "44 06 039 05R" → "44 06 039 05R" (déjà formaté)
   */
  formatOemRefWithSpaces(ref: string): string {
    if (!ref) return '';

    // D'abord normaliser (supprimer espaces existants)
    const normalized = this.normalizeOemRef(ref);
    if (!normalized || normalized.length < 4) return ref.trim().toUpperCase();

    // Détecter le pattern et appliquer le format approprié
    const len = normalized.length;

    // Format Renault 10 caractères: XX XX XXX XXR (2-2-3-3)
    if (len === 10) {
      return `${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
    }

    // Format 11 caractères: XX XX XXX XXXR (2-2-3-4)
    if (len === 11) {
      return `${normalized.slice(0, 2)} ${normalized.slice(2, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
    }

    // Format 9 caractères: XXX XXX XXX (3-3-3)
    if (len === 9) {
      return `${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
    }

    // Format 8 caractères: XXXX XXXX (4-4)
    if (len === 8) {
      return `${normalized.slice(0, 4)} ${normalized.slice(4)}`;
    }

    // Format 12+ caractères: XXX XXX XXX XXX... (groupes de 3)
    if (len >= 12) {
      const groups: string[] = [];
      for (let i = 0; i < len; i += 3) {
        groups.push(normalized.slice(i, Math.min(i + 3, len)));
      }
      return groups.join(' ');
    }

    // Autres formats: retourner tel quel en majuscules
    return ref.trim().toUpperCase();
  }

  /**
   * 🔄 Déduplique les références OEM et uniformise le format avec espaces
   * Toutes les refs sont formatées uniformément pour une meilleure lisibilité
   * @example ["77 01 206 343", "7701206343"] → ["77 01 206 343"]
   * @example ["410600379R"] → ["41 06 003 79R"]
   */
  deduplicateOemRefs(oemRefs: string[]): string[] {
    if (!oemRefs || oemRefs.length === 0) return [];

    const seen = new Set<string>(); // Ensemble des refs normalisées déjà vues
    const result: string[] = [];

    for (const ref of oemRefs) {
      const normalized = this.normalizeOemRef(ref);
      if (!normalized) continue;

      // Si pas encore vu, ajouter la version formatée avec espaces
      if (!seen.has(normalized)) {
        seen.add(normalized);
        // 🔧 Toujours formater avec espaces pour uniformité
        result.push(this.formatOemRefWithSpaces(ref));
      }
    }

    return result;
  }

  /**
   * 🔍 Découvre les préfixes dominants depuis un tableau de refs OEM
   * LOCALE - Aucune requête DB, analyse uniquement les données fournies
   *
   * @param oemRefs Tableau de références OEM à analyser
   * @returns Liste des préfixes dominants (max 3)
   */
  discoverPrefixesFromRefs(oemRefs: string[]): string[] {
    if (!oemRefs || oemRefs.length === 0) {
      return [];
    }

    // Compter les occurrences de chaque préfixe
    const prefixCounts = new Map<string, number>();

    for (const ref of oemRefs) {
      const prefix = this.extractOemPrefix(ref);
      if (prefix) {
        prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
      }
    }

    // Identifier les préfixes dominants (>15% des refs OU minimum 3 occurrences)
    const totalRefs = oemRefs.length;
    const minThreshold = Math.max(
      this.MIN_PREFIX_COUNT,
      totalRefs * this.MIN_PREFIX_THRESHOLD,
    );

    const dominantPrefixes = Array.from(prefixCounts.entries())
      .filter(([, count]) => count >= minThreshold)
      .sort((a, b) => b[1] - a[1]) // Tri par fréquence décroissante
      .slice(0, this.MAX_PREFIXES)
      .map(([prefix]) => prefix);

    return dominantPrefixes;
  }

  /**
   * 🎯 Filtre les refs OEM pour ne garder que celles avec les préfixes dominants
   * VERSION SIMPLIFIÉE - Analyse locale sans requêtes DB
   *
   * @param allOemRefs Toutes les refs OEM à filtrer
   * @param typeId ID du type de véhicule (pour cache)
   * @param gammeId ID de la gamme de pièces (pour cache)
   * @param marqueName Nom de la marque constructeur (pour cache)
   * @returns Objet avec refs filtrées, préfixes découverts, et stats
   */
  filterOemRefsForSeo(
    allOemRefs: string[],
    typeId: number,
    gammeId: number,
    marqueName: string,
  ): {
    filteredRefs: string[];
    allRefs: string[];
    prefixes: string[];
    filterApplied: boolean;
    stats: {
      totalRefs: number;
      filteredCount: number;
      reductionPercent: number;
      duplicatesRemoved?: number; // 🔄 Nombre de doublons supprimés
    };
  } {
    if (!allOemRefs || allOemRefs.length === 0) {
      return {
        filteredRefs: [],
        allRefs: [],
        prefixes: [],
        filterApplied: false,
        stats: { totalRefs: 0, filteredCount: 0, reductionPercent: 0 },
      };
    }

    // 🔄 Dédupliquer les refs avant traitement (supprime les doublons avec/sans espaces)
    const uniqueOemRefs = this.deduplicateOemRefs(allOemRefs);
    const duplicatesRemoved = allOemRefs.length - uniqueOemRefs.length;

    if (duplicatesRemoved > 0) {
      this.logger.debug(
        `🔄 [DEDUP] ${allOemRefs.length} refs → ${uniqueOemRefs.length} uniques (-${duplicatesRemoved} doublons)`,
      );
    }

    const cacheKey = this.getCacheKey(typeId, gammeId, marqueName);

    // Vérifier le cache des préfixes
    let prefixes: string[];
    const cached = this.prefixCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      prefixes = cached.prefixes;
      this.logger.debug(
        `📦 [CACHE HIT] Préfixes pour ${cacheKey}: ${prefixes.join(', ')}`,
      );
    } else {
      // Découvrir les préfixes depuis les refs dédupliquées
      prefixes = this.discoverPrefixesFromRefs(uniqueOemRefs);

      // Mettre en cache
      this.prefixCache.set(cacheKey, {
        prefixes,
        timestamp: Date.now(),
      });

      this.logger.log(
        `🔍 [DISCOVER] ${cacheKey}: ${prefixes.length} préfixes ` +
          `(${prefixes.join(', ')}) sur ${uniqueOemRefs.length} refs uniques`,
      );
    }

    // Si pas de préfixes dominants, retourner toutes les refs uniques
    if (prefixes.length === 0) {
      this.logger.warn(`⚠️ [SEO] Pas de préfixes dominants pour ${cacheKey}`);
      return {
        filteredRefs: uniqueOemRefs,
        allRefs: uniqueOemRefs,
        prefixes: [],
        filterApplied: false,
        stats: {
          totalRefs: uniqueOemRefs.length,
          filteredCount: uniqueOemRefs.length,
          reductionPercent: 0,
        },
      };
    }

    // Filtrer les refs uniques par les préfixes découverts
    const filteredRefs = uniqueOemRefs.filter((ref) => {
      const refPrefix = this.extractOemPrefix(ref);
      return refPrefix && prefixes.includes(refPrefix);
    });

    const reductionPercent =
      uniqueOemRefs.length > 0
        ? Math.round(
            ((uniqueOemRefs.length - filteredRefs.length) /
              uniqueOemRefs.length) *
              100,
          )
        : 0;

    this.logger.log(
      `🎯 [SEO] Filtrage ${cacheKey}: ${filteredRefs.length}/${uniqueOemRefs.length} refs uniques ` +
        `(-${reductionPercent}%) (préfixes: ${prefixes.join(', ')})`,
    );

    return {
      filteredRefs,
      allRefs: uniqueOemRefs,
      prefixes,
      filterApplied: true,
      stats: {
        totalRefs: uniqueOemRefs.length,
        filteredCount: filteredRefs.length,
        reductionPercent,
        duplicatesRemoved, // 🔄 Nombre de doublons supprimés
      },
    };
  }

  /**
   * 🔧 Méthode utilitaire pour filtrer directement par préfixes connus
   * (sans passer par le cache/discovery)
   */
  filterByPrefixes(oemRefs: string[], prefixes: string[]): string[] {
    if (!prefixes || prefixes.length === 0) {
      return oemRefs;
    }

    return oemRefs.filter((ref) => {
      const refPrefix = this.extractOemPrefix(ref);
      return refPrefix && prefixes.includes(refPrefix);
    });
  }

  /**
   * Vide le cache (utile pour les tests ou après une mise à jour des données)
   */
  clearCache(): void {
    this.prefixCache.clear();
    this.logger.log('🗑️ Cache des préfixes OEM vidé');
  }

  /**
   * Retourne les statistiques du cache
   */
  getCacheStats(): {
    size: number;
    entries: Array<{
      cacheKey: string;
      prefixes: string[];
      age: number;
    }>;
  } {
    const now = Date.now();
    return {
      size: this.prefixCache.size,
      entries: Array.from(this.prefixCache.entries()).map(
        ([cacheKey, data]) => ({
          cacheKey,
          prefixes: data.prefixes,
          age: Math.round((now - data.timestamp) / 1000),
        }),
      ),
    };
  }
}
