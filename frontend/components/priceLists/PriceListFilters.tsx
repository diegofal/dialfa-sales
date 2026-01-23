'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Category } from '@/types/category';

interface PriceListFiltersProps {
  categories: Category[];
  selectedCategoryId: string;
  searchTerm: string;
  activeOnly: boolean;
  onCategoryChange: (categoryId: string) => void;
  onSearchChange: (search: string) => void;
  onActiveOnlyChange: (activeOnly: boolean) => void;
}

export function PriceListFilters({
  categories,
  selectedCategoryId,
  searchTerm,
  activeOnly,
  onCategoryChange,
  onSearchChange,
  onActiveOnlyChange,
}: PriceListFiltersProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end">
      {/* Search */}
      <div className="flex-1 space-y-2">
        <Label htmlFor="search">Buscar</Label>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id="search"
            placeholder="Buscar por código o descripción..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="space-y-2 md:w-[250px]">
        <Label htmlFor="category">Categoría</Label>
        <Select value={selectedCategoryId} onValueChange={onCategoryChange}>
          <SelectTrigger id="category">
            <SelectValue placeholder="Todas las categorías" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Only Toggle */}
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 md:w-[180px]">
        <Label htmlFor="active-only" className="cursor-pointer text-sm">
          Solo activos
        </Label>
        <Switch id="active-only" checked={activeOnly} onCheckedChange={onActiveOnlyChange} />
      </div>
    </div>
  );
}
