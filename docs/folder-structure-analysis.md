# SPISA - Análisis de Estructura de Carpetas

> **Última actualización**: Enero 2026 (Post-Fase 1-3)
> **Test Files**: 53 archivos con 706 tests
> **Nueva Infraestructura**: lib/hooks/api/, components/ui/data-table, components/ui/error-boundary

## 1. Estructura Actual

```
spisa-new/
├── frontend/                        # ✅ Aplicación Next.js principal
│   ├── app/                         # ✅ App Router (Next.js 15)
│   │   ├── api/                     # ✅ API Routes - 72 endpoints
│   │   │   ├── articles/            # ✅ CRUD de artículos
│   │   │   ├── auth/                # ✅ Autenticación
│   │   │   ├── categories/          # ✅ Categorías
│   │   │   ├── certificates/        # ✅ Certificados
│   │   │   ├── clients/             # ✅ Clientes
│   │   │   ├── dashboard/           # ✅ Métricas
│   │   │   ├── delivery-notes/      # ✅ Remitos
│   │   │   ├── feedback/            # ✅ Feedback
│   │   │   ├── invoices/            # ✅ Facturas
│   │   │   ├── payment-terms/       # ✅ Términos de pago
│   │   │   ├── price-lists/         # ✅ Listas de precios
│   │   │   ├── sales-orders/        # ✅ Pedidos de venta
│   │   │   ├── stock-movements/     # ✅ Movimientos
│   │   │   ├── supplier-orders/     # ✅ Pedidos a proveedores
│   │   │   ├── suppliers/           # ✅ Proveedores
│   │   │   └── users/               # ✅ Usuarios
│   │   ├── dashboard/               # ✅ Páginas protegidas
│   │   │   ├── activity/            # ✅ Log de actividades
│   │   │   ├── articles/            # ✅ Gestión artículos
│   │   │   ├── categories/          # ✅ Categorías
│   │   │   ├── certificates/        # ✅ Certificados
│   │   │   ├── clients/             # ✅ Clientes
│   │   │   ├── delivery-notes/      # ✅ Remitos
│   │   │   ├── feedback/            # ✅ Feedback
│   │   │   ├── invoices/            # ✅ Facturas
│   │   │   ├── payment-terms/       # ✅ Términos pago
│   │   │   ├── price-lists/         # ✅ Listas precios
│   │   │   ├── sales-orders/        # ✅ Pedidos venta
│   │   │   ├── settings/            # ✅ Configuración
│   │   │   ├── supplier-orders/     # ✅ Pedidos proveedores
│   │   │   ├── suppliers/           # ✅ Proveedores
│   │   │   ├── layout.tsx           # ✅ Layout dashboard
│   │   │   └── page.tsx             # ✅ Dashboard home
│   │   ├── login/                   # ✅ Página login
│   │   ├── layout.tsx               # ✅ Root layout
│   │   ├── page.tsx                 # ✅ Home (redirect)
│   │   └── globals.css              # ✅ Estilos globales
│   ├── components/                  # ✅ Componentes React
│   │   ├── ui/                      # ✅ Componentes base shadcn
│   │   │   ├── accordion.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── combobox.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── spinner.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── data-table.tsx       # ✅ [NUEVO] Generic DataTable<T>
│   │   │   ├── error-boundary.tsx   # ✅ [NUEVO] Error boundary
│   │   │   ├── sortable-table-head.tsx
│   │   │   ├── clickable-table-row.tsx
│   │   │   ├── empty-state.tsx
│   │   │   └── ...
│   │   ├── activity/                # ✅ Componentes actividad
│   │   ├── articles/                # ✅ Componentes artículos
│   │   ├── auth/                    # ✅ AuthInitializer
│   │   ├── categories/              # ✅ Componentes categorías
│   │   ├── certificates/            # ✅ Componentes certificados
│   │   ├── clients/                 # ✅ Componentes clientes
│   │   ├── dashboard/               # ✅ Métricas y gráficos
│   │   ├── deliveryNotes/           # ✅ Componentes remitos
│   │   ├── invoices/                # ✅ Componentes facturas
│   │   ├── layout/                  # ✅ Navbar, Sidebar
│   │   ├── paymentTerms/            # ✅ Términos pago
│   │   ├── priceLists/              # ✅ Listas precios
│   │   ├── print/                   # ✅ Plantillas impresión
│   │   ├── salesOrders/             # ✅ Pedidos venta
│   │   ├── supplierOrders/          # ✅ Pedidos proveedores
│   │   └── users/                   # ✅ Usuarios
│   ├── lib/                         # ✅ Lógica compartida
│   │   ├── services/                # ✅ Servicios de negocio (23 files)
│   │   │   ├── ArticleService.ts    # ✅ [NUEVO] Service layer
│   │   │   ├── ClientService.ts     # ✅ [NUEVO]
│   │   │   ├── InvoiceService.ts    # ✅ [NUEVO]
│   │   │   ├── SalesOrderService.ts # ✅ [NUEVO]
│   │   │   ├── + 19 more services
│   │   │   ├── abcClassification.ts
│   │   │   ├── activityLogger.ts
│   │   │   ├── changeTracker.ts
│   │   │   ├── PDFService.ts
│   │   │   ├── proformaImport/
│   │   │   └── __tests__/           # ✅ [NUEVO] 22 test files
│   │   ├── hooks/                   # ✅ Custom React hooks (31 total)
│   │   │   ├── api/                 # ✅ [NUEVO] Generic hooks
│   │   │   │   ├── useEntityMutation.ts
│   │   │   │   ├── useEntityQuery.ts
│   │   │   │   ├── createCRUDHooks.ts
│   │   │   │   ├── index.ts
│   │   │   │   └── __tests__/       # ✅ [NUEVO] 2 test files
│   │   │   ├── useArticles.ts       # ✅ Migrated to factory
│   │   │   ├── useClients.ts        # ✅ Migrated to factory
│   │   │   └── + 29 legacy hooks
│   │   ├── errors/                  # ✅ [NUEVO] Error handling
│   │   │   ├── AppError.ts
│   │   │   ├── handler.ts
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── api-helpers/             # ✅ [NUEVO] API utilities
│   │   │   ├── extractParams.ts
│   │   │   ├── responses.ts
│   │   │   ├── index.ts
│   │   │   └── __tests__/
│   │   ├── utils/                   # ✅ Utilidades
│   │   │   ├── articleSorting.ts
│   │   │   ├── errors.ts
│   │   │   ├── mapper.ts
│   │   │   ├── salesCalculations.ts
│   │   │   └── __tests__/           # ✅ [NUEVO] 4 test files
│   │   ├── validations/             # ✅ Schemas Zod
│   │   │   ├── schemas.ts
│   │   │   └── __tests__/           # ✅ [NUEVO]
│   │   ├── auth/                    # ✅ JWT, roles, guards
│   │   │   ├── guards.ts
│   │   │   ├── jwt.ts
│   │   │   ├── roles.ts
│   │   │   └── __tests__/           # ✅ [NUEVO] 2 test files
│   │   ├── permissions/             # ✅ Permissions logic
│   │   │   └── __tests__/           # ✅ [NUEVO]
│   │   ├── db.ts                    # ✅ Prisma client singleton
│   │   └── utils.ts                 # ✅ Utilidades generales
│   ├── store/                       # ✅ Zustand stores
│   │   └── authStore.ts
│   ├── hooks/                       # ✅ Custom React hooks
│   ├── prisma/                      # ✅ Base de datos
│   │   ├── schema.prisma            # ✅ Schema
│   │   ├── migrations/              # ✅ Migraciones
│   │   └── seed.ts                  # ⚠️ Seed (si existe)
│   ├── public/                      # ✅ Activos estáticos
│   │   └── logo.png
│   ├── scripts/                     # ✅ Scripts utilidad
│   │   └── generate-classifications.ts
│   ├── .env                         # ✅ Variables entorno
│   ├── .gitignore                   # ✅ Git ignore
│   ├── eslint.config.mjs            # ✅ ESLint config
│   ├── next.config.ts               # ✅ Next.js config
│   ├── package.json                 # ✅ Dependencies
│   ├── postcss.config.mjs           # ✅ PostCSS config
│   ├── tailwind.config.ts           # ✅ Tailwind config
│   └── tsconfig.json                # ✅ TypeScript config
├── database/                        # ✅ Scripts importación
│   └── import-from-sqlserver.ts
├── docs/                            # ✅ Documentación (nueva)
│   ├── architecture-overview.md
│   ├── components-interaction.md
│   ├── folder-structure-analysis.md
│   ├── improvement-opportunities.md
│   ├── code-quality-tools.md
│   └── solid-principles-analysis.md
├── .specstory/                      # ✅ Historial de specs
├── docker-compose.yml               # ✅ Orquestación Docker
├── env.example                      # ✅ Ejemplo de .env
└── README.md                        # ⚠️ Probablemente necesita actualización
```

