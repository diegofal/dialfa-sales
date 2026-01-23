# SPISA - Análisis de Principios de Diseño de Software

> **Última actualización**: Enero 2026 (Post-Fase 1-3)
> **Estado**: SRP mejorado, DRY en progreso, DIP pendiente

## 1. Principios SOLID

### 1.1 Single Responsibility Principle (SRP)

> **"Una clase/módulo debe tener una única razón para cambiar"**

#### ✅ Aspectos que Cumplen SRP

**1. Servicios Especializados**

```
lib/services/
├── activityLogger.ts       ✅ Solo logging de actividades
├── PDFService.ts           ✅ Solo generación de PDFs
├── abcClassification.ts    ✅ Solo clasificación ABC
├── clientClassification.ts ✅ Solo clasificación de clientes
├── stockValuation.ts       ✅ Solo valuación de inventario
└── salesTrends.ts          ✅ Solo análisis de tendencias
```

**Ejemplo - Activity Logger:**
```typescript
// lib/services/activityLogger.ts
// ✅ Una sola responsabilidad: Logging de actividades

export const activityLogger = {
  async logActivity(params: LogActivityParams): Promise<void> {
    // Solo se encarga de persistir logs
    await prisma.activity_logs.create({ data: params })
  }
}
```

**2. Componentes de Dominio Separados**

```
components/
├── articles/     ✅ Solo artículos
├── clients/      ✅ Solo clientes
├── invoices/     ✅ Solo facturas
└── salesOrders/  ✅ Solo pedidos
```

**3. API Routes por Recurso**

```
app/api/
├── articles/     ✅ Solo CRUD de artículos
├── clients/      ✅ Solo CRUD de clientes
└── invoices/     ✅ Solo CRUD de facturas
```

#### ✅ CORRECCIONES IMPLEMENTADAS (Fase 1-3)

**1. API Routes - CORREGIDO**

**ANTES (Violaba SRP)**:
```typescript
// ❌ Route handler con lógica de negocio
export async function POST(request: NextRequest) {
  // Validación
  // Lógica de negocio mezclada
  // Persistencia directa con Prisma
  // Logging
  // Más lógica de negocio
}
```

**DESPUÉS (Cumple SRP)**:
```typescript
// ✅ Route handler solo orquesta
export async function POST(request: NextRequest) {
  try {
    const validated = schema.parse(await request.json())
    const result = await ArticleService.create(validated, request)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
```

**Estado**: 72/72 routes delegando a servicios (100%)

**2. Error Handling - CORREGIDO**

**ANTES**:
```typescript
// ❌ Try-catch disperso en cada route
catch (error: any) {
  if (error.code === 'P2002') return NextResponse.json(...)
  if (error instanceof ZodError) return NextResponse.json(...)
  // ...
}
```

**DESPUÉS**:
```typescript
// ✅ Error handling centralizado
import { handleError } from '@/lib/errors'

catch (error) {
  return handleError(error) // Maneja AppError, ZodError, Prisma
}
```

**Estado**: Implementado en `lib/errors/AppError.ts` + `handler.ts`

#### ⚠️ Violaciones de SRP Restantes

**1. Componentes con Múltiples Responsabilidades** (Fase 4 pendiente)

**Problema en `ArticlesTable.tsx`:**
```typescript
// ❌ VIOLA SRP: Hace demasiadas cosas
function ArticlesTable() {
  // 1. Fetching de datos
  const { data } = useQuery(['articles'])

  // 2. Gestión de estado local (filtros, paginación)
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)

  // 3. Lógica de negocio (cálculos)
  const calculateTotal = () => { /* ... */ }

  // 4. UI rendering
  return <table>...</table>
}
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE SRP: Separar responsabilidades

// 1. Hook para fetching y estado
function useArticlesData(filters: Filters) {
  const { data, isLoading } = useQuery(['articles', filters])
  return { articles: data?.data, total: data?.total, isLoading }
}

// 2. Hook para filtros
function useArticlesFilters() {
  const [filters, setFilters] = useState<Filters>({})
  const updateFilter = (key: string, value: any) => { /* ... */ }
  return { filters, updateFilter }
}

// 3. Utilidad para cálculos
function calculateArticleTotal(article: Article): number {
  return article.stock * article.unitPrice
}

// 4. Componente solo para UI
function ArticlesTable({ articles }: Props) {
  return <table>...</table>
}

// 5. Componente contenedor que orquesta
function ArticlesTableContainer() {
  const { filters, updateFilter } = useArticlesFilters()
  const { articles, total, isLoading } = useArticlesData(filters)

  return (
    <>
      <ArticlesFilters filters={filters} onChange={updateFilter} />
      <ArticlesTable articles={articles} />
      <Pagination total={total} />
    </>
  )
}
```

