// 📁 frontend/app/components/vehicle/VehicleSelector.tsx
// 🚗 VehicleSelector unifié - Un seul composant pour tous les besoins

import { useNavigate } from "@remix-run/react";
import {
  type VehicleBrand,
  type VehicleModel,
  type VehicleType,
} from "@repo/database-types";
import {
  Search,
  Car,
  Calendar,
  Settings,
  RotateCcw,
  FileText,
} from "lucide-react";
import { memo, useState, useEffect, useCallback } from "react";
import { logger } from "~/utils/logger";
import { enhancedVehicleApi } from "../../services/api/enhanced-vehicle.api";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface VehicleSelectorProps {
  // 🎨 Mode d'affichage
  mode?: "compact" | "full" | "mobile-premium";

  // 🔧 Fonctionnalités
  enableTypeMineSearch?: boolean;

  // 📞 Callbacks
  onVehicleSelect?: (vehicle: {
    brand: VehicleBrand;
    year: number;
    model: VehicleModel;
    type: VehicleType;
  }) => void;

  // 🧭 Navigation
  redirectOnSelect?: boolean;
  redirectTo?: "vehicle-page" | "search" | "custom";
  customRedirectUrl?: (vehicle: any) => string;

  // 🎯 Présélection
  currentVehicle?: {
    brand?: { id: number; name: string };
    year?: number;
    model?: { id: number; name: string };
    type?: { id: number; name: string };
  };

  // 🎨 Style
  className?: string;
  variant?: "default" | "minimal" | "card";

  // 🏷️ Contexte
  context?: "homepage" | "detail" | "pieces" | "search";
}