## 2. Evaluación de la Estructura

### 2.1 ✅ Aspectos Positivos

1. **Organización por Dominio en Componentes**
   - Cada módulo tiene su carpeta: `articles/`, `clients/`, `invoices/`
   - Facilita encontrar componentes relacionados
   - Escala bien con el crecimiento del proyecto

2. **Separación Clara entre UI y Lógica**
   - `components/ui/` para componentes base reutilizables
   - `lib/services/` para lógica de negocio
   - `lib/utils/` para utilidades
   - `store/` para estado global

3. **API Routes Organizadas**
   - Carpetas por recurso en `app/api/`
   - Fácil mapeo entre ruta y código
   - RESTful naming conventions

4. **Configuración Centralizada**
   - Archivos de config en raíz de `frontend/`
   - `.env` para variables de entorno
   - Configs de TypeScript, ESLint, Tailwind bien estructuradas

5. **Servicios de Negocio Centralizados**
   - `lib/services/` con servicios específicos
   - Evita duplicación de lógica
   - Facilita testing unitario

### 2.2 ⚠️ Áreas de Mejora

#### A. Tests (IMPLEMENTADOS EN FASE 1-3) ✅

```
✅ frontend/
   ├── lib/
   │   ├── services/__tests__/       # ✅ IMPLEMENTADO: 22 archivos
   │   ├── utils/__tests__/          # ✅ IMPLEMENTADO: 4 archivos
   │   ├── auth/__tests__/           # ✅ IMPLEMENTADO: 2 archivos
   │   ├── errors/__tests__/         # ✅ IMPLEMENTADO: 1 archivo
   │   ├── api-helpers/__tests__/    # ✅ IMPLEMENTADO: 1 archivo
   │   ├── permissions/__tests__/    # ✅ IMPLEMENTADO: 1 archivo
   │   ├── validations/__tests__/    # ✅ IMPLEMENTADO: 1 archivo
   │   └── hooks/api/__tests__/      # ✅ IMPLEMENTADO: 2 archivos
```