**2. API Routes con Lógica de Negocio**

**Problema en `app/api/articles/route.ts`:**
```typescript
// ❌ VIOLA SRP: Route handler con lógica de negocio

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validación
    const validated = schema.parse(body)

    // Lógica de negocio mezclada
    if (validated.stock < validated.minimumStock) {
      // enviar alerta
      await sendStockAlert(validated)
    }

    // Persistencia
    const article = await prisma.articles.create({ data: validated })

    // Más lógica de negocio
    await updateRelatedCategories(article)

    // Logging
    await logActivity(...)

    return NextResponse.json(article)
  } catch (error) {
    return handleError(error)
  }
}
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE SRP: Extraer lógica a servicio

// lib/services/articleService.ts
class ArticleService {
  async createArticle(data: CreateArticleDto): Promise<Article> {
    // Toda la lógica de negocio aquí
    if (data.stock < data.minimumStock) {
      await this.sendStockAlert(data)
    }

    const article = await prisma.articles.create({ data })

    await this.updateRelatedCategories(article)
    await activityLogger.logActivity(...)

    return article
  }

  private async sendStockAlert(data: CreateArticleDto) { /* ... */ }
  private async updateRelatedCategories(article: Article) { /* ... */ }
}

// app/api/articles/route.ts
// Route handler solo orquesta
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = schema.parse(body)

    const articleService = new ArticleService()
    const article = await articleService.createArticle(validated)

    return NextResponse.json(article, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
```

**Archivos a Refactorizar:**
- `app/api/articles/route.ts` → Extraer a `lib/services/articleService.ts`
- `app/api/clients/route.ts` → Extraer a `lib/services/clientService.ts`
- `app/api/sales-orders/route.ts` → Extraer a `lib/services/salesOrderService.ts`
- `app/api/invoices/route.ts` → Extraer a `lib/services/invoiceService.ts`
- `components/articles/ArticlesTable.tsx` → Separar en múltiples componentes

---

### 1.2 Open/Closed Principle (OCP)

> **"Abierto para extensión, cerrado para modificación"**

#### ✅ Aspectos que Cumplen OCP

**1. Componentes UI Base (shadcn)**

```typescript
// ✅ CUMPLE OCP: Button extensible sin modificar

import { Button } from '@/components/ui/button'

// Extensión mediante props
<Button variant="destructive" size="lg">
  Delete
</Button>

// Extensión mediante composición
<Button asChild>
  <Link href="/dashboard">Dashboard</Link>
</Button>
```

**2. Prisma Schema**

```prisma
// ✅ CUMPLE OCP: Fácil de extender sin modificar

model articles {
  // Campos existentes
  id          BigInt
  code        String
  description String

  // Extensión: agregar nuevos campos sin modificar código
  // new_field   String?
}
```

#### ⚠️ Violaciones de OCP Detectadas

**Problema en Mappers:**

```typescript
// ❌ VIOLA OCP: Switch/if para cada tipo
// lib/utils/mapper.ts

export function mapToApi(data: any, type: string) {
  switch (type) {
    case 'article':
      return mapArticle(data)
    case 'client':
      return mapClient(data)
    case 'invoice':
      return mapInvoice(data)
    // Agregar nuevo tipo requiere modificar este código
    default:
      return data
  }
}
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE OCP: Strategy pattern

interface Mapper<T, R> {
  map(data: T): R
}

class ArticleMapper implements Mapper<Article, ArticleDto> {
  map(data: Article): ArticleDto {
    return { /* ... */ }
  }
}

class ClientMapper implements Mapper<Client, ClientDto> {
  map(data: Client): ClientDto {
    return { /* ... */ }
  }
}

// Registry para mappers
class MapperRegistry {
  private mappers = new Map<string, Mapper<any, any>>()

  register(type: string, mapper: Mapper<any, any>) {
    this.mappers.set(type, mapper)
  }

  map<T, R>(type: string, data: T): R {
    const mapper = this.mappers.get(type)
    if (!mapper) throw new Error(`No mapper for type: ${type}`)
    return mapper.map(data)
  }
}

// Uso
const registry = new MapperRegistry()
registry.register('article', new ArticleMapper())
registry.register('client', new ClientMapper())

// Extensión: solo agregar nuevo mapper, no modificar código existente
registry.register('newType', new NewTypeMapper())

const result = registry.map('article', articleData)
```

