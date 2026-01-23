# SPISA - Interacciones entre Componentes

## 1. Mapa de Interacciones del Sistema

```
┌────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────┐      ┌──────────────┐      ┌──────────┐  │
│  │   Páginas   │◄────►│ Componentes  │◄────►│  Hooks   │  │
│  │ (page.tsx)  │      │  (UI/Domain) │      │ (custom) │  │
│  └──────┬──────┘      └──────┬───────┘      └────┬─────┘  │
│         │                    │                    │        │
│         └────────────────────┼────────────────────┘        │
│                              │                             │
│         ┌────────────────────┼────────────────────┐        │
│         │                    ▼                    │        │
│  ┌──────▼──────┐      ┌─────────────┐      ┌────▼──────┐  │
│  │   Zustand   │      │React Query  │      │   Forms   │  │
│  │   (Global)  │      │  (Remote)   │      │(RHF + Zod)│  │
│  └─────────────┘      └──────┬──────┘      └───────────┘  │
│                              │                             │
└──────────────────────────────┼─────────────────────────────┘
                               │ HTTP (Axios/Fetch)
┌──────────────────────────────┼─────────────────────────────┐
│                    MIDDLEWARE LAYER                        │
├──────────────────────────────┼─────────────────────────────┤
│                              ▼                             │
│                     ┌─────────────────┐                    │
│                     │  middleware.ts  │                    │
│                     │                 │                    │
│                     │ - Verify JWT    │                    │
│                     │ - Extract User  │                    │
│                     │ - Inject Headers│                    │
│                     └────────┬────────┘                    │
│                              │                             │
└──────────────────────────────┼─────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────┐
│                      CAPA DE API                           │
├──────────────────────────────┼─────────────────────────────┤
│                              ▼                             │
│                     ┌─────────────────┐                    │
│                     │  Route Handlers │                    │
│                     │  (app/api/*/)   │                    │
│                     │                 │                    │
│                     │ - Validate Body │                    │
│                     │ - Call Services │                    │
│                     │ - Handle Errors │                    │
│                     └────────┬────────┘                    │
│                              │                             │
└──────────────────────────────┼─────────────────────────────┘
                               │
┌──────────────────────────────┼─────────────────────────────┐
│                 CAPA DE LÓGICA DE NEGOCIO                  │
├──────────────────────────────┼─────────────────────────────┤
│                              ▼                             │
│  ┌────────────┐      ┌──────────────┐      ┌───────────┐  │
│  │  Services  │◄────►│   Mappers    │◄────►│Validators │  │
│  │            │      │              │      │   (Zod)   │  │
│  │- Activity  │      │ snake_case   │      │           │  │
│  │- PDF       │      │    ↕         │      │           │  │
│  │- ABC Class │      │ camelCase    │      │           │  │
│  │- Stock Val │      │              │      │           │  │
│  └──────┬─────┘      └──────────────┘      └───────────┘  │
│         │                                                  │
└─────────┼──────────────────────────────────────────────────┘
          │
┌─────────┼──────────────────────────────────────────────────┐
│         │            CAPA DE PERSISTENCIA                  │
├─────────┼──────────────────────────────────────────────────┤
│         ▼                                                  │
│  ┌──────────────┐                                          │
│  │Prisma Client │                                          │
│  │  (lib/db.ts) │                                          │
│  │              │                                          │
│  │ - Queries    │                                          │
│  │ - Mutations  │                                          │
│  │ - Txs        │                                          │
│  └──────┬───────┘                                          │
│         │                                                  │
│         ▼                                                  │
│  ┌──────────────┐                                          │
│  │ PostgreSQL   │                                          │
│  │      16      │                                          │
│  └──────────────┘                                          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

## 2. Flujos de Interacción por Caso de Uso

### 2.1 Crear un Artículo

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ Click "Nuevo Artículo"
       ▼
┌──────────────────┐
│ ArticlesTable    │
│ (Client Component)│
└──────┬───────────┘
       │ Open dialog
       ▼
┌──────────────────┐
│ ArticleDialog    │
│ - React Hook Form│
│ - Zod validation │
└──────┬───────────┘
       │ onSubmit
       ▼
┌──────────────────┐
│ useMutation      │
│ (React Query)    │
└──────┬───────────┘
       │ POST /api/articles
       ▼
┌──────────────────┐
│  middleware.ts   │
│ - Verify JWT     │
│ - Extract user   │
└──────┬───────────┘
       │ with headers
       ▼
┌──────────────────┐
│ app/api/articles/│
│     route.ts     │
│ - Validate body  │
│ - Extract user   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Prisma Query   │
│ articles.create()│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  activityLogger  │
│ log(ARTICLE_     │
│     CREATE)      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Response JSON  │
│ { article: {...} }│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  React Query     │
│ - Invalidate     │
│ - Refetch        │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   UI Update      │
│ - Close dialog   │
│ - Show toast     │
│ - Refresh table  │
└──────────────────┘
```

