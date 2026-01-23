# AI Development Patterns - Patrones Obligatorios para IA

> **📌 REGLA FUNDAMENTAL:** Todos los cambios realizados por IA (Claude Code, Cursor, Copilot, etc.) DEBEN seguir estrictamente los patrones documentados en este proyecto.

## 🎯 Objetivo

Este documento centraliza los patrones arquitectónicos y de código que **TODA** herramienta de IA debe seguir al trabajar en este proyecto.

## 📋 Documentos de Referencia

Antes de hacer cualquier cambio, lee:

1. **`DEVELOPER_GUIDE.md`** - Guía principal
2. **`architecture-overview.md`** - Arquitectura del sistema
3. **`folder-structure-analysis.md`** - Estructura de carpetas
4. **`components-interaction.md`** - Interacción entre componentes

## 🏗️ Patrones Arquitectónicos Core

### 1. Factory Pattern para Hooks (OBLIGATORIO)

El patrón más importante del proyecto. **SIEMPRE** úsalo para entidades CRUD.

**Ubicación del factory:** `frontend/lib/hooks/api/createCRUDHooks.ts`

**Ejemplo de uso correcto:**
```typescript
// frontend/lib/hooks/useCategories.ts
import { createCRUDHooks } from './api/createCRUDHooks';

const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Category,
  CategoryFormData,
  CategoryFormData,
  CategoryListParams
>({
  entityName: 'Categoría',
  api: categoriesApi,
  queryKey: 'categories',
});

export {
  useList as useCategories,
  useById as useCategory,
  useCreate as useCreateCategory,
  useUpdate as useUpdateCategory,
  useDelete as useDeleteCategory,
};
```

**Referencias:**
- Ejemplo simple: `frontend/lib/hooks/useCategories.ts`
- Ejemplo complejo: `frontend/lib/hooks/useArticles.ts`

### 2. API Layer Pattern

**Estructura estándar:**
```typescript
// frontend/lib/api/entities.ts
import type { Entity, EntityFormData } from '@/types/entity';
import type { PagedResult } from '@/types/pagination';
import { apiClient } from './client';

export const entitiesApi = {
  getAll: async (params?): Promise<PagedResult<Entity>> => {
    const { data } = await apiClient.get<PagedResult<Entity>>('/entities', { params });
    return data;
  },
  getById: async (id: number): Promise<Entity> => { ... },
  create: async (data: EntityFormData): Promise<Entity> => { ... },
  update: async (id: number, data: EntityFormData): Promise<Entity> => { ... },
  delete: async (id: number): Promise<void> => { ... },
};
```

**Puntos clave:**
- ✅ Usar `PagedResult<T>` para listas paginadas
- ✅ Parámetros: `pageNumber`, `pageSize` (no `page`, `limit`)
- ✅ Usar `apiClient` (configurado con auth)

### 3. Tipos TypeScript Pattern

**Estructura estándar:**
```typescript
// frontend/types/entity.ts
export interface Entity {
  id: number;
  // campos de la entidad
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface EntityFormData {
  // SOLO campos editables (sin id, timestamps)
}

export interface EntityListParams extends PaginationParams {
  // filtros específicos
}
```

### 4. Validación con Zod Pattern

**Ubicación:** `frontend/lib/validations/schemas.ts`

**Estructura estándar:**
```typescript
export const createEntitySchema = z.object({
  field: z.string().min(1, 'Mensaje en español'),
});

export const updateEntitySchema = createEntitySchema.partial();
```

### 5. Dialog Form Pattern

**Estructura estándar:**
```typescript
// frontend/components/entities/EntityDialog.tsx
export function EntityDialog({ isOpen, onClose, entityId }) {
  const isEditing = !!entityId;
  const { data: entity } = useEntity(entityId || 0);
  const createMutation = useCreateEntity();
  const updateMutation = useUpdateEntity();

  const { register, handleSubmit, reset, setValue, formState } = useForm({
    resolver: zodResolver(createEntitySchema),
  });

  // Populate form on edit
  useEffect(() => {
    if (isEditing && entity) {
      // setValue para cada campo
    }
  }, [entity, isEditing]);

  // Submit handler
  const onSubmit = async (data) => {
    if (isEditing) {
      await updateMutation.mutateAsync({ id: entityId, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onClose();
  };

  return <Dialog>...</Dialog>;
}
```

**Referencia:** `frontend/components/categories/CategoryDialog.tsx`

### 6. CRUD Page Pattern

**Estructura estándar:**
```typescript
// frontend/app/dashboard/entities/page.tsx
export default function EntitiesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { pagination, setPage, setPageSize, setSorting } = usePagination(50);

  const { data, isLoading } = useEntities({
    pageNumber: pagination.pageNumber,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortDescending: pagination.sortDescending,
    searchTerm,
  });

  return (
    <div className="space-y-6">
      {/* Header con botón "Nueva Entidad" */}
      <Card>
        {/* Tabla con datos */}
        {/* Paginación */}
      </Card>
      <EntityDialog isOpen={isDialogOpen} onClose={...} entityId={editingId} />
    </div>
  );
}
```

**Referencia:** `frontend/app/dashboard/categories/page.tsx`

## 📁 Estructura de Archivos Obligatoria

Para cada nueva entidad CRUD (ej: "Supplier"):

