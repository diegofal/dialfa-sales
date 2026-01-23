# Claude Code Development Rules - SPISA Project

## 🎯 REGLA FUNDAMENTAL OBLIGATORIA

**TODOS los cambios realizados por Claude DEBEN seguir estrictamente los patrones arquitectónicos y de código documentados en este proyecto.**

### Proceso Obligatorio Antes de Escribir Código:

1. 🔍 **EXPLORAR** - Busca ejemplos similares en el codebase
2. 📖 **LEER** - Consulta la documentación en `docs/`
3. 🎨 **SEGUIR** - Aplica los patrones identificados
4. ✅ **VALIDAR** - Verifica consistencia con el código existente

**❌ NUNCA inventes nuevos patrones sin consultarlo primero con el usuario.**

## 📚 Documentación Obligatoria de Referencia

Antes de implementar cualquier funcionalidad, **LEE** estas guías:

### Core Documentation
- **`docs/DEVELOPER_GUIDE.md`** - Guía principal de desarrollo
- **`docs/architecture-overview.md`** - Arquitectura del sistema
- **`docs/folder-structure-analysis.md`** - Estructura de carpetas

### Patrones y Código
- **`docs/components-interaction.md`** - Interacción entre componentes
- **`docs/solid-principles-analysis.md`** - Principios SOLID aplicados
- **`docs/code-quality-tools.md`** - Herramientas y estándares

### Implementación
- **`docs/IMPLEMENTATION_PLAN.md`** - Plan de implementación
- **`docs/TECHNICAL_DEBT_COMPLETION.md`** - Deuda técnica resuelta
- **`docs/MIGRATION_SUMMARY_2026.md`** - Migraciones realizadas

## 🏗️ Patrones Arquitectónicos Obligatorios

### 1. Factory Pattern para Hooks - PATRÓN ESTÁNDAR

Este es el patrón **MÁS IMPORTANTE** del proyecto. **SIEMPRE** úsalo para entidades CRUD.

✅ **PATRÓN CORRECTO (úsalo siempre):**
```typescript
// frontend/lib/hooks/useEntities.ts
import type { Entity, EntityFormData } from '@/types/entity';
import type { PaginationParams } from '@/types/pagination';
import { entitiesApi } from '../api/entities';
import { createCRUDHooks } from './api/createCRUDHooks';

export interface EntitiesListParams extends PaginationParams {
  activeOnly?: boolean;
  // otros filtros específicos
}

// Usa el factory pattern - genera todos los hooks automáticamente
const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Entity,
  EntityFormData,
  EntityFormData,
  EntitiesListParams
>({
  entityName: 'Entidad',
  api: entitiesApi,
  queryKey: 'entities',
});

// Exporta con nombres semánticos
export {
  useList as useEntities,
  useById as useEntity,
  useCreate as useCreateEntity,
  useUpdate as useUpdateEntity,
  useDelete as useDeleteEntity,
};
```

❌ **ANTI-PATRÓN (NO hacer esto):**
```typescript
// ❌ NO crear hooks manuales desde cero
export function useEntity() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['entity'],
    queryFn: () => api.get('/entity'),
  });
}

// ❌ NO crear mutations manuales
export function useCreateEntity() {
  return useMutation({
    mutationFn: (data) => api.post('/entity', data),
    onSuccess: () => { ... },
  });
}
```

**Referencia:** Ver `frontend/lib/hooks/useCategories.ts` como ejemplo completo.

### 2. API Layer - Estructura Estándar

