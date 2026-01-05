/**
 * Hook personnalisé pour gérer les données de la page d'accueil
 * Encapsule toute la logique métier liée au catalogue et aux marques
 */

import { useLoaderData } from '@remix-run/react';
import { useState, useEffect } from 'react';

import { type FamilyWithGammes } from '~/services/api/hierarchy.api';

export function useHomeData() {
  const loaderData = useLoaderData<any>();
  
  // État pour les données du catalogue
  const [families, setFamilies] = useState<FamilyWithGammes[]>(
    loaderData?.catalogData?.families || []
  );
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // État pour les marques - Type simplifié pour éviter les erreurs de sérialisation JSON
  const [brands, setBrands] = useState<Array<{ 
    id: number; 
    name: string; 
    slug: string; 
    logo?: string;
  }>>(loaderData?.brandsData || []);
  const [loadingBrands, setLoadingBrands] = useState(false);

  // Sync avec les données SSR
  useEffect(() => {
    if (loaderData?.catalogData?.families && loaderData.catalogData.families.length > 0) {
      setFamilies(loaderData.catalogData.families);
      setLoadingCatalog(false);
    }
  }, [loaderData?.catalogData]);

  useEffect(() => {
    if (loaderData?.brandsData && loaderData.brandsData.length > 0) {
      setBrands(loaderData.brandsData);
      setLoadingBrands(false);
    }
  }, [loaderData?.brandsData]);

  return {
    // Données du catalogue
    families,
    loadingCatalog,

    // Données des marques
    brands,
    loadingBrands,
    
    // Autres données
    blogArticles: loaderData?.blogArticlesData,
    equipementiers: loaderData?.equipementiersData,
  };
}