```
1. frontend/types/supplier.ts
   → Interfaces: Supplier, SupplierFormData, SupplierListParams

2. frontend/lib/validations/schemas.ts
   → Agregar: createSupplierSchema, updateSupplierSchema

3. frontend/lib/api/suppliers.ts
   → Exportar: suppliersApi { getAll, getById, create, update, delete }

4. frontend/lib/hooks/useSuppliers.ts
   → Usar createCRUDHooks factory

5. frontend/components/suppliers/SupplierDialog.tsx
   → Formulario create/edit

6. frontend/components/suppliers/SuppliersTable.tsx
   → Tabla con acciones

7. frontend/app/dashboard/suppliers/page.tsx
   → Página CRUD principal
```

## 🚫 Anti-Patrones - NUNCA HACER

### ❌ NO crear hooks manuales

```typescript
// ❌ INCORRECTO
export function useEntity() {
  return useQuery({
    queryKey: ['entity'],
    queryFn: () => api.get('/entity'),
  });
}
```

### ❌ NO inventar estructuras nuevas

Siempre sigue la estructura documentada. No crees carpetas o archivos adicionales sin justificación.

### ❌ NO duplicar código

Busca componentes reutilizables en `frontend/components/ui/` antes de crear nuevos.

### ❌ NO ignorar TypeScript

Todos los errores de TypeScript deben resolverse. No uses `any` ni `@ts-ignore`.

### ❌ NO crear APIs inconsistentes

Las APIs de lista deben retornar `PagedResult<T>` con la estructura:
```typescript
{
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

## 🔍 Proceso de Implementación

### Paso 1: Explorar

Antes de escribir código, busca ejemplos similares:
```bash
# Busca hooks similares
ls frontend/lib/hooks/use*.ts

# Busca páginas CRUD similares
ls frontend/app/dashboard/*/page.tsx
```

### Paso 2: Identificar el Módulo Más Similar

- **Entidad simple:** → Ver `categories/`
- **Con relaciones:** → Ver `articles/`
- **Con filtros complejos:** → Ver `clients/`

### Paso 3: Copiar y Adaptar

1. Copia la estructura del módulo similar
2. Cambia nombres (Entity → Supplier)
3. Ajusta campos y tipos
4. Mantén la misma estructura

### Paso 4: Validar

```bash
cd frontend
npm run build   # Debe pasar
npm run lint    # Debe pasar
npx tsc --noEmit  # Sin errores
```

## 🎨 Convenciones de Código

### Nomenclatura
- **Archivos:** camelCase (`useSuppliers.ts`)
- **Componentes:** PascalCase (`SupplierDialog.tsx`)
- **Funciones:** camelCase (`handleSubmit`)
- **Tipos:** PascalCase (`SupplierFormData`)
- **Constantes:** UPPER_CASE o camelCase según contexto

### TypeScript
- ✅ Strict mode habilitado
- ✅ Tipos explícitos siempre
- ✅ No usar `any`, `unknown` es preferible
- ✅ Interfaces para objetos, types para uniones

### React
- ✅ Functional components con hooks
- ✅ Props con interface explícita
- ✅ `'use client'` cuando usa hooks de navegador
- ✅ Export default para páginas

### Styling
- ✅ Tailwind CSS utility classes
- ✅ Componentes shadcn/ui de `@/components/ui/`
- ✅ Responsive por defecto

## 📝 Mensajes de Commit

**Formato obligatorio (Conventional Commits):**

```
type(scope): subject en minúsculas

Body explicando QUÉ y POR QUÉ (no cómo).
Máximo 150 caracteres por línea.

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat` - Nueva funcionalidad
- `fix` - Corrección de bug
- `refactor` - Refactorización
- `chore` - Mantenimiento
- `docs` - Documentación

Ver `.claude/COMMIT_GUIDE.md` para detalles.

## 🛠️ Skills Disponibles

El proyecto tiene skills de Claude Code para automatizar tareas:

- **`/scaffold-entity`** - Genera entidad CRUD completa
- **`/commit`** - Crea commit con formato correcto

Ver `.claude/skills/` para todos los skills disponibles.

## 📚 Referencias por Caso de Uso

### Crear nueva entidad CRUD
1. Lee: `DEVELOPER_GUIDE.md`
2. Ejemplo: `frontend/app/dashboard/categories/`
3. Usa: `/scaffold-entity` skill

### Agregar hook custom
1. Lee: `createCRUDHooks.ts`
2. Ejemplo: `frontend/lib/hooks/useCategories.ts`
3. Siempre usa el factory pattern

### Crear formulario
1. Ejemplo: `CategoryDialog.tsx`
2. Usa: React Hook Form + Zod
3. Componentes: `@/components/ui/`

### Crear tabla
1. Ejemplo: `CategoriesTable.tsx`
2. Usa: `SortableTableHead`, `ClickableTableRow`
3. Actions: Edit/Delete buttons

## ⚠️ Excepciones a las Reglas

Si necesitas desviarte de estos patrones:

1. ✅ **Consulta con el usuario primero**
2. ✅ **Documenta la razón en el commit**
3. ✅ **Actualiza esta documentación**

## 🎯 Principio Fundamental

> **La consistencia es más importante que la perfección.**

Un código que sigue los patrones del proyecto es mejor que un código "perfecto" que no lo hace.

## 📞 Contacto y Soporte

Si tienes dudas sobre los patrones:

1. Lee esta documentación
2. Explora módulos similares
3. Pregunta al equipo de desarrollo

---

**Última actualización:** 2026-01-23
**Versión:** 1.0.0
**Proyecto:** SPISA - Sistema de Gestión de Inventario y Ventas
