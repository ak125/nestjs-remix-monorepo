/**
 * 🔎 REFERENCE SEARCH MODAL
 *
 * Modal pour la recherche par référence OEM ou commerciale
 *
 * Features :
 * - Formulaire de recherche avec validation
 * - Input avec bouton clear
 * - Boutons submit et annulation
 * - Section d'aide avec exemples de références
 * - Animations d'entrée/sortie
 *
 * Props :
 * - isOpen: État d'ouverture du modal
 * - searchReference: Valeur de l'input
 * - onSearchReferenceChange: Callback pour modifier la valeur
 * - onSubmit: Callback pour soumettre le formulaire
 * - onClose: Callback pour fermer le modal
 */

import { ChevronRight, Search } from "lucide-react";
import { memo } from "react";

interface ReferenceSearchModalProps {
  isOpen: boolean;
  searchReference: string;
  onSearchReferenceChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const ReferenceSearchModal = memo(function ReferenceSearchModal({
  isOpen,
  searchReference,
  onSearchReferenceChange,
  onSubmit,
  onClose,
}: ReferenceSearchModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-20 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 animate-in slide-in-from-top-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Recherche par référence
              </h3>
              <p className="text-sm text-gray-600">
                Entrez une référence OEM ou commerciale
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Fermer le modal"
          >
            <ChevronRight className="w-5 h-5 text-gray-500 rotate-90" />
          </button>
        </div>

        {/* Formulaire */}
        <div className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={searchReference}
                onChange={(e) => onSearchReferenceChange(e.target.value)}
                placeholder="Ex: 7701208265, KTBWP8841, 04C115561H..."
                className="w-full px-6 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none transition-colors"
                autoFocus
              />
              {searchReference && (
                <button
                  type="button"
                  onClick={() => onSearchReferenceChange("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Effacer"
                >
                  <ChevronRight className="w-5 h-5 text-gray-400 rotate-45" />
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!searchReference.trim()}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rechercher
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>

          {/* Aide */}
          <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <p className="text-sm text-orange-900 font-medium mb-2">
              💡 Exemples de références :
            </p>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>
                • Référence OEM constructeur :{" "}
                <code className="font-mono bg-white px-2 py-0.5 rounded">
                  7701208265
                </code>
              </li>
              <li>
                • Référence commerciale :{" "}
                <code className="font-mono bg-white px-2 py-0.5 rounded">
                  KTBWP8841
                </code>
              </li>
              <li>
                • Référence VAG :{" "}
                <code className="font-mono bg-white px-2 py-0.5 rounded">
                  04C115561H
                </code>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ReferenceSearchModal;
