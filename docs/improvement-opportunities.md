# SPISA - Oportunidades de Mejora

## 1. Testing (Prioridad: CRÍTICA 🔴)

### 1.1 Estado Actual
- ❌ **No hay tests unitarios**
- ❌ **No hay tests de integración**
- ❌ **No hay tests E2E**
- ❌ **No hay herramientas de testing configuradas**

### 1.2 Impacto
- **Riesgo Alto**: Cambios pueden romper funcionalidad sin detectarlo
- **Mantenimiento Difícil**: Refactorizar es riesgoso
- **Onboarding Lento**: Nuevos devs no tienen safety net
- **Deuda Técnica**: Crece exponencialmente sin tests

### 1.3 Solución Propuesta

#### A. Jest para Tests Unitarios

**Instalación:**
```bash
npm install -D jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest
```

**Configuración (jest.config.js):**
```javascript
const nextJest = require('next/jest')

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    'lib/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
}

module.exports = createJestConfig(customJestConfig)
```

**Ejemplos de Tests:**

```typescript
// lib/services/activityLogger.test.ts
import { activityLogger } from './activityLogger'
import { prisma } from '../db'

jest.mock('../db', () => ({
  prisma: {
    activity_logs: {
      create: jest.fn(),
    },
  },
}))

describe('ActivityLogger', () => {
  it('should log activity with correct params', async () => {
    const mockRequest = new Request('http://localhost')

    await activityLogger.logActivity({
      request: mockRequest,
      operation: 'ARTICLE_CREATE',
      description: 'Test',
      entityType: 'article',
      entityId: 1n,
    })

    expect(prisma.activity_logs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operation: 'ARTICLE_CREATE',
        description: 'Test',
      }),
    })
  })
})

// components/articles/ArticlesTable.test.tsx
import { render, screen } from '@testing-library/react'
import { ArticlesTable } from './ArticlesTable'

describe('ArticlesTable', () => {
  const mockArticles = [
    { id: 1, code: 'A001', description: 'Article 1', unitPrice: 100 },
  ]

  it('should render articles', () => {
    render(<ArticlesTable data={mockArticles} />)
    expect(screen.getByText('Article 1')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    render(<ArticlesTable data={[]} isLoading />)
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })
})

// app/api/articles/route.test.ts
import { GET, POST } from './route'
import { prisma } from '@/lib/db'

jest.mock('@/lib/db')

describe('/api/articles', () => {
  describe('GET', () => {
    it('should return paginated articles', async () => {
      const mockArticles = [{ id: 1, code: 'A001' }]
      ;(prisma.articles.findMany as jest.Mock).mockResolvedValue(mockArticles)
      ;(prisma.articles.count as jest.Mock).mockResolvedValue(1)

      const request = new Request('http://localhost/api/articles?page=1&limit=50')
      const response = await GET(request)
      const data = await response.json()

      expect(data.data).toEqual(mockArticles)
      expect(data.total).toBe(1)
    })
  })
})
```

#### B. Playwright para Tests E2E

**Instalación:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Configuración (playwright.config.ts):**
```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './__tests__/e2e',
  fullyParallel: true,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3000,
  },
})
```

**Ejemplo de Test E2E:**
```typescript
// __tests__/e2e/articles.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Articles Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should create new article', async ({ page }) => {
    await page.goto('/dashboard/articles')
    await page.click('text=Nuevo Artículo')

    await page.fill('input[name="code"]', 'TEST001')
    await page.fill('input[name="description"]', 'Test Article')
    await page.fill('input[name="unitPrice"]', '100')

    await page.click('button[type="submit"]')

    await expect(page.locator('text=Artículo creado')).toBeVisible()
    await expect(page.locator('text=TEST001')).toBeVisible()
  })
})
```

### 1.4 Scripts a Agregar

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

### 1.5 Cobertura de Testing Recomendada

| Capa | Prioridad | Cobertura Objetivo |
|------|-----------|-------------------|
| Servicios (lib/services/) | 🔴 Crítica | 90%+ |
| Utilidades (lib/utils/) | 🔴 Crítica | 90%+ |
| API Routes | 🟡 Alta | 80%+ |
| Componentes de dominio | 🟡 Alta | 70%+ |
| Componentes UI base | 🟢 Media | 60%+ |
| E2E flujos críticos | 🔴 Crítica | 100% |

---

## 2. Type Safety (Prioridad: ALTA 🔴)

