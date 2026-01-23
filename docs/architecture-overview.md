# SPISA - Visión General de la Arquitectura

> **Última actualización**: Enero 2026 (Post-Fase 1-3 Refactoring)
> **Estado**: Infraestructura modernizada, 706 tests, hooks genéricos implementados

## 1. Introducción

SPISA es una aplicación **Full-Stack Next.js monolítica** para gestión empresarial (ERP) que incluye inventario, ventas, facturación y análisis. La aplicación integra frontend y backend en un único proyecto Next.js.

**Arquitectura**: Refactorizada en **Fases 1-3** con infraestructura moderna basada en hooks genéricos, servicios dedicados, y error handling centralizado.

## 2. Stack Tecnológico

### Frontend
- **Framework**: Next.js 15.5.9 (App Router, React Server Components)
- **UI Library**: React 19.1.0
- **Lenguaje**: TypeScript 5
- **Estilos**: Tailwind CSS 4.0
- **Componentes**: shadcn/ui (Radix UI + Tailwind)
- **Iconos**: Lucide React
- **Gráficos**: Recharts

### Backend
- **API**: Next.js API Routes (App Router)
- **ORM**: Prisma 6.18.0
- **Base de Datos**: PostgreSQL 16
- **Autenticación**: JWT (jose library) + HTTP-only cookies
- **Validación**: Zod 4.1.11

### Gestión de Estado
- **Estado Global**: Zustand 5.0.8 (con persistencia en localStorage)
- **Estado Remoto**: TanStack Query (React Query) 5.90.2
- **Hooks Genéricos** (Nuevo): createCRUDHooks, useEntityQuery, useEntityMutation

### Utilidades
- **Formularios**: React Hook Form 7.63.0
- **Notificaciones**: Sonner 2.0.7
- **PDFs**: pdfkit, pdf-lib
- **Excel**: xlsx
- **Encriptación**: bcryptjs
- **HTTP Client**: Axios

## 3. Arquitectura de Capas (Post-Refactoring)

```
┌─────────────────────────────────────────────────────┐
│                 PRESENTACIÓN (UI)                   │
│  - Pages: app/dashboard/*/page.tsx                  │
│  - Componentes: components/*/ (90 total)            │
│  - UI Genéricos: DataTable<T>, ErrorBoundary [NEW]  │
│  - Hooks: hooks/ (31 total, 2 factory-based)        │
│  - Estado UI: Zustand store                         │
├─────────────────────────────────────────────────────┤
│              STATE MANAGEMENT [NEW]                 │
│  - Hooks Genéricos: lib/hooks/api/                  │
│    • createCRUDHooks (factory pattern)              │
│    • useEntityQuery, useEntityMutation              │
│  - React Query: Cache + invalidation automática     │
├─────────────────────────────────────────────────────┤
│                 CAPA DE API                         │
│  - Route Handlers: app/api/[entity]/route.ts (72)   │
│  - Patrón: 100% delegación a servicios             │
│  - Middleware: middleware.ts (Auth)                 │
│  - Validaciones: Zod schemas                        │
│  - Error Handling: handleError() centralizado [NEW] │
├─────────────────────────────────────────────────────┤
│              LÓGICA DE NEGOCIO [REFACTORIZED]       │
│  - Servicios: lib/services/*.ts (23 servicios)      │
│    • ArticleService, InvoiceService, etc.           │
│  - Cross-cutting: activityLogger, changeTracker     │
│  - Utilidades: lib/utils/*.ts                       │
│  - Errors: AppError class + handler [NEW]           │
│  - Mappers: snake_case ↔ camelCase                  │
├─────────────────────────────────────────────────────┤
│              PERSISTENCIA                           │
│  - ORM: Prisma Client                               │
│  - Base de Datos: PostgreSQL 16                     │
│  - Migraciones: Prisma migrations                   │
└─────────────────────────────────────────────────────┘
```

## 4. Estructura de Directorios

