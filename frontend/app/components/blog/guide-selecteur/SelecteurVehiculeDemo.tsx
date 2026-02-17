/**
 * Demo interactive du selecteur de vehicule
 * Utilise des donnees mockees pour illustrer les 4 methodes de recherche
 */

import { Link } from "@remix-run/react";
import {
  AlertTriangle,
  ArrowRight,
  Car,
  CheckCircle,
  FileSearch,
  Hash,
  Loader2,
  Package,
  RotateCcw,
  Search,
  Settings,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectItem } from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

/* ===========================================================================
   MOCK DATA
   =========================================================================== */

interface MockMotorisation {
  id: string;
  name: string;
  fuel: string;
  power: string;
  years: string;
}

interface MockModel {
  id: string;
  name: string;
  years: number[];
  motorisations: MockMotorisation[];
}

interface MockBrand {
  id: string;
  name: string;
  models: MockModel[];
}

const MOCK_BRANDS: MockBrand[] = [
  {
    id: "renault",
    name: "Renault",
    models: [
      {
        id: "clio-4",
        name: "Clio IV (2012-2019)",
        years: [2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012],
        motorisations: [
          {
            id: "clio4-tce90",
            name: "0.9 TCe 90ch",
            fuel: "Essence",
            power: "90ch",
            years: "2012-2019",
          },
          {
            id: "clio4-dci90",
            name: "1.5 dCi 90ch",
            fuel: "Diesel",
            power: "90ch",
            years: "2012-2019",
          },
          {
            id: "clio4-tce120",
            name: "1.2 TCe 120ch EDC",
            fuel: "Essence",
            power: "120ch",
            years: "2013-2019",
          },
        ],
      },
      {
        id: "megane-3",
        name: "Megane III (2008-2016)",
        years: [2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008],
        motorisations: [
          {
            id: "meg3-tce130",
            name: "1.2 TCe 130ch",
            fuel: "Essence",
            power: "130ch",
            years: "2012-2016",
          },
          {
            id: "meg3-dci110",
            name: "1.5 dCi 110ch",
            fuel: "Diesel",
            power: "110ch",
            years: "2009-2016",
          },
          {
            id: "meg3-dci130",
            name: "1.6 dCi 130ch",
            fuel: "Diesel",
            power: "130ch",
            years: "2011-2016",
          },
        ],
      },
    ],
  },
  {
    id: "peugeot",
    name: "Peugeot",
    models: [
      {
        id: "208-1",
        name: "208 I (2012-2019)",
        years: [2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012],
        motorisations: [
          {
            id: "208-puretech82",
            name: "1.2 PureTech 82ch",
            fuel: "Essence",
            power: "82ch",
            years: "2012-2019",
          },
          {
            id: "208-bhdi100",
            name: "1.6 BlueHDi 100ch",
            fuel: "Diesel",
            power: "100ch",
            years: "2014-2019",
          },
          {
            id: "208-gti",
            name: "1.6 THP 208ch GTi",
            fuel: "Essence",
            power: "208ch",
            years: "2013-2019",
          },
        ],
      },
      {
        id: "308-2",
        name: "308 II (2013-2021)",
        years: [2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013],
        motorisations: [
          {
            id: "308-puretech130",
            name: "1.2 PureTech 130ch EAT8",
            fuel: "Essence",
            power: "130ch",
            years: "2017-2021",
          },
          {
            id: "308-bhdi130",
            name: "1.5 BlueHDi 130ch",
            fuel: "Diesel",
            power: "130ch",
            years: "2017-2021",
          },
        ],
      },
    ],
  },
  {
    id: "volkswagen",
    name: "Volkswagen",
    models: [
      {
        id: "golf-7",
        name: "Golf VII (2012-2020)",
        years: [2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012],
        motorisations: [
          {
            id: "golf7-tsi110",
            name: "1.0 TSI 110ch",
            fuel: "Essence",
            power: "110ch",
            years: "2017-2020",
          },
          {
            id: "golf7-tdi150",
            name: "2.0 TDI 150ch DSG",
            fuel: "Diesel",
            power: "150ch",
            years: "2012-2020",
          },
          {
            id: "golf7-gti",
            name: "2.0 TSI 245ch GTI",
            fuel: "Essence",
            power: "245ch",
            years: "2017-2020",
          },
        ],
      },
    ],
  },
];