**Total: 53 test files, 706 tests passing**

**Pendiente**:
```
❌ frontend/
   ├── __tests__/                    # E2E tests
   ├── components/__tests__/         # Component tests (Fase 4)
   └── app/api/__tests__/            # Integration tests (Fase 3.18)
```

#### B. Tipos TypeScript No Centralizados

```
❌ Tipos mezclados en varios archivos
```

**Debería haber:**
```
✅ frontend/
   ├── types/                    # Tipos compartidos
   │   ├── api.ts               # Tipos de API
   │   ├── models.ts            # Tipos de modelos
   │   ├── forms.ts             # Tipos de formularios
   │   └── index.ts             # Re-exports
```

#### C. Constantes No Centralizadas

```
❌ Constantes hardcodeadas en archivos
```

**Debería haber:**
```
✅ frontend/
   ├── constants/
   │   ├── routes.ts            # Rutas de la app
   │   ├── permissions.ts       # Permisos y roles
   │   ├── status.ts            # Estados de entidades
   │   └── index.ts
```

#### D. Configuraciones de Ambiente

```
⚠️ .env en frontend/ (puede estar en git)
```

**Mejor práctica:**
```
✅ frontend/
   ├── .env                     # Gitignored
   ├── .env.example             # ✅ Ya existe
   ├── .env.development         # Dev overrides
   ├── .env.production          # Prod overrides
   └── .env.test                # Test overrides
```

#### E. Estructura de Hooks (PARCIALMENTE IMPLEMENTADO) ⚠️

**IMPLEMENTADO**:
```
✅ frontend/
   ├── lib/hooks/
   │   ├── api/                     # ✅ Hooks genéricos (NUEVO)
   │   │   ├── createCRUDHooks.ts   # Factory pattern
   │   │   ├── useEntityQuery.ts    # Generic query
   │   │   ├── useEntityMutation.ts # Generic mutation
   │   │   ├── index.ts
   │   │   └── __tests__/
   │   ├── useArticles.ts           # ✅ Migrated to factory
   │   ├── useClients.ts            # ✅ Migrated to factory
   │   ├── useSalesOrders.ts        # Legacy (pending migration)
   │   ├── useInvoices.ts           # Legacy (pending migration)
   │   └── + 27 more hooks          # Legacy (pending migration)
```

**Pendiente (Fase 4)**:
- Migrar 29 hooks restantes al factory pattern
- Organizar por categoría (api/, ui/, auth/) si es necesario

#### F. Scripts de Migración y Seed

```
⚠️ prisma/seed.ts no visible
⚠️ Scripts de migración dispersos
```

**Mejor estructura:**
```
✅ frontend/
   ├── prisma/
   │   ├── schema.prisma
   │   ├── migrations/
   │   ├── seeds/               # Seeds organizados
   │   │   ├── users.seed.ts
   │   │   ├── categories.seed.ts
   │   │   └── index.ts
   │   └── seed.ts              # Entry point
```