const VehicleSelector = memo(function VehicleSelector({
  mode = "full",
  enableTypeMineSearch = false,
  onVehicleSelect,
  redirectOnSelect = true,
  redirectTo = "vehicle-page",
  customRedirectUrl,
  currentVehicle,
  className = "",
  variant = "default",
  context = "homepage",
}: VehicleSelectorProps) {
  // 📊 État unifié
  const [brands, setBrands] = useState<VehicleBrand[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);
  const [types, setTypes] = useState<VehicleType[]>([]);

  const [selectedBrand, setSelectedBrand] = useState<VehicleBrand | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [selectedType, setSelectedType] = useState<VehicleType | null>(null);

  const [loadingBrands, setLoadingBrands] = useState(false);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const [, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"vehicle" | "mine">("vehicle");
  const [mineCode, setMineCode] = useState("");

  const navigate = useNavigate();

  // Charger les marques au montage (le composant ne monte que sur interaction)
  useEffect(() => {
    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBrands = useCallback(async () => {
    if (loadingBrands || brands.length > 0) return;

    setLoadingBrands(true);
    try {
      const brandsData = await enhancedVehicleApi.getBrands();
      setBrands(brandsData);

      // 🎯 Pré-sélectionner la marque si fournie dans currentVehicle
      if (currentVehicle?.brand?.id && brandsData.length > 0) {
        const preselectedBrand = brandsData.find(
          (b) => b.marque_id === currentVehicle.brand!.id,
        );
        if (preselectedBrand) {
          setSelectedBrand(preselectedBrand);

          // Charger les années pour cette marque
          try {
            const yearsData = await enhancedVehicleApi.getYearsByBrand(
              preselectedBrand.marque_id,
            );
            setYears(yearsData.sort((a, b) => b - a));
          } catch (error) {
            logger.warn(
              "❌ Erreur chargement années pour marque pré-sélectionnée:",
              error,
            );
          }
        }
      }
    } catch (error) {
      logger.error("❌ Erreur chargement marques:", error);
      setBrands([]);
    } finally {
      setLoadingBrands(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingBrands, brands.length, currentVehicle?.brand?.id]);

  // 🏷️ Gestion sélection marque
  const handleBrandChange = useCallback(
    async (brandId: number) => {
      const brand = brands.find((b) => b.marque_id === brandId) || null;
      setSelectedBrand(brand);
      setSelectedYear(null);
      setSelectedModel(null);
      setSelectedType(null);
      setModels([]);
      setTypes([]);

      if (brand) {
        setLoadingYears(true);
        try {
          const yearsData = await enhancedVehicleApi.getYearsByBrand(
            brand.marque_id,
          );
          setYears(yearsData.sort((a, b) => b - a));
        } catch (error) {
          logger.warn("❌ Erreur chargement années:", error);
          setYears([]);
        } finally {
          setLoadingYears(false);
        }
      } else {
        setYears([]);
      }
    },
    [brands],
  );

  // 📅 Gestion sélection année
  const handleYearChange = useCallback(
    async (year: number) => {
      setSelectedYear(year);
      setSelectedModel(null);
      setSelectedType(null);
      setTypes([]);

      if (selectedBrand && year) {
        setLoadingModels(true);
        try {
          const modelsData = await enhancedVehicleApi.getModels(
            selectedBrand.marque_id,
            {
              year,
              page: 0, // 🔧 Backend uses zero-indexed pages
              limit: 100,
            },
          );
          setModels(modelsData);
        } catch (error) {
          logger.warn("❌ Erreur chargement modèles:", error);
          setModels([]);
        } finally {
          setLoadingModels(false);
        }
      }
    },
    [selectedBrand],
  );

  // 🚗 Gestion sélection modèle
  const handleModelChange = useCallback(
    async (modelId: number) => {
      const model = models.find((m) => m.modele_id === modelId) || null;
      setSelectedModel(model);
      setSelectedType(null);

      if (model && selectedYear) {
        setLoadingTypes(true);
        try {
          const typesData = await enhancedVehicleApi.getTypes(model.modele_id, {
            year: selectedYear,
          });
          setTypes(typesData);
        } catch (error) {
          logger.warn("❌ Erreur chargement types:", error);
          setTypes([]);
        } finally {
          setLoadingTypes(false);
        }
      }
    },
    [models, selectedYear],
  );

  // ⚙️ Gestion sélection type avec navigation configurée
  const handleTypeSelect = useCallback(
    (type: VehicleType) => {
      if (!selectedBrand || !selectedModel || !type) {
        return;
      }

      setSelectedType(type);

      // 📞 Callback si fourni - toujours appeler même si redirectOnSelect est false
      if (selectedYear && onVehicleSelect) {
        onVehicleSelect({
          brand: selectedBrand,
          year: selectedYear,
          model: selectedModel,
          type,
        });
      }

      // 🧭 Navigation selon configuration avec format alias-id
      if (redirectOnSelect) {
        let url = "";
        let brandSlug = "";
        let modelSlug = "";
        let typeSlug = "";

        switch (redirectTo) {
          case "vehicle-page":
            // 🔧 Fonction helper pour créer un slug propre
            const createSlug = (name: string): string => {
              return name
                .toLowerCase()
                .normalize("NFD") // Normaliser les caractères accentués
                .replace(/[\u0300-\u036f]/g, "") // Retirer les accents
                .replace(/[^\w\s-]/g, "") // Garder uniquement lettres, chiffres, espaces et tirets
                .trim()
                .replace(/[\s_]+/g, "-") // Remplacer espaces et underscores par tirets
                .replace(/-+/g, "-") // Éviter plusieurs tirets consécutifs
                .replace(/^-+|-+$/g, ""); // Retirer tirets début/fin
            };

            // 🔧 Construire les slugs avec format alias-id requis par le loader
            // Gérer les cas où les alias sont vides ou manquants
            const brandAlias =
              selectedBrand.marque_alias &&
              selectedBrand.marque_alias.trim() !== ""
                ? selectedBrand.marque_alias
                : createSlug(selectedBrand.marque_name);

            const modelAlias =
              selectedModel.modele_alias &&
              selectedModel.modele_alias.trim() !== ""
                ? selectedModel.modele_alias
                : createSlug(selectedModel.modele_name);

            const typeAlias =
              type.type_alias && type.type_alias.trim() !== ""
                ? type.type_alias
                : createSlug(type.type_name);

            brandSlug = `${brandAlias}-${selectedBrand.marque_id}`;
            modelSlug = `${modelAlias}-${selectedModel.modele_id}`;
            typeSlug = `${typeAlias}-${type.type_id}`;

            url = `/constructeurs/${brandSlug}/${modelSlug}/${typeSlug}.html`;
            break;

          case "search":
            url = `/recherche?brand=${selectedBrand.marque_id}&model=${selectedModel.modele_id}&type=${type.type_id}`;
            break;

          case "custom":
            url = customRedirectUrl
              ? customRedirectUrl({
                  brand: selectedBrand,
                  model: selectedModel,
                  type,
                })
              : "";
            break;
        }

        if (url && !url.includes("undefined") && !url.includes("--")) {
          // 🚀 Navigation client-side rapide via Remix (pas de rechargement complet)
          navigate(url);
        }
      }
    },
    [
      selectedBrand,
      selectedModel,
      selectedYear,
      onVehicleSelect,
      redirectOnSelect,
      redirectTo,
      customRedirectUrl,
      navigate,
    ],
  );

  // 🧹 Reset complet
  const handleReset = useCallback(() => {
    setSelectedBrand(null);
    setSelectedYear(null);
    setSelectedModel(null);
    setSelectedType(null);
    setYears([]);
    setModels([]);
    setTypes([]);
    setSearchQuery("");
  }, []);

  // 🔍 Handler recherche par Type Mine
  const handleMineSearch = useCallback(() => {
    if (!mineCode || mineCode.length < 5) {
      return;
    }
    navigate(`/search/mine?code=${mineCode.toUpperCase()}`);
  }, [mineCode, navigate]);

  // 🎨 Styles adaptatifs selon variant
  const containerClass = `
    ${variant === "card" ? "bg-white rounded-xl shadow-lg p-6" : ""}
    ${variant === "minimal" ? "border rounded-lg p-4" : ""}
    ${className}
  `.trim();

  // 🎨 Mode compact (horizontal)
  if (mode === "compact") {
    return (
      <div
        className={`vehicle-selector-compact grid grid-cols-2 gap-2.5 sm:flex sm:gap-3 sm:items-center ${containerClass}`}
        data-nosnippet
        data-noindex
      >
        <Car className="hidden sm:block w-5 h-5 text-cta flex-shrink-0" />

        {/* Marque */}
        <select
          id="brand-v2"
          value={selectedBrand?.marque_id || ""}
          onChange={(e) => handleBrandChange(Number(e.target.value))}
          disabled={loadingBrands}
          className="sm:flex-1 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-cta/20 focus:border-cta transition-all disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Sélectionner la marque"
        >
          <option value="">Marque</option>
          {brands.map((brand) => (
            <option key={brand.marque_id} value={brand.marque_id}>
              {brand.marque_name}
            </option>
          ))}
        </select>

        {/* Année */}
        <select
          value={selectedYear || ""}
          onChange={(e) => handleYearChange(Number(e.target.value))}
          disabled={!selectedBrand || loadingYears}
          className="sm:flex-1 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-cta/20 focus:border-cta transition-all disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Sélectionner l'année"
        >
          <option value="">Année</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        {/* Modèle */}
        <select
          value={selectedModel?.modele_id || ""}
          onChange={(e) => handleModelChange(Number(e.target.value))}
          disabled={!selectedYear || loadingModels}
          className="sm:flex-1 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-cta/20 focus:border-cta transition-all disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Sélectionner le modèle"
        >
          <option value="">Modèle</option>
          {models.map((model) => (
            <option key={model.modele_id} value={model.modele_id}>
              {model.modele_name}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={selectedType?.type_id || ""}
          onChange={(e) => {
            const selectedType = types.find(
              (t) => t.type_id.toString() === e.target.value,
            );
            if (selectedType) handleTypeSelect(selectedType);
          }}
          disabled={!selectedModel || loadingTypes}
          className="sm:flex-1 py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-cta/20 focus:border-cta transition-all disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="Sélectionner la motorisation"
        >
          <option value="">Motorisation</option>
          {types.map((type) => (
            <option key={type.type_id} value={type.type_id}>
              {type.type_name}
            </option>
          ))}
        </select>

        <Button
          onClick={handleReset}
          variant="outline"
          size="sm"
          className="col-span-2 sm:col-span-1 rounded-xl"
          aria-label="Réinitialiser la sélection de véhicule"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Mode mobile-premium (grille 2x2, labels, CTA orange, reset discret)
  if (mode === "mobile-premium") {
    // Calcul du champ actif (prochain a remplir)
    const activeField = !selectedBrand
      ? 0
      : !selectedYear
        ? 1
        : !selectedModel
          ? 2
          : !selectedType
            ? 3
            : -1;

    const fieldBase =
      "w-full h-12 rounded-2xl border px-3 text-[15px] shadow-sm transition-all appearance-none";
    const fieldActive =
      "bg-blue-50 border-blue-400 text-slate-800 ring-1 ring-blue-200";
    const fieldNeutral = "border-slate-200 bg-white text-slate-800";
    const fieldDisabled =
      "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed";

    const getFieldClass = (index: number, isDisabled: boolean) => {
      if (isDisabled) return `${fieldBase} ${fieldDisabled}`;
      if (activeField === index) return `${fieldBase} ${fieldActive}`;
      return `${fieldBase} ${fieldNeutral}`;
    };

    const canSearch = !!selectedType;

    const labelClass = (disabled: boolean) =>
      `mb-1.5 block text-[13px] font-semibold ${disabled ? "text-slate-400" : "text-slate-800"}`;

    return (
      <div className="space-y-3" data-nosnippet data-noindex>
        <div className="grid grid-cols-2 gap-2.5">
          {/* Marque */}
          <label className="block">
            <span className={labelClass(false)}>Marque</span>
            <div className="relative">
              <Car
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none"
              />
              <select
                value={selectedBrand?.marque_id || ""}
                onChange={(e) => handleBrandChange(Number(e.target.value))}
                disabled={loadingBrands}
                className={`${getFieldClass(0, false)} pl-8`}
                aria-label="Marque"
              >
                <option value="">
                  {loadingBrands ? "Chargement..." : "Sélectionner"}
                </option>
                {brands.map((brand) => (
                  <option key={brand.marque_id} value={brand.marque_id}>
                    {brand.marque_name}
                  </option>
                ))}
              </select>
            </div>
          </label>

          {/* Annee */}
          <label className="block">
            <span className={labelClass(!selectedBrand && !loadingYears)}>
              Année
            </span>
            <select
              value={selectedYear || ""}
              onChange={(e) => handleYearChange(Number(e.target.value))}
              disabled={!selectedBrand || loadingYears}
              className={getFieldClass(1, !selectedBrand && !loadingYears)}
              aria-label="Année"
            >
              <option value="">
                {loadingYears ? "Chargement..." : "Sélectionner"}
              </option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          {/* Modele */}
          <label className="block">
            <span
              className={labelClass(
                (!selectedBrand || !selectedYear) && !loadingModels,
              )}
            >
              Modèle
            </span>
            <select
              value={selectedModel?.modele_id || ""}
              onChange={(e) => handleModelChange(Number(e.target.value))}
              disabled={!selectedYear || loadingModels}
              className={getFieldClass(
                2,
                (!selectedBrand || !selectedYear) && !loadingModels,
              )}
              aria-label="Modèle"
            >
              <option value="">
                {loadingModels ? "Chargement..." : "Sélectionner"}
              </option>
              {models.map((model) => (
                <option key={model.modele_id} value={model.modele_id}>
                  {model.modele_name}
                </option>
              ))}
            </select>
          </label>

          {/* Motorisation */}
          <label className="block">
            <span className={labelClass(!selectedModel && !loadingTypes)}>
              Motorisation
            </span>
            <select
              value={selectedType?.type_id || ""}
              onChange={(e) => {
                const t = types.find(
                  (t) => t.type_id.toString() === e.target.value,
                );
                if (t) handleTypeSelect(t);
              }}
              disabled={!selectedModel || loadingTypes}
              className={getFieldClass(3, !selectedModel && !loadingTypes)}
              aria-label="Motorisation"
            >
              <option value="">
                {loadingTypes ? "Chargement..." : "Sélectionner"}
              </option>
              {types.map((type) => (
                <option key={type.type_id} value={type.type_id}>
                  {type.type_name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* CTA */}
        <Button
          onClick={() => {
            if (selectedType) handleTypeSelect(selectedType);
          }}
          disabled={!canSearch}
          className="w-full h-12 bg-cta rounded-2xl text-white text-[16px] font-semibold shadow-[0_12px_24px_rgba(249,115,22,0.28)] hover:bg-cta-hover active:translate-y-0 disabled:opacity-40 disabled:shadow-none"
        >
          Rechercher des pièces
        </Button>

        {/* Reset */}
        <button
          type="button"
          onClick={handleReset}
          className="mx-auto block text-[14px] font-medium text-slate-500 underline underline-offset-4 hover:text-slate-700 transition-colors py-2.5 min-h-[44px]"
        >
          Réinitialiser
        </button>
      </div>
    );
  }

  // 🎨 Mode full (vertical) - Design moderne avec Card + onglets
  return (
    <Card
      className={`bg-white/95 backdrop-blur-sm shadow-2xl border-0 ${className}`}
      data-nosnippet
      data-noindex
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-gray-900 text-center flex items-center justify-center gap-2">
          <Car className="w-5 h-5 text-blue-600" />
          {context === "homepage" && "Sélectionnez votre véhicule"}
          {context === "pieces" && "Trouvez les pièces compatibles"}
          {context === "detail" && "Changer de véhicule"}
          {context === "search" && "Recherche par véhicule"}
          {!context && "Sélectionnez votre véhicule"}
        </CardTitle>

        {/* Onglets de sélection du mode */}
        {enableTypeMineSearch && (
          <div className="flex gap-2 mt-4 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setSearchMode("vehicle")}
              className={`flex-1 px-4 py-2.5 min-h-[44px] rounded-md text-sm font-medium transition-all duration-200 ${
                searchMode === "vehicle"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Car className="w-4 h-4 inline mr-2" />
              Par véhicule
            </button>
            <button
              onClick={() => setSearchMode("mine")}
              className={`flex-1 px-4 py-2.5 min-h-[44px] rounded-md text-sm font-medium transition-all duration-200 ${
                searchMode === "mine"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Type Mine
              <span className="text-xs font-normal opacity-70 ml-1">
                (carte grise D.2)
              </span>
            </button>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Mode: Recherche par véhicule */}
          {searchMode === "vehicle" && (
            <>
              {/* Grid des sélecteurs - 4 colonnes responsive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Constructeur */}
                <div>
                  <label
                    htmlFor="brand-v2"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    <Car className="w-4 h-4 inline mr-1" />
                    Marque
                  </label>
                  <select
                    id="brand-v2"
                    value={selectedBrand?.marque_id || ""}
                    onChange={(e) => handleBrandChange(Number(e.target.value))}
                    onFocus={() =>
                      !brands.length && !loadingBrands && loadBrands()
                    }
                    disabled={loadingBrands}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {loadingBrands ? "Chargement..." : "Constructeur"}
                    </option>
                    {brands.map((brand) => (
                      <option key={brand.marque_id} value={brand.marque_id}>
                        {brand.marque_name} {brand.is_featured ? "⭐" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Année */}
                <div>
                  <label
                    htmlFor="year-v2"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Année
                  </label>
                  <select
                    id="year-v2"
                    value={selectedYear || ""}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    disabled={!selectedBrand || loadingYears}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {loadingYears ? "Chargement..." : "Année"}
                    </option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Modèle */}
                <div>
                  <label
                    htmlFor="model-v2"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    <Search className="w-4 h-4 inline mr-1" />
                    Modèle
                  </label>
                  <select
                    id="model-v2"
                    value={selectedModel?.modele_id || ""}
                    onChange={(e) => handleModelChange(Number(e.target.value))}
                    disabled={!selectedYear || loadingModels}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {loadingModels ? "Chargement..." : "Modèle"}
                    </option>
                    {models.map((model) => (
                      <option key={model.modele_id} value={model.modele_id}>
                        {model.modele_name}
                      </option>
                    ))}
                  </select>
                  {selectedYear && !loadingModels && models.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Essayez une autre année ou vérifiez la marque
                    </p>
                  )}
                </div>

                {/* Motorisation */}
                <div>
                  <label
                    htmlFor="type-v2"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    <Settings className="w-4 h-4 inline mr-1" />
                    Motorisation
                  </label>
                  <select
                    id="type-v2"
                    value={selectedType?.type_id || ""}
                    onChange={(e) => {
                      const selectedType = types.find(
                        (t) => t.type_id.toString() === e.target.value,
                      );
                      if (selectedType) handleTypeSelect(selectedType);
                    }}
                    disabled={!selectedModel || loadingTypes}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base text-gray-900 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    <option value="">
                      {loadingTypes ? "Chargement..." : "Motorisation"}
                    </option>
                    {types.map((type) => (
                      <option key={type.type_id} value={type.type_id}>
                        {type.type_name} ({type.type_fuel}) -{" "}
                        {type.type_power_ps} PS
                      </option>
                    ))}
                  </select>
                  {selectedModel && !loadingTypes && types.length > 1 && (
                    <p className="text-xs text-gray-400 mt-1">
                      Carte grise champ D.2 pour identifier la bonne
                      motorisation
                    </p>
                  )}
                </div>
              </div>

              {/* Indicateur de chargement */}
              {(loadingBrands ||
                loadingYears ||
                loadingModels ||
                loadingTypes) && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 text-sm text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Chargement...
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mode: Recherche par Type Mine */}
          {searchMode === "mine" && enableTypeMineSearch && (
            <div className="space-y-4">
              {/* Aide */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-purple-900">
                    <p className="font-medium mb-1">
                      Le Type Mine se trouve sur votre carte grise
                    </p>
                    <p className="text-purple-700">
                      Champ D.2 • Format : 10 à 15 caractères alphanumériques
                    </p>
                    <p className="text-purple-600 mt-2 font-mono text-xs">
                      Exemple : M10RENAAG0D001
                    </p>
                  </div>
                </div>
              </div>

              {/* Input Type Mine */}
              <div>
                <label
                  htmlFor="mineCode"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Code Type Mine
                </label>
                <input
                  id="mineCode"
                  type="text"
                  value={mineCode}
                  onChange={(e) => setMineCode(e.target.value.toUpperCase())}
                  placeholder="Ex: M10RENAAG0D001"
                  maxLength={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 bg-white font-mono uppercase"
                />
                {mineCode && mineCode.length < 5 && (
                  <p className="text-xs text-red-600 mt-1">
                    Minimum 5 caractères requis
                  </p>
                )}
              </div>

              {/* Bouton recherche */}
              <Button
                onClick={handleMineSearch}
                disabled={!mineCode || mineCode.length < 5}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-6 text-lg font-semibold disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed"
              >
                <Search className="w-5 h-5 mr-2" />
                Rechercher par Type Mine
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

export default VehicleSelector;
