import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cva, type VariantProps } from 'class-variance-authority';
import { Command } from 'cmdk';
import * as React from 'react';
import { cn } from '../lib/utils';

/**
 * Combobox - Composant de sélection avec recherche
 * 
 * Basé sur Radix UI Popover + cmdk (Command)
 * 
 * Features:
 * - Recherche avec filtrage temps réel
 * - Keyboard navigation (Arrow, Enter, Escape)
 * - CVA variants (size, density, radius, state)
 * - CSS variables pour theming
 * - ARIA labels (a11y)
 * - Loading + Empty states
 * - Headless pattern (controlled)
 * 
 * @example
 * ```tsx
 * <Combobox
 *   items={brands}
 *   value={selectedBrand}
 *   onChange={setSelectedBrand}
 *   placeholder="Choisir une marque"
 *   getItemLabel={(item) => item.name}
 *   getItemValue={(item) => item.id}
 * />
 * ```
 */

const comboboxTriggerVariants = cva(
  'flex items-center justify-between w-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'h-8 px-2 text-sm',
        md: 'h-10 px-3 text-base',
        lg: 'h-12 px-4 text-lg',
      },
      state: {
        default: 'border-[var(--border-primary)] focus-visible:ring-[var(--color-primary-500)]',
        error: 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]',
        success: 'border-[var(--color-success)] focus-visible:ring-[var(--color-success)]',
      },
      radius: {
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-full',
      },
      density: {
        comfy: 'gap-2',
        compact: 'gap-1',
      },
    },
    defaultVariants: {
      size: 'md',
      state: 'default',
      radius: 'md',
      density: 'comfy',
    },
  }
);

const comboboxContentVariants = cva(
  'z-dropdown bg-[var(--bg-primary)] border-2 border-[var(--border-primary)] shadow-lg',
  {
    variants: {
      radius: {
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-2xl',
      },
    },
    defaultVariants: {
      radius: 'md',
    },
  }
);

export interface ComboboxItem {
  value: string | number;
  label: string;
  disabled?: boolean;
  [key: string]: any;
}

export interface ComboboxProps<T extends ComboboxItem>
  extends Omit<React.HTMLAttributes<HTMLButtonElement>, 'onChange'>,
    VariantProps<typeof comboboxTriggerVariants> {
  items: T[];
  value?: string | number | null;
  onChange?: (value: string | number | null, item: T | null) => void;
  placeholder?: string;
  emptyText?: string;
  searchPlaceholder?: string;
  getItemLabel?: (item: T) => string;
  getItemValue?: (item: T) => string | number;
  renderItem?: (item: T) => React.ReactNode;
  filterItems?: (items: T[], query: string) => T[];
  loading?: boolean;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Combobox<T extends ComboboxItem>({
  className,
  items = [],
  value,
  onChange,
  placeholder = 'Sélectionner...',
  emptyText = 'Aucun résultat',
  searchPlaceholder = 'Rechercher...',
  getItemLabel = (item) => item.label,
  getItemValue = (item) => item.value,
  renderItem,
  filterItems,
  loading = false,
  disabled = false,
  size,
  state,
  radius,
  density,
  'aria-label': ariaLabel,
  ...props
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  // Trouver l'item sélectionné
  const selectedItem = React.useMemo(
    () => items.find((item) => getItemValue(item) === value) || null,
    [items, value, getItemValue]
  );

  // Filtrer les items selon la recherche
  const filteredItems = React.useMemo(() => {
    if (!search) return items;
    
    if (filterItems) {
      return filterItems(items, search);
    }

    // Filtrage par défaut (insensible à la casse)
    const query = search.toLowerCase();
    return items.filter((item) =>
      getItemLabel(item).toLowerCase().includes(query)
    );
  }, [items, search, filterItems, getItemLabel]);

  const handleSelect = (item: T) => {
    const itemValue = getItemValue(item);
    const newValue = value === itemValue ? null : itemValue;
    onChange?.(newValue, newValue ? item : null);
    setOpen(false);
    setSearch('');
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        {...props}
        disabled={disabled || loading}
        className={cn(
          comboboxTriggerVariants({ size, state, radius, density }),
          'bg-[var(--bg-primary)] text-[var(--text-primary)]',
          className
        )}
        aria-label={ariaLabel || placeholder}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={cn('truncate', !selectedItem && 'text-[var(--text-secondary)]')}>
          {loading ? 'Chargement...' : selectedItem ? getItemLabel(selectedItem) : placeholder}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'transition-transform duration-200 text-[var(--text-secondary)]',
            open && 'transform rotate-180'
          )}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            comboboxContentVariants({ radius }),
            'w-[var(--radix-popover-trigger-width)] max-h-96 overflow-hidden'
          )}
        >
          <Command
            className="flex flex-col"
            filter={(value: string, search: string) => {
              // Custom filter déjà géré par filteredItems
              return 1;
            }}
          >
            {/* Search input */}
            <div className="flex items-center border-b border-[var(--border-primary)] px-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[var(--text-secondary)]"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={searchPlaceholder}
                className="flex h-10 w-full bg-transparent py-3 px-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Items list */}
            <Command.List className="max-h-80 overflow-y-auto p-1">
              {loading ? (
                <Command.Loading className="py-6 text-center text-sm text-[var(--text-secondary)]">
                  Chargement...
                </Command.Loading>
              ) : filteredItems.length === 0 ? (
                <Command.Empty className="py-6 text-center text-sm text-[var(--text-secondary)]">
                  {emptyText}
                </Command.Empty>
              ) : (
                <Command.Group>
                  {filteredItems.map((item) => {
                    const itemValue = getItemValue(item);
                    const isSelected = value === itemValue;
                    
                    return (
                      <Command.Item
                        key={String(itemValue)}
                        value={String(itemValue)}
                        onSelect={() => !item.disabled && handleSelect(item)}
                        disabled={item.disabled}
                        className={cn(
                          'relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm transition-colors',
                          'hover:bg-[var(--color-primary-50)] focus:bg-[var(--color-primary-50)]',
                          'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                          isSelected && 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]'
                        )}
                      >
                        {isSelected && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mr-2"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                        {renderItem ? renderItem(item) : getItemLabel(item)}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

Combobox.displayName = 'Combobox';