#### G. Documentación de API

```
❌ No hay documentación de API generada
```

**Debería haber:**
```
✅ frontend/
   ├── docs/
   │   ├── api/                 # Docs de API
   │   │   ├── openapi.yaml     # OpenAPI spec
   │   │   └── endpoints.md     # Lista de endpoints
   │   └── ...
```

## 3. Propuesta de Estructura Mejorada

```
spisa-new/
├── frontend/
│   ├── app/                         # ✅ Sin cambios
│   ├── components/                  # ✅ Sin cambios
│   ├── lib/
│   │   ├── services/                # ✅ Sin cambios
│   │   ├── utils/                   # ✅ Sin cambios
│   │   ├── validations/             # ✅ Sin cambios
│   │   ├── auth/                    # ✅ Sin cambios
│   │   ├── db.ts                    # ✅ Sin cambios
│   │   └── utils.ts                 # ✅ Sin cambios
│   ├── store/                       # ✅ Sin cambios
│   ├── hooks/
│   │   ├── api/                     # 🆕 Hooks de API
│   │   ├── ui/                      # 🆕 Hooks de UI
│   │   └── auth/                    # 🆕 Hooks de auth
│   ├── types/                       # 🆕 Tipos centralizados
│   │   ├── api.ts
│   │   ├── models.ts
│   │   ├── forms.ts
│   │   └── index.ts
│   ├── constants/                   # 🆕 Constantes
│   │   ├── routes.ts
│   │   ├── permissions.ts
│   │   ├── status.ts
│   │   └── index.ts
│   ├── __tests__/                   # 🆕 Tests E2E
│   │   ├── e2e/
│   │   └── integration/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   ├── seeds/                   # 🆕 Seeds organizados
│   │   └── seed.ts
│   ├── public/
│   ├── scripts/
│   ├── .env.development             # 🆕 Env específico
│   ├── .env.production              # 🆕 Env específico
│   ├── .env.test                    # 🆕 Env específico
│   └── ... (configs sin cambios)
├── docs/                            # ✅ Ya creado
│   ├── architecture-overview.md
│   ├── components-interaction.md
│   ├── folder-structure-analysis.md
│   ├── improvement-opportunities.md
│   ├── code-quality-tools.md
│   ├── solid-principles-analysis.md
│   └── api/                         # 🆕 Docs de API
│       ├── openapi.yaml
│       └── endpoints.md
├── database/
└── ... (resto sin cambios)
```

## 4. Análisis por Capa

### 4.1 Capa de Presentación (Componentes)

**Estado Actual:** ✅ Bien Organizada

**Fortalezas:**
- Separación entre componentes base (`ui/`) y de dominio
- Naming conventions claros
- Un componente por archivo

**Mejoras:**
- Agregar archivos `.test.tsx` junto a cada componente
- Crear un archivo `index.ts` en cada carpeta para re-exports
- Documentar props complejas con JSDoc

**Ejemplo:**
```typescript
// components/articles/index.ts
export { ArticlesTable } from './ArticlesTable'
export { ArticleDialog } from './ArticleDialog'
export { QuickArticleLookup } from './QuickArticleLookup'

// components/articles/ArticleDialog.tsx
/**
 * Dialog para crear/editar artículos
 *
 * @param article - Artículo a editar (undefined para crear)
 * @param open - Estado del dialog
 * @param onOpenChange - Callback para cambio de estado
 * @param onSuccess - Callback ejecutado al crear/editar exitosamente
 */
export function ArticleDialog(props: ArticleDialogProps) {
  // ...
}
```

### 4.2 Capa de Lógica (lib/)

**Estado Actual:** ✅ Bien Organizada

**Fortalezas:**
- Servicios separados por responsabilidad
- Utils organizados
- Auth centralizado

**Mejoras:**
- Agregar tests unitarios para cada servicio
- Crear interfaces para servicios (mejor testing y mocking)
- Centralizar manejo de errores

**Ejemplo:**
```typescript
// lib/services/interfaces.ts
export interface IActivityLogger {
  logActivity(params: LogActivityParams): Promise<void>
}

// lib/services/activityLogger.ts
export class ActivityLogger implements IActivityLogger {
  async logActivity(params: LogActivityParams): Promise<void> {
    // ...
  }
}

// lib/services/activityLogger.test.ts
describe('ActivityLogger', () => {
  it('should log activity with correct params', async () => {
    // ...
  })
})
```

### 4.3 Capa de API (app/api/)