✅ **PATRÓN CORRECTO:**
```typescript
// frontend/lib/api/entities.ts
import type { Entity, EntityFormData } from '@/types/entity';
import type { PagedResult } from '@/types/pagination';
import { apiClient } from './client';

export const entitiesApi = {
  getAll: async (params?: {
    pageNumber?: number;
    pageSize?: number;
    searchTerm?: string;
    // otros filtros
  }): Promise<PagedResult<Entity>> => {
    const apiParams = {
      page: params?.pageNumber || 1,
      limit: params?.pageSize || 50,
      search: params?.searchTerm,
    };
    const { data } = await apiClient.get<PagedResult<Entity>>('/entities', { params: apiParams });
    return data;
  },

  getById: async (id: number): Promise<Entity> => {
    const { data } = await apiClient.get<Entity>(`/entities/${id}`);
    return data;
  },

  create: async (entityData: EntityFormData): Promise<Entity> => {
    const { data } = await apiClient.post<Entity>('/entities', entityData);
    return data;
  },

  update: async (id: number, entityData: EntityFormData): Promise<Entity> => {
    const { data } = await apiClient.put<Entity>(`/entities/${id}`, entityData);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/entities/${id}`);
  },
};
```

**Puntos clave:**
- ✅ Usa `PagedResult<T>` para listas paginadas
- ✅ Parámetros: `pageNumber`, `pageSize` (no `page`, `limit` en la interfaz)
- ✅ Retorna tipos tipados
- ✅ Usa `apiClient` (ya configurado con auth)

**Referencia:** Ver `frontend/lib/api/categories.ts`

### 3. Tipos TypeScript - Convenciones

✅ **PATRÓN CORRECTO:**
```typescript
// frontend/types/entity.ts
export interface Entity {
  id: number;
  // campos de la entidad
  code: string;
  name: string;
  isActive: boolean;
  // timestamps estándar
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface EntityFormData {
  // SOLO campos editables (sin id, timestamps, campos calculados)
  code: string;
  name: string;
  isActive?: boolean;
}

export interface EntityListParams extends PaginationParams {
  activeOnly?: boolean;
  searchTerm?: string;
  // filtros específicos
}
```

**Convenciones:**
- ✅ Entidad principal: `Entity` (singular)
- ✅ Datos de formulario: `EntityFormData`
- ✅ Parámetros de lista: `EntityListParams extends PaginationParams`
- ✅ Timestamps: `createdAt`, `updatedAt`, `deletedAt?`

### 4. Validación con Zod - Esquemas

✅ **PATRÓN CORRECTO:**
```typescript
// Agregar a frontend/lib/validations/schemas.ts
export const createEntitySchema = z.object({
  code: z.string().min(1, 'El código es requerido').max(20, 'Máximo 20 caracteres'),
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  isActive: z.boolean().optional().default(true),
});

export const updateEntitySchema = createEntitySchema
  .partial()
  .required({ code: true }); // campos obligatorios en update

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
```

**Convenciones:**
- ✅ Esquemas en `frontend/lib/validations/schemas.ts`
- ✅ Mensajes de error en español
- ✅ Schema de update es partial del create
- ✅ Exportar tipos inferidos

### 5. Componentes de Formulario - Dialog Pattern

✅ **PATRÓN CORRECTO:**
```typescript
// frontend/components/entities/EntityDialog.tsx
'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useEntity, useCreateEntity, useUpdateEntity } from '@/lib/hooks/useEntities';
import { createEntitySchema } from '@/lib/validations/schemas';
import type { EntityFormData } from '@/types/entity';

interface EntityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entityId?: number | null;
}

