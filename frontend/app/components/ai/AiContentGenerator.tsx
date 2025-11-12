import { useState } from 'react';
import { useAiContent } from '~/hooks/useAiContent';

interface AiContentGeneratorProps {
  onContentGenerated?: (content: string) => void;
  initialType?: 'product_description' | 'seo_meta' | 'marketing_copy' | 'blog_article';
  className?: string;
}

export function AiContentGenerator({
  onContentGenerated,
  initialType = 'product_description',
  className = '',
}: AiContentGeneratorProps) {
  const { generateContent, isLoading, error, clearError } = useAiContent();
  
  const [contentType, setContentType] = useState(initialType);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState<'professional' | 'casual' | 'friendly' | 'technical' | 'persuasive' | 'informative'>('professional');
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxLength, setMaxLength] = useState(500);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    clearError();
    
    try {
      const result = await generateContent({
        type: contentType,
        prompt,
        tone,
        temperature,
        maxLength,
        useCache: true,
      });

      setGeneratedContent(result.content);
      
      if (onContentGenerated) {
        onContentGenerated(result.content);
      }
    } catch (err) {
      console.error('Error generating content:', err);
    }
  };

  const handleCopy = async () => {
    if (generatedContent) {
      await navigator.clipboard.writeText(generatedContent);
    }
  };

  const handleClear = () => {
    setGeneratedContent(null);
    setPrompt('');
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h2 className="text-2xl font-bold mb-4 text-gray-900">
        Générateur de Contenu IA
      </h2>

      {/* Content Type Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Type de contenu
        </label>
        <select
          value={contentType}
          onChange={(e) => setContentType(e.target.value as any)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isLoading}
        >
          <option value="product_description">Description de produit</option>
          <option value="seo_meta">Méta description SEO</option>
          <option value="marketing_copy">Texte marketing</option>
          <option value="blog_article">Article de blog</option>
          <option value="social_media">Post réseaux sociaux</option>
          <option value="email_campaign">Email marketing</option>
        </select>
      </div>

      {/* Prompt Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description / Instructions
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Décrivez ce que vous souhaitez générer..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
          disabled={isLoading}
        />
      </div>

      {/* Tone Selection */}
      <div className="mb-4">
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
          <option value="technical">Technique</option>
          <option value="persuasive">Persuasif</option>
          <option value="informative">Informatif</option>
        </select>
      </div>

      {/* Advanced Options */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {showAdvanced ? '− Masquer' : '+ Afficher'} les options avancées
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Température: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                Plus bas = plus précis, Plus haut = plus créatif
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longueur maximale: {maxLength} tokens
              </label>
              <input
                type="range"
                min="50"
                max="2000"
                step="50"
                value={maxLength}
                onChange={(e) => setMaxLength(parseInt(e.target.value))}
                className="w-full"
                disabled={isLoading}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 mb-4">
        <button
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Génération en cours...' : 'Générer le contenu'}
        </button>
        
        {generatedContent && (
          <button
            onClick={handleClear}
            className="px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
          >
            Nouveau
          </button>
        )}
      </div>

      {/* Generated Content Display */}
      {generatedContent && (
        <div className="mt-6 border-t pt-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Contenu généré
            </h3>
            <button
              onClick={handleCopy}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📋 Copier
            </button>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="prose prose-sm max-w-none">
              {generatedContent.split('\n').map((line, i) => (
                <p key={i} className="mb-2 text-gray-800">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
