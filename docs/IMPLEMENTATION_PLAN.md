# SPISA - Plan de Implementación Exhaustivo

## Resumen

**Archivos totales a refactorizar: 161**
- API Routes: 72
- Componentes: 54 (34 UI primitivos están OK)
- Servicios: 10
- Utilidades: 3
- Hooks: 2
- Páginas: 20

**Organización:** 5 Fases iterativas. Cada fase lista TODOS los archivos involucrados. No se avanza a la siguiente fase hasta completar la anterior al 100%.

---

## Fase 0: Herramientas de Calidad

**Objetivo:** Configurar tooling antes de tocar código de negocio.

### 0.1 Prettier

- [x] Instalar `prettier`, `eslint-config-prettier`, `prettier-plugin-tailwindcss`
- [x] Crear `.prettierrc.json`
- [x] Crear `.prettierignore`
- [x] Ejecutar `prettier --write .` sobre todo el proyecto
- [x] Agregar scripts `format` y `format:check` en package.json

### 0.2 Husky + Lint-staged

- [x] Instalar `husky`, `lint-staged`
- [x] Ejecutar `npx husky install`
- [x] Crear `.husky/pre-commit` con `npx lint-staged`
- [x] Crear `.lintstagedrc.json`

### 0.3 Commitlint

- [x] Instalar `@commitlint/cli`, `@commitlint/config-conventional`
- [x] Crear `commitlint.config.js`
- [x] Crear `.husky/commit-msg`

### 0.4 ESLint mejorado

- [x] Instalar `eslint-plugin-import`
- [x] Agregar reglas de ordenamiento de imports
- [x] Agregar regla `no-console` (warn)
- [x] Agregar regla `@typescript-eslint/no-explicit-any` (warn)
- [x] Ejecutar `eslint --fix` sobre todo el proyecto

### 0.5 TypeScript estricto

- [x] Agregar `noUnusedLocals: true` en tsconfig.json
- [x] Agregar `noUnusedParameters: true`
- [x] Agregar `noImplicitReturns: true`
- [x] Agregar `noFallthroughCasesInSwitch: true`
- [x] Corregir todos los errores que aparezcan

### 0.6 Jest

- [x] Instalar `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`, `@types/jest`
- [x] Crear `jest.config.js`
- [x] Crear `jest.setup.js`
- [x] Agregar scripts `test`, `test:watch`, `test:coverage`
- [x] Crear `.husky/pre-push` con `npm test`

### 0.7 VSCode

- [x] Crear `.vscode/settings.json`
- [x] Crear `.vscode/extensions.json`

**Criterio de completitud:** Todas las herramientas funcionando, todo el código formateado, lint pasando, TypeScript sin errores.

---

## Fase 1: Infraestructura de Código

**Objetivo:** Crear las capas base que usarán todas las refactorizaciones posteriores.

### 1.1 Tipos centralizados

Ya existían 23 archivos de tipos por dominio (mejor organización que la propuesta por categoría):

- [x] `types/index.ts` - Re-exports barrel (creado)
- [x] Tipos por dominio: article.ts, salesOrder.ts, invoice.ts, client.ts, etc. (ya existían)
- [x] Tipos de API: api.ts, pagination.ts (ya existían)
- [x] Tipos de formularios: dentro de cada archivo de dominio (ya existían)
- [x] Enumeraciones: clientClassification.ts, stockMovement.ts, supplierOrder.ts (ya existían)

### 1.2 Error handling centralizado

- [x] `lib/errors/AppError.ts` - Clase base con métodos estáticos (badRequest, unauthorized, forbidden, notFound, conflict, internal)
- [x] `lib/errors/handler.ts` - Función `handleError()` que maneja ZodError, Prisma errors, AppError y errores genéricos
- [x] `lib/errors/index.ts` - Re-exports
- [x] Tests: `lib/errors/__tests__/errors.test.ts`
- [x] `components/ui/error-boundary.tsx` - ErrorBoundary class component + ErrorFallback funcional
- [x] Integrar ErrorBoundary en `app/dashboard/layout.tsx`

### 1.3 Helpers de API

- [x] `lib/api-helpers/extractParams.ts` - Función `extractPaginationParams(request)` con validación y clamping
- [x] `lib/auth/roles.ts` → `getUserFromRequest(request)` ya existía
- [x] `lib/api-helpers/responses.ts` - Funciones helper: `successResponse()`, `createdResponse()`, `paginatedResponse()`, `noContentResponse()`
- [x] `lib/api-helpers/index.ts` - Re-exports
- [x] Tests: `lib/api-helpers/__tests__/api-helpers.test.ts`

### 1.4 Interfaces de repositorios

_(Pospuesto: se creará incrementalmente junto con Fase 2 cuando se refactoricen los servicios)_

### 1.5 Implementaciones Prisma de repositorios

_(Pospuesto: se creará incrementalmente junto con Fase 2)_

### 1.6 Hooks reutilizables