export function EntityDialog({ isOpen, onClose, entityId }: EntityDialogProps) {
  const isEditing = !!entityId;
  const { data: entity, isLoading } = useEntity(entityId || 0);
  const createMutation = useCreateEntity();
  const updateMutation = useUpdateEntity();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EntityFormData>({
    resolver: zodResolver(createEntitySchema),
    defaultValues: {
      code: '',
      name: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (isEditing && entity) {
      setValue('code', entity.code);
      setValue('name', entity.name);
      setValue('isActive', entity.isActive);
    } else if (!isEditing) {
      reset();
    }
  }, [entity, isEditing, setValue, reset]);

  const onSubmit = async (data: EntityFormData) => {
    try {
      if (isEditing && entityId) {
        await updateMutation.mutateAsync({ id: entityId, data });
      } else {
        await createMutation.mutateAsync(data);
      }
      reset();
      onClose();
    } catch (error) {
      console.error('Error submitting entity:', error);
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
            {isEditing ? 'Editar Entidad' : 'Nueva Entidad'}
          </DialogTitle>
        </DialogHeader>

        {isLoading && isEditing ? (
          <LoadingSpinner size="md" className="py-8" />
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Campos del formulario */}
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

**Referencia:** Ver `frontend/components/categories/CategoryDialog.tsx`

### 6. Páginas CRUD - Estructura Estándar

✅ **PATRÓN CORRECTO:**
```typescript
// frontend/app/dashboard/entities/page.tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Pagination } from '@/components/ui/pagination';
import { useEntities } from '@/lib/hooks/useEntities';
import { usePagination } from '@/lib/hooks/usePagination';
import { EntityDialog } from '@/components/entities/EntityDialog';
import { EntitiesTable } from '@/components/entities/EntitiesTable';

export default function EntitiesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { pagination, setPage, setPageSize, setSorting } = usePagination(50);

  const { data, isLoading } = useEntities({
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
          <h1 className="text-3xl font-bold tracking-tight">Entidades</h1>
          <p className="text-muted-foreground">
            Gestión de entidades del sistema
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Entidad
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Entidades</CardTitle>
              <CardDescription>
                {data?.pagination.total || 0} entidades registradas
              </CardDescription>
            </div>
            <div className="relative w-64">
              <Input
                placeholder="Buscar entidades..."
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
              <EntitiesTable
                entities={data.data}
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
              No se encontraron entidades
            </div>
          )}
        </CardContent>
      </Card>

      <EntityDialog
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        entityId={editingId}
      />
    </div>
  );
}
```

**Referencia:** Ver `frontend/app/dashboard/categories/page.tsx`

## 📁 Estructura de Archivos Obligatoria

Para cada nueva entidad CRUD, crear estos archivos **en este orden**:

```
Entidad: "Supplier" (ejemplo)

1. frontend/types/supplier.ts
   - Interface Supplier
   - Interface SupplierFormData
   - Interface SupplierListParams

2. frontend/lib/validations/schemas.ts
   - Agregar createSupplierSchema
   - Agregar updateSupplierSchema

3. frontend/lib/api/suppliers.ts
   - exportar suppliersApi con getAll, getById, create, update, delete

4. frontend/lib/hooks/useSuppliers.ts
   - Usar createCRUDHooks
   - Exportar hooks con nombres semánticos

5. frontend/components/suppliers/SupplierDialog.tsx
   - Formulario create/edit en Dialog

6. frontend/components/suppliers/SuppliersTable.tsx
   - Tabla con acciones edit/delete

7. frontend/app/dashboard/suppliers/page.tsx
   - Página principal CRUD
```

**NO** crear archivos adicionales sin necesidad. Mantén la estructura simple y consistente.

## 🚫 Anti-Patrones - NUNCA HACER

1. ❌ **NO crear hooks sin usar `createCRUDHooks`**
   - El factory pattern es obligatorio para entidades CRUD

2. ❌ **NO inventar nuevas estructuras de carpetas**
   - Sigue la estructura documentada

3. ❌ **NO duplicar código**
   - Busca componentes reutilizables primero

4. ❌ **NO ignorar TypeScript errors**
   - Todos los errores deben resolverse

5. ❌ **NO usar `any` en TypeScript**
   - Todos los tipos deben ser explícitos

6. ❌ **NO mezclar español e inglés**
   - Código en inglés, UI/mensajes en español

7. ❌ **NO crear interfaces inconsistentes**
   - Las APIs deben retornar `PagedResult<T>`

8. ❌ **NO hardcodear valores**
   - Usa constantes o configuración

## 🔍 Proceso de Implementación

### Paso 1: Explorar (OBLIGATORIO)

Antes de escribir código, usa el **Task tool con explore agent**:

```typescript
// Usa Task tool para explorar
Task({
  subagent_type: 'Explore',
  prompt: 'Encuentra ejemplos de entidades CRUD completas que sigan el factory pattern',
  description: 'Explore CRUD patterns'
});
```

### Paso 2: Identificar Patrones

Busca módulos similares:
- Para entidades simples → Ver `categories/`
- Para entidades con relaciones → Ver `articles/`
- Para formularios complejos → Ver `clients/`

### Paso 3: Seguir el Patrón

Copia la estructura del módulo más similar y adapta:
1. Cambia nombres de entidad
2. Ajusta campos y tipos
3. Mantén la misma estructura
4. Usa los mismos hooks y componentes UI

### Paso 4: Validar

Antes de considerar completo:
```bash
cd frontend
npm run build  # Debe pasar sin errores
npm run lint   # Debe pasar sin warnings críticos
```

## 📝 Commits - Conventional Commits

**SIEMPRE** usa este formato:

```
type(scope): subject en minúsculas sin punto final

Body opcional explicando QUÉ cambiaste y POR QUÉ (no el cómo).
Máximo 150 caracteres por línea.

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types comunes:**
- `feat` - Nueva funcionalidad
- `fix` - Corrección de bug
- `refactor` - Refactorización sin cambios de funcionalidad
- `chore` - Mantenimiento, configuración
- `docs` - Documentación

Ver `.claude/COMMIT_GUIDE.md` para detalles completos.

## 🎨 Estilo de Código

### React
- ✅ Functional components con hooks
- ✅ TypeScript strict mode
- ✅ Props interfaces explícitas
- ✅ Use client directive cuando sea necesario

### State Management
- ✅ React Query para server state (via hooks generados)
- ✅ useState para UI state local
- ✅ No usar Context API sin justificación

### Forms
- ✅ React Hook Form
- ✅ Zod para validación
- ✅ zodResolver para integración

### Styling
- ✅ Tailwind CSS utility classes
- ✅ Componentes shadcn/ui
- ✅ Responsive design por defecto

## 🛠️ Herramientas y Comandos

```bash
# Build (debe pasar)
npm run build

# Linting
npm run lint

# Type checking
npx tsc --noEmit

# Tests (si existen)
npm test
```

## 📚 Referencias Rápidas por Módulo

### Hooks
- **Factory Pattern:** `frontend/lib/hooks/api/createCRUDHooks.ts`
- **Ejemplo completo:** `frontend/lib/hooks/useCategories.ts`
- **Con filtros complejos:** `frontend/lib/hooks/useArticles.ts`

### Componentes
- **Dialog Form:** `frontend/components/categories/CategoryDialog.tsx`
- **Table:** `frontend/components/categories/CategoriesTable.tsx`
- **Página CRUD:** `frontend/app/dashboard/categories/page.tsx`

### API
- **Cliente base:** `frontend/lib/api/client.ts`
- **API simple:** `frontend/lib/api/categories.ts`
- **API compleja:** `frontend/lib/api/articles.ts`

### UI Components
- **Todos los componentes:** `frontend/components/ui/`
- **Usar siempre estos componentes base**

## ⚠️ Cuando Desviarte de los Patrones

Si necesitas crear algo que NO siga estos patrones:

1. ✅ **Pregunta primero al usuario**
2. ✅ **Explica por qué es necesario**
3. ✅ **Documenta la decisión**
4. ✅ **Actualiza esta guía si es un nuevo patrón**

## 🎯 Principio Fundamental

> **La consistencia es más importante que la perfección.**
>
> Un código "bueno" que sigue los patrones del proyecto
> es mejor que un código "perfecto" que no lo hace.

## 📞 En Caso de Duda

1. Lee `docs/DEVELOPER_GUIDE.md`
2. Busca ejemplos en módulos similares
3. Usa el Task tool con explore agent
4. Pregunta al usuario

---

**Última actualización:** 2026-01-23
**Versión:** 1.0.0
