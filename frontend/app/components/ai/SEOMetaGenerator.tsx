import { memo, useRef, useState } from "react";
import { useAiContent } from "~/hooks/useAiContent";
import { logger } from "~/utils/logger";

interface SEOMetaGeneratorProps {
  initialPageTitle?: string;
  onGenerated?: (meta: { title: string; description: string }) => void;
  className?: string;
}

interface KeywordRow {
  id: number;
  value: string;
}

export const SEOMetaGenerator = memo(function SEOMetaGenerator({
  initialPageTitle = "",
  onGenerated,
  className = "",
}: SEOMetaGeneratorProps) {
  const { generateSEOMeta, isLoading, error } = useAiContent();

  const [pageTitle, setPageTitle] = useState(initialPageTitle);
  const [pageUrl, setPageUrl] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const keywordIdRef = useRef(0);
  const [keywords, setKeywords] = useState<KeywordRow[]>([
    { id: 0, value: "" },
  ]);
  const [businessType, setBusinessType] = useState("");
  const [generatedMeta, setGeneratedMeta] = useState<string | null>(null);

  const handleAddKeyword = () => {
    setKeywords([...keywords, { id: ++keywordIdRef.current, value: "" }]);
  };

  const handleRemoveKeyword = (id: number) => {
    setKeywords(keywords.filter((keyword) => keyword.id !== id));
  };

  const handleKeywordChange = (id: number, value: string) => {
    setKeywords(
      keywords.map((keyword) =>
        keyword.id === id ? { ...keyword, value } : keyword,
      ),
    );
  };

  const handleGenerate = async () => {
    if (!pageTitle.trim()) return;

    try {
      const result = await generateSEOMeta({
        pageTitle,
        pageUrl: pageUrl || undefined,
        targetKeyword: targetKeyword || undefined,
        keywords: keywords.filter((k) => k.value.trim()).map((k) => k.value),
        businessType: businessType || undefined,
      });

      setGeneratedMeta(result.content);

      if (onGenerated) {
        onGenerated({
          title: pageTitle,
          description: result.content,
        });
      }
    } catch (err) {
      logger.error("Error generating SEO meta:", err);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        Générateur de Méta Description SEO
      </h2>

      <div className="space-y-4">
        {/* Page Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titre de la page *
          </label>
          <input
            type="text"
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            placeholder="Ex: Vannes papillon motorisées - Catalogue 2025"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Page URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            URL de la page (optionnel)
          </label>
          <input
            type="url"
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            placeholder="https://example.com/vannes-papillon"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* Target Keyword */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mot-clé principal
          </label>
          <input
            type="text"
            value={targetKeyword}
            onChange={(e) => setTargetKeyword(e.target.value)}
            placeholder="Ex: vanne papillon motorisée"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
          <p className="text-xs text-gray-500 mt-1">
            Le mot-clé que vous souhaitez cibler pour le référencement
          </p>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mots-clés secondaires
          </label>
          <div className="space-y-2">
            {keywords.map((keyword) => (
              <div key={keyword.id} className="flex gap-2">
                <input
                  type="text"
                  value={keyword.value}
                  onChange={(e) =>
                    handleKeywordChange(keyword.id, e.target.value)
                  }
                  placeholder="Ex: automatisation, robinet industriel"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isLoading}
                />
                {keywords.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveKeyword(keyword.id)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                    disabled={isLoading}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAddKeyword}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            disabled={isLoading}
          >
            + Ajouter un mot-clé
          </button>
        </div>

        {/* Business Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Type d'entreprise
          </label>
          <input
            type="text"
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            placeholder="Ex: E-commerce industriel, Fabricant"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isLoading}
          />
        </div>

        {/* SEO Tips */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">
            💡 Bonnes pratiques SEO
          </h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Longueur idéale : 150-160 caractères</li>
            <li>• Inclure le mot-clé principal naturellement</li>
            <li>• Ajouter un appel à l'action clair</li>
            <li>• Rendre la description unique et engageante</li>
          </ul>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isLoading || !pageTitle.trim()}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Génération en cours..." : "Générer la méta description"}
        </button>

        {/* Generated Content */}
        {generatedMeta && (
          <div className="mt-6 border-t pt-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Méta description générée
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedMeta);
                }}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                📋 Copier
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-800">{generatedMeta}</p>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  Longueur : {generatedMeta.length} caractères
                </span>
                <span
                  className={`font-medium ${
                    generatedMeta.length >= 150 && generatedMeta.length <= 160
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  {generatedMeta.length >= 150 && generatedMeta.length <= 160
                    ? "✓ Longueur optimale"
                    : generatedMeta.length < 150
                      ? "⚠ Trop court"
                      : "⚠ Trop long"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