- [x] `lib/hooks/api/useEntityMutation.ts` - Mutation genérica con error handling centralizado y toast
- [x] `lib/hooks/api/useEntityQuery.ts` - Query genérica + useEntityById
- [x] `lib/hooks/api/createCRUDHooks.ts` - Factory para generar hooks CRUD completos (useList, useById, useCreate, useUpdate, useDelete)
- [x] `lib/hooks/api/index.ts` - Re-exports barrel
- [x] `lib/hooks/api/__tests__/useEntityMutation.test.ts` - 13 tests (extractErrorMessage)
- [x] `lib/hooks/api/__tests__/createCRUDHooks.test.ts` - 8 tests (factory generation)

### 1.7 Constantes centralizadas

- [x] `lib/constants/operations.ts` - Operaciones de auditoría (ya existía)
- [x] `lib/constants/stockMovementTypes.ts` - Tipos de movimiento de stock (ya existía)
- [x] `lib/constants/status.ts` - Estados de pedidos y pedidos a proveedor (creado)
- [x] `lib/constants/index.ts` - Re-exports barrel (creado)
- [x] `lib/auth/roles.ts` - Roles y permisos (ya existía)

### 1.8 Componente DataTable genérico

- [x] `components/ui/data-table.tsx` - DataTable<T> genérico con soporte para: columnas tipadas (ColumnDef<T>), sorting via SortableTableHead, paginación via Pagination, filas clickeables via ClickableTableRow, estados vacío/loading

**Criterio de completitud:** Infraestructura base creada, compilando sin errores, con tests unitarios para error handler, API helpers, y hooks genéricos. ErrorBoundary integrado en layout.

---

## Fase 2: Refactorización de Servicios y Utilidades

**Objetivo:** Refactorizar TODOS los servicios existentes y crear los nuevos que extraen lógica de los routes.

### 2.1 Refactorizar utilidades existentes

- [x] `lib/utils/mapper.ts` → Agregar tipos de retorno explícitos (ArticleDTO, CategoryDTO, ClientDTO, SalesOrderDTO, InvoiceDTO, DeliveryNoteDTO)
- [x] `lib/utils/salesCalculations.ts` → Agregar cálculos financieros (calculateDiscountedPrice, calculateLineTotal, calculateSubtotal) y calculateTrendDirection compartido
- [x] `lib/utils/articleSorting.ts` → Ya bien estructurado con SortableArticle interface y comparadores reutilizables exportados

### 2.2 Refactorizar servicios existentes

- [x] `lib/services/activityLogger.ts` → Agregar interface IActivityLogger, extraer extractRequestContext
- [x] `lib/services/changeTracker.ts` → Registry pattern (entityRegistry reemplaza switches), exportar EntityKey type
- [x] `lib/services/abcClassification.ts` → Extraer función pura classifyByRevenue, eliminar console.log
- [x] `lib/services/clientClassification.ts` → Exportar classifyClient y scoring functions, usar calculateTrendDirection compartido
- [x] `lib/services/clientSalesTrends.ts` → Eliminar console.log noise
- [x] `lib/services/salesTrends.ts` → Eliminar console.log noise
- [x] `lib/services/stockValuation.ts` → Usar calculateTrendDirection compartido, exportar classifyStockStatus, eliminar console.log
- [x] `lib/services/PDFService.ts` → Agregar validación de datos de entrada en generate methods
- [x] `lib/services/proformaImport/article-matcher.ts` → Agregar IArticleMatcher interface, eliminar console.log
- [x] `lib/services/proformaImport/bestflow-extractor.ts` → Agregar validación de input (buffer/sheets), mejorar error handling
- [x] `lib/services/proformaImport/matching-normalizer.ts` → Ya integrado con tipos centralizados de ./types

### 2.3 Crear servicios nuevos (extraídos de API routes)

- [x] `lib/services/ArticleService.ts` → Lógica de: crear, actualizar, eliminar, enriquecer con ABC/trends, validar stock
- [x] `lib/services/ClientService.ts` → Lógica de: crear, actualizar, eliminar, clasificar, calcular crédito
- [x] `lib/services/SalesOrderService.ts` → Lógica de: crear con items, actualizar, generar número secuencial, calcular totales, validar stock, cambiar estado
- [x] `lib/services/InvoiceService.ts` → Lógica de: crear desde pedido, cancelar, generar número, calcular impuestos, gestionar movimientos de stock
- [x] `lib/services/DeliveryNoteService.ts` → Lógica de: crear desde pedido, calcular pesos/bultos
- [x] `lib/services/PriceListService.ts` → Lógica de: bulk update, draft management, revert, undo, historial
- [x] `lib/services/SupplierOrderService.ts` → Lógica de: importar, sincronizar datos, sincronizar pesos, cambiar estado
- [x] `lib/services/DashboardService.ts` → Lógica de: métricas, charts, agregaciones
- [x] `lib/services/CertificateService.ts` → Lógica de: sync, download, vincular coladas
- [x] `lib/services/UserService.ts` → Lógica de: crear, actualizar, validar permisos
- [x] `lib/services/AuthService.ts` → Lógica de: login, validar token, refresh
- [x] `lib/services/CategoryService.ts` → Lógica de: CRUD categorías, gestionar descuentos por condición de pago
- [x] `lib/services/SupplierService.ts` → Lógica de: CRUD proveedores con auditoría
- [x] `lib/services/FeedbackService.ts` → Lógica de: CRUD feedback con validación de estados/prioridades
- [x] `lib/services/SettingsService.ts` → Lógica de: get/update settings con change tracking

