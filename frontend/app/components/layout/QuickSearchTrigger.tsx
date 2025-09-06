/**
 * 🔍 QUICK SEARCH TRIGGER - Déclencheur de recherche rapide
 * 
 * Composant simple pour déclencher la recherche rapide
 * Compatible avec votre structure Header
 */

import { Search } from "lucide-react";

interface QuickSearchTriggerProps {
  placeholder?: string;
  onOpen?: () => void;
  className?: string;
}

export function QuickSearchTrigger({ 
  placeholder = "Rechercher...", 
  onOpen,
  className = "" 
}: QuickSearchTriggerProps) {
  const handleClick = () => {
    onOpen?.();
  };

  return (
    <button
      onClick={handleClick}
      className={`
        flex items-center space-x-2 px-3 py-2 
        bg-gray-100 hover:bg-gray-200 
        rounded-lg transition-colors
        text-gray-600 hover:text-gray-800
        ${className}
      `}
    >
      <Search className="w-4 h-4" />
      <span className="text-sm hidden md:inline">{placeholder}</span>
    </button>
  );
}
