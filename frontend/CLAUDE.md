# Claude Code - Instrucciones de Desarrollo SPISA

> **IMPORTANTE:** Este archivo contiene instrucciones permanentes para mantener el proyecto.
> Cualquier IA trabajando en este proyecto DEBE seguir estas directrices.

## 🎯 Principios Fundamentales

### 1. No Agregar Console Logs

**NUNCA agregues console.log/console.warn para debugging:**

- ❌ No dejes console.log en código de producción
- ❌ No agregues logs "temporales" que luego se olvidan
- ✅ Usa Sentry para error tracking (ya configurado)
- ✅ Si necesitas debugging, usa breakpoints o herramientas de DevTools

### 2. Testing Obligatorio

**DESPUÉS DE CADA CAMBIO:**

1. ✅ Verificar que la app compila: `npm run build` o verificar en dev
2. ✅ Ejecutar tests si existen: `npm test`
3. ✅ Verificar TypeScript: `npx tsc --noEmit`

**Flujo correcto:**

```
Hacer cambio → Verificar compilación → ¿Funciona? → Continuar
                         ↓
                        NO → DETENER → Arreglar → Continuar
```

### 3. Workflow de Desarrollo

**Antes de empezar a codear:**

1. Entender la estructura del proyecto
2. Verificar que no existe funcionalidad similar
3. Planificar cambios y validar con usuario si hay ambigüedad

**Durante desarrollo:**

1. Seguir convenciones de código existentes
2. Escribir código limpio y auto-documentado
3. NO agregar console.logs

**Después de codear:**

1. Verificar que compila sin errores
2. Probar manualmente el cambio
3. Verificar que no rompiste nada existente

## 📁 Estructura del Proyecto

```
frontend/
├── app/                      # Next.js App Router
│   ├── api/                  # API Routes (backend)
│   ├── dashboard/            # Páginas del dashboard
│   └── layout.tsx            # Layout principal
├── components/               # Componentes React
│   ├── ui/                   # Componentes UI base (shadcn)
│   ├── articles/             # Componentes de artículos
│   ├── clients/              # Componentes de clientes
│   ├── salesOrders/          # Componentes de pedidos
│   ├── invoices/             # Componentes de facturas
│   ├── deliveryNotes/        # Componentes de remitos
│   ├── certificates/         # Componentes de certificados
│   ├── suppliers/            # Componentes de proveedores
│   ├── categories/           # Componentes de categorías
│   ├── priceLists/           # Componentes de listas de precios
│   └── providers/            # Context providers (Sentry, Theme, etc.)
├── lib/                      # Utilidades y lógica compartida
│   ├── api/                  # Funciones de llamadas API
│   ├── hooks/                # Custom hooks
│   │   ├── generic/          # Hooks genéricos (useDebounce, etc.)
│   │   └── domain/           # Hooks de dominio (useArticles, etc.)
│   ├── providers/            # React Query, Theme providers
│   ├── utils/                # Utilidades generales
│   └── db/                   # Conexiones a bases de datos
├── prisma/                   # Prisma schema y migraciones
└── scripts/                  # Scripts de mantenimiento

CRÍTICO: Seguir la estructura de hooks en lib/hooks/
- generic/ para hooks reutilizables
- domain/ para hooks específicos del negocio
```

## 🏗️ Stack Tecnológico

- **Framework:** Next.js 15 con Turbopack
- **React:** 19.x
- **TypeScript:** Strict mode
- **Base de datos:** PostgreSQL con Prisma ORM
- **Almacenamiento:** Supabase Storage (certificados)
- **UI:** shadcn/ui + Tailwind CSS
- **Data fetching:** TanStack Query (React Query)
- **Error tracking:** Sentry (@sentry/react)
- **Autenticación:** JWT custom

## 🔌 API Routes Importantes

**Estructura de API Routes (Next.js App Router):**

```
app/api/
├── articles/           # CRUD de artículos
├── clients/            # CRUD de clientes
├── sales-orders/       # Pedidos de venta
├── invoices/           # Facturas
├── delivery-notes/     # Remitos
├── certificates/       # Certificados de calidad
├── suppliers/          # Proveedores
├── categories/         # Categorías
├── price-lists/        # Listas de precios
└── auth/               # Autenticación
```

## 📝 Convenciones de Código

### TypeScript/React

```typescript
// ✅ BUENO - con tipos, descriptivo
interface ArticleFormData {
  code: string;
  description: string;
  unitPrice: number;
  categoryId: number;
}

const useArticle = (id: number): Article | undefined => {
  const { data } = useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id),
  });
  return data;
};

// ❌ MALO - sin tipos, any
const useArticle = (id: any) => {
  const { data }: any = useQuery({ ... });
  return data;
};
```

### Hooks Personalizados

```typescript
// ✅ Ubicación correcta según tipo:
// lib/hooks/generic/useDebounce.ts - hooks genéricos
// lib/hooks/domain/useArticles.ts - hooks de dominio

// ✅ Naming convention
export function useArticles(options: UseArticlesOptions) { ... }
export function useCreateArticle() { ... }
export function useUpdateArticle() { ... }
```

