// 📁 frontend/app/components/vehicle/VehicleCombobox.tsx
// 🚗 Combobox intelligent pour sélection rapide de véhicule

import { Car, ChevronDown, Search, X } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { logger } from "~/utils/logger";

interface VehicleComboboxProps {
  placeholder?: string;
  onSelect?: (vehicle: {
    brand: any;
    year: number;
    model: any;
    type: any;
  }) => void;
  currentVehicle?: {
    brand?: { id: number; name: string };
    model?: { id: number; name: string };
    type?: { id: number; name: string };
  };
  className?: string;
}

interface VehicleOption {
  id: string;
  label: string;
  brand: any;
  year: number;
  model: any;
  type: any;
}

const VehicleCombobox = memo(function VehicleCombobox({
  placeholder = "🚗 Recherchez votre véhicule (ex: Peugeot 208 1.6 HDI)",
  onSelect: _onSelect,
  currentVehicle: _currentVehicle,
  className = "",
}: VehicleComboboxProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(
    null,
  );
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 🔍 Recherche simplifiée avec debounce
  useEffect(() => {
    if (query.length < 2) {
      setOptions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        await searchVehicles(query);
      } catch (error) {
        logger.error("❌ Erreur recherche véhicules:", error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 500); // Augmenter le debounce à 500ms

    return () => clearTimeout(timer);
  }, [query]);

  // 🎯 Recherche SIMPLIFIÉE - juste les marques pour éviter la boucle
  const searchVehicles = async (searchTerm: string) => {
    const term = searchTerm.toLowerCase().trim();
    const results: VehicleOption[] = [];

    try {
      // Rechercher uniquement les marques (pas de cascade)
      const brands = await enhancedVehicleApi.getBrands();
      const matchingBrands = brands
        .filter(
          (b) =>
            b.marque_name.toLowerCase().includes(term) ||
            (b.marque_alias && b.marque_alias.toLowerCase().includes(term)),
        )
        .slice(0, 5); // Max 5 marques

      // Pour chaque marque, créer une suggestion simple
      for (const brand of matchingBrands) {
        // Suggestion de marque générique
        results.push({
          id: `brand-${brand.marque_id}`,
          label: `${brand.marque_name} (tous modèles)`,
          brand,
          year: new Date().getFullYear(), // Année courante
          model: {
            modele_id: 0,
            modele_name: "À sélectionner",
            modele_alias: "a-selectionner",
          },
          type: {
            type_id: 0,
            type_name: "À sélectionner",
            type_alias: "a-selectionner",
          },
        });
      }

      setOptions(results);
      setHighlightedIndex(0);
    } catch (error) {
      logger.error("❌ Erreur recherche:", error);
      setOptions([]);
    }
  };

  // 🎯 Sélection - Pour l'instant, on redirige vers le sélecteur complet
  const handleSelect = (option: VehicleOption) => {
    setSelectedVehicle(option);
    setQuery("");
    setIsOpen(false);

    // Note: Comme on n'a que la marque, on ne peut pas encore faire la sélection complète
    // L'utilisateur devra utiliser le sélecteur complet pour choisir modèle/type
    logger.log("🚗 Marque sélectionnée:", option.brand.marque_name);

    // Afficher un message pour guider l'utilisateur
    alert(
      `Marque ${option.brand.marque_name} sélectionnée.\n\nPour une sélection complète (modèle + type), utilisez le sélecteur détaillé ci-dessous.`,
    );

    // On ne peut pas appeler onSelect car on n'a pas de modèle/type valides
    // if (onSelect) {
    //   onSelect({
    //     brand: option.brand,
    //     year: option.year,
    //     model: option.model,
    //     type: option.type
    //   });
    // }
  };

  // ⌨️ Navigation clavier
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || options.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < options.length - 1 ? prev + 1 : prev,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        e.preventDefault();
        if (options[highlightedIndex]) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // 🖱️ Clic en dehors
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🧹 Clear selection
  const handleClear = () => {
    setSelectedVehicle(null);
    setQuery("");
    setOptions([]);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      {/* 🎯 Véhicule sélectionné - Badge */}
      {selectedVehicle && (
        <div className="mb-3 inline-flex items-center gap-2 bg-gradient-to-r from-semantic-info/10 to-secondary-500/10 text-semantic-info px-4 py-2 rounded-lg border border-semantic-info/20">
          <Car className="w-4 h-4" />
          <span className="font-medium text-sm">{selectedVehicle.label}</span>
          <button
            onClick={handleClear}
            className="ml-2 hover:bg-semantic-info/20 rounded-full p-1 transition-colors"
            aria-label="Supprimer la sélection"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* 🔍 Input de recherche */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-12 pr-12 py-4 text-base border-2 border-neutral-200 rounded-xl focus:border-semantic-info focus:ring-4 focus:ring-semantic-info/10 outline-none transition-all bg-white shadow-sm hover:border-neutral-300"
          />
          {loading ? (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-semantic-info border-t-transparent"></div>
            </div>
          ) : (
            <ChevronDown
              className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          )}
        </div>

        {/* 📋 Dropdown suggestions */}
        {isOpen && (options.length > 0 || loading) && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-2 bg-white border border-neutral-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto"
          >
            {loading && options.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-semantic-info border-t-transparent mx-auto mb-2"></div>
                <p className="text-sm">Recherche en cours...</p>
              </div>
            ) : options.length === 0 ? (
              <div className="px-4 py-8 text-center text-neutral-500">
                <p className="text-sm">Aucune marque trouvée</p>
                <p className="text-xs mt-1">
                  Essayez : Peugeot, Renault, Citroën...
                </p>
              </div>
            ) : (
              <ul className="py-2">
                {options.map((option, index) => (
                  <li key={option.id}>
                    <button
                      onClick={() => handleSelect(option)}
                      className={`w-full px-4 py-3 text-left hover:bg-semantic-info/5 transition-colors border-l-4 ${
                        index === highlightedIndex
                          ? "bg-semantic-info/10 border-semantic-info"
                          : "border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Car className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        <span className="text-sm text-neutral-800 font-medium">
                          {option.label}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 💡 Aide contextuelle */}
        {!isOpen && query.length === 0 && !selectedVehicle && (
          <p className="mt-2 text-xs text-neutral-500 flex items-center gap-1">
            <Search className="w-3 h-3" />
            Tapez le nom d'une marque (ex: Peugeot, Renault...)
          </p>
        )}
      </div>
    </div>
  );
});

export default VehicleCombobox;