### 2.4 Tests para TODOS los servicios

- [x] `lib/services/__tests__/activityLogger.test.ts`
- [x] `lib/services/__tests__/changeTracker.test.ts`
- [x] `lib/services/__tests__/abcClassification.test.ts`
- [x] `lib/services/__tests__/clientClassification.test.ts`
- [x] `lib/services/__tests__/clientSalesTrends.test.ts`
- [x] `lib/services/__tests__/salesTrends.test.ts`
- [x] `lib/services/__tests__/stockValuation.test.ts`
- [x] `lib/services/__tests__/PDFService.test.ts`
- [x] `lib/services/proformaImport/__tests__/article-matcher.test.ts`
- [x] `lib/services/__tests__/ArticleService.test.ts`
- [x] `lib/services/__tests__/ClientService.test.ts`
- [x] `lib/services/__tests__/SalesOrderService.test.ts`
- [x] `lib/services/__tests__/InvoiceService.test.ts`
- [x] `lib/services/__tests__/DeliveryNoteService.test.ts`
- [x] `lib/services/__tests__/PriceListService.test.ts`
- [x] `lib/services/__tests__/SupplierOrderService.test.ts`
- [x] `lib/services/__tests__/DashboardService.test.ts`
- [x] `lib/services/__tests__/CertificateService.test.ts`
- [x] `lib/services/__tests__/UserService.test.ts`
- [x] `lib/services/__tests__/AuthService.test.ts`
- [x] `lib/services/__tests__/CategoryService.test.ts`
- [x] `lib/services/__tests__/SupplierService.test.ts`
- [x] `lib/services/__tests__/FeedbackService.test.ts`
- [x] `lib/services/__tests__/SettingsService.test.ts`

### 2.5 Tests para utilidades

- [x] `lib/utils/__tests__/mapper.test.ts`
- [x] `lib/utils/__tests__/salesCalculations.test.ts`
- [x] `lib/utils/__tests__/articleSorting.test.ts`

**Criterio de completitud:** Todos los servicios refactorizados y creados. Tests pasando para cada servicio. 0 lógica de negocio queda en los API routes (se verifica en Fase 3).

---

## Fase 3: Refactorización de TODAS las API Routes

**Objetivo:** Todas las 72 API routes usan servicios, repositorios, error handler centralizado y helpers de API. Ninguna contiene lógica de negocio.

### Patrón objetivo para cada route:

```typescript
import { handleError } from '@/lib/errors'
import { extractPaginationParams, extractUser, paginatedResponse } from '@/lib/api'
import { ArticleService } from '@/lib/services/ArticleService'

export async function GET(request: NextRequest) {
  try {
    const user = extractUser(request)
    const params = extractPaginationParams(request)
    const result = await articleService.list(params)
    return paginatedResponse(result)
  } catch (error) {
    return handleError(error)
  }
}
```

### 3.1 Routes de Auth (3 archivos)

- [x] `app/api/auth/login/route.ts` → Usar AuthService.login()
- [x] `app/api/auth/logout/route.ts` → Thin wrapper (clearAuthCookie + logActivity)
- [x] `app/api/auth/me/route.ts` → Usar AuthService.validateSession()

### 3.2 Routes de Articles (4 archivos)

- [x] `app/api/articles/route.ts` → Usar ArticleService.list(), ArticleService.create()
- [x] `app/api/articles/[id]/route.ts` → Usar ArticleService.getById(), .update(), .delete()
- [x] `app/api/articles/abc-refresh/route.ts` → Usar ArticleService.refreshABC()
- [x] `app/api/articles/valuation/route.ts` → Usar ArticleService.getValuation()

### 3.3 Routes de Clients (4 archivos)

- [x] `app/api/clients/route.ts` → Usar ClientService.list(), .create()
- [x] `app/api/clients/[id]/route.ts` → Usar ClientService.getById(), .update(), .delete()
- [x] `app/api/clients/[id]/payment-term/route.ts` → Usar ClientService.updatePaymentTerm()
- [x] `app/api/clients/classification/route.ts` → Usar ClientService.getClassification()

### 3.4 Routes de Sales Orders (5 archivos)

- [x] `app/api/sales-orders/route.ts` → Usar SalesOrderService.list(), .create()
- [x] `app/api/sales-orders/[id]/route.ts` → Usar SalesOrderService.getById(), .update(), .delete()
- [x] `app/api/sales-orders/[id]/generate-invoice/route.ts` → Usar SalesOrderService.generateInvoice()
- [x] `app/api/sales-orders/[id]/generate-delivery-note/route.ts` → Usar SalesOrderService.generateDeliveryNote()
- [x] `app/api/sales-orders/[id]/permissions/route.ts` → Usar SalesOrderService.getPermissions()

### 3.5 Routes de Invoices (10 archivos)