### 2.2 Listar Artículos con Paginación

```
┌─────────────┐
│ ArticlesPage│
└──────┬──────┘
       │ useQuery(['articles', page, limit])
       ▼
┌──────────────────┐
│  React Query     │
│ - Check cache    │
│ - Fetch if stale │
└──────┬───────────┘
       │ GET /api/articles?page=1&limit=50
       ▼
┌──────────────────┐
│  middleware.ts   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ app/api/articles/│
│     route.ts     │
│ - Parse query    │
│ - Validate params│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Prisma findMany()│
│ - where: filters │
│ - skip: (page-1) │
│ - take: limit    │
│ - include: cat   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│     Mapper       │
│ snake_case →     │
│ camelCase        │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Response JSON   │
│ {                │
│   data: [...]    │
│   total: 1234    │
│   page: 1        │
│ }                │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  React Query     │
│ - Update cache   │
│ - Return data    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ ArticlesTable    │
│ - Render rows    │
│ - Pagination ctrl│
└──────────────────┘
```

### 2.3 Crear Pedido de Venta

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ Click "Nuevo Pedido"
       ▼
┌──────────────────┐
│SalesOrderDialog  │
└──────┬───────────┘
       │ Select client
       ▼
┌──────────────────┐
│  ClientSelect    │
│ (Combobox)       │
└──────┬───────────┘
       │ useQuery(['clients'])
       ▼
┌──────────────────┐
│ GET /api/clients │
└──────┬───────────┘
       │ Returns clients
       ▼
┌──────────────────┐
│   Add Items      │
│ (QuickCartPopup) │
└──────┬───────────┘
       │ Search article
       ▼
┌──────────────────┐
│QuickArticleLookup│
│ - useQuery       │
│ - debounced      │
└──────┬───────────┘
       │ GET /api/articles?search=...
       ▼
┌──────────────────┐
│  Select article  │
│ - Auto-fill price│
│ - Apply discounts│
└──────┬───────────┘
       │ Add to cart
       ▼
┌──────────────────┐
│  Calculate Total │
│ - Subtotal       │
│ - Discounts      │
│ - Taxes          │
└──────┬───────────┘
       │ Submit order
       ▼
┌──────────────────┐
│useMutation       │
│ POST /api/       │
│   sales-orders   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Route Handler    │
│ - Validate schema│
│ - Check client   │
│ - Check stock    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Prisma Tx        │
│ BEGIN            │
│ - Create order   │
│ - Create items   │
│ COMMIT           │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  activityLogger  │
│ log(ORDER_CREATE)│
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Response       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  UI Update       │
│ - Invalidate     │
│ - Navigate to    │
│   order detail   │
└──────────────────┘
```

### 2.4 Generar Factura desde Pedido

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ Click "Facturar" en pedido
       ▼
┌──────────────────┐
│ InvoiceDialog    │
│ - Pre-filled from│
│   sales order    │
└──────┬───────────┘
       │ useQuery(['sales-order', id])
       ▼
┌──────────────────┐
│ GET /api/        │
│ sales-orders/[id]│
└──────┬───────────┘
       │ Returns order + items
       ▼
┌──────────────────┐
│  Fill form       │
│ - Invoice number │
│ - Date           │
│ - Items (editable)│
└──────┬───────────┘
       │ Submit
       ▼
┌──────────────────┐
│ useMutation      │
│ POST /api/       │
│   invoices       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Route Handler    │
│ - Validate       │
│ - Check stock    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Prisma Tx        │
│ BEGIN            │
│ - Create invoice │
│ - Create items   │
│ - Create delivery│
│   note (if needed)│
│ - Update stock   │
│ COMMIT           │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  PDFService      │
│ generateInvoice  │
│ PDF()            │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  activityLogger  │
│ log(INVOICE_     │
│     CREATE)      │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Response       │
│ { invoice, pdf } │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  UI Update       │
│ - Show PDF       │
│ - Option to print│
└──────────────────┘
```

### 2.5 Autenticación (Login)

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ Enter credentials
       ▼
┌──────────────────┐
│   LoginPage      │
│ - React Hook Form│
│ - Zod validation │
└──────┬───────────┘
       │ onSubmit
       ▼
┌──────────────────┐
│ POST /api/auth/  │
│      login       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Route Handler    │
│ - Find user by   │
│   username       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ bcrypt.compare() │
│ - Hash password  │
│ - Compare        │
└──────┬───────────┘
       │ ✓ Valid
       ▼
