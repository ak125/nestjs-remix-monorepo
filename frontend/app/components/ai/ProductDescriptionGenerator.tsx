import { memo, useRef, useState } from "react";
import { useAiContent } from "~/hooks/useAiContent";
import { logger } from "~/utils/logger";

interface ProductDescriptionGeneratorProps {
  productName?: string;
  onGenerated?: (description: string) => void;
  className?: string;
}

interface FeatureRow {
  id: number;
  value: string;
}

export const ProductDescriptionGenerator = memo(
  function ProductDescriptionGenerator({
    productName: initialProductName = "",
    onGenerated,
    className = "",
  }: ProductDescriptionGeneratorProps) {
    const { generateProductDescription, isLoading, error } = useAiContent();

    const [productName, setProductName] = useState(initialProductName);
    const [category, setCategory] = useState("");
    const featureIdRef = useRef(0);
    const [features, setFeatures] = useState<FeatureRow[]>([
      { id: 0, value: "" },
    ]);
    const [targetAudience, setTargetAudience] = useState("");
    const [tone, setTone] = useState<"professional" | "casual" | "friendly">(
      "professional",
    );
    const [length, setLength] = useState<"short" | "medium" | "long">("medium");
    const [generatedDescription, setGeneratedDescription] = useState<
      string | null
    >(null);

    const handleAddFeature = () => {
      setFeatures([...features, { id: ++featureIdRef.current, value: "" }]);
    };

    const handleRemoveFeature = (id: number) => {
      setFeatures(features.filter((feature) => feature.id !== id));
    };

    const handleFeatureChange = (id: number, value: string) => {
      setFeatures(
        features.map((feature) =>
          feature.id === id ? { ...feature, value } : feature,
        ),
      );
    };

    const handleGenerate = async () => {
      if (!productName.trim()) return;

      try {
        const result = await generateProductDescription({
          productName,
          category: category || undefined,
          features: features.filter((f) => f.value.trim()).map((f) => f.value),
          targetAudience: targetAudience || undefined,
          tone,
          length,
        });

        setGeneratedDescription(result.content);

        if (onGenerated) {
          onGenerated(result.content);
        }
      } catch (err) {
        logger.error("Error generating description:", err);
      }
    };

    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <h2 className="text-2xl font-bold mb-6 text-gray-900">
          Générateur de Description Produit
        </h2>

        <div className="space-y-4">
          {/* Product Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du produit *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Vanne papillon motorisée DN50"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catégorie
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ex: Vannes papillon, Motorisations"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Features */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Caractéristiques principales
            </label>
            <div className="space-y-2">
              {features.map((feature) => (
                <div key={feature.id} className="flex gap-2">
                  <input
                    type="text"
                    value={feature.value}
                    onChange={(e) =>
                      handleFeatureChange(feature.id, e.target.value)
                    }
                    placeholder="Ex: Corps en fonte GGG40"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isLoading}
                  />
                  {features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(feature.id)}
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
              onClick={handleAddFeature}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              disabled={isLoading}
            >
              + Ajouter une caractéristique
            </button>
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Public cible
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Ex: Professionnels du traitement de l'eau"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
          </div>

          {/* Settings Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ton
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="professional">Professionnel</option>
                <option value="casual">Décontracté</option>
                <option value="friendly">Amical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longueur
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isLoading}
              >
                <option value="short">Courte (environ 100 mots)</option>
                <option value="medium">Moyenne (environ 250 mots)</option>
                <option value="long">Longue (environ 500 mots)</option>
              </select>
            </div>
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
            disabled={isLoading || !productName.trim()}
            className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Génération en cours..." : "Générer la description"}
          </button>

          {/* Generated Content */}
          {generatedDescription && (
            <div className="mt-6 border-t pt-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Description générée
                </h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedDescription);
                  }}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  📋 Copier
                </button>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-800 whitespace-pre-wrap">
                  {generatedDescription}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);