```
spisa-new/
├── frontend/                    # Aplicación Next.js
│   ├── app/                     # App Router (Next.js 15)
│   │   ├── api/                 # API Routes (Backend)
│   │   ├── dashboard/           # Páginas protegidas
│   │   ├── login/               # Autenticación
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Home (redirect)
│   ├── components/              # Componentes React
│   │   ├── ui/                  # Componentes base (shadcn)
│   │   ├── articles/            # Por dominio
│   │   ├── clients/
│   │   ├── invoices/
│   │   └── ...
│   ├── lib/                     # Lógica compartida
│   │   ├── services/            # Servicios de negocio
│   │   ├── utils/               # Utilidades
│   │   ├── validations/         # Schemas Zod
│   │   ├── auth/                # JWT, roles
│   │   └── db.ts                # Prisma client
│   ├── store/                   # Zustand stores
│   ├── hooks/                   # Custom React hooks
│   ├── prisma/                  # Schema y migraciones
│   ├── public/                  # Activos estáticos
│   └── scripts/                 # Scripts de utilidad
├── database/                    # Scripts de importación
├── docs/                        # Documentación (esta carpeta)
└── docker-compose.yml           # Servicios Docker
```

## 5. Flujo de Datos

### Petición típica (Crear Artículo)

```
1. Usuario interactúa con UI
   ↓
2. Componente React (ArticleDialog)
   - Validación cliente (React Hook Form + Zod)
   ↓
3. HTTP Request (POST /api/articles)
   - Headers con credenciales
   - Cookies HTTP-only con JWT
   ↓
4. Middleware (middleware.ts)
   - Verifica JWT
   - Extrae usuario
   - Inyecta headers: x-user-id, x-user-role
   ↓
5. Route Handler (app/api/articles/route.ts)
   - Valida request body (Zod)
   - Llama servicio de negocio
   ↓
6. Lógica de Negocio (lib/services/)
   - Reglas de negocio
   - Transformaciones
   ↓
7. Persistencia (Prisma)
   - INSERT INTO articles
   - Retorna registro creado
   ↓
8. Activity Logging
   - Registra en activity_logs
   ↓
9. HTTP Response
   - JSON con datos
   - Status code
   ↓
10. React Query
    - Invalida caché
    - Re-fetch automático
    ↓
11. UI se actualiza
    - Muestra toast de éxito
```

## 6. Características Principales

### 6.1 Autenticación y Autorización
- **JWT en HTTP-only cookies** para seguridad
- **Middleware centralizado** valida todas las rutas
- **Roles**: admin, vendedor
- **Auditoría**: Todos los login se registran

### 6.2 Gestión de Inventario
- CRUD completo de artículos
- Categorización y subcategorización
- Clasificación ABC automática
- Valuación de inventario por categoría
- Movimientos de stock
- Artículos discontinuados

### 6.3 Ventas y Facturación
- Pedidos de venta con workflow
- Generación de facturas desde pedidos
- Remitos de entrega
- Cálculo automático de impuestos
- Notas de crédito
- PDF imprimibles

### 6.4 Clientes
- Base de clientes con clasificación ABC
- Límites de crédito
- Términos de pago personalizados
- Descuentos por cliente
- Historial de compras
- Análisis de tendencias

### 6.5 Listas de Precios
- Importación desde Excel (proformas)
- Borradores de precios
- Historial de cambios
- Revertir cambios
- Descuentos por condición de pago

### 6.6 Reportes y Analytics
- Dashboard con KPIs en tiempo real
- Gráficos de ventas (Recharts)
- Órdenes recientes
- Clasificación ABC de productos y clientes
- Análisis de tendencias

### 6.7 Auditoría
- Log de todas las operaciones
- Seguimiento de cambios
- IP del usuario
- Información completa del usuario

## 7. Patrones de Diseño Utilizados

### 7.1 Singleton
- **Prisma Client** (`lib/db.ts`): Una única instancia compartida

### 7.2 Repository Pattern (Implícito)
- Prisma actúa como abstracción de datos
- Servicios encapsulan lógica compleja

### 7.3 Data Transfer Objects (DTOs)
- Mappers convierten entre snake_case (BD) y camelCase (API)

### 7.4 Middleware Pattern
- Autenticación centralizada
- Inyección de headers de usuario

### 7.5 Service Layer
- Lógica de negocio separada de controladores
- Servicios reutilizables (activityLogger, PDFService, etc.)

## 8. Seguridad

### 8.1 Autenticación
- JWT en HTTP-only cookies (protegido contra XSS)
- Tokens con expiración configurable
- bcrypt para hash de contraseñas

### 8.2 Autorización
- Verificación de roles en middleware
- Guards en API routes (`requireAdmin`, `requireAuth`)

### 8.3 Validación
- Zod en cliente y servidor
- Sanitización de inputs
- Validación de tipos con TypeScript

### 8.4 Auditoría
- Log de todas las operaciones sensibles
- Rastreabilidad completa

