# Scaffold Entity Skill

**Command:** `/scaffold-entity [entity-name]`

**Description:** Generates a complete CRUD entity following the project's architecture patterns, including types, API layer, hooks, forms, tables, and pages.

## Instructions

You are an expert code generator for this SPISA ERP system. When the user invokes this skill, you will create a complete entity following the established patterns.

## Architecture Pattern

This codebase follows a 7-layer architecture for entities:

1. **Type Definitions** (`frontend/types/`)
2. **Validation Schemas** (`frontend/lib/validations/schemas.ts`)
3. **API Layer** (`frontend/lib/api/`)
4. **Hooks** (`frontend/lib/hooks/`)
5. **Form Dialog Component** (`frontend/components/`)
6. **Table Component** (`frontend/components/`)
7. **CRUD Page** (`frontend/app/dashboard/`)

## Step 1: Gather Requirements

Ask the user these questions using AskUserQuestion:

1. **Entity Name** (if not provided as argument)
   - Singular form in Spanish (e.g., "Proveedor", "Producto")
   - Code will derive plural and English names

2. **Fields Configuration**
   - Ask: "¿Qué campos necesita esta entidad? (formato: nombre:tipo, ej: nombre:string, precio:number, activo:boolean)"
   - Common types: string, number, boolean, date
   - Auto-include: id, createdAt, updatedAt, isDeleted/deletedAt

3. **Relationships**
   - Ask: "¿Tiene relaciones con otras entidades? (ej: categoryId -> Category)"

4. **Features**
   - Pagination: "¿Necesita paginación?" (default: yes for list entities)
   - Search: "¿Necesita búsqueda?" (default: yes)
   - Filters: "¿Necesita filtros adicionales?" (specify which)
   - Sorting: "¿Necesita ordenamiento?" (default: yes)

## Step 2: Generate Entity Name Variants

From the Spanish entity name, derive:
- **Singular Spanish**: `Proveedor`
- **Plural Spanish**: `Proveedores`
- **Singular English (camelCase)**: `supplier`
- **Plural English (camelCase)**: `suppliers`
- **Pascal Case**: `Supplier`
- **Kebab Case**: `suppliers` (for routes)

## Step 3: Generate Files

### 3.1 Type Definition (`frontend/types/{entityName}.ts`)

```typescript
export interface {PascalCase} {
  id: number;
  // User-defined fields
  {fieldName}: {fieldType};
  // Relations
  {relationId}: number;
  {relationName}?: string; // if needs to display relation name
  // Standard fields
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  isDeleted?: boolean;
}

export interface {PascalCase}FormData {
  // Only editable fields (no id, createdAt, etc.)
  {fieldName}: {fieldType};
}

export interface {PascalCase}ListParams extends PaginationParams {
  activeOnly?: boolean;
  searchTerm?: string;
  // Additional filters based on user requirements
}
```

### 3.2 Validation Schema (`frontend/lib/validations/schemas.ts`)

**ADD** to the existing schemas file:

```typescript
export const create{PascalCase}Schema = z.object({
  {fieldName}: z.{zodType}().{validations}(),
  // Example validations:
  // string: z.string().min(1, 'Campo requerido').max(100, 'Máximo 100 caracteres')
  // number: z.coerce.number().min(0, 'Debe ser mayor a 0')
  // boolean: z.boolean().optional().default(true)
});

export const update{PascalCase}Schema = create{PascalCase}Schema
  .partial()
  .required({ /* required fields */ });

export type Create{PascalCase}Input = z.infer<typeof create{PascalCase}Schema>;
export type Update{PascalCase}Input = z.infer<typeof update{PascalCase}Schema>;
```

### 3.3 API Layer (`frontend/lib/api/{pluralName}.ts`)