### 2.1 Problemas Actuales

- ⚠️ **Tipos dispersos**: Definidos en múltiples archivos
- ⚠️ **`any` usage**: Posiblemente en varios lugares
- ⚠️ **Falta de tipos compartidos**: Entre frontend y backend

### 2.2 Solución Propuesta

#### A. Centralizar Tipos

**Crear estructura:**
```
types/
├── api.ts          # Tipos de request/response
├── models.ts       # Tipos de entidades (Prisma generados + custom)
├── forms.ts        # Tipos de formularios
├── enums.ts        # Enums compartidos
├── utils.ts        # Utility types
└── index.ts        # Re-exports
```

**Ejemplo (types/models.ts):**
```typescript
import type { Prisma } from '@prisma/client'

// Extend Prisma types
export type Article = Prisma.articlesGetPayload<{
  include: { categories: true }
}>

export type Client = Prisma.clientsGetPayload<{
  include: { provinces: true }
}>

// Custom types
export type ArticleWithStock = Article & {
  availableStock: number
  reservedStock: number
}
```

**Ejemplo (types/api.ts):**
```typescript
// Request types
export interface PaginationParams {
  page: number
  limit: number
}

export interface ArticlesListRequest extends PaginationParams {
  search?: string
  categoryId?: number
  isActive?: boolean
}

// Response types
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type ArticlesListResponse = PaginatedResponse<Article>
```

#### B. Eliminar `any`

**Buscar y reemplazar:**
```bash
# Buscar todos los any
grep -r ": any" --include="*.ts" --include="*.tsx"

# Reemplazar con tipos correctos
```

**Estrategia:**
1. Activar `noImplicitAny` en tsconfig.json (si no está)
2. Usar `unknown` en lugar de `any` cuando sea necesario
3. Crear tipos específicos para cada caso

#### C. Strict Mode en TypeScript

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "strict": true,              // Ya habilitado ✅
    "noUncheckedIndexedAccess": true,  // Agregar
    "noImplicitReturns": true,   // Agregar
    "noFallthroughCasesInSwitch": true,  // Agregar
    "forceConsistentCasingInFileNames": true  // Agregar
  }
}
```

---

## 3. Error Handling (Prioridad: ALTA 🔴)

### 3.1 Problemas Actuales

- ⚠️ **Manejo inconsistente**: Cada endpoint maneja errores diferente
- ⚠️ **No hay error boundaries**: En React
- ⚠️ **Logs no estructurados**: Dificulta debugging

### 3.2 Solución Propuesta

#### A. Error Handler Centralizado

**Crear `lib/errors/handler.ts`:**
```typescript
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleError(error: unknown): NextResponse {
  console.error('[Error Handler]', error)

  // Validation errors (Zod)
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation Error',
        message: 'Datos inválidos',
        details: error.flatten(),
      },
      { status: 400 }
    )
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Unique Constraint', message: 'El registro ya existe' },
        { status: 409 }
      )
    }
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Not Found', message: 'Registro no encontrado' },
        { status: 404 }
      )
    }
  }

  // Custom app errors
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.code, message: error.message, details: error.details },
      { status: error.statusCode }
    )
  }

  // Unknown errors
  return NextResponse.json(
    {
      error: 'Internal Server Error',
      message: 'Ha ocurrido un error inesperado',
    },
    { status: 500 }
  )
}
```

**Uso en API routes:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validated = createArticleSchema.parse(body)

    const article = await prisma.articles.create({ data: validated })

    return NextResponse.json(article, { status: 201 })
  } catch (error) {
    return handleError(error)
  }
}
```

#### B. Error Boundaries en React

**Crear `components/ErrorBoundary.tsx`:**
```typescript
'use client'
import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[Error Boundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <h2 className="text-lg font-semibold text-red-800">
              Ha ocurrido un error
            </h2>
            <p className="text-sm text-red-600">
              {this.state.error?.message}
            </p>
          </div>
        )
      )
    }

    return this.props.children
  }
}
```

**Uso:**
```typescript
// app/layout.tsx
<ErrorBoundary>
  {children}
</ErrorBoundary>
```

#### C. Logging Estructurado

**Instalar Winston:**
```bash
npm install winston
```

**Crear `lib/logger.ts`:**
```typescript
import winston from 'winston'

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
})

// En producción, agregar transporte a archivo o servicio externo
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  )
  logger.add(new winston.transports.File({ filename: 'logs/combined.log' }))
}
```