- [x] `app/api/invoices/route.ts` → Usar InvoiceService.list(), .create()
- [x] `app/api/invoices/[id]/route.ts` → Usar InvoiceService.getById(), .update(), .delete()
- [x] `app/api/invoices/[id]/cancel/route.ts` → Usar InvoiceService.cancel()
- [x] `app/api/invoices/[id]/exchange-rate/route.ts` → Usar InvoiceService.updateExchangeRate()
- [x] `app/api/invoices/[id]/items/route.ts` → Usar InvoiceService.updateItems()
- [x] `app/api/invoices/[id]/payment-term/route.ts` → Usar InvoiceService.updatePaymentTerm()
- [x] `app/api/invoices/[id]/pdf/route.ts` → Usar InvoiceService.getPDF()
- [x] `app/api/invoices/[id]/preview-pdf/route.ts` → Usar InvoiceService.getPDF()
- [x] `app/api/invoices/[id]/print/route.ts` → Usar InvoiceService.print()
- [x] `app/api/invoices/[id]/print-pdf/route.ts` → Usar InvoiceService.print()
- [x] `app/api/invoices/[id]/stock-movements/route.ts` → Usar InvoiceService.getStockMovements()

### 3.6 Routes de Delivery Notes (4 archivos)

- [x] `app/api/delivery-notes/route.ts` → Usar DeliveryNoteService.list(), .create()
- [x] `app/api/delivery-notes/[id]/route.ts` → Usar DeliveryNoteService.getById()
- [x] `app/api/delivery-notes/[id]/pdf/route.ts` → Usar DeliveryNoteService.getPDF()
- [x] `app/api/delivery-notes/[id]/print/route.ts` → Usar DeliveryNoteService.print()

### 3.7 Routes de Categories (3 archivos)

- [x] `app/api/categories/route.ts` → Usar CategoryService.list(), .create()
- [x] `app/api/categories/[id]/route.ts` → Usar CategoryService.getById(), .update(), .remove()
- [x] `app/api/categories/[id]/payment-discounts/route.ts` → Usar CategoryService.getPaymentDiscounts(), .updatePaymentDiscounts()

### 3.8 Routes de Payment Terms (2 archivos)

- [x] `app/api/payment-terms/route.ts` → Prisma directo + handleError
- [x] `app/api/payment-terms/[id]/route.ts` → Prisma directo + handleError + logActivity

### 3.9 Routes de Price Lists (6 archivos)

- [x] `app/api/price-lists/route.ts` → Usar PriceListService.list()
- [x] `app/api/price-lists/bulk-update/route.ts` → Usar PriceListService.bulkUpdate()
- [x] `app/api/price-lists/draft/route.ts` → Usar PriceListService.saveDraft(), .loadDraft(), .deleteDraft()
- [x] `app/api/price-lists/revert/route.ts` → Usar PriceListService.revertSingle()
- [x] `app/api/price-lists/revert-batch/route.ts` → Usar PriceListService.revertBatch()
- [x] `app/api/price-lists/undo/route.ts` → Usar PriceListService.undo()

### 3.10 Routes de Supplier Orders (6 archivos)

- [x] `app/api/supplier-orders/route.ts` → Usar SupplierOrderService.list(), .create()
- [x] `app/api/supplier-orders/[id]/route.ts` → Usar SupplierOrderService.getById(), .update()
- [x] `app/api/supplier-orders/[id]/status/route.ts` → Usar SupplierOrderService.updateStatus()
- [x] `app/api/supplier-orders/[id]/sync-data/route.ts` → Usar SupplierOrderService.syncData()
- [x] `app/api/supplier-orders/[id]/sync-weights/route.ts` → Usar SupplierOrderService.syncWeights()
- [x] `app/api/supplier-orders/import/route.ts` → Usar SupplierOrderService.importProforma()

### 3.11 Routes de Certificates (4 archivos)

- [x] `app/api/certificates/route.ts` → Usar CertificateService.list(), .upload()
- [x] `app/api/certificates/[id]/route.ts` → Usar CertificateService.getById(), .remove()
- [x] `app/api/certificates/[id]/download/route.ts` → Usar CertificateService.getDownloadUrl()
- [x] `app/api/certificates/sync/route.ts` → Usar CertificateService.syncFromExcel()

### 3.12 Routes de Dashboard (2 archivos)

- [x] `app/api/dashboard/metrics/route.ts` → Usar DashboardService.getMetrics()
- [x] `app/api/dashboard/charts/route.ts` → Usar DashboardService.getCharts()

### 3.13 Routes de Stock Movements (2 archivos)

- [x] `app/api/stock-movements/route.ts` → Usar ArticleService.listStockMovements()
- [x] `app/api/stock-movements/adjust/route.ts` → Usar ArticleService.adjustStock()

### 3.14 Routes de Activity Logs (2 archivos)

- [x] `app/api/activity-logs/route.ts` → Prisma directo + handleError
- [x] `app/api/activity-logs/[id]/changes/route.ts` → Prisma directo + handleError

### 3.15 Routes de Users (2 archivos)