export const MOCK_VARIANT_ALERTS = [
  {
    title: "Variante disques de frein",
    description:
      "Ce vehicule existe avec 2 diametres de disques avant (283 mm et 302 mm). Mesurez vos disques actuels ou verifiez le code PR sur la plaque constructeur.",
    variant: "warning" as const,
  },
  {
    title: "Systeme Start & Stop",
    description:
      "Les vehicules Start & Stop necessitent des plaquettes specifiques (preparation LowMet) et une batterie AGM/EFB. Verifiez si votre vehicule est equipe.",
    variant: "info" as const,
  },
  {
    title: "Equipementier d'origine variable",
    description:
      "Ce modele a ete equipe en premiere monte par differents fournisseurs selon la periode de fabrication. Le type de fixation peut varier.",
    variant: "warning" as const,
  },
];

/* ===========================================================================
   TYPES
   =========================================================================== */

export interface SavedVehicleDemo {
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  year: number;
  motorisationId: string;
  motorisationName: string;
  fuel: string;
  power: string;
  savedAt: string;
}

const DEMO_STORAGE_KEY = "demoVehicle";

/* ===========================================================================
   VALIDATION HELPERS
   =========================================================================== */

const IMMAT_SIV = /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/;
const IMMAT_FNI = /^\d{1,4}\s?[A-Z]{1,3}\s?\d{2}$/;

function validateImmat(value: string): string {
  const cleaned = value.toUpperCase().trim();
  if (!cleaned) return "Veuillez saisir votre numero d'immatriculation.";
  if (!IMMAT_SIV.test(cleaned) && !IMMAT_FNI.test(cleaned.replace(/\s/g, ""))) {
    return "Format non reconnu — essayez avec ou sans tirets (ex : AA-123-BB ou 1234 AB 75).";
  }
  return "";
}

function validateVin(value: string): string {
  const cleaned = value.toUpperCase().trim();
  if (!cleaned) return "Veuillez saisir votre numero VIN.";
  if (cleaned.length !== 17)
    return `Le VIN doit contenir 17 caracteres, sans I, O, Q (${cleaned.length}/17).`;
  if (/[IOQ]/.test(cleaned))
    return "Le VIN ne peut pas contenir les lettres I, O ou Q (confusion avec 1 et 0).";
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(cleaned))
    return "Le VIN ne doit contenir que des lettres (sauf I, O, Q) et des chiffres.";
  return "";
}

function validateOem(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return "Veuillez saisir un numero de reference OEM.";
  if (cleaned.length < 5)
    return "La reference OEM doit contenir au moins 5 caracteres.";
  if (cleaned.length > 20)
    return "La reference OEM ne doit pas depasser 20 caracteres.";
  return "";
}

/* ===========================================================================
   SUB-COMPONENTS
   =========================================================================== */

export function VehicleBanner({
  vehicle,
  onClear,
}: {
  vehicle: SavedVehicleDemo;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
      <Car className="h-5 w-5 text-green-700" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-green-800">
          Votre vehicule :
        </span>
        <Badge className="border-green-300 bg-white text-green-800">
          {vehicle.brandName} {vehicle.modelName}
        </Badge>
        <Badge variant="outline" className="text-green-700">
          {vehicle.motorisationName}
        </Badge>
        <Badge variant="outline" className="text-green-700">
          {vehicle.year}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClear}
        className="ml-auto text-green-700 hover:bg-green-100 hover:text-green-900"
      >
        <RotateCcw className="mr-1 h-3.5 w-3.5" />
        Changer
      </Button>
    </div>
  );
}

function LoadingSimulation() {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-gray-50 p-4"
      role="status"
    >
      <Loader2 className="h-5 w-5 animate-spin text-green-600" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-700">
          Identification du vehicule en cours...
        </p>
        <p className="text-xs text-gray-500">
          Recherche dans la base de donnees constructeur
        </p>
      </div>
    </div>
  );
}

/* ===========================================================================
   MAIN COMPONENT
   =========================================================================== */

