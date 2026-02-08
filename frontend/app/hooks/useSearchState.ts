/**
 * Hook pour gérer l'état de recherche de la page d'accueil
 * Gère la modal de recherche par référence et la recherche générale
 */

import { useState } from "react";
import { logger } from "~/utils/logger";

export function useSearchState() {
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchReference, setSearchReference] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    logger.log("Search query:", searchQuery);
    window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
  };

  const handleReferenceSearch = () => {
    if (searchReference.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchReference)}`;
    }
  };

  const closeSearchBar = () => {
    setShowSearchBar(false);
    setSearchReference("");
  };

  return {
    // État
    showSearchBar,
    searchReference,
    searchQuery,
    isSearching,

    // Setters
    setShowSearchBar,
    setSearchReference,
    setSearchQuery,

    // Handlers
    handleSearch,
    handleReferenceSearch,
    closeSearchBar,
  };
}