- [x] `app/api/users/route.ts` → Usar UserService.list(), .create()
- [x] `app/api/users/[id]/route.ts` → Usar UserService.getById(), .update()

### 3.16 Routes de Lookups (5 archivos)

- [x] `app/api/lookups/operation-types/route.ts` → Prisma directo + handleError
- [x] `app/api/lookups/payment-methods/route.ts` → Prisma directo + handleError
- [x] `app/api/lookups/provinces/route.ts` → Prisma directo + handleError
- [x] `app/api/lookups/tax-conditions/route.ts` → Prisma directo + handleError
- [x] `app/api/lookups/transporters/route.ts` → Prisma directo + handleError

### 3.17 Routes restantes (7 archivos)

- [x] `app/api/coladas/route.ts` → Usar CertificateService.listColadas(), .createColada()
- [x] `app/api/feedback/route.ts` → Usar FeedbackService.list(), .create()
- [x] `app/api/feedback/[id]/route.ts` → Usar FeedbackService.update(), .remove()
- [x] `app/api/price-history/route.ts` → Usar PriceListService.getHistory()
- [x] `app/api/settings/route.ts` → Usar SettingsService.get(), .update()
- [x] `app/api/suppliers/route.ts` → Usar SupplierService.list(), .create()
- [x] `app/api/suppliers/[id]/route.ts` → Usar SupplierService.getById(), .update(), .remove()

### 3.18 Tests de integración para TODAS las routes

- [ ] `app/api/auth/__tests__/login.test.ts`
- [ ] `app/api/auth/__tests__/logout.test.ts`
- [ ] `app/api/auth/__tests__/me.test.ts`
- [ ] `app/api/articles/__tests__/route.test.ts`
- [ ] `app/api/articles/__tests__/[id].test.ts`
- [ ] `app/api/clients/__tests__/route.test.ts`
- [ ] `app/api/clients/__tests__/[id].test.ts`
- [ ] `app/api/sales-orders/__tests__/route.test.ts`
- [ ] `app/api/sales-orders/__tests__/[id].test.ts`
- [ ] `app/api/sales-orders/__tests__/generate-invoice.test.ts`
- [ ] `app/api/sales-orders/__tests__/generate-delivery-note.test.ts`
- [ ] `app/api/invoices/__tests__/route.test.ts`
- [ ] `app/api/invoices/__tests__/[id].test.ts`
- [ ] `app/api/invoices/__tests__/cancel.test.ts`
- [ ] `app/api/invoices/__tests__/pdf.test.ts`
- [ ] `app/api/delivery-notes/__tests__/route.test.ts`
- [ ] `app/api/categories/__tests__/route.test.ts`
- [ ] `app/api/price-lists/__tests__/route.test.ts`
- [ ] `app/api/price-lists/__tests__/bulk-update.test.ts`
- [ ] `app/api/supplier-orders/__tests__/route.test.ts`
- [ ] `app/api/supplier-orders/__tests__/import.test.ts`
- [ ] `app/api/certificates/__tests__/route.test.ts`
- [ ] `app/api/dashboard/__tests__/metrics.test.ts`
- [ ] `app/api/dashboard/__tests__/charts.test.ts`
- [ ] `app/api/users/__tests__/route.test.ts`
- [ ] `app/api/stock-movements/__tests__/route.test.ts`

**Criterio de completitud:** Las 72 API routes refactorizadas. Cada route tiene máximo 15-20 líneas de código. Toda lógica de negocio delegada a servicios. Tests de integración para todas las routes críticas.

---

## Fase 4: Refactorización de TODOS los Componentes

**Objetivo:** Todos los 54 componentes que necesitan refactorización cumplen SRP, usan hooks centralizados, no duplican lógica, y usan tipos centralizados.

### Patrón objetivo para cada componente:

```typescript
import type { Article } from '@/types'
import type { PagedResult } from '@/types/pagination'
import { useEntityQuery } from '@/lib/hooks/api'
import { DataTable, ColumnDef } from '@/components/ui/data-table'

const columns: ColumnDef<Article>[] = [
  { id: 'code', header: 'Código', cell: (row) => row.code, sortKey: 'code' },
  { id: 'name', header: 'Descripción', cell: (row) => row.name, sortKey: 'name' },
]

function ArticlesTable() {
  const { pagination, setSorting, setPage, setPageSize } = usePagination()
  const { data, isLoading } = useEntityQuery<PagedResult<Article>>({
    queryKey: ['articles'],
    endpoint: '/articles',
    params: pagination,
  })

  return (
    <DataTable
      data={data?.data ?? []}
      columns={columns}
      keyExtractor={(row) => row.id}
      isLoading={isLoading}
      sorting={{ ...pagination, onSort: setSorting }}
      pagination={{
        totalCount: data?.pagination.total ?? 0,
        currentPage: pagination.pageNumber,
        pageSize: pagination.pageSize,
        onPageChange: setPage,
        onPageSizeChange: setPageSize,
      }}
    />
  )
}
```

### Patrón objetivo para hooks CRUD (usando factory):