## 9. Optimizaciones

### 9.1 Base de Datos
- **40+ índices** para queries frecuentes
- **Foreign keys** con cascadas optimizadas
- **Soft deletes** en lugar de eliminaciones físicas

### 9.2 Frontend
- **React Query** con caché inteligente (staleTime: 1 min)
- **Server Components** donde es posible
- **Lazy loading** de componentes
- **Turbopack** para builds rápidos

### 9.3 API
- **Paginación** en todas las listas
- **Búsqueda optimizada** con ILIKE
- **Includes selectivos** en Prisma

## 10. Despliegue

### 10.1 Docker
- **PostgreSQL 16** en Alpine (liviano)
- **Multi-stage builds** para frontend
- **Standalone output** de Next.js

### 10.2 Variables de Entorno
- `.env` para desarrollo
- Secrets para producción
- Validación de env vars en startup

## 11. Consideraciones de Escalabilidad

### 11.1 Actual
✅ Base de datos escalable (PostgreSQL)
✅ Frontend optimizado (Next.js + Turbopack)
⚠️ API monolítica en proceso único

### 11.2 Para Escalar
- Extraer API a microservicio independiente
- Agregar Redis para caché
- Database replicas para lectura
- CDN para activos estáticos
- Rate limiting y circuit breakers

## 12. Nuevos Patrones (Post-Refactoring 2026)

### 12.1 Factory Pattern para Hooks

```typescript
// Antes (89 líneas):
export function useArticles() { /* manual useQuery */ }
export function useArticle(id) { /* manual useQuery */ }
export function useCreateArticle() { /* manual useMutation */ }
export function useUpdateArticle() { /* manual useMutation */ }
export function useDeleteArticle() { /* manual useMutation */ }

// Después (37 líneas):
const { useList, useById, useCreate, useUpdate, useDelete } =
  createCRUDHooks<Article, ArticleFormData>({
    entityName: 'Artículo',
    api: articlesApi,
    queryKey: 'articles',
  })

export { useList as useArticles, useById as useArticle, ... }
```

**Beneficios**:
- 59% reducción de código
- Error handling automático
- Cache invalidation automática
- Mensajes de éxito/error estandarizados

### 12.2 DataTable Genérico

```typescript
<DataTable
  data={articles}
  columns={[
    { id: 'code', header: 'Código', cell: (row) => row.code, sortKey: 'code' },
    { id: 'name', header: 'Descripción', cell: (row) => row.name },
  ]}
  keyExtractor={(row) => row.id}
  sorting={{ sortBy, sortDescending, onSort }}
  pagination={{ totalCount, currentPage, pageSize, onPageChange }}
  isLoading={isLoading}
  emptyMessage="No se encontraron artículos"
/>
```

**Beneficios**:
- Componentes de tabla de 372 LOC → <150 LOC
- Sorting, paginación, estados incluidos
- Type-safe con generics

### 12.3 Error Handling Centralizado

```typescript
// Antes:
try {
  const result = await prisma.articles.create({ data })
  return NextResponse.json(result)
} catch (error: any) {
  if (error.code === 'P2002') {
    return NextResponse.json({ error: 'Duplicado' }, { status: 409 })
  }
  return NextResponse.json({ error: 'Error' }, { status: 500 })
}

// Después:
try {
  const result = await ArticleService.create(data)
  return NextResponse.json(result)
} catch (error) {
  return handleError(error) // Maneja AppError, ZodError, Prisma errors
}
```

### 12.4 Test Coverage

**Antes**: 0 tests

**Después**: 706 tests en 53 archivos
- 22 service tests
- 4 utility tests
- 2 hook tests
- Tests para auth, permissions, errors, validations

## 13. Conclusión

SPISA es una aplicación **robusta y bien estructurada** que sigue principios modernos de desarrollo:
- **Type-safe** (TypeScript end-to-end, 98% coverage)
- **Validación en capas** (Zod client + server)
- **Auditoría completa** (Activity logger + change tracker)
- **Separación de responsabilidades** (Layered architecture)
- **Reutilización de componentes** (Factory pattern, generic hooks)
- **Testeada** (706 tests, 70%+ service coverage)

La arquitectura monolítica es apropiada para el tamaño actual del proyecto y puede evolucionar a microservicios si es necesario.

**Estado Actual**: Fase 1-3 completas (55%), Fase 4-5 pendientes (components + cleanup)
