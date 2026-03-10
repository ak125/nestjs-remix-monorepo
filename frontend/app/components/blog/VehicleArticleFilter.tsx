/**
 * VehicleArticleFilter — "Trouver des articles pour votre véhicule"
 * Cascading selects: Marque → Modèle → Articles filtrés
 */
import { Link } from "@remix-run/react";
import { Car, Loader2, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  type BlogArticle,
  getArticleUrl,
  formatReadingTime,
  formatViews,
  getTypeLabel,
} from "./blog-helpers";

interface VehicleMarque {
  marque_id: number;
  marque_name: string;
  marque_alias: string;
}

interface VehicleModele {
  modele_id: number;
  modele_name: string;
  modele_alias: string;
}

export function VehicleArticleFilter() {
  const [marques, setMarques] = useState<VehicleMarque[]>([]);
  const [modeles, setModeles] = useState<VehicleModele[]>([]);
  const [articles, setArticles] = useState<BlogArticle[]>([]);

  const [selectedMarque, setSelectedMarque] = useState<number | null>(null);
  const [selectedModele, setSelectedModele] = useState<number | null>(null);

  const [loadingMarques, setLoadingMarques] = useState(false);
  const [loadingModeles, setLoadingModeles] = useState(false);
  const [loadingArticles, setLoadingArticles] = useState(false);

  // Load marques on mount
  useEffect(() => {
    setLoadingMarques(true);
    fetch("/api/blog/vehicle-marques")
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setMarques(res.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingMarques(false));
  }, []);

  // Load modeles when marque changes
  useEffect(() => {
    if (!selectedMarque) {
      setModeles([]);
      setArticles([]);
      return;
    }
    setSelectedModele(null);
    setLoadingModeles(true);
    fetch(`/api/blog/vehicle-modeles/${selectedMarque}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setModeles(res.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingModeles(false));

    // Also load articles for marque
    setLoadingArticles(true);
    fetch(`/api/blog/by-vehicle?marque_id=${selectedMarque}&limit=6`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setArticles(res.data?.articles || []);
      })
      .catch(() => {})
      .finally(() => setLoadingArticles(false));
  }, [selectedMarque]);

  // Load articles when modele changes
  useEffect(() => {
    if (!selectedMarque || !selectedModele) return;
    setLoadingArticles(true);
    fetch(
      `/api/blog/by-vehicle?marque_id=${selectedMarque}&modele_id=${selectedModele}&limit=6`,
    )
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setArticles(res.data?.articles || []);
      })
      .catch(() => {})
      .finally(() => setLoadingArticles(false));
  }, [selectedModele, selectedMarque]);

  const selectedMarqueName = marques.find(
    (m) => m.marque_id === selectedMarque,
  )?.marque_name;

  return (
    <section className="py-16 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-5 py-1.5 text-sm">
            <Car className="w-4 h-4 mr-2" />
            Par véhicule
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
            Trouver des articles pour votre véhicule
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Sélectionnez votre marque et modèle pour voir les guides et conseils
            adaptés
          </p>
        </div>

        {/* Selects */}
        <div className="max-w-3xl mx-auto mb-10">
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Marque */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Marque
                </label>
                <select
                  value={selectedMarque ?? ""}
                  onChange={(e) =>
                    setSelectedMarque(
                      e.target.value ? parseInt(e.target.value, 10) : null,
                    )
                  }
                  disabled={loadingMarques}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">
                    {loadingMarques
                      ? "Chargement..."
                      : "Sélectionnez une marque"}
                  </option>
                  {marques.map((m) => (
                    <option key={m.marque_id} value={m.marque_id}>
                      {m.marque_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Modèle */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Modèle
                </label>
                <select
                  value={selectedModele ?? ""}
                  onChange={(e) =>
                    setSelectedModele(
                      e.target.value ? parseInt(e.target.value, 10) : null,
                    )
                  }
                  disabled={!selectedMarque || loadingModeles}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {loadingModeles
                      ? "Chargement..."
                      : !selectedMarque
                        ? "Choisissez d'abord une marque"
                        : "Tous les modèles"}
                  </option>
                  {modeles.map((m) => (
                    <option key={m.modele_id} value={m.modele_id}>
                      {m.modele_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {loadingArticles && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mr-2" />
            <span className="text-gray-600">Recherche en cours...</span>
          </div>
        )}

        {!loadingArticles && selectedMarque && articles.length > 0 && (
          <div className="max-w-5xl mx-auto">
            <p className="text-sm text-gray-500 mb-4 text-center">
              {articles.length} article{articles.length > 1 ? "s" : ""} trouvé
              {articles.length > 1 ? "s" : ""} pour{" "}
              <span className="font-semibold text-gray-700">
                {selectedMarqueName}
              </span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {articles.map((article) => (
                <Link
                  key={article.id}
                  to={getArticleUrl(article)}
                  prefetch="intent"
                  className="group"
                >
                  <Card className="h-full border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 text-blue-700 text-xs"
                        >
                          {getTypeLabel(article.type)}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
                        {article.title}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-3">
                        {article.excerpt}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{formatReadingTime(article.readingTime)}</span>
                        <span>{formatViews(article.viewsCount)} vues</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loadingArticles &&
          selectedMarque &&
          articles.length === 0 &&
          !loadingModeles && (
            <div className="text-center py-8">
              <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                Aucun article trouvé pour ce véhicule.
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Essayez une autre marque ou consultez nos{" "}
                <Link
                  to="/blog-pieces-auto/conseils"
                  className="text-blue-600 hover:underline"
                >
                  conseils généraux
                </Link>
                .
              </p>
            </div>
          )}

        {!selectedMarque && !loadingMarques && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-400">
              Sélectionnez une marque pour commencer
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