```typescript
import { createCRUDHooks } from '@/lib/hooks/api'
import { articlesApi } from '@/lib/api/articles'
import type { Article, ArticleFormData } from '@/types/article'

// Reemplaza useArticles, useArticle, useCreateArticle, useUpdateArticle, useDeleteArticle
const { useList, useById, useCreate, useUpdate, useDelete } =
  createCRUDHooks<Article, ArticleFormData, ArticleFormData>({
    entityName: 'Artículo',
    api: articlesApi,
    queryKey: 'articles',
  })

export { useList as useArticles, useById as useArticle, useCreate as useCreateArticle, useUpdate as useUpdateArticle, useDelete as useDeleteArticle }
```

### 4.1 Componentes de Sales Orders (6 archivos)

- [ ] `components/salesOrders/SalesOrderWizard.tsx` → Extraer lógica a hook `useSalesOrderWizard`, separar validación en utilidad, simplificar a orquestador
- [ ] `components/salesOrders/ItemsSelectionStep.tsx` → Usar salesCalculations centralizado, extraer lógica de agregar items a hook
- [ ] `components/salesOrders/OrderSummaryStep.tsx` → Usar salesCalculations centralizado, eliminar duplicación con ItemsSelectionStep
- [ ] `components/salesOrders/ClientSelectionStep.tsx` → Usar hook de búsqueda centralizado
- [ ] `components/salesOrders/SalesOrdersTable.tsx` → Usar useEntityQuery, separar acciones en componente aparte
- [ ] `components/salesOrders/SingleStepOrderForm.tsx` → Consolidar lógica compartida con Wizard, usar useEntityForm

### 4.2 Componentes de Price Lists (5 archivos)

- [ ] `components/priceLists/PriceListTable.tsx` → Separar en PriceListTableRow + PriceEditCell + PriceCalculations, usar salesCalculations
- [ ] `components/priceLists/PriceImportDialog.tsx` → Usar useEntityMutation, separar validación
- [ ] `components/priceLists/PriceHistoryDialog.tsx` → Usar useEntityQuery
- [ ] `components/priceLists/PriceHistoryTable.tsx` → Usar tipos centralizados
- [ ] `components/priceLists/PriceListFilters.tsx` → Extraer lógica de filtros a hook

### 4.3 Componentes de Articles (11 archivos)

- [ ] `components/articles/ArticlesTable.tsx` → Reducir de 372 líneas: extraer lógica de trends a hook, usar useEntityQuery, separar toolbar/filtros
- [ ] `components/articles/ArticleDialog.tsx` → Usar useEntityForm
- [ ] `components/articles/QuickArticleLookup.tsx` → Usar hook de búsqueda centralizado con useDebounce
- [ ] `components/articles/QuickCartPopup.tsx` → Usar hook de carrito, separar lógica de precio/descuento
- [ ] `components/articles/ClientLookup.tsx` → Usar hook de búsqueda centralizado
- [ ] `components/articles/StockAdjustDialog.tsx` → Usar useEntityMutation
- [ ] `components/articles/StockMovementsTable.tsx` → Usar useEntityQuery
- [ ] `components/articles/ValuationByCategory.tsx` → Usar useEntityQuery con tipos
- [ ] `components/articles/ValuationSummary.tsx` → Usar tipos centralizados
- [ ] `components/articles/ValuationTable.tsx` → Usar tipos centralizados, eliminar cálculos duplicados
- [ ] `components/articles/SupplierOrderPanel.tsx` → Usar useEntityQuery

### 4.4 Componentes de Clients (4 archivos)

- [ ] `components/clients/ClientDialog.tsx` → Usar useEntityForm
- [ ] `components/clients/ClientsTable.tsx` → Usar useEntityQuery
- [ ] `components/clients/ClientClassificationFilters.tsx` → Extraer lógica a hook
- [ ] `components/clients/ClientClassificationSummary.tsx` → Usar tipos centralizados

### 4.5 Componentes de Certificates (3 archivos)

- [ ] `components/certificates/CertificatesTable.tsx` → Usar useEntityQuery
- [ ] `components/certificates/CertificateViewerDialog.tsx` → Usar useEntityMutation
- [ ] `components/certificates/SyncExcelDialog.tsx` → Usar useEntityMutation

### 4.6 Componentes de Dashboard (3 archivos)

- [ ] `components/dashboard/DashboardMetrics.tsx` → Usar useEntityQuery con tipo MetricsData
- [ ] `components/dashboard/RecentSalesOrders.tsx` → Usar useEntityQuery con tipo SalesOrderPreview
- [ ] `components/dashboard/MetricCard.tsx` → Agregar tipos específicos (ya está OK en funcionalidad)

### 4.7 Componentes de Layout (6 archivos)

- [ ] `components/layout/Sidebar.tsx` → Usar constantes de rutas centralizadas
- [ ] `components/layout/Navbar.tsx` → Usar constantes de rutas centralizadas
- [ ] `components/layout/ArticulosMenuItem.tsx` → Usar constantes de rutas
- [ ] `components/layout/FacturasMenuItem.tsx` → Usar constantes de rutas
- [ ] `components/layout/PedidosMenuItem.tsx` → Usar constantes de rutas
- [ ] `components/layout/RemitosMenuItem.tsx` → Usar constantes de rutas