export const SelecteurVehiculeDemo = memo(function SelecteurVehiculeDemo() {
  // --- localStorage persistence ---
  const [savedVehicle, setSavedVehicle] = useState<SavedVehicleDemo | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(DEMO_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedVehicleDemo;
        if (parsed?.brandId && parsed?.modelId && parsed?.motorisationId) {
          setSavedVehicle(parsed);
        }
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const saveVehicle = useCallback((vehicle: SavedVehicleDemo) => {
    setSavedVehicle(vehicle);
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(vehicle));
    } catch {
      // silently fail
    }
  }, []);

  const clearVehicle = useCallback(() => {
    setSavedVehicle(null);
    setIsConfirmed(false);
    setShowVariants(false);
    try {
      localStorage.removeItem(DEMO_STORAGE_KEY);
    } catch {
      // silently fail
    }
  }, []);

  // --- Manual mode ---
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMoto, setSelectedMoto] = useState("");

  const availableModels = useMemo(() => {
    if (!selectedBrand) return [];
    return MOCK_BRANDS.find((b) => b.id === selectedBrand)?.models ?? [];
  }, [selectedBrand]);

  const availableYears = useMemo(() => {
    if (!selectedModel) return [];
    return availableModels.find((m) => m.id === selectedModel)?.years ?? [];
  }, [selectedModel, availableModels]);

  const availableMotos = useMemo(() => {
    if (!selectedModel) return [];
    return (
      availableModels.find((m) => m.id === selectedModel)?.motorisations ?? []
    );
  }, [selectedModel, availableModels]);

  const isManualComplete =
    selectedBrand && selectedModel && selectedYear && selectedMoto;

  // --- Immatriculation mode ---
  const [immatValue, setImmatValue] = useState("");
  const [immatError, setImmatError] = useState("");

  // --- VIN mode ---
  const [vinValue, setVinValue] = useState("");
  const [vinError, setVinError] = useState("");

  // --- OEM mode ---
  const [oemValue, setOemValue] = useState("");
  const [oemError, setOemError] = useState("");

  // --- Shared states ---
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showVariants, setShowVariants] = useState(false);

  const confirmRef = useRef<HTMLDivElement>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // --- Handlers ---

  const handleBrandChange = useCallback((value: string) => {
    setSelectedBrand(value);
    setSelectedModel("");
    setSelectedYear("");
    setSelectedMoto("");
    setIsConfirmed(false);
    setShowVariants(false);
  }, []);

  const handleModelChange = useCallback((value: string) => {
    setSelectedModel(value);
    setSelectedYear("");
    setSelectedMoto("");
    setIsConfirmed(false);
    setShowVariants(false);
  }, []);

  const handleYearChange = useCallback((value: string) => {
    setSelectedYear(value);
    setSelectedMoto("");
    setIsConfirmed(false);
    setShowVariants(false);
  }, []);

  const handleMotoChange = useCallback((value: string) => {
    setSelectedMoto(value);
    setIsConfirmed(false);
    setShowVariants(false);
  }, []);

  const buildVehicleFromManual = useCallback((): SavedVehicleDemo | null => {
    const brand = MOCK_BRANDS.find((b) => b.id === selectedBrand);
    const model = brand?.models.find((m) => m.id === selectedModel);
    const moto = model?.motorisations.find((mt) => mt.id === selectedMoto);
    if (!brand || !model || !moto || !selectedYear) return null;
    return {
      brandId: brand.id,
      brandName: brand.name,
      modelId: model.id,
      modelName: model.name,
      year: parseInt(selectedYear, 10),
      motorisationId: moto.id,
      motorisationName: moto.name,
      fuel: moto.fuel,
      power: moto.power,
      savedAt: new Date().toISOString(),
    };
  }, [selectedBrand, selectedModel, selectedYear, selectedMoto]);

  const scrollToConfirm = useCallback(() => {
    setTimeout(() => {
      confirmRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      confirmRef.current?.focus();
    }, 100);
  }, []);

  const handleManualConfirm = useCallback(() => {
    const vehicle = buildVehicleFromManual();
    if (!vehicle) return;
    setIsLoading(true);
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setIsConfirmed(true);
      setShowVariants(true);
      saveVehicle(vehicle);
      scrollToConfirm();
    }, 800);
  }, [buildVehicleFromManual, saveVehicle, scrollToConfirm]);

  const handleImmatSubmit = useCallback(() => {
    const error = validateImmat(immatValue);
    setImmatError(error);
    if (error) return;
    setIsLoading(true);
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      const mockResult: SavedVehicleDemo = {
        brandId: "renault",
        brandName: "Renault",
        modelId: "clio-4",
        modelName: "Clio IV (2012-2019)",
        year: 2017,
        motorisationId: "clio4-tce90",
        motorisationName: "0.9 TCe 90ch",
        fuel: "Essence",
        power: "90ch",
        savedAt: new Date().toISOString(),
      };
      setIsConfirmed(true);
      setShowVariants(true);
      saveVehicle(mockResult);
      scrollToConfirm();
    }, 1500);
  }, [immatValue, saveVehicle, scrollToConfirm]);

  const handleVinSubmit = useCallback(() => {
    const error = validateVin(vinValue);
    setVinError(error);
    if (error) return;
    setIsLoading(true);
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      const mockResult: SavedVehicleDemo = {
        brandId: "peugeot",
        brandName: "Peugeot",
        modelId: "308-2",
        modelName: "308 II (2013-2021)",
        year: 2019,
        motorisationId: "308-puretech130",
        motorisationName: "1.2 PureTech 130ch EAT8",
        fuel: "Essence",
        power: "130ch",
        savedAt: new Date().toISOString(),
      };
      setIsConfirmed(true);
      setShowVariants(true);
      saveVehicle(mockResult);
      scrollToConfirm();
    }, 1500);
  }, [vinValue, saveVehicle, scrollToConfirm]);

  const handleOemSubmit = useCallback(() => {
    const error = validateOem(oemValue);
    setOemError(error);
    if (error) return;
    setIsLoading(true);
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setIsConfirmed(true);
      setShowVariants(false);
      scrollToConfirm();
    }, 1500);
  }, [oemValue, scrollToConfirm]);

  const handleReset = useCallback(() => {
    clearVehicle();
    setSelectedBrand("");
    setSelectedModel("");
    setSelectedYear("");
    setSelectedMoto("");
    setImmatValue("");
    setImmatError("");
    setVinValue("");
    setVinError("");
    setOemValue("");
    setOemError("");
    setTimeout(() => document.getElementById("demo-brand")?.focus(), 100);
  }, [clearVehicle]);

  // --- Render: saved vehicle summary ---
  if (savedVehicle && !isLoading) {
    return (
      <Card className="border-2 border-green-200" id="demo-selecteur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5 text-green-600" />
            Testez le selecteur de vehicule
            <Badge className="ml-auto border-green-300 bg-green-50 text-green-700">
              Demo
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <VehicleBanner vehicle={savedVehicle} onClear={handleReset} />

          <p className="text-sm text-gray-600">
            Une fois confirme, votre vehicule filtre automatiquement toutes les
            pages pieces.
          </p>

          {showVariants && (
            <div
              className="space-y-3"
              role="region"
              aria-label="Alertes de variantes"
            >
              <p className="text-sm font-medium text-gray-700">
                Alertes de compatibilite detectees pour ce vehicule :
              </p>
              {MOCK_VARIANT_ALERTS.map((alert, i) => (
                <Alert key={i} variant={alert.variant}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{alert.title}</AlertTitle>
                  <AlertDescription>{alert.description}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/">
                Rechercher mes pieces compatibles
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-1 h-4 w-4" />
              Changer de vehicule
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-green-200" id="demo-selecteur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Car className="h-5 w-5 text-green-600" />
          Testez le selecteur de vehicule
          <Badge className="ml-auto border-green-300 bg-green-50 text-green-700">
            Demo interactive
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="mb-4 w-full">
            <TabsTrigger
              value="immatriculation"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
            >
              <Hash className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Immatriculation</span>
              <span className="sm:hidden">Immat.</span>
            </TabsTrigger>
            <TabsTrigger
              value="vin"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
            >
              <FileSearch className="h-3.5 w-3.5" />
              VIN
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Manuelle</span>
              <span className="sm:hidden">Manuel</span>
            </TabsTrigger>
            <TabsTrigger
              value="oem"
              className="flex-1 gap-1.5 text-xs sm:text-sm"
            >
              <Package className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Ref. OEM</span>
              <span className="sm:hidden">OEM</span>
            </TabsTrigger>
          </TabsList>

          {/* --- Immatriculation Tab --- */}
          <TabsContent value="immatriculation" className="space-y-4">
            <p className="text-sm text-gray-600">
              Recherchez vos pieces auto par plaque d'immatriculation pour
              identifier votre vehicule instantanement.
            </p>
            <div className="space-y-2">
              <Label htmlFor="demo-immat">Numero d'immatriculation</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="demo-immat"
                  placeholder="AA-123-BB"
                  value={immatValue}
                  onChange={(e) => {
                    setImmatValue(e.target.value.toUpperCase());
                    if (immatError) setImmatError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleImmatSubmit();
                  }}
                  aria-invalid={!!immatError}
                  aria-describedby={immatError ? "demo-immat-error" : undefined}
                  className="sm:max-w-xs font-mono uppercase"
                  maxLength={12}
                />
                <Button
                  onClick={handleImmatSubmit}
                  disabled={isLoading || !immatValue.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-1 h-4 w-4" />
                  )}
                  Rechercher
                </Button>
              </div>
              {immatError && (
                <p
                  id="demo-immat-error"
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {immatError}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Format SIV (AA-123-BB) ou ancien format FNI (1234 AB 75). Vous
                pouvez aussi utiliser votre carte grise pour trouver vos pieces
                auto.
              </p>
            </div>
            {isLoading && <LoadingSimulation />}
          </TabsContent>

          {/* --- VIN Tab --- */}
          <TabsContent value="vin" className="space-y-4">
            <p className="text-sm text-gray-600">
              Le numero VIN (17 caracteres) permet l'identification la plus
              precise de votre vehicule. Ideal pour trouver une piece auto avec
              le numero de chassis.
            </p>
            <div className="space-y-2">
              <Label htmlFor="demo-vin">Numero VIN (17 caracteres)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="demo-vin"
                  placeholder="VF3LCBHZXJS123456"
                  value={vinValue}
                  onChange={(e) => {
                    setVinValue(e.target.value.toUpperCase());
                    if (vinError) setVinError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleVinSubmit();
                  }}
                  aria-invalid={!!vinError}
                  aria-describedby={vinError ? "demo-vin-error" : undefined}
                  className="sm:max-w-sm font-mono uppercase"
                  maxLength={17}
                />
                <Button
                  onClick={handleVinSubmit}
                  disabled={isLoading || !vinValue.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-1 h-4 w-4" />
                  )}
                  Decoder
                </Button>
              </div>
              {vinError && (
                <p
                  id="demo-vin-error"
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {vinError}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {vinValue.length}/17 caracteres — visible sur la carte grise
                (champ E) ou le pare-brise. Permet de trouver le code moteur
                avec le VIN gratuitement.
              </p>
            </div>
            {isLoading && <LoadingSimulation />}
          </TabsContent>

          {/* --- Manual Tab --- */}
          <TabsContent value="manual" className="space-y-4">
            <p className="text-sm text-gray-600">
              Utilisez le selecteur de vehicule pieces auto pour selectionner
              votre vehicule etape par etape. Les options s'affinent
              automatiquement.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="demo-brand">Marque</Label>
                <Select
                  id="demo-brand"
                  value={selectedBrand}
                  onValueChange={handleBrandChange}
                  placeholder="-- Choisir la marque --"
                  aria-label="Selectionner la marque"
                >
                  {MOCK_BRANDS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-model">Modele</Label>
                <Select
                  id="demo-model"
                  value={selectedModel}
                  onValueChange={handleModelChange}
                  disabled={!selectedBrand}
                  placeholder="-- Choisir le modele --"
                  aria-label="Selectionner le modele"
                >
                  {availableModels.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-year">Annee</Label>
                <Select
                  id="demo-year"
                  value={selectedYear}
                  onValueChange={handleYearChange}
                  disabled={!selectedModel}
                  placeholder="-- Choisir l'annee --"
                  aria-label="Selectionner l'annee"
                >
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={y.toString()}>
                      {y}
                    </SelectItem>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="demo-moto">Motorisation</Label>
                <Select
                  id="demo-moto"
                  value={selectedMoto}
                  onValueChange={handleMotoChange}
                  disabled={!selectedYear}
                  placeholder="-- Choisir la motorisation --"
                  aria-label="Selectionner la motorisation"
                >
                  {availableMotos.map((mt) => (
                    <SelectItem key={mt.id} value={mt.id}>
                      {mt.name} ({mt.fuel})
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>

            {isManualComplete && !isConfirmed && (
              <div
                ref={confirmRef}
                tabIndex={-1}
                className="space-y-3 rounded-lg border border-green-200 bg-green-50/50 p-4"
                role="region"
                aria-label="Resume du vehicule selectionne"
              >
                <p className="text-sm font-medium text-green-800">
                  Vehicule selectionne :
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {MOCK_BRANDS.find((b) => b.id === selectedBrand)?.name}
                  </Badge>
                  <Badge variant="outline">
                    {availableModels.find((m) => m.id === selectedModel)?.name}
                  </Badge>
                  <Badge variant="outline">{selectedYear}</Badge>
                  <Badge variant="outline">
                    {availableMotos.find((mt) => mt.id === selectedMoto)?.name}
                  </Badge>
                </div>
                <Button
                  onClick={handleManualConfirm}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-1 h-4 w-4" />
                  )}
                  Confirmer et enregistrer
                </Button>
              </div>
            )}

            {isLoading && <LoadingSimulation />}

            {isConfirmed && savedVehicle && (
              <div
                ref={confirmRef}
                tabIndex={-1}
                className="space-y-3"
                role="region"
                aria-label="Vehicule confirme"
              >
                <Alert variant="success">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Vehicule enregistre</AlertTitle>
                  <AlertDescription>
                    {savedVehicle.brandName} {savedVehicle.modelName} —{" "}
                    {savedVehicle.motorisationName} ({savedVehicle.year}). Votre
                    vehicule filtre automatiquement toutes les pages pieces.
                  </AlertDescription>
                </Alert>

                {showVariants && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">
                      Points de vigilance pour ce vehicule :
                    </p>
                    {MOCK_VARIANT_ALERTS.map((alert, i) => (
                      <Alert key={i} variant={alert.variant} size="sm">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>{alert.title}</AlertTitle>
                        <AlertDescription>{alert.description}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/">
                      Rechercher mes pieces
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Changer de vehicule
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* --- OEM Tab --- */}
          <TabsContent value="oem" className="space-y-4">
            <p className="text-sm text-gray-600">
              Cherchez une piece detachee par sa reference OEM (numero d'origine
              equipementier) pour trouver l'equivalent exact ou les alternatives
              compatibles.
            </p>
            <div className="space-y-2">
              <Label htmlFor="demo-oem">Reference OEM</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="demo-oem"
                  placeholder="0 986 478 868"
                  value={oemValue}
                  onChange={(e) => {
                    setOemValue(e.target.value);
                    if (oemError) setOemError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleOemSubmit();
                  }}
                  aria-invalid={!!oemError}
                  aria-describedby={oemError ? "demo-oem-error" : undefined}
                  className="sm:max-w-xs font-mono"
                  maxLength={20}
                />
                <Button
                  onClick={handleOemSubmit}
                  disabled={isLoading || !oemValue.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-1 h-4 w-4" />
                  )}
                  Rechercher
                </Button>
              </div>
              {oemError && (
                <p
                  id="demo-oem-error"
                  className="text-sm text-red-600"
                  role="alert"
                >
                  {oemError}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Le numero OEM est grave ou imprime sur la piece d'origine (ex :
                0 986 478 868 pour Bosch, 8200 123 456 pour Renault).
              </p>
            </div>

            {isLoading && <LoadingSimulation />}

            {isConfirmed && (
              <div
                ref={confirmRef}
                tabIndex={-1}
                className="space-y-3"
                role="region"
                aria-label="Piece trouvee par reference OEM"
              >
                <Alert variant="success">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Piece identifiee</AlertTitle>
                  <AlertDescription>
                    Bosch — Disque de frein avant O280mm. Reference OEM :{" "}
                    {oemValue || "0 986 478 868"}. 3 equivalences trouvees chez
                    d'autres equipementiers.
                  </AlertDescription>
                </Alert>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/">
                      Voir les equivalences
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Nouvelle recherche
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
});