**Estado Actual:** ✅ Bien Organizada

**Fortalezas:**
- RESTful conventions
- Organización por recurso
- Middleware centralizado

**Mejoras:**
- Agregar tests de integración para cada endpoint
- Documentar con OpenAPI/Swagger
- Centralizar manejo de errores

**Ejemplo:**
```typescript
// app/api/articles/route.ts
/**
 * @openapi
 * /api/articles:
 *   get:
 *     tags:
 *       - Articles
 *     summary: Obtener lista de artículos
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de artículos
 */
export async function GET(request: NextRequest) {
  // ...
}
```

### 4.4 Capa de Datos (prisma/)

**Estado Actual:** ✅ Bien Organizada

**Fortalezas:**
- Schema bien definido
- Migraciones automáticas
- Relaciones claras

**Mejoras:**
- Agregar seeds organizados
- Documentar schema con comentarios
- Crear views para queries complejas

## 5. Convenciones de Nombres

### 5.1 Archivos

**Estado Actual:** ✅ Consistente

- Componentes: `PascalCase.tsx`
- Utilidades: `camelCase.ts`
- Tipos: `PascalCase.ts` o `camelCase.ts`
- Tests: `*.test.ts` o `*.test.tsx`

### 5.2 Carpetas

**Estado Actual:** ✅ Consistente

- Rutas: `kebab-case/` (API routes, pages)
- Componentes: `camelCase/` (domain folders)
- Config: `lowercase/`

### 5.3 Variables y Funciones

**Estado Actual:** ✅ Consistente

- Variables: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`
- Funciones: `camelCase`
- Componentes: `PascalCase`

## 6. Gestión de Dependencias

### 6.1 package.json

**Estado Actual:** ✅ Bien Organizado

**Mejoras:**
- Separar mejor devDependencies
- Agregar scripts para testing
- Versionar dependencies con rangos controlados

**Sugerencia:**
```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:e2e": "playwright test",
    "lint": "next lint",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit",
    "db:migrate": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  }
}
```

## 7. Archivos de Configuración

### 7.1 Ubicación

**Estado Actual:** ✅ Correcta (raíz de frontend/)

- `next.config.ts`
- `tsconfig.json`
- `tailwind.config.ts`
- `eslint.config.mjs`
- `postcss.config.mjs`

### 7.2 Mejoras

- Agregar `jest.config.js`
- Agregar `playwright.config.ts` para E2E
- Agregar `.prettierrc` para formateo consistente

## 8. Recomendaciones Finales

### 8.1 Prioridad Alta

1. ✅ **Crear carpeta `docs/`** - Ya hecho
2. 🔴 **Agregar testing** - Crítico
3. 🔴 **Centralizar tipos** - Importante para type safety
4. 🟡 **Centralizar constantes** - Reduce hardcoding

### 8.2 Prioridad Media

5. 🟡 **Organizar hooks** - Mejor DX
6. 🟡 **Seeds organizados** - Facilita testing
7. 🟡 **Documentación de API** - Mejor colaboración

### 8.3 Prioridad Baja

8. 🟢 **Prettier config** - Formateo consistente
9. 🟢 **Re-exports con index.ts** - Imports más limpios
10. 🟢 **JSDoc en componentes complejos** - Mejor DX

## 9. Comparación con Best Practices

| Aspecto | Estado Actual | Best Practice | Cumple |
|---------|---------------|---------------|--------|
| Separación de capas | ✅ Clara | Presentación, Lógica, Datos | ✅ |
| Organización por dominio | ✅ Sí | Por feature/dominio | ✅ |
| Tests | ❌ No | Tests co-ubicados | ❌ |
| Tipos centralizados | ⚠️ Parcial | Carpeta `types/` | ⚠️ |
| Constantes | ⚠️ Dispersas | Carpeta `constants/` | ⚠️ |
| Hooks organizados | ⚠️ Básico | Por categoría | ⚠️ |
| Docs de API | ❌ No | OpenAPI/Swagger | ❌ |
| Seeds | ⚠️ Básico | Organizados | ⚠️ |
| Env files | ⚠️ Básico | Por ambiente | ⚠️ |
| Naming conventions | ✅ Consistente | Consistente | ✅ |

**Score: 6/10 ✅ | 4/10 ⚠️ | 0/10 ❌**

## Conclusión

La estructura de carpetas actual es **sólida y bien pensada** pero tiene margen de mejora en:
- Testing (prioridad crítica)
- Centralización de tipos y constantes
- Documentación de API
- Organización de hooks y seeds

La base es excelente para escalar, solo necesita complementarse con las prácticas mencionadas.