### 4.8 Componentes de Supplier Orders (2 archivos)

- [ ] `components/supplierOrders/ImportPreviewDialog.tsx` → Usar useEntityMutation, tipos centralizados
- [ ] `components/supplierOrders/ProformaDropZone.tsx` → Usar useEntityMutation

### 4.9 Componentes restantes (14 archivos)

- [ ] `components/activity/ActivityLogsTable.tsx` → Usar useEntityQuery
- [ ] `components/activity/ActivityChangesDetail.tsx` → Usar tipos centralizados
- [ ] `components/auth/AuthInitializer.tsx` → Usar AuthService
- [ ] `components/categories/CategoriesTable.tsx` → Usar useEntityQuery
- [ ] `components/categories/CategoryDialog.tsx` → Usar useEntityForm
- [ ] `components/deliveryNotes/DeliveryNotesTable.tsx` → Usar useEntityQuery
- [ ] `components/invoices/InvoicesTable.tsx` → Usar useEntityQuery
- [ ] `components/paymentTerms/PaymentTermDialog.tsx` → Usar useEntityForm
- [ ] `components/print/PDFPreviewModal.tsx` → Usar tipos centralizados
- [ ] `components/users/UserDialog.tsx` → Usar useEntityForm
- [ ] `components/users/UsersTable.tsx` → Usar useEntityQuery
- [ ] `components/certificates/TiffViewer.tsx` → Tipos centralizados
- [ ] `components/certificates/UploadCertificateDialog.tsx` → Usar useEntityMutation
- [ ] `components/articles/ValuationCard.tsx` → Tipos centralizados
- [ ] `components/articles/ValuationFilters.tsx` → Hook de filtros

### 4.10 Tests para componentes críticos

- [ ] `components/salesOrders/__tests__/SalesOrderWizard.test.tsx`
- [ ] `components/salesOrders/__tests__/ItemsSelectionStep.test.tsx`
- [ ] `components/priceLists/__tests__/PriceListTable.test.tsx`
- [ ] `components/priceLists/__tests__/PriceImportDialog.test.tsx`
- [ ] `components/articles/__tests__/ArticlesTable.test.tsx`
- [ ] `components/articles/__tests__/ArticleDialog.test.tsx`
- [ ] `components/articles/__tests__/QuickCartPopup.test.tsx`
- [ ] `components/clients/__tests__/ClientDialog.test.tsx`
- [ ] `components/clients/__tests__/ClientsTable.test.tsx`
- [ ] `components/dashboard/__tests__/DashboardMetrics.test.tsx`
- [ ] `components/auth/__tests__/AuthInitializer.test.tsx`

**Criterio de completitud:** Los 54 componentes refactorizados. Ninguno tiene lógica de negocio. Todos usan hooks centralizados y tipos del directorio types/. Tests para los componentes críticos.

---

## Fase 5: Refactorización de TODAS las Páginas y Limpieza Final

**Objetivo:** Páginas simplificadas, hooks refactorizados, limpieza de código muerto, cobertura de tests al 80%+.

### 5.1 Páginas de Sales Orders (4 archivos)

- [ ] `app/dashboard/sales-orders/page.tsx` → Simplificar, delegar a SalesOrdersTable
- [ ] `app/dashboard/sales-orders/new/page.tsx` → Simplificar, delegar a SalesOrderWizard
- [ ] `app/dashboard/sales-orders/[id]/page.tsx` → Usar useEntityQuery con tipo específico
- [ ] `app/dashboard/sales-orders/[id]/edit/page.tsx` → Usar useEntityQuery + useEntityForm

### 5.2 Páginas de Invoices (3 archivos)

- [ ] `app/dashboard/invoices/page.tsx` → Simplificar, delegar a InvoicesTable
- [ ] `app/dashboard/invoices/[id]/page.tsx` → Usar useEntityQuery
- [ ] `app/dashboard/invoices/new/page.tsx` → Simplificar

### 5.3 Páginas restantes (13 archivos)

- [ ] `app/dashboard/page.tsx` → Simplificar, delegar a DashboardMetrics
- [ ] `app/dashboard/articles/page.tsx` → Delegar a ArticlesTable
- [ ] `app/dashboard/articles/valuation/page.tsx` → Delegar a ValuationByCategory
- [ ] `app/dashboard/price-lists/page.tsx` → Delegar a PriceListTable
- [ ] `app/dashboard/supplier-orders/page.tsx` → Delegar
- [ ] `app/dashboard/supplier-orders/[id]/page.tsx` → Usar useEntityQuery
- [ ] `app/dashboard/activity/page.tsx` → Delegar
- [ ] `app/dashboard/categories/page.tsx` → Delegar
- [ ] `app/dashboard/certificates/page.tsx` → Delegar
- [ ] `app/dashboard/clients/page.tsx` → Delegar
- [ ] `app/dashboard/delivery-notes/page.tsx` → Delegar
- [ ] `app/dashboard/delivery-notes/[id]/page.tsx` → Usar useEntityQuery
- [ ] `app/dashboard/feedback/page.tsx` → Delegar
- [ ] `app/dashboard/feedback/admin/page.tsx` → Delegar
- [ ] `app/dashboard/payment-terms/page.tsx` → Delegar
- [ ] `app/dashboard/settings/page.tsx` → OK (simple)
- [ ] `app/dashboard/suppliers/page.tsx` → Delegar
- [ ] `app/dashboard/users/page.tsx` → Delegar