**Archivos a Refactorizar:**
- `lib/utils/mapper.ts` → Implementar patrón Strategy

---

### 1.3 Liskov Substitution Principle (LSP)

> **"Los subtipos deben ser sustituibles por sus tipos base"**

#### ✅ Aspectos que Cumplen LSP

**1. React Components**

```typescript
// ✅ CUMPLE LSP: Componentes intercambiables

interface TableProps {
  data: any[]
  columns: Column[]
}

// Componente base
function BasicTable({ data, columns }: TableProps) { /* ... */ }

// Componente extendido (sustituible)
function PaginatedTable({ data, columns }: TableProps) {
  return <BasicTable data={data} columns={columns} />
}

// Uso: cualquiera funciona
const MyTable = BasicTable // o PaginatedTable
<MyTable data={articles} columns={columns} />
```

#### ⚠️ Violaciones Potenciales de LSP

**Problema en Servicios:**

```typescript
// ❌ POSIBLE VIOLACIÓN LSP

interface Logger {
  log(message: string): Promise<void>
}

class ActivityLogger implements Logger {
  async log(message: string): Promise<void> {
    // Implementación que persiste en BD
    await prisma.activity_logs.create({ /* ... */ })
  }
}

class ConsoleLogger implements Logger {
  async log(message: string): Promise<void> {
    // ❌ VIOLA LSP: No es realmente async, pero firma dice que sí
    console.log(message)
    // No retorna Promise correctamente
  }
}
```

**Solución:**
```typescript
// ✅ CUMPLE LSP

class ConsoleLogger implements Logger {
  async log(message: string): Promise<void> {
    console.log(message)
    return Promise.resolve() // Retorna Promise válida
  }
}

// O mejor: separar interfaces
interface SyncLogger {
  log(message: string): void
}

interface AsyncLogger {
  log(message: string): Promise<void>
}
```

---

### 1.4 Interface Segregation Principle (ISP)

> **"Los clientes no deben depender de interfaces que no usan"**

#### ✅ Aspectos que Cumplen ISP

**1. React Props Específicas**

```typescript
// ✅ CUMPLE ISP: Props específicas para cada componente

interface ArticleFormProps {
  initialData?: Article
  onSubmit: (data: Article) => void
  // Solo lo necesario
}

interface ArticleTableProps {
  articles: Article[]
  onEdit?: (article: Article) => void
  // Solo lo necesario
}
```

#### ⚠️ Violaciones de ISP Detectadas

**Problema en Tipos Prisma:**

```typescript
// ❌ VIOLA ISP: Tipos demasiado grandes

import type { articles } from '@prisma/client'

// Componente solo necesita código y descripción
// pero recibe TODOS los campos
function ArticlePreview({ article }: { article: articles }) {
  return (
    <div>
      <span>{article.code}</span>
      <span>{article.description}</span>
      {/* No usa: stock, prices, dates, etc. */}
    </div>
  )
}
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE ISP: Tipos específicos

// types/models.ts
export interface ArticlePreviewData {
  code: string
  description: string
}

export interface ArticleDetailData extends ArticlePreviewData {
  stock: number
  unitPrice: number
  costPrice: number
}

export interface ArticleFullData extends ArticleDetailData {
  createdAt: Date
  updatedAt: Date
  createdBy: number
  // ... todos los campos
}

// Uso
function ArticlePreview({ article }: { article: ArticlePreviewData }) {
  // Solo recibe lo necesario
}

function ArticleDetail({ article }: { article: ArticleDetailData }) {
  // Recibe lo necesario para detalle
}
```

**Archivos a Mejorar:**
- Crear `types/models.ts` con interfaces específicas
- Refactorizar componentes para usar interfaces segregadas
- Evitar pasar objetos Prisma completos cuando no es necesario

---

### 1.5 Dependency Inversion Principle (DIP)

> **"Depender de abstracciones, no de concreciones"**

#### ⚠️ Violaciones de DIP Detectadas

