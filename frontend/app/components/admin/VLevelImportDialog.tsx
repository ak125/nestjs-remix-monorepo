/**
 * V-Level Import Dialog
 * @description Dialog modal pour importer des fichiers CSV de keywords V-Level
 * @aligned AI-COS Architecture - CSV Import Pipeline
 */

import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface VLevelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gammeName: string;
  pgId: number;
  onSuccess?: () => void;
}

interface ImportStats {
  totalRows: number;
  parsedSuccessfully: number;
  parseErrors: number;
  vlevelCalculated: number;
  inserted?: number;
  updated?: number;
}

interface PreviewItem {
  keyword: string;
  variant: string | null;
  calculatedVLevel: string;
  volume: number;
  volume_global?: number;
  planBUsed: boolean;
  model: string | null;
  energy: string | null;
}

interface ImportResult {
  success: boolean;
  message: string;
  stats?: ImportStats;
  preview?: PreviewItem[];
  errors?: string[];
}

export function VLevelImportDialog({
  open,
  onOpenChange,
  gammeName,
  pgId: _pgId,
  onSuccess,
}: VLevelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const url = `/api/admin/gammes-seo/import-vlevel-csv?gamme=${encodeURIComponent(gammeName)}&dryRun=${isDryRun}`;

      const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json();

      // Handle API response format (may be wrapped in data)
      const resultData = data.data || data;
      setResult(resultData);

      if (!isDryRun && resultData.success) {
        onSuccess?.();
      }
    } catch (error) {
      setResult({
        success: false,
        message: `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setFile(null);
    setResult(null);
    setIsDryRun(true);
  };

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (!newOpen) {
      resetDialog();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import V-Level CSV - {gammeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Zone */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv"
              // eslint-disable-next-line no-restricted-syntax -- Hidden file input is intentional
              className="hidden"
            />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  Changer
                </Button>
              </div>
            ) : (
              <div>
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Selectionner un fichier CSV
                </Button>
                <p className="text-sm text-gray-500 mt-2">
                  Colonnes: keyword, gamme, volume, model, generation, variant,
                  energy
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Optionnel: volume_global (pour Plan B)
                </p>
              </div>
            )}
          </div>

          {/* Options */}
          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDryRun}
                onChange={(e) => setIsDryRun(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm">Mode previsualisation (dry run)</span>
            </label>
            {!isDryRun && (
              <span className="text-xs text-orange-600 font-medium">
                Les donnees seront enregistrees en base
              </span>
            )}
          </div>

          {/* Results */}
          {result && (
            <div
              className={`rounded-lg p-4 ${
                result.success
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">{result.message}</span>
              </div>

              {/* Stats Grid */}
              {result.stats && (
                <div className="grid grid-cols-4 gap-2 text-sm mt-3">
                  <div className="bg-white rounded p-2 text-center shadow-sm">
                    <div className="font-bold text-lg">
                      {result.stats.totalRows}
                    </div>
                    <div className="text-gray-500 text-xs">Lignes</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center shadow-sm">
                    <div className="font-bold text-lg text-green-600">
                      {result.stats.parsedSuccessfully}
                    </div>
                    <div className="text-gray-500 text-xs">Parsees</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center shadow-sm">
                    <div className="font-bold text-lg text-red-600">
                      {result.stats.parseErrors}
                    </div>
                    <div className="text-gray-500 text-xs">Erreurs</div>
                  </div>
                  <div className="bg-white rounded p-2 text-center shadow-sm">
                    <div className="font-bold text-lg text-blue-600">
                      {result.stats.vlevelCalculated}
                    </div>
                    <div className="text-gray-500 text-xs">V-Levels</div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {result.preview && result.preview.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2 text-sm">
                    Apercu des resultats ({result.preview.length} premiers):
                  </h4>
                  <div className="max-h-48 overflow-y-auto border rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">
                            Variante
                          </th>
                          <th className="px-2 py-1.5 text-center font-medium">
                            V-Level
                          </th>
                          <th className="px-2 py-1.5 text-center font-medium">
                            Volume
                          </th>
                          <th className="px-2 py-1.5 text-center font-medium">
                            Plan B
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.preview.map((item, i) => (
                          <tr key={i} className="border-b hover:bg-gray-50">
                            <td className="px-2 py-1.5">
                              <div className="truncate max-w-[200px]">
                                {item.variant || item.keyword}
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.model} {item.energy}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <Badge
                                variant={
                                  item.calculatedVLevel === "V2"
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  item.calculatedVLevel === "V2"
                                    ? "bg-blue-500"
                                    : item.calculatedVLevel === "V3"
                                      ? "bg-green-500"
                                      : ""
                                }
                              >
                                {item.calculatedVLevel}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5 text-center font-mono">
                              {item.volume}
                              {item.volume_global && (
                                <span className="text-xs text-gray-400 block">
                                  ({item.volume_global})
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              {item.planBUsed && (
                                <Badge
                                  variant="outline"
                                  className="text-orange-600 border-orange-300"
                                >
                                  Plan B
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Parse Errors */}
              {result.errors && result.errors.length > 0 && (
                <div className="mt-3 text-sm">
                  <p className="font-medium text-red-700 mb-1">
                    Erreurs de parsing:
                  </p>
                  <ul className="list-disc list-inside text-red-600 text-xs space-y-0.5 max-h-24 overflow-y-auto">
                    {result.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 10 && (
                      <li className="text-gray-500">
                        ... et {result.errors.length - 10} autres erreurs
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Import en cours...
              </>
            ) : isDryRun ? (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Previsualiser
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Importer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