```typescript
import { apiClient } from './client';
import type { {PascalCase}, {PascalCase}FormData, {PascalCase}ListParams } from '@/types/{singularName}';
import type { PagedResult } from '@/types/common';

interface {PascalCase}Response {
  data: {PascalCase}[];
}

export const {pluralName}Api = {
  getAll: async (params?: {PascalCase}ListParams): Promise<PagedResult<{PascalCase}>> => {
    const apiParams = {
      page: params?.pageNumber || 1,
      limit: params?.pageSize || 50,
      search: params?.searchTerm,
      activeOnly: params?.activeOnly,
      sortBy: params?.sortBy,
      sortDescending: params?.sortDescending,
      // Add custom filters
    };

    const { data } = await apiClient.get<PagedResult<{PascalCase}>>('/{kebab-case}', {
      params: apiParams,
    });

    return data;
  },

  getById: async (id: number): Promise<{PascalCase}> => {
    const { data } = await apiClient.get<{PascalCase}>(`/{kebab-case}/${id}`);
    return data;
  },

  create: async (entityData: {PascalCase}FormData): Promise<{PascalCase}> => {
    const { data } = await apiClient.post<{PascalCase}>('/{kebab-case}', entityData);
    return data;
  },

  update: async (id: number, entityData: {PascalCase}FormData): Promise<{PascalCase}> => {
    const { data } = await apiClient.put<{PascalCase}>(`/{kebab-case}/${id}`, entityData);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/{kebab-case}/${id}`);
  },
};
```

### 3.4 Hooks (`frontend/lib/hooks/use{PascalCase}.ts`)

```typescript
import { createCRUDHooks } from './api/createCRUDHooks';
import { {pluralName}Api } from '@/lib/api/{pluralName}';
import type { {PascalCase}, {PascalCase}FormData, {PascalCase}ListParams } from '@/types/{singularName}';

const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  {PascalCase},
  {PascalCase}FormData,
  {PascalCase}FormData,
  {PascalCase}ListParams
>({
  entityName: '{SpanishSingular}',
  api: {pluralName}Api,
  queryKey: '{pluralName}',
});

export {
  useList as use{PascalCase}s,
  useById as use{PascalCase},
  useCreate as useCreate{PascalCase},
  useUpdate as useUpdate{PascalCase},
  useDelete as useDelete{PascalCase},
};
```

### 3.5 Form Dialog Component (`frontend/components/{pluralName}/{PascalCase}Dialog.tsx`)

```typescript
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { use{PascalCase}, useCreate{PascalCase}, useUpdate{PascalCase} } from '@/lib/hooks/use{PascalCase}s';
import { create{PascalCase}Schema } from '@/lib/validations/schemas';
import type { {PascalCase}FormData } from '@/types/{singularName}';

interface {PascalCase}DialogProps {
  isOpen: boolean;
  onClose: () => void;
  {singularName}Id?: number | null;
}