**Problema en Services:**

```typescript
// ❌ VIOLA DIP: Depende directamente de Prisma

// lib/services/articleService.ts
import { prisma } from '@/lib/db'

export class ArticleService {
  async getArticle(id: number) {
    // Dependencia directa de implementación concreta
    return await prisma.articles.findUnique({ where: { id } })
  }
}
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE DIP: Depender de abstracción

// lib/repositories/interfaces.ts
export interface IArticleRepository {
  findById(id: number): Promise<Article | null>
  findAll(filters: Filters): Promise<Article[]>
  create(data: CreateArticleDto): Promise<Article>
  update(id: number, data: UpdateArticleDto): Promise<Article>
  delete(id: number): Promise<void>
}

// lib/repositories/prismaArticleRepository.ts
export class PrismaArticleRepository implements IArticleRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: number): Promise<Article | null> {
    return await this.prisma.articles.findUnique({ where: { id } })
  }

  // ... otras implementaciones
}

// lib/services/articleService.ts
export class ArticleService {
  constructor(private articleRepo: IArticleRepository) {}

  async getArticle(id: number) {
    // Depende de abstracción
    return await this.articleRepo.findById(id)
  }
}

// Uso
const articleRepo = new PrismaArticleRepository(prisma)
const articleService = new ArticleService(articleRepo)

// Facilita testing con mocks
const mockRepo: IArticleRepository = {
  findById: jest.fn().mockResolvedValue(mockArticle),
  // ...
}
const testService = new ArticleService(mockRepo)
```

**Beneficios:**
- ✅ Fácil de testear (mocks)
- ✅ Fácil cambiar implementación (de Prisma a otro ORM)
- ✅ Desacoplado

**Archivos a Crear:**
- `lib/repositories/interfaces.ts` → Interfaces de repositorios
- `lib/repositories/prisma/articleRepository.ts`
- `lib/repositories/prisma/clientRepository.ts`
- `lib/repositories/prisma/invoiceRepository.ts`

---

## 2. Principio DRY (Don't Repeat Yourself)

> **"No repetir código, extraer duplicaciones"**

### ✅ Aspectos que Cumplen DRY

**1. Componentes UI Reutilizables**

```
components/ui/       ✅ Componentes base reutilizados
├── button.tsx       Usado en todo el proyecto
├── dialog.tsx       Usado en todos los formularios
└── table.tsx        Usado en todas las listas
```

**2. Hooks Compartidos**

```typescript
// ✅ CUMPLE DRY: Hook reutilizable

function usePagination(initialPage = 1, initialLimit = 50) {
  const [page, setPage] = useState(initialPage)
  const [limit, setLimit] = useState(initialLimit)

  return { page, limit, setPage, setLimit }
}

// Usado en múltiples componentes
function ArticlesTable() {
  const { page, limit, setPage } = usePagination()
}

function ClientsTable() {
  const { page, limit, setPage } = usePagination()
}
```

### ✅ MEJORAS IMPLEMENTADAS (Fase 1-3)

**1. Hooks Genéricos - IMPLEMENTADO**

**ANTES** (Violaba DRY):
```typescript
// ❌ Código duplicado en 31 hooks
// useArticles.ts (89 LOC)
export function useArticles() {
  return useQuery({
    queryKey: ['articles'],
    queryFn: () => fetch('/api/articles').then(r => r.json()),
  })
}
export function useCreateArticle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data) => fetch(...),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] })
      toast.success('Artículo creado')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
// ... 3 more mutations duplicadas
```

**DESPUÉS** (Cumple DRY):
```typescript
// ✅ Factory pattern (37 LOC)
const { useList, useById, useCreate, useUpdate, useDelete } =
  createCRUDHooks<Article, ArticleFormData>({
    entityName: 'Artículo',
    api: articlesApi,
    queryKey: 'articles',
  })

export { useList as useArticles, useById as useArticle, ... }
```

**Estado**: 2/31 hooks migrados (useArticles, useClients), 29 pendientes

**2. Error Handling - IMPLEMENTADO**

**ANTES**:
```typescript
// ❌ Duplicado 50+ veces
onError: (error) => {
  const err = error as { response?: { data?: { message?: string } } }
  toast.error(err.response?.data?.message || 'Error')
}
```