---

## 4. Validación y Sanitización (Prioridad: ALTA 🔴)

### 4.1 Problemas Actuales

- ⚠️ **Validación solo con Zod**: Falta sanitización
- ⚠️ **No hay rate limiting**: Vulnerable a abuse
- ⚠️ **Falta validación de archivos**: En uploads

### 4.2 Solución Propuesta

#### A. Sanitización de Inputs

**Instalar:**
```bash
npm install validator
npm install -D @types/validator
```

**Crear `lib/validation/sanitize.ts`:**
```typescript
import validator from 'validator'

export const sanitize = {
  string: (input: string): string => {
    return validator.trim(validator.escape(input))
  },

  email: (input: string): string => {
    return validator.normalizeEmail(input) || ''
  },

  html: (input: string): string => {
    // Para rich text, usar biblioteca especializada
    return validator.stripLow(input)
  },
}
```

#### B. Rate Limiting

**Instalar:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Crear `lib/ratelimit.ts`:**
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10 requests per 10 seconds
})

export async function checkRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(
    identifier
  )

  if (!success) {
    throw new AppError(
      429,
      'Too Many Requests',
      'RATE_LIMIT_EXCEEDED',
      { limit, reset, remaining }
    )
  }
}
```

**Uso en middleware:**
```typescript
// middleware.ts
import { checkRateLimit } from '@/lib/ratelimit'

export async function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown'

  try {
    await checkRateLimit(ip)
  } catch (error) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }

  // ... resto del middleware
}
```

#### C. Validación de Archivos

**Crear `lib/validation/files.ts`:**
```typescript
export const fileValidation = {
  maxSize: 5 * 1024 * 1024, // 5MB

  allowedTypes: {
    images: ['image/jpeg', 'image/png', 'image/webp'],
    documents: ['application/pdf', 'application/vnd.ms-excel'],
    excel: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ],
  },

  validate(file: File, type: keyof typeof fileValidation.allowedTypes) {
    if (file.size > this.maxSize) {
      throw new Error('Archivo demasiado grande')
    }

    if (!this.allowedTypes[type].includes(file.type)) {
      throw new Error('Tipo de archivo no permitido')
    }

    return true
  },
}
```

---

## 5. Performance (Prioridad: MEDIA 🟡)

### 5.1 Problemas Actuales

- ⚠️ **No hay caché de BD**: Queries repetitivas
- ⚠️ **No hay CDN**: Para activos estáticos
- ⚠️ **Bundle size**: Puede optimizarse

### 5.2 Solución Propuesta

#### A. Redis para Caché

**Instalar:**
```bash
npm install ioredis
```

**Crear `lib/cache.ts`:**
```typescript
import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key)
    return data ? JSON.parse(data) : null
  },

  async set(key: string, value: any, ttl = 60): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value))
  },

  async del(key: string): Promise<void> {
    await redis.del(key)
  },

  async clear(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern)
    if (keys.length > 0) {
      await redis.del(...keys)
    }
  },
}
```

**Uso:**
```typescript
// app/api/articles/route.ts
export async function GET(request: NextRequest) {
  const cacheKey = `articles:${page}:${limit}`

  // Try cache first
  const cached = await cache.get(cacheKey)
  if (cached) return NextResponse.json(cached)

  // Query DB
  const articles = await prisma.articles.findMany({ /* ... */ })

  // Cache result
  await cache.set(cacheKey, articles, 60) // 1 min

  return NextResponse.json(articles)
}
```

#### B. Bundle Analysis

**Instalar:**
```bash
npm install -D @next/bundle-analyzer
```

**Configurar (next.config.ts):**
```typescript
import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withBundleAnalyzer({
  // ... rest of config
})
```

**Ejecutar:**
```bash
ANALYZE=true npm run build
```

#### C. Image Optimization

**Usar Next.js Image:**
```typescript
import Image from 'next/image'

<Image
  src="/logo.png"
  alt="Logo"
  width={200}
  height={100}
  priority // Para above-the-fold images
/>
```

---

## 6. Seguridad (Prioridad: ALTA 🔴)

### 6.1 Auditoría de Seguridad

#### A. Helmet para Headers de Seguridad

**Instalar:**
```bash
npm install helmet
```

**Configurar en middleware:**
```typescript
import { NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  )

  return response
}
```

#### B. CSRF Protection

**Instalar:**
```bash
npm install csrf
```

**Implementar:**
```typescript
// lib/csrf.ts
import { createCsrfToken, verifyCsrfToken } from 'csrf'