export function {PascalCase}Dialog({ isOpen, onClose, {singularName}Id }: {PascalCase}DialogProps) {
  const isEditing = !!{singularName}Id;
  const { data: {singularName}, isLoading } = use{PascalCase}({singularName}Id || 0);
  const createMutation = useCreate{PascalCase}();
  const updateMutation = useUpdate{PascalCase}();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<{PascalCase}FormData>({
    resolver: zodResolver(create{PascalCase}Schema),
    defaultValues: {
      // Set default values for fields
    },
  });

  useEffect(() => {
    if (isEditing && {singularName}) {
      // Populate form with existing data
      Object.keys({singularName}).forEach((key) => {
        setValue(key as keyof {PascalCase}FormData, {singularName}[key]);
      });
    } else if (!isEditing) {
      reset();
    }
  }, [{singularName}, isEditing, setValue, reset]);

  const onSubmit = async (data: {PascalCase}FormData) => {
    try {
      if (isEditing && {singularName}Id) {
        await updateMutation.mutateAsync({ id: {singularName}Id, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      reset();
      onClose();
    } catch (error) {
      console.error('Error submitting {singularName}:', error);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar {SpanishSingular}' : 'Nuevo {SpanishSingular}'}
          </DialogTitle>
        </DialogHeader>

        {isLoading && isEditing ? (
          <div className="py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Generate form fields based on schema */}
            {/* Example field: */}
            <div className="space-y-2">
              <Label htmlFor="{fieldName}">{FieldLabel}</Label>
              <Input
                id="{fieldName}"
                type="{inputType}"
                {...register('{fieldName}')}
              />
              {errors.{fieldName} && (
                <p className="text-sm text-red-500">{errors.{fieldName}.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Guardando...
                  </>
                ) : isEditing ? (
                  'Actualizar'
                ) : (
                  'Crear'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### 3.6 Table Component (`frontend/components/{pluralName}/{PascalCase}sTable.tsx`)

```typescript
'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { ClickableTableRow } from '@/components/ui/clickable-table-row';
import { Edit, Trash2 } from 'lucide-react';
import { useDelete{PascalCase} } from '@/lib/hooks/use{PascalCase}s';
import type { {PascalCase} } from '@/types/{singularName}';

interface {PascalCase}sTableProps {
  {pluralName}: {PascalCase}[];
  onEdit: (id: number) => void;
  currentSortBy?: string;
  currentSortDescending?: boolean;
  onSort?: (sortBy: string, sortDescending: boolean) => void;
}

export function {PascalCase}sTable({
  {pluralName},
  onEdit,
  currentSortBy,
  currentSortDescending,
  onSort,
}: {PascalCase}sTableProps) {
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteMutation = useDelete{PascalCase}();

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="{SortField}"
                currentSortBy={currentSortBy}
                currentSortDescending={currentSortDescending}
                onSort={onSort}
              >
                {ColumnHeader}
              </SortableTableHead>
              {/* Add more column headers */}
              <TableHead className="w-[100px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.isArray({pluralName}) && {pluralName}.length > 0 ? (
              {pluralName}.map(({singularName}) => (
                <ClickableTableRow
                  key={{singularName}.id}
                  onRowClick={() => onEdit({singularName}.id)}
                >
                  <TableCell>{/* Render field */}</TableCell>
                  {/* Add more cells */}
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit({singularName}.id);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId({singularName}.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </ClickableTableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={100} className="text-center py-8 text-muted-foreground">
                  No hay {pluralSpanish} registrados
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {spanishSingular}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El {spanishSingular} será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### 3.7 CRUD Page (`frontend/app/dashboard/{kebab-case}/page.tsx`)

```typescript
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Pagination } from '@/components/ui/pagination';
import { use{PascalCase}s } from '@/lib/hooks/use{PascalCase}s';
import { usePagination } from '@/lib/hooks/usePagination';
import { {PascalCase}Dialog } from '@/components/{pluralName}/{PascalCase}Dialog';
import { {PascalCase}sTable } from '@/components/{pluralName}/{PascalCase}sTable';

export default function {PascalCase}sPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { pagination, setPage, setPageSize, setSorting } = usePagination(50);

  const { data, isLoading } = use{PascalCase}s({
    activeOnly: false,
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
    searchTerm,
  });

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{SpanishPlural}</h1>
          <p className="text-muted-foreground">
            Gestión de {spanishPlural} del sistema
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo {SpanishSingular}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de {SpanishPlural}</CardTitle>
              <CardDescription>
                {data?.pagination.total || 0} {spanishPlural} registrados
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Input
                placeholder="Buscar {spanishPlural}..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && <LoadingSpinner size="md" className="py-8" />}

          {data && data.data.length > 0 && (
            <>
              <{PascalCase}sTable
                {pluralName}={data.data}
                onEdit={handleEdit}
                currentSortBy={pagination.sortBy}
                currentSortDescending={pagination.sortDescending}
                onSort={setSorting}
              />
              <div className="mt-4">
                <Pagination
                  totalCount={data.pagination.total}
                  currentPage={data.pagination.page}
                  pageSize={data.pagination.limit}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </>
          )}

          {data && data.data.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron {spanishPlural}
            </div>
          )}
        </CardContent>
      </Card>

      <{PascalCase}Dialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        {singularName}Id={editingId}
      />
    </div>
  );
}
```

## Step 4: Summary Report

After generating all files, provide the user with:

1. **Files Created** - List all generated files with paths
2. **Next Steps** - What they need to do:
   - Add backend API endpoint (`/{kebab-case}`)
   - Add route to navigation menu if needed
   - Test the CRUD operations
3. **Customization Notes** - Common customizations they might want:
   - Additional validation rules
   - Custom filters
   - Relationship displays
   - Special UI components

## Important Notes

- **Always** follow the exact patterns from existing entities
- **Use** the factory pattern `createCRUDHooks` for hooks
- **Include** proper TypeScript types everywhere
- **Add** proper error handling and loading states
- **Follow** naming conventions (camelCase for code, PascalCase for components)
- **Use** existing UI components from `@/components/ui/`
- **Include** Spanish labels and messages
- **Add** proper form validation with Zod
- **Implement** soft deletes with `isDeleted` or `deletedAt`
- **Add** timestamps (`createdAt`, `updatedAt`)

## Common Field Type Mappings

- **String fields**: Input, Textarea
- **Number fields**: Input type="number"
- **Boolean fields**: Checkbox, Switch
- **Date fields**: DatePicker
- **Select fields**: Select, Combobox
- **Relations**: Combobox with search

## Common Validation Patterns

```typescript
// String
z.string().min(1, 'Campo requerido').max(100, 'Máximo 100 caracteres')

// Number
z.coerce.number().min(0, 'Debe ser mayor a 0')

// Email
z.string().email('Email inválido')

// Optional
z.string().optional().nullable()

// Boolean with default
z.boolean().optional().default(true)

// Decimal/Money
z.coerce.number().min(0).multipleOf(0.01)
```

## Execution Flow

1. Parse entity name from command or ask user
2. Ask for fields and configuration
3. Generate all 7 files in order
4. Create components directory if needed
5. Add navigation route if requested
6. Show summary and next steps

Begin by gathering requirements from the user!