**DESPUÉS**:
```typescript
// ✅ Centralizado en useEntityMutation
function useEntityMutation({ mutationFn, successMessage }) {
  return useMutation({
    mutationFn,
    onError: (error) => {
      toast.error(extractErrorMessage(error, fallback))
    },
  })
}
```

### ⚠️ Violaciones de DRY Restantes

**1. Código Duplicado en Componentes** (Fase 4 pendiente)

```typescript
// ❌ VIOLA DRY: Tablas duplicadas

// app/api/articles/route.ts
export async function GET(request: NextRequest) {
  try {
    const user = extractUserFromHeaders(request) // Repetido
    if (!user) return unauthorizedResponse()     // Repetido

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')     // Repetido
    const limit = parseInt(searchParams.get('limit') || '50')  // Repetido
    const search = searchParams.get('search') || ''            // Repetido

    const data = await prisma.articles.findMany({ /* ... */ })

    return NextResponse.json({ data, total, page, limit }) // Repetido
  } catch (error) {
    return handleError(error) // Repetido
  }
}

// app/api/clients/route.ts
export async function GET(request: NextRequest) {
  try {
    const user = extractUserFromHeaders(request) // DUPLICADO
    if (!user) return unauthorizedResponse()     // DUPLICADO

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')     // DUPLICADO
    const limit = parseInt(searchParams.get('limit') || '50')  // DUPLICADO
    const search = searchParams.get('search') || ''            // DUPLICADO

    const data = await prisma.clients.findMany({ /* ... */ })

    return NextResponse.json({ data, total, page, limit }) // DUPLICADO
  } catch (error) {
    return handleError(error) // DUPLICADO
  }
}

// ... mismo patrón en 20+ routes
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE DRY: Extraer lógica común

// lib/api/helpers.ts
export function withAuth<T>(
  handler: (request: NextRequest, user: User) => Promise<T>
) {
  return async (request: NextRequest) => {
    try {
      const user = extractUserFromHeaders(request)
      if (!user) return unauthorizedResponse()

      const result = await handler(request, user)
      return NextResponse.json(result)
    } catch (error) {
      return handleError(error)
    }
  }
}

export function extractPaginationParams(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  return {
    page: parseInt(searchParams.get('page') || '1'),
    limit: parseInt(searchParams.get('limit') || '50'),
    search: searchParams.get('search') || '',
  }
}

// app/api/articles/route.ts
export const GET = withAuth(async (request, user) => {
  const { page, limit, search } = extractPaginationParams(request)

  const data = await prisma.articles.findMany({ /* ... */ })

  return { data, total, page, limit }
})

// app/api/clients/route.ts
export const GET = withAuth(async (request, user) => {
  const { page, limit, search } = extractPaginationParams(request)

  const data = await prisma.clients.findMany({ /* ... */ })

  return { data, total, page, limit }
})
```

**2. Formularios Duplicados**

```typescript
// ❌ VIOLA DRY: Formularios similares con código repetido

// components/articles/ArticleDialog.tsx
function ArticleDialog() {
  const form = useForm({
    resolver: zodResolver(articleSchema),
  })

  const mutation = useMutation({
    mutationFn: (data) => fetch('/api/articles', { /* ... */ }),
    onSuccess: () => {
      queryClient.invalidateQueries(['articles'])
      toast.success('Artículo creado')
      form.reset()
    },
  })

  return <form onSubmit={form.handleSubmit(mutation.mutate)}>...</form>
}

// components/clients/ClientDialog.tsx
function ClientDialog() {
  const form = useForm({
    resolver: zodResolver(clientSchema),
  })

  const mutation = useMutation({
    mutationFn: (data) => fetch('/api/clients', { /* ... */ }),
    onSuccess: () => {
      queryClient.invalidateQueries(['clients'])  // DUPLICADO
      toast.success('Cliente creado')             // DUPLICADO
      form.reset()                                // DUPLICADO
    },
  })

  return <form onSubmit={form.handleSubmit(mutation.mutate)}>...</form>
}

// ... mismo patrón en 10+ dialogs
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE DRY: Hook reutilizable

// hooks/useEntityForm.ts
export function useEntityForm<T extends z.ZodType>({
  schema,
  endpoint,
  queryKey,
  successMessage,
}: {
  schema: T
  endpoint: string
  queryKey: string[]
  successMessage: string
}) {
  const queryClient = useQueryClient()

  const form = useForm({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: (data: z.infer<T>) =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries(queryKey)
      toast.success(successMessage)
      form.reset()
    },
    onError: (error) => {
      toast.error('Error al guardar')
    },
  })

  return { form, mutation }
}

// Uso
function ArticleDialog() {
  const { form, mutation } = useEntityForm({
    schema: articleSchema,
    endpoint: '/api/articles',
    queryKey: ['articles'],
    successMessage: 'Artículo creado',
  })

  return <form onSubmit={form.handleSubmit(mutation.mutate)}>...</form>
}

function ClientDialog() {
  const { form, mutation } = useEntityForm({
    schema: clientSchema,
    endpoint: '/api/clients',
    queryKey: ['clients'],
    successMessage: 'Cliente creado',
  })

  return <form onSubmit={form.handleSubmit(mutation.mutate)}>...</form>
}
```