### Componentes

```typescript
// ✅ BUENO
interface ArticleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  article?: Article;
}

export function ArticleDialog({ isOpen, onClose, article }: ArticleDialogProps) {
  // ...
}

// ❌ MALO - props sin tipos
export function ArticleDialog(props: any) { ... }
```

### API Routes

```typescript
// ✅ BUENO - con validación y manejo de errores
export async function GET(request: Request) {
  try {
    const articles = await prisma.article.findMany();
    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}
```

## 🚨 Errores Comunes a EVITAR

### ❌ NO hacer:

1. **Agregar console.log/warn:** Usar Sentry para errores
2. **Ignorar TypeScript errors:** Arreglarlos, no usar `any`
3. **Crear hooks en lugares incorrectos:** Seguir estructura generic/domain
4. **Hardcodear URLs:** Usar rutas relativas `/api/...`
5. **Modificar componentes de shadcn/ui:** Crear wrappers si necesario
6. **Ignorar errores de Prisma:** Manejar correctamente

### ✅ SÍ hacer:

1. **Seguir patrones existentes:** Consistencia > originalidad
2. **Usar React Query:** Para data fetching y caching
3. **Validar con Zod:** Para forms y API inputs
4. **Manejar loading/error states:** En todos los componentes
5. **Usar componentes de shadcn:** No reinventar la rueda

## 🎯 Checklist Pre-Commit

Antes de cada commit, verifica:

- [ ] No hay console.log/warn en código nuevo
- [ ] TypeScript compila sin errores
- [ ] La app funciona en desarrollo
- [ ] No hay imports no utilizados
- [ ] Código sigue convenciones existentes
- [ ] Nuevos hooks están en la carpeta correcta (generic/domain)

## 🔧 Comandos Útiles

```bash
# Development
npm run dev                     # Iniciar servidor de desarrollo

# Build & Check
npm run build                   # Build de producción
npx tsc --noEmit               # Verificar TypeScript

# Database
npx prisma db push             # Aplicar schema a DB
npx prisma generate            # Regenerar cliente Prisma
npx prisma studio              # Abrir Prisma Studio

# Testing
npm test                       # Ejecutar tests

# Formatting
npm run format                 # Formatear código con Prettier
npm run lint                   # Verificar ESLint
```

## 📚 Módulos del Sistema

### Artículos

- CRUD de productos/artículos
- Categorías y descuentos por categoría
- Listas de precios por condición de pago
- Valorización de stock

### Clientes

- CRUD de clientes
- Condiciones de pago
- Descuentos especiales
- Historial de pedidos

### Pedidos de Venta

- Carrito rápido (QuickCart)
- Múltiples pestañas de pedido
- Descuentos por artículo
- Generación de facturas y remitos

### Facturas

- Generación desde pedidos
- Numeración automática
- Estados (pendiente, pagada, anulada)

### Remitos

- Generación desde pedidos
- Datos de transporte
- Estados de entrega

### Certificados de Calidad

- Upload a Supabase Storage
- Asociación con coladas
- Visualización de TIFF/PDF

### Proveedores

- CRUD de proveedores
- Pedidos a proveedores
- Import de proformas

## 🆘 Cuando Algo Sale Mal

1. **Build falla:** Revisar errores de TypeScript, verificar imports
2. **API no responde:** Verificar conexión a DB, revisar logs del servidor
3. **UI rota:** Check console de browser, verificar props de componentes
4. **Prisma error:** Verificar schema, ejecutar `prisma generate`

## 🤖 Instrucciones para IA

**Si eres una IA trabajando en este proyecto:**

### REGLA #1: NO AGREGAR CONSOLE.LOGS

**🚨 OBLIGATORIO - NO HAY EXCEPCIONES 🚨**

- ❌ NUNCA agregues console.log para debugging
- ❌ NUNCA dejes console.warn en código
- ✅ Los errores se capturan con Sentry automáticamente
- ✅ Usa console.error SOLO para errores reales en catch blocks

### REGLA #2: VERIFICAR QUE COMPILA

Después de CADA modificación de código:

1. Verificar que no hay errores de TypeScript
2. Verificar que la app carga correctamente
3. Si algo falla, arreglarlo ANTES de continuar

### REGLA #3: SEGUIR PATRONES EXISTENTES

1. **Mira cómo está hecho algo similar** antes de crear algo nuevo
2. **Usa los mismos patrones** de componentes, hooks, API routes
3. **No reinventes** - el proyecto tiene convenciones establecidas

### Flujo de Trabajo Obligatorio:

```
1. Usuario pide cambio
   ↓
2. Entender el contexto y la estructura existente
   ↓
3. Hacer cambio siguiendo patrones existentes
   ↓
4. Verificar que compila y funciona
   ↓
   ├─ Funciona → Continuar
   └─ Falla → DETENER, arreglar, volver a verificar
   ↓
5. Listo
```

**Recuerda:**

- No agregar logs innecesarios
- Seguir la estructura de carpetas existente
- Usar TypeScript correctamente (no `any`)
- Manejar errores con try/catch y Sentry