export async function validateCsrf(request: NextRequest) {
  const token = request.headers.get('x-csrf-token')
  const cookie = request.cookies.get('csrf-token')?.value

  if (!token || !cookie || token !== cookie) {
    throw new AppError(403, 'Invalid CSRF token')
  }
}
```

#### C. SQL Injection Prevention

**Buenas prácticas:**
- ✅ Usar Prisma (previene SQL injection automáticamente)
- ✅ Nunca concatenar strings para queries
- ✅ Validar inputs con Zod

#### D. Dependency Security Audit

**Scripts:**
```json
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "deps:check": "npx npm-check-updates"
  }
}
```

**Ejecutar regularmente:**
```bash
npm audit
npm audit fix
```

---

## 7. Monitoreo y Observabilidad (Prioridad: MEDIA 🟡)

### 7.1 Solución Propuesta

#### A. Application Performance Monitoring (APM)

**Opciones:**
- **Sentry**: Error tracking
- **DataDog**: APM completo
- **New Relic**: APM completo

**Ejemplo con Sentry:**
```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
})
```

#### B. Health Check Endpoint

**Crear `app/api/health/route.ts`:**
```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Database connection failed',
      },
      { status: 503 }
    )
  }
}
```

---

## 8. CI/CD Pipeline (Prioridad: MEDIA 🟡)

### 8.1 GitHub Actions

**Crear `.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Build
        run: npm run build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security audit
        run: npm audit --audit-level=high
```

---

## 9. Documentación (Prioridad: MEDIA 🟡)

### 9.1 Propuesta

#### A. OpenAPI/Swagger

**Instalar:**
```bash
npm install swagger-jsdoc swagger-ui-express
```

**Generar docs automáticamente desde JSDoc en routes:**
```typescript
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
 *         description: Lista de artículos paginada
 */
```

#### B. Storybook para Componentes

**Instalar:**
```bash
npx sb init
```

**Crear stories:**
```typescript
// components/ui/button.stories.tsx
import { Button } from './button'

export default {
  title: 'UI/Button',
  component: Button,
}

export const Primary = () => <Button>Click me</Button>
export const Secondary = () => <Button variant="secondary">Click me</Button>
```

---

## 10. Resumen de Prioridades

| # | Mejora | Prioridad | Impacto | Esfuerzo |
|---|--------|-----------|---------|----------|
| 1 | **Testing** (Unit + E2E) | 🔴 Crítica | Alto | Alto |
| 2 | **Type Safety** (Centralizar tipos) | 🔴 Alta | Alto | Medio |
| 3 | **Error Handling** (Centralizado) | 🔴 Alta | Alto | Medio |
| 4 | **Validación** (Sanitización + Rate limit) | 🔴 Alta | Alto | Medio |
| 5 | **Seguridad** (Headers, CSRF, Audit) | 🔴 Alta | Alto | Bajo |
| 6 | **Performance** (Caché Redis) | 🟡 Media | Medio | Medio |
| 7 | **Monitoreo** (Sentry, Health checks) | 🟡 Media | Medio | Bajo |
| 8 | **CI/CD** (GitHub Actions) | 🟡 Media | Medio | Bajo |
| 9 | **Documentación** (OpenAPI, Storybook) | 🟡 Media | Bajo | Alto |

## 11. Plan de Implementación Sugerido

### Fase 1: Fundamentos (2-3 semanas)
1. Configurar Jest y escribir tests para servicios críticos
2. Centralizar tipos en carpeta `types/`
3. Implementar error handler centralizado
4. Agregar security headers

### Fase 2: Estabilidad (2-3 semanas)
5. Agregar tests de integración para API routes
6. Implementar rate limiting
7. Configurar CI/CD pipeline
8. Agregar monitoring básico (health checks)

### Fase 3: Optimización (2-3 semanas)
9. Agregar tests E2E con Playwright
10. Implementar caché con Redis
11. Optimizar bundle size
12. Documentar API con OpenAPI

### Fase 4: Excelencia (Ongoing)
13. Mejorar cobertura de tests a 80%+
14. Agregar Sentry para error tracking
15. Crear Storybook para componentes
16. Documentación técnica completa

---

**Nota Final**: Estas mejoras transformarán el proyecto de **bueno a excelente**, aumentando significativamente la **calidad, seguridad, mantenibilidad y escalabilidad** del código.