**Archivos a Crear:**
- `lib/api/helpers.ts` → Helpers para API routes
- `hooks/api/useEntityForm.ts` → Hook para formularios
- `hooks/api/useEntityQuery.ts` → Hook para queries
- `hooks/api/useEntityMutation.ts` → Hook para mutations

---

## 3. Principio KISS (Keep It Simple, Stupid)

> **"Mantener las cosas simples"**

### ✅ Aspectos que Cumplen KISS

**1. Componentes Simples**

```typescript
// ✅ CUMPLE KISS: Componente simple y claro

function MetricCard({ title, value, icon }: Props) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
```

### ⚠️ Violaciones de KISS Detectadas

**Problema en Lógica Compleja:**

```typescript
// ❌ VIOLA KISS: Demasiado complejo

function calculateDiscount(
  article: Article,
  client: Client,
  quantity: number,
  paymentTerm: PaymentTerm
) {
  let discount = 0

  // Descuento por categoría
  if (article.category?.defaultDiscountPercent) {
    discount += article.category.defaultDiscountPercent
  }

  // Descuento por cliente
  const clientDiscount = client.discounts?.find(
    (d) => d.categoryId === article.categoryId
  )
  if (clientDiscount) {
    discount += clientDiscount.discountPercent
  }

  // Descuento por cantidad
  if (quantity >= 100) discount += 5
  else if (quantity >= 50) discount += 3
  else if (quantity >= 10) discount += 1

  // Descuento por término de pago
  const paymentDiscount = paymentTerm.discounts?.find(
    (d) => d.categoryId === article.categoryId
  )
  if (paymentDiscount) {
    discount += paymentDiscount.discountPercent
  }

  // Máximo 50%
  return Math.min(discount, 50)
}
```

**Solución Propuesta:**
```typescript
// ✅ CUMPLE KISS: Separar en funciones pequeñas

interface DiscountStrategy {
  calculate(): number
}

class CategoryDiscount implements DiscountStrategy {
  constructor(private article: Article) {}

  calculate(): number {
    return this.article.category?.defaultDiscountPercent || 0
  }
}

class ClientDiscount implements DiscountStrategy {
  constructor(private client: Client, private article: Article) {}

  calculate(): number {
    const discount = this.client.discounts?.find(
      (d) => d.categoryId === this.article.categoryId
    )
    return discount?.discountPercent || 0
  }
}

class QuantityDiscount implements DiscountStrategy {
  constructor(private quantity: number) {}

  calculate(): number {
    if (this.quantity >= 100) return 5
    if (this.quantity >= 50) return 3
    if (this.quantity >= 10) return 1
    return 0
  }
}

class PaymentTermDiscount implements DiscountStrategy {
  constructor(private paymentTerm: PaymentTerm, private article: Article) {}

  calculate(): number {
    const discount = this.paymentTerm.discounts?.find(
      (d) => d.categoryId === this.article.categoryId
    )
    return discount?.discountPercent || 0
  }
}

// Calculador simple
class DiscountCalculator {
  private strategies: DiscountStrategy[] = []

  addStrategy(strategy: DiscountStrategy) {
    this.strategies.push(strategy)
    return this
  }

  calculate(): number {
    const total = this.strategies.reduce(
      (sum, strategy) => sum + strategy.calculate(),
      0
    )
    return Math.min(total, 50) // Máximo 50%
  }
}

// Uso simple
const discount = new DiscountCalculator()
  .addStrategy(new CategoryDiscount(article))
  .addStrategy(new ClientDiscount(client, article))
  .addStrategy(new QuantityDiscount(quantity))
  .addStrategy(new PaymentTermDiscount(paymentTerm, article))
  .calculate()
```