### 5.4 Refactorizar hooks existentes

- [ ] `hooks/useFormValidation.ts` → Reemplazar por useEntityForm o eliminar si queda sin uso
- [ ] `hooks/usePrintDocument.ts` → Integrar con PDFService refactorizado

### 5.5 Limpieza de código muerto

- [ ] Ejecutar `npx ts-prune` para encontrar exports no usados
- [ ] Eliminar funciones/variables no referenciadas
- [ ] Eliminar imports no usados (ESLint ya lo marca)
- [ ] Revisar componentes no montados en ninguna página
- [ ] Eliminar archivos de configuración obsoletos

### 5.6 Validación de schemas Zod

- [ ] Revisar `lib/validations/schemas.ts` → Verificar que cubre TODAS las entidades
- [ ] Agregar schemas faltantes (si hay routes sin validación Zod)
- [ ] Integrar schemas con tipos de `types/forms.ts`

### 5.7 Auditoría final de principios

- [ ] **SRP**: Verificar que cada archivo tiene una sola razón de cambio
- [ ] **OCP**: Verificar que mapper usa factory/strategy, no switch
- [ ] **LSP**: Verificar que repositorios son intercambiables
- [ ] **ISP**: Verificar que componentes reciben solo props necesarias
- [ ] **DIP**: Verificar que servicios dependen de interfaces, no de Prisma directo
- [ ] **DRY**: Buscar duplicaciones con herramientas (jscpd o similar)
- [ ] **YAGNI**: Eliminar código especulativo no usado

### 5.8 Cobertura de tests final

- [ ] Ejecutar `npm run test:coverage`
- [ ] Identificar archivos con cobertura < 80%
- [ ] Escribir tests faltantes hasta alcanzar 80% global
- [ ] Verificar que todos los flujos críticos están cubiertos:
  - [ ] Login/logout
  - [ ] CRUD completo de artículos
  - [ ] Crear pedido de venta
  - [ ] Generar factura desde pedido
  - [ ] Generar remito desde pedido
  - [ ] Importar precios
  - [ ] Ajuste de stock
  - [ ] Clasificación ABC

### 5.9 Documentación actualizada

- [ ] `docs/architecture-overview.md` → Refleja nueva arquitectura con repositorios y servicios
- [ ] `docs/components-interaction.md` → Flujos actualizados
- [ ] `docs/folder-structure-analysis.md` → Nueva estructura con types/, constants/, repositories/
- [ ] `docs/improvement-opportunities.md` → Todo marcado como implementado
- [ ] `docs/code-quality-tools.md` → Todas las herramientas marcadas como activas
- [ ] `docs/solid-principles-analysis.md` → Todos los principios marcados como cumplidos

**Criterio de completitud:**
- 0 archivos pendientes de refactorización
- Cobertura de tests >= 80%
- 0 violaciones de principios SOLID detectadas
- 0 duplicación de código significativa
- Documentación 100% actualizada
- ESLint y TypeScript sin errores ni warnings

---

## Tracking de Progreso

### Contadores

| Fase | Total Items | Completados | % | Nota |
|------|-------------|-------------|---|------|
| Fase 0: Herramientas | 30 | 30 | 100% | Completa |
| Fase 1: Infraestructura | 24 | 24 | 100% | Completa: ErrorBoundary ✓, Hooks genéricos ✓, DataTable ✓ |
| Fase 2: Servicios | 52 | 52 | 100% | Completa: utils, servicios, 24/24 tests |
| Fase 3: API Routes | 98 | 72 | 73% | 72/72 routes ✓, faltan 26 integration tests |
| Fase 4: Componentes | 66 | 0 | 0% | No iniciada (agregado RemitosMenuItem) |
| Fase 5: Páginas y Limpieza | 52 | 0 | 0% | No iniciada |
| **TOTAL** | **322** | **178** | **55%** | |

### Reglas de Avance

1. **No avanzar de fase hasta completar la anterior al 100%**
2. Cada checkbox se marca SOLO cuando el archivo está refactorizado Y tiene test (si aplica)
3. Si un archivo refactorizado rompe otro, se arregla antes de continuar
4. Al final de cada fase: ejecutar `npm run build`, `npm test`, `npm run lint` - todo debe pasar
5. Al final de cada fase: actualizar la documentación correspondiente

### Cómo Marcar Progreso

Cada vez que se completa un item:
1. Cambiar `- [ ]` a `- [x]` en este archivo
2. Actualizar los contadores de la tabla
3. Si es fin de fase: actualizar documentación
4. Commit con formato: `refactor(fase-X): descripción del cambio`
