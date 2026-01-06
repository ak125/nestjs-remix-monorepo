/**
 * Hook personnalisé pour gérer les données de la page d'accueil
 * Encapsule toute la logique métier liée au catalogue et aux marques
 */

import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { type FamilyWithGammes } from "~/services/api/hierarchy.api";

export function useHomeData() {
  const loaderData = useLoaderData<any>();

  // État pour les données du catalogue
  const [families, _setFamilies] = useState<FamilyWithGammes[]>(
    loaderData?.catalogData?.families || [],
  );
  const [loadingCatalog, _setLoadingCatalog] = useState(false);
  // Use array instead of Set to avoid React hydration issues (Set doesn't serialize correctly during SSR)
  const [expandedFamilies, setExpandedFamilies] = useState<(string | number)[]>(
    [],
  );

  // État pour les marques - Type simplifié pour éviter les erreurs de sérialisation JSON
  const [brands, _setBrands] = useState<
    Array<{
      id: number;
      name: string;
      slug: string;
      logo?: string;
    }>
  >(loaderData?.brandsData || []);
  const [loadingBrands, _setLoadingBrands] = useState(false);

  // Fonction pour toggle l'expansion d'une famille
  const toggleFamilyExpansion = (familyId: string | number) => {
    setExpandedFamilies((prev) =>
      prev.includes(familyId)
        ? prev.filter((id) => id !== familyId)
        : [...prev, familyId],
    );
  };

  return {
    // Données du catalogue
    families,
    loadingCatalog,
    expandedFamilies,
    toggleFamilyExpansion,

    // Données des marques
    brands,
    loadingBrands,

    // Autres données
    blogArticles: loaderData?.blogArticlesData,
    equipementiers: loaderData?.equipementiersData,
  };
}