---

## 4. Principio YAGNI (You Aren't Gonna Need It)

> **"No implementar features que no se necesitan ahora"**

### ✅ Aspectos que Cumplen YAGNI

**1. Sin Sobre-Ingeniería**

El proyecto evita:
- ✅ No hay código "por si acaso"
- ✅ No hay features no usadas
- ✅ Implementaciones directas y claras

### ⚠️ Posibles Violaciones de YAGNI

**Revisar si existen:**

1. **Campos en BD no usados**
```sql
-- Revisar en Prisma schema si hay campos que nunca se usan
SELECT column_name FROM information_schema.columns
WHERE table_name = 'articles'
  AND column_name NOT IN (
    SELECT DISTINCT column_name FROM query_logs
  )
```

2. **Componentes no referenciados**
```bash
# Buscar componentes creados pero no importados
npx unimport scan
```

3. **Utilidades no usadas**
```bash
# Buscar funciones exportadas pero no importadas
npx ts-prune
```

---

## 5. Principio de Composición sobre Herencia

> **"Favorecer composición sobre herencia"**

### ✅ Aspectos que Cumplen

**1. React Composition**

```typescript
// ✅ CUMPLE: Composición en lugar de herencia

// En lugar de herencia
<Dialog>
  <DialogTrigger>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <ArticleForm />
  </DialogContent>
</Dialog>

// Composición flexible
<Card>
  <CardHeader>
    <CardTitle>Articles</CardTitle>
  </CardHeader>
  <CardContent>
    <ArticlesTable />
  </CardContent>
</Card>
```

---

## 6. Resumen de Refactorizaciones

### 6.1 ✅ COMPLETADAS (Fase 1-3)

| # | Principio | Problema | Solución | Estado |
|---|-----------|----------|----------|--------|
| 1 | **SRP** | API routes con lógica de negocio | 23 servicios creados | ✅ 100% |
| 2 | **DRY** | Error handling duplicado | AppError + handleError | ✅ 100% |
| 3 | **DRY** | Hooks duplicados | createCRUDHooks factory | ✅ 6% (2/31) |
| 4 | **SRP** | Activity logging mezclado | activityLogger service | ✅ 100% |

**Archivos Creados**:
- `lib/services/ArticleService.ts` (893 LOC)
- `lib/services/InvoiceService.ts` (893 LOC)
- `lib/services/SalesOrderService.ts` (887 LOC)
- `lib/hooks/api/createCRUDHooks.ts`
- `lib/hooks/api/useEntityMutation.ts`
- `lib/hooks/api/useEntityQuery.ts`
- `lib/errors/AppError.ts`
- `lib/errors/handler.ts`
- `components/ui/data-table.tsx`
- `components/ui/error-boundary.tsx`
- + 22 service tests, 2 hook tests

### 6.2 ⚠️ EN PROGRESO (Fase 4)

| # | Principio | Problema | Archivo(s) | Solución | Estado |
|---|-----------|----------|------------|----------|--------|
| 5 | **DRY** | 29 hooks restantes | `lib/hooks/*.ts` | Migrar a factory | 0% |
| 6 | **SRP** | Componentes grandes | `ArticlesTable.tsx` (372 LOC) | Usar DataTable<T> | 0% |
| 7 | **DRY** | Tablas duplicadas | 6+ table components | Usar DataTable<T> | 0% |

### 6.3 ❌ PENDIENTES (Fase 5+)

| # | Principio | Problema | Archivo(s) | Solución | Prioridad |
|---|-----------|----------|------------|----------|-----------|
| 8 | **DIP** | Dependencia directa de Prisma | `lib/services/*.ts` | Repository pattern | Media |
| 9 | **ISP** | Interfaces muy grandes | Tipos Prisma | Interfaces segregadas | Media |
| 10 | **OCP** | Switch/if para tipos | `lib/utils/mapper.ts` | Strategy pattern | Media |
| 11 | **YAGNI** | Código no usado | Todo el proyecto | Auditar | Baja |

---

## 7. Plan de Implementación

### Fase 1: Fundamentos (Semana 1-2)

1. **Crear estructura de repositorios** (DIP)
   ```
   lib/repositories/
   ├── interfaces.ts
   ├── prisma/
   │   ├── articleRepository.ts
   │   ├── clientRepository.ts
   │   └── invoiceRepository.ts
   ```

