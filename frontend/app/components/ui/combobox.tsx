import * as React from "react";
import { useState } from "react";
import { Input } from "./input";
import { cn } from "~/lib/utils";

export interface ComboboxItem {
  value: string;
  label: string;
  disabled?: boolean;
  [key: string]: any; // Pour des données supplémentaires
}

export interface ComboboxProps {
  items: ComboboxItem[];
  value?: string;
  onValueChange?: (value: string, item?: ComboboxItem) => void;
  onSearch?: (query: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
  maxHeight?: number;
}

export function Combobox({
  items = [],
  value,
  onValueChange,
  onSearch,
  placeholder = "Sélectionner...",
  searchPlaceholder = "Rechercher...",
  emptyMessage = "Aucun résultat trouvé",
  loading = false,
  disabled = false,
  className,
  allowClear = true,
  maxHeight = 200
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Trouve l'item sélectionné
  const selectedItem = items.find(item => item.value === value);

  // Filtre les items selon la recherche
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    
    return items.filter(item =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.value.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  // Gestionnaire de recherche
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setHighlightedIndex(-1);
    
    if (onSearch) {
      onSearch(query);
    }
  };

  // Sélection d'un item
  const handleSelect = (item: ComboboxItem) => {
    if (item.disabled) return;
    
    onValueChange?.(item.value, item);
    setIsOpen(false);
    setSearchQuery("");
  };

  // Clear selection
  const handleClear = () => {
    onValueChange?.("", undefined);
    setSearchQuery("");
  };

  // Navigation au clavier
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          Math.min(prev + 1, filteredItems.length - 1)
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredItems[highlightedIndex]) {
          handleSelect(filteredItems[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSearchQuery("");
        break;
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isOpen && "ring-2 ring-ring ring-offset-2"
          )}
        >
          <span className={cn(
            selectedItem ? "text-foreground" : "text-muted-foreground"
          )}>
            {selectedItem?.label || placeholder}
          </span>
          
          <div className="flex items-center gap-1">
            {allowClear && selectedItem && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="h-4 w-4 rounded-sm hover:bg-muted flex items-center justify-center"
              >
                ✕
              </button>
            )}
            <svg
              className={cn(
                "h-4 w-4 opacity-50 transition-transform",
                isOpen && "rotate-180"
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 bg-popover text-popover-foreground border rounded-md shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b">
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="h-8"
            />
          </div>

          {/* Items list */}
          <div 
            className="py-1 overflow-auto"
            style={{ maxHeight }}
          >
            {loading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Chargement...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                {emptyMessage}
              </div>
            ) : (
              filteredItems.map((item, index) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  disabled={item.disabled}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground",
                    "disabled:pointer-events-none disabled:opacity-50",
                    index === highlightedIndex && "bg-accent text-accent-foreground",
                    selectedItem?.value === item.value && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  {item.label}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