┌──────────────────┐
│  Create JWT      │
│ - userId         │
│ - role           │
│ - email          │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Set HTTP-only    │
│    Cookie        │
│ - auth-token     │
│ - Secure         │
│ - HttpOnly       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Update user     │
│ last_login_at    │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  activityLogger  │
│ log(LOGIN)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│   Response       │
│ { user, token }  │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  authStore       │
│ setAuth(user)    │
└──────┬───────────┘
       │ Persist to localStorage
       ▼
┌──────────────────┐
│  Navigate to     │
│   /dashboard     │
└──────────────────┘
```

## 3. Comunicación entre Componentes

### 3.1 Parent → Child (Props)

```typescript
// Parent
<ArticleDialog
  article={selectedArticle}
  open={isDialogOpen}
  onOpenChange={setIsDialogOpen}
  onSuccess={handleSuccess}
/>

// Child
interface ArticleDialogProps {
  article?: Article
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}
```

### 3.2 Child → Parent (Callbacks)

```typescript
// Parent
const handleArticleCreated = (article: Article) => {
  queryClient.invalidateQueries(['articles'])
  toast.success('Artículo creado')
}

// Child
<form onSubmit={handleSubmit((data) => {
  mutate(data, {
    onSuccess: (article) => {
      props.onSuccess?.(article)
    }
  })
})}>
```

### 3.3 Siblings (Estado compartido)

```typescript
// Via Zustand
const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
}))

// Component A
const addToCart = useCartStore((s) => s.addItem)
addToCart(article)

// Component B
const cartItems = useCartStore((s) => s.items)
```

### 3.4 Desacoplados (Eventos)

```typescript
// Via React Query invalidation
const mutation = useMutation({
  mutationFn: createArticle,
  onSuccess: () => {
    queryClient.invalidateQueries(['articles'])
    queryClient.invalidateQueries(['dashboard-metrics'])
  }
})
```

## 4. Gestión de Estado Global

### 4.1 Auth Store (Zustand)

```
┌──────────────────┐
│   authStore      │
├──────────────────┤
│ - user           │
│ - isAuthenticated│
│ - hydrated       │
├──────────────────┤
│ setAuth()        │
│ clearAuth()      │
│ isAdmin()        │
│ isVendedor()     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  localStorage    │
│ 'spisa-auth-     │
│    storage'      │
└──────────────────┘
```

Componentes que consumen:
- `Navbar.tsx` - muestra usuario
- `Sidebar.tsx` - filtra items por rol
- `AuthInitializer.tsx` - valida sesión
- Páginas protegidas - verifican auth

### 4.2 React Query Cache

```
┌──────────────────────────────┐
│      Query Client            │
├──────────────────────────────┤
│ queries: {                   │
│   ['articles', 1, 50]: {...} │
│   ['clients']: {...}         │
│   ['dashboard-metrics']: {...}│
│ }                            │
├──────────────────────────────┤
│ mutations: {                 │
│   ['create-article']: {...}  │
│ }                            │
└──────────────────────────────┘
```

## 5. Comunicación con Backend

### 5.1 Patrón de Fetch

```typescript
// READ
const { data, isLoading, error } = useQuery({
  queryKey: ['articles', page, limit],
  queryFn: async () => {
    const res = await fetch(
      `/api/articles?page=${page}&limit=${limit}`
    )
    if (!res.ok) throw new Error('Failed')
    return res.json()
  },
  staleTime: 60 * 1000, // 1 min
})

// WRITE
const mutation = useMutation({
  mutationFn: async (data: CreateArticle) => {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Failed')
    return res.json()
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['articles'])
  },
})
```

### 5.2 Manejo de Errores

```
Error en API
    ↓
Route Handler catch
    ↓
Return error response
    ↓
React Query onError
    ↓
Toast notification
```

## 6. Servicios Compartidos

### 6.1 Activity Logger

```
Componente llama API
    ↓
API Route ejecuta acción
    ↓
Llama activityLogger.logActivity()
    ↓
Crea registro en activity_logs
    ↓
No afecta respuesta al cliente
```

### 6.2 PDF Service

```
Usuario solicita PDF
    ↓
POST /api/invoices/[id]/pdf
    ↓
PDFService.generateInvoicePDF()
    ↓
Lee datos de BD
    ↓
Genera PDF con pdfkit
    ↓
Retorna Buffer
    ↓
Response con Content-Type: application/pdf
```

## 7. Conclusión

El sistema utiliza un patrón de **comunicación unidireccional** donde:
- El **frontend** solicita datos al **backend**
- El **backend** valida, procesa y persiste
- Los **servicios compartidos** manejan lógica transversal
- **React Query** gestiona el estado remoto y caché
- **Zustand** gestiona el estado global de UI

Este diseño facilita:
- **Debugging**: flujo claro de datos
- **Testing**: componentes desacoplados
- **Mantenimiento**: responsabilidades claras
- **Escalabilidad**: fácil agregar nuevas features