2. **Extraer lógica de API routes a servicios** (SRP)
   ```
   lib/services/
   ├── articleService.ts
   ├── clientService.ts
   ├── salesOrderService.ts
   └── invoiceService.ts
   ```

3. **Crear helpers de API** (DRY)
   ```
   lib/api/
   ├── helpers.ts
   ├── withAuth.ts
   └── extractParams.ts
   ```

### Fase 2: Componentes (Semana 3-4)

4. **Crear hooks reutilizables** (DRY)
   ```
   hooks/api/
   ├── useEntityForm.ts
   ├── useEntityQuery.ts
   └── useEntityMutation.ts
   ```

5. **Refactorizar componentes grandes** (SRP)
   - Separar `ArticlesTable.tsx`
   - Separar `ClientsTable.tsx`
   - Separar `SalesOrdersTable.tsx`

6. **Crear interfaces segregadas** (ISP)
   ```
   types/
   ├── models.ts
   ├── api.ts
   └── forms.ts
   ```

### Fase 3: Optimización (Semana 5-6)

7. **Implementar Strategy patterns** (OCP, KISS)
   - Refactorizar mappers
   - Refactorizar cálculo de descuentos

8. **Auditoría YAGNI**
   - Eliminar código no usado
   - Eliminar campos de BD no usados
   - Limpiar componentes no referenciados

---

## 8. Métricas de Éxito

### Antes (Pre-Refactoring)

- ❌ Servicios mezclados con routes
- ❌ Código duplicado en 72 routes
- ❌ 0 tests
- ❌ Error handling disperso
- ❌ Dependencias directas de Prisma

### Después de Fase 1-3 (Actual)

- ✅ 23 servicios separados y testeables
- ✅ 72 routes delegando (100%)
- ✅ 706 tests (70%+ service coverage)
- ✅ Error handling centralizado (AppError)
- ✅ Hooks genéricos (factory pattern)
- ⚠️ Dependencias de Prisma (pendiente repository pattern)

### Pendiente (Fase 4-5)

- ⏳ Migrar 29 hooks a factory pattern
- ⏳ Refactorizar 54 componentes
- ⏳ Component & integration tests
- ⏳ Repository pattern (DIP)
- ⏳ Interfaces segregadas (ISP)

### KPIs

| Métrica | Antes | Actual | Objetivo | Estado |
|---------|-------|--------|----------|--------|
| **Duplicación de código** | ~15% | ~8% | < 5% | ⚠️ Mejorado |
| **Test Coverage** | 0% | ~70% services | 80%+ | ⚠️ Mejorado |
| **Avg Route LOC** | ~500 | ~44 | <50 | ✅ Logrado |
| **Service Layer** | 0 | 23 | 23 | ✅ Logrado |
| **Generic Hooks** | 0 | 3 | 3 | ✅ Logrado |
| **Factory Adoption** | 0% | 6% | 50%+ | ❌ Pendiente |

---

## 9. Conclusión

### Estado Post-Fase 1-3 (Enero 2026)

El proyecto ha logrado **mejoras significativas** en principios de diseño:

**✅ Logros Completados**:
1. **SRP** - API routes 100% delegadas a servicios
2. **SRP** - Error handling centralizado
3. **DRY** - Hooks genéricos creados (factory pattern)
4. **DRY** - Error handling no duplicado
5. **Testing** - 706 tests implementados (70%+ services)

**⚠️ Mejoras en Progreso**:
1. **DRY** - Migrar 29 hooks restantes (6% completado)
2. **SRP** - Refactorizar 54 componentes grandes
3. **Testing** - Component & integration tests

**❌ Pendientes para Fase 5+**:
1. **DIP** - Implementar Repository pattern
2. **ISP** - Crear interfaces segregadas
3. **OCP** - Strategy pattern para mappers
4. **YAGNI** - Auditoría de código no usado

### Próximos Pasos

**Fase 4** (Prioridad Alta):
- Migrar 29 hooks a factory pattern
- Refactorizar componentes grandes con DataTable<T>
- Agregar component tests

**Fase 5** (Prioridad Media):
- Repository pattern para DIP
- Interfaces segregadas
- Cleanup YAGNI

El código ha evolucionado de **bueno a muy bueno**, y con Fase 4-5 llegará a **excelente**.
