/**
 * SEO Tab Content for Admin Gamme SEO Detail page
 * Handles meta title, description, H1, content, and switch variations
 */

import { useFetcher } from "@remix-run/react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  Save,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { type GammeDetail, type SeoFormState } from "./types";
import { getCharCountClass, getCharCountStatus } from "./utils";

interface SeoTabContentProps {
  detail: GammeDetail;
  seoForm: SeoFormState;
  setSeoForm: (form: SeoFormState) => void;
  pgId: number;
}

const MAX_VISIBLE_VARIATIONS = 5;

export function SeoTabContent({
  detail,
  seoForm,
  setSeoForm,
  pgId,
}: SeoTabContentProps) {
  const fetcher = useFetcher();

  // Local state for expandable switches
  const [expandedSwitches, setExpandedSwitches] = useState<Set<string>>(
    new Set(),
  );
  const [showAllVariations, setShowAllVariations] = useState<Set<string>>(
    new Set(),
  );

  // State for Family Switches editing
  const [editingSwitch, setEditingSwitch] = useState<{
    id: number;
    content: string;
  } | null>(null);
  const [newSwitchAlias, setNewSwitchAlias] = useState<number | null>(null);
  const [newSwitchContent, setNewSwitchContent] = useState("");
  const [switchSaving, setSwitchSaving] = useState(false);

  const toggleSwitch = (alias: string) => {
    setExpandedSwitches((prev) => {
      const next = new Set(prev);
      if (next.has(alias)) {
        next.delete(alias);
      } else {
        next.add(alias);
      }
      return next;
    });
  };

  const toggleShowAllVariations = (key: string) => {
    setShowAllVariations((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Handlers for Family Switches CRUD
  const handleCreateSwitch = async (alias: number, content: string) => {
    setSwitchSaving(true);
    try {
      const response = await fetch(`/api/admin/gammes-seo/${pgId}/switches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, content }),
      });
      const result = await response.json();
      if (result.success) {
        setNewSwitchAlias(null);
        setNewSwitchContent("");
        window.location.reload();
      } else {
        alert(result.message || "Erreur lors de la creation");
      }
    } catch {
      alert("Erreur reseau");
    } finally {
      setSwitchSaving(false);
    }
  };

  const handleUpdateSwitch = async (id: number, content: string) => {
    setSwitchSaving(true);
    try {
      const response = await fetch(
        `/api/admin/gammes-seo/${pgId}/switches/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const result = await response.json();
      if (result.success) {
        setEditingSwitch(null);
        window.location.reload();
      } else {
        alert(result.message || "Erreur lors de la mise a jour");
      }
    } catch {
      alert("Erreur reseau");
    } finally {
      setSwitchSaving(false);
    }
  };

  const handleDeleteSwitch = async (id: number) => {
    if (!confirm("Supprimer ce switch ?")) return;
    setSwitchSaving(true);
    try {
      const response = await fetch(
        `/api/admin/gammes-seo/${pgId}/switches/${id}`,
        {
          method: "DELETE",
        },
      );
      const result = await response.json();
      if (result.success) {
        window.location.reload();
      } else {
        alert(result.message || "Erreur lors de la suppression");
      }
    } catch {
      alert("Erreur reseau");
    } finally {
      setSwitchSaving(false);
    }
  };

  return (
    <>
      {/* Google Preview */}
      <Card className="mb-6 border-blue-200 bg-gradient-to-r from-blue-50 to-white">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Apercu Google</CardTitle>
          </div>
          <CardDescription>
            Previsualisation de l'affichage dans les resultats de recherche
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-white p-4 rounded-lg border shadow-sm max-w-2xl">
            {/* URL */}
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                <span className="text-xs font-bold text-orange-600">A</span>
              </div>
              <div>
                <span className="text-sm text-gray-700">automecanik.com</span>
                <span className="text-sm text-gray-500">
                  {" "}
                  &gt; pieces &gt; {detail.gamme.pg_alias}
                </span>
              </div>
            </div>
            {/* Title */}
            <h3 className="text-xl text-blue-800 hover:underline cursor-pointer mb-1 leading-tight">
              {seoForm.sg_title || detail.gamme.pg_name || "Titre de la page"}
            </h3>
            {/* Description */}
            <p className="text-sm text-gray-600 leading-relaxed">
              {seoForm.sg_descrip ||
                "Ajoutez une meta description pour voir l'apercu..."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Donnees SEO</CardTitle>
          <CardDescription>
            Meta title, description, H1 et contenu de la page gamme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="updateSeo" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sg_title" className="flex items-center gap-2">
                  Meta Title
                  {seoForm.sg_title.length > 0 &&
                    seoForm.sg_title.length <= 60 && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  {seoForm.sg_title.length > 60 &&
                    seoForm.sg_title.length <= 70 && (
                      <AlertCircle className="h-4 w-4 text-yellow-500" />
                    )}
                  {seoForm.sg_title.length > 70 && (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </Label>
                <Input
                  id="sg_title"
                  name="sg_title"
                  value={seoForm.sg_title}
                  onChange={(e) =>
                    setSeoForm({ ...seoForm, sg_title: e.target.value })
                  }
                  placeholder="Titre SEO"
                  className={
                    seoForm.sg_title.length > 70 ? "border-red-300" : ""
                  }
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          seoForm.sg_title.length <= 60
                            ? "bg-green-500"
                            : seoForm.sg_title.length <= 70
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min((seoForm.sg_title.length / 70) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span
                      className={`text-xs font-medium ${getCharCountClass(seoForm.sg_title.length, 60, 70)}`}
                    >
                      {getCharCountStatus(seoForm.sg_title.length, 60, 70)}
                    </span>
                  </div>
                  <span
                    className={`text-xs ${getCharCountClass(seoForm.sg_title.length, 60, 70)}`}
                  >
                    {seoForm.sg_title.length}/60 caracteres
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sg_h1">H1</Label>
                <Input
                  id="sg_h1"
                  name="sg_h1"
                  value={seoForm.sg_h1}
                  onChange={(e) =>
                    setSeoForm({ ...seoForm, sg_h1: e.target.value })
                  }
                  placeholder="Titre H1"
                />
                <p className="text-xs text-gray-400">
                  Le H1 s'affiche sur la page, pas dans Google
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sg_descrip" className="flex items-center gap-2">
                Meta Description
                {seoForm.sg_descrip.length > 0 &&
                  seoForm.sg_descrip.length <= 160 && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                {seoForm.sg_descrip.length > 160 &&
                  seoForm.sg_descrip.length <= 180 && (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                {seoForm.sg_descrip.length > 180 && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </Label>
              <Textarea
                id="sg_descrip"
                name="sg_descrip"
                value={seoForm.sg_descrip}
                onChange={(e) =>
                  setSeoForm({ ...seoForm, sg_descrip: e.target.value })
                }
                placeholder="Description SEO"
                rows={3}
                className={
                  seoForm.sg_descrip.length > 180 ? "border-red-300" : ""
                }
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        seoForm.sg_descrip.length <= 160
                          ? "bg-green-500"
                          : seoForm.sg_descrip.length <= 180
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min((seoForm.sg_descrip.length / 180) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span
                    className={`text-xs font-medium ${getCharCountClass(seoForm.sg_descrip.length, 160, 180)}`}
                  >
                    {getCharCountStatus(seoForm.sg_descrip.length, 160, 180)}
                  </span>
                </div>
                <span
                  className={`text-xs ${getCharCountClass(seoForm.sg_descrip.length, 160, 180)}`}
                >
                  {seoForm.sg_descrip.length}/160 caracteres
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sg_keywords">Keywords</Label>
              <Input
                id="sg_keywords"
                name="sg_keywords"
                value={seoForm.sg_keywords}
                onChange={(e) =>
                  setSeoForm({ ...seoForm, sg_keywords: e.target.value })
                }
                placeholder="Mots-cles separes par des virgules"
              />
              {seoForm.sg_keywords && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {seoForm.sg_keywords.split(",").map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {kw.trim()}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sg_content" className="flex items-center gap-2">
                Contenu
                <span className="text-xs text-gray-400 font-normal">
                  ({seoForm.sg_content.length} caracteres)
                </span>
              </Label>
              <Textarea
                id="sg_content"
                name="sg_content"
                value={seoForm.sg_content}
                onChange={(e) =>
                  setSeoForm({ ...seoForm, sg_content: e.target.value })
                }
                placeholder="Contenu principal de la page"
                rows={6}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={fetcher.state === "submitting"}>
                <Save className="mr-2 h-4 w-4" />
                {fetcher.state === "submitting"
                  ? "Sauvegarde..."
                  : "Sauvegarder"}
              </Button>
            </div>
          </fetcher.Form>

          {/* Item Switches */}
          {detail.switchGroups && detail.switchGroups.length > 0 && (
            <div className="mt-8 border-t pt-6">
              <h3 className="mb-4 text-lg font-medium">
                Item Switches{" "}
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  #Switch_1#, #Switch_2#, #Switch_3#
                </code>
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Switches d'items (alias 1-3). Cliquez pour voir les variations.
              </p>
              <div className="space-y-3">
                {[...detail.switchGroups]
                  .sort((a, b) => parseInt(a.alias) - parseInt(b.alias))
                  .map((group) => {
                    const isOpen = expandedSwitches.has(group.alias);
                    return (
                      <div
                        key={group.alias}
                        className="bg-gray-50 rounded-lg border"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSwitch(group.alias)}
                          className="w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-t-lg"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                                group.usedInTemplate
                                  ? "bg-green-100 text-green-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {group.usedInTemplate ? "\u2713" : "!"}
                            </span>
                            <span className="font-medium text-gray-900">
                              #{group.alias} -{" "}
                              {group.name || `Alias ${group.alias}`}
                            </span>
                            <code className="text-xs bg-gray-200 px-1 rounded">
                              {group.placeholder || `#Switch_${group.alias}#`}
                            </code>
                            <Badge variant="secondary">
                              {group.count} variations
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 max-w-xs truncate">
                              {group.sample || "(vide)"}
                            </span>
                            {isOpen ? (
                              <ChevronUp className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-500" />
                            )}
                          </div>
                        </button>

                        {isOpen &&
                          (() => {
                            const switchKey = `item_${group.alias}`;
                            const showAll = showAllVariations.has(switchKey);
                            const visibleVariations = showAll
                              ? group.variations
                              : group.variations.slice(
                                  0,
                                  MAX_VISIBLE_VARIATIONS,
                                );
                            const hiddenCount =
                              group.variations.length - MAX_VISIBLE_VARIATIONS;

                            return (
                              <div className="border-t p-4 space-y-2">
                                {visibleVariations.map((variation, idx) => (
                                  <div
                                    key={variation.sis_id}
                                    className="flex items-center gap-2 p-2 bg-white rounded border text-sm"
                                  >
                                    <span className="text-gray-400 w-6">
                                      #{idx + 1}
                                    </span>
                                    <span className="flex-1 text-gray-700">
                                      {variation.content || "(vide)"}
                                    </span>
                                  </div>
                                ))}
                                {hiddenCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      toggleShowAllVariations(switchKey)
                                    }
                                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  >
                                    {showAll
                                      ? "\u25B2 Reduire"
                                      : `\u25BC Voir les ${hiddenCount} autres variations`}
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Family Switches */}
          {detail.familySwitchGroups &&
            detail.familySwitchGroups.length > 0 && (
              <div className="mt-8 border-t pt-6">
                <h3 className="mb-4 text-lg font-medium">
                  Family Switches{" "}
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    #FamilySwitch_11# ... #FamilySwitch_16#
                  </code>
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Switches de famille (alias 11-16). Cliquez pour voir les
                  variations.
                </p>
                <div className="space-y-3">
                  {[...detail.familySwitchGroups]
                    .sort((a, b) => parseInt(a.alias) - parseInt(b.alias))
                    .map((group) => {
                      const isOpen = expandedSwitches.has(
                        `family_${group.alias}`,
                      );
                      return (
                        <div
                          key={`family_${group.alias}`}
                          className="bg-blue-50 rounded-lg border border-blue-200"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              toggleSwitch(`family_${group.alias}`)
                            }
                            className="w-full p-4 flex items-center justify-between hover:bg-blue-100 transition-colors rounded-t-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-5 h-5 flex items-center justify-center rounded-full text-xs ${
                                  group.usedInTemplate
                                    ? "bg-green-100 text-green-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {group.usedInTemplate ? "\u2713" : "!"}
                              </span>
                              <span className="font-medium text-blue-900">
                                #{group.alias} -{" "}
                                {group.name || `Alias ${group.alias}`}
                              </span>
                              <code className="text-xs bg-blue-200 px-1 rounded">
                                {group.placeholder ||
                                  `#FamilySwitch_${group.alias}#`}
                              </code>
                              <Badge variant="secondary">
                                {group.count} variations
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-blue-700 max-w-xs truncate">
                                {group.sample || "(vide)"}
                              </span>
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4 text-blue-500" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                          </button>

                          {isOpen &&
                            (() => {
                              const switchKey = `family_${group.alias}`;
                              const showAll = showAllVariations.has(switchKey);
                              const visibleVariations = showAll
                                ? group.variations
                                : group.variations.slice(
                                    0,
                                    MAX_VISIBLE_VARIATIONS,
                                  );
                              const hiddenCount =
                                group.variations.length -
                                MAX_VISIBLE_VARIATIONS;

                              return (
                                <div className="border-t border-blue-200 p-4 space-y-2">
                                  {visibleVariations.map((variation, idx) => (
                                    <div
                                      key={variation.id}
                                      className="flex items-center gap-2 p-2 bg-white rounded border text-sm group"
                                    >
                                      <span className="text-blue-400 w-6">
                                        #{idx + 1}
                                      </span>
                                      {editingSwitch?.id === variation.id ? (
                                        <>
                                          <input
                                            type="text"
                                            value={editingSwitch.content}
                                            onChange={(e) =>
                                              setEditingSwitch({
                                                ...editingSwitch,
                                                content: e.target.value,
                                              })
                                            }
                                            className="flex-1 px-2 py-1 border rounded text-sm"
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdateSwitch(
                                                variation.id,
                                                editingSwitch.content,
                                              )
                                            }
                                            disabled={switchSaving}
                                            className="text-green-600 hover:text-green-800 px-2"
                                          >
                                            \u2713
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingSwitch(null)
                                            }
                                            className="text-gray-500 hover:text-gray-700 px-2"
                                          >
                                            \u2715
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <span className="flex-1 text-gray-700">
                                            {variation.content || "(vide)"}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingSwitch({
                                                id: variation.id,
                                                content: variation.content,
                                              })
                                            }
                                            className="opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 px-2 transition-opacity"
                                          >
                                            \u270F\uFE0F
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleDeleteSwitch(variation.id)
                                            }
                                            className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 px-2 transition-opacity"
                                          >
                                            \uD83D\uDDD1\uFE0F
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                  {hiddenCount > 0 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleShowAllVariations(switchKey)
                                      }
                                      className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                    >
                                      {showAll
                                        ? "\u25B2 Reduire"
                                        : `\u25BC Voir les ${hiddenCount} autres variations`}
                                    </button>
                                  )}
                                  {/* Add button */}
                                  {newSwitchAlias === parseInt(group.alias) ? (
                                    <div className="flex items-center gap-2 mt-3 p-2 bg-green-50 rounded border border-green-200">
                                      <input
                                        type="text"
                                        value={newSwitchContent}
                                        onChange={(e) =>
                                          setNewSwitchContent(e.target.value)
                                        }
                                        placeholder="Nouveau contenu..."
                                        className="flex-1 px-2 py-1 border rounded text-sm"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleCreateSwitch(
                                            parseInt(group.alias),
                                            newSwitchContent,
                                          )
                                        }
                                        disabled={
                                          switchSaving ||
                                          !newSwitchContent.trim()
                                        }
                                        className="text-green-600 hover:text-green-800 px-2 disabled:opacity-50"
                                      >
                                        \u2713 Creer
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setNewSwitchAlias(null);
                                          setNewSwitchContent("");
                                        }}
                                        className="text-gray-500 hover:text-gray-700 px-2"
                                      >
                                        \u2715
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNewSwitchAlias(parseInt(group.alias))
                                      }
                                      className="w-full py-2 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors border border-dashed border-green-300 mt-2"
                                    >
                                      \u2795 Ajouter une variation
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </CardContent>
      </Card>
    </>
  );
}
