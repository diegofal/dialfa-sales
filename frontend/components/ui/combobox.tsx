'use client';

import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  /** When true, allows typing a custom value not in the options list */
  allowCustom?: boolean;
  /** Label for the "use custom" option, e.g. 'Usar "{search}"' */
  customLabel?: (search: string) => string;
  /** Called when a delete icon is clicked on an option. Only options with deletable values show the icon. */
  onDelete?: (value: string) => void;
  /** Predicate to determine which options show a delete button. Defaults to all options when onDelete is provided. */
  isDeletable?: (value: string) => boolean;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = 'Seleccionar...',
  emptyMessage = 'No se encontraron resultados',
  className,
  allowCustom = false,
  customLabel,
  onDelete,
  isDeletable,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    return options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search]);

  const selectedOption = options.find((option) => option.value === value);

  // Check if the search text exactly matches an existing option
  const exactMatch = search.trim()
    ? options.some((o) => o.label.toLowerCase() === search.trim().toLowerCase())
    : true;

  const showCustomOption = allowCustom && search.trim() && !exactMatch;

  const handleSelect = (selectedValue: string) => {
    onValueChange?.(selectedValue === value ? '' : selectedValue);
    setOpen(false);
    setSearch('');
  };

  const handleSelectCustom = () => {
    const customValue = `custom:${search.trim()}`;
    onValueChange?.(customValue);
    setOpen(false);
    setSearch('');
  };

  // Display label: for custom values show the text part, for options show the label
  const displayLabel = React.useMemo(() => {
    if (selectedOption) return selectedOption.label;
    if (value?.startsWith('custom:')) return value.slice(7);
    return null;
  }, [selectedOption, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
        >
          {displayLabel || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showCustomOption) {
                e.preventDefault();
                handleSelectCustom();
              }
            }}
            className="h-9"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {/* Custom value option */}
          {showCustomOption && (
            <div className="p-1">
              <button
                onClick={handleSelectCustom}
                className="hover:bg-accent hover:text-accent-foreground relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none"
              >
                <Plus className="mr-2 h-4 w-4" />
                {customLabel ? customLabel(search.trim()) : `Usar "${search.trim()}"`}
              </button>
            </div>
          )}
          {filteredOptions.length === 0 && !showCustomOption ? (
            <div className="text-muted-foreground py-6 text-center text-sm">{emptyMessage}</div>
          ) : (
            <div className="p-1">
              {filteredOptions.map((option) => {
                const canDelete = onDelete && (isDeletable ? isDeletable(option.value) : true);
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'hover:bg-accent hover:text-accent-foreground group relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none',
                      value === option.value && 'bg-accent'
                    )}
                  >
                    <button
                      className="flex flex-1 items-center"
                      onClick={() => handleSelect(option.value)}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4 shrink-0',
                          value === option.value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {option.label}
                    </button>
                    {canDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(option.value);
                        }}
                        className="text-muted-foreground hover:text-destructive ml-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        title="Eliminar"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
