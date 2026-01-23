# SPISA - Developer Quick Reference Guide

> **Last Updated**: January 23, 2026
> **Status**: Post-Refactoring (Phases 1-3 Complete)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Code Standards](#code-standards)
4. [Common Tasks](#common-tasks)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## Project Overview

**SPISA** is a Full-Stack ERP built with Next.js 15, focusing on inventory management, sales orders, invoicing, and analytics.

**Key Tech**:
- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript 5
- **Backend**: Next.js API Routes + Prisma 6 + PostgreSQL 16
- **State**: React Query 5 + Zustand 5
- **UI**: shadcn/ui + Tailwind CSS 4

**Key Metrics**:
- 📁 161 files refactored
- ✅ 706 tests passing
- 🏗️ 23 services created
- 🔧 72 API routes
- 📦 98% type safety

---

## Architecture Patterns

### 1. Layered Architecture

```
┌─────────────────────────────────────┐
│      UI Components (90)             │
│  - Feature components               │
│  - shadcn/ui primitives             │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Hooks Layer (31)               │
│  - React Query hooks                │
│  - Factory pattern (19% adoption)   │
│  - 100% API wrapper coverage        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      API Client Layer (17)          │
│  - Axios-based API wrappers         │
│  - Consistent error handling        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┘
│      API Routes (72)                │
│  - Thin orchestration layer         │
│  - 100% delegation to services      │
│  - Average: 44 LOC                  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Service Layer (23)             │
│  - Business logic                   │
│  - 3,044 LOC total                  │
│  - 70%+ test coverage               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Data Layer (Prisma)            │
│  - Type-safe ORM                    │
│  - PostgreSQL 16                    │
└─────────────────────────────────────┘
```

### 2. Factory Pattern for Hooks

**Use the factory** for simple CRUD operations:

```typescript
// lib/hooks/useMyEntity.ts
import { createCRUDHooks } from './api/createCRUDHooks';
import { myEntityApi } from '@/lib/api/myEntity';

const { useList, useById, useCreate, useUpdate, useDelete } =
  createCRUDHooks<MyEntity, CreateData, UpdateData, ListParams>({
    entityName: 'My Entity',
    api: myEntityApi,
    queryKey: 'myEntity',
  });

export {
  useList as useMyEntities,
  useById as useMyEntity,
  useCreate as useCreateMyEntity,
  useUpdate as useUpdateMyEntity,
  useDelete as useDeleteMyEntity,
};
```

**Benefits**:
- ✅ Automatic toast notifications
- ✅ Automatic cache invalidation
- ✅ Centralized error handling
- ✅ ~60% code reduction

**When NOT to use**:
- Complex domain logic (keep manual)
- Non-standard mutation behavior
- Custom success messages per operation

### 3. Service Pattern

**All business logic goes in services**:

```typescript
// lib/services/MyEntityService.ts
import prisma from '@/lib/db';
import { AppError } from '@/lib/errors';
import { logActivity } from './activityLogger';

export class MyEntityService {
  static async getAll(params) {
    // Business logic here
    const entities = await prisma.myEntity.findMany({
      where: { /* ... */ },
      include: { /* ... */ },
    });

    return entities;
  }

  static async create(data, userId) {
    // Validation
    if (!data.name) {
      throw AppError.badRequest('Name is required');
    }

    // Create
    const entity = await prisma.myEntity.create({ data });

    // Audit log
    await logActivity({
      userId,
      action: 'create',
      entityType: 'myEntity',
      entityId: entity.id,
      description: `Created entity: ${entity.name}`,
    });

    return entity;
  }
}
```

### 4. API Route Pattern

**All routes delegate to services**:

```typescript
// app/api/my-entity/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MyEntityService } from '@/lib/services/MyEntityService';
import { getUserFromRequest } from '@/lib/api-helpers/getUserFromRequest';
import { handleError } from '@/lib/errors/handler';
import { myEntitySchema } from '@/lib/validations/schemas';

export async function POST(request: NextRequest) {
  try {
    // 1. Extract user
    const user = getUserFromRequest(request);

    // 2. Parse & validate
    const body = await request.json();
    const validated = myEntitySchema.parse(body);

    // 3. Delegate to service
    const result = await MyEntityService.create(validated, user.id);

    // 4. Return
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
```

**Rules**:
- ❌ NO business logic in routes
- ❌ NO direct Prisma calls
- ✅ ONLY orchestration (parse → validate → delegate → return)

### 5. Error Handling

**Use AppError class**:

```typescript
import { AppError } from '@/lib/errors';

// Throw semantic errors
throw AppError.badRequest('Invalid input');
throw AppError.unauthorized('Not logged in');
throw AppError.forbidden('Insufficient permissions');
throw AppError.notFound('Entity not found');
throw AppError.conflict('Duplicate entry');
throw AppError.internal('Server error');
```

**Handler automatically converts**:
- `AppError` → correct HTTP status + message
- `ZodError` → 400 + validation errors
- `Prisma errors` → appropriate status + message
- Generic errors → 500 + generic message

---

## Code Standards

### File Naming

```
- Components: PascalCase (ArticleDialog.tsx)
- Hooks: camelCase with 'use' prefix (useArticles.ts)
- Services: PascalCase with 'Service' suffix (ArticleService.ts)
- API routes: kebab-case (my-entity/route.ts)
- Types: camelCase (article.ts, salesOrder.ts)
- Constants: SCREAMING_SNAKE_CASE (ROUTES, ACTION_BUTTON_CONFIG)
```

### Import Ordering

```typescript
// 1. React/Next
import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 2. External libraries
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

// 3. Internal - components
import { Button } from '@/components/ui/button';

// 4. Internal - hooks/utils/services
import { useArticles } from '@/lib/hooks/useArticles';
import { formatPrice } from '@/lib/utils';

// 5. Internal - types
import type { Article } from '@/types/article';
```

### TypeScript Rules

```typescript
// ✅ DO: Explicit return types for exported functions
export function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// ✅ DO: Use type inference for locals
const total = calculateTotal(items); // inferred as number

// ❌ DON'T: Use 'any' (use 'unknown' if needed)
function process(data: any) { } // ❌

// ✅ DO: Use 'unknown' and type guards
function process(data: unknown) {
  if (typeof data === 'string') { /* ... */ }
}

// ✅ DO: Interface for objects, Type for unions/primitives
interface User { name: string; age: number; }
type Status = 'pending' | 'active' | 'inactive';
```

---

## Common Tasks

### Adding a New Entity

1. **Create Type** (`types/myEntity.ts`):
```typescript
export interface MyEntity {
  id: number;
  name: string;
  createdAt: string;
}

export interface MyEntityFormData {
  name: string;
}
```

2. **Create API Wrapper** (`lib/api/myEntity.ts`):
```typescript
import { apiClient } from './client';

export const myEntityApi = {
  getAll: async () => {
    const { data } = await apiClient.get('/my-entity');
    return data;
  },
  // ... create, update, delete
};
```

3. **Create Hook** (`lib/hooks/useMyEntity.ts`):
```typescript
import { createCRUDHooks } from './api/createCRUDHooks';

const { useList, useCreate } = createCRUDHooks({
  entityName: 'My Entity',
  api: myEntityApi,
  queryKey: 'myEntity',
});

export { useList as useMyEntities, /* ... */ };
```

4. **Create Service** (`lib/services/MyEntityService.ts`):
```typescript
export class MyEntityService {
  static async getAll() { /* ... */ }
  static async create(data, userId) { /* ... */ }
}
```

5. **Create API Route** (`app/api/my-entity/route.ts`):
```typescript
export async function GET() {
  try {
    const result = await MyEntityService.getAll();
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}
```

6. **Create Component** (`components/myEntity/MyEntityTable.tsx`)

7. **Create Page** (`app/dashboard/my-entity/page.tsx`)

### Adding Tests

```typescript
// lib/services/__tests__/MyEntityService.test.ts
import { MyEntityService } from '../MyEntityService';
import prisma from '@/lib/db';

jest.mock('@/lib/db', () => ({
  myEntity: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
}));

describe('MyEntityService', () => {
  it('should get all entities', async () => {
    (prisma.myEntity.findMany as jest.Mock).mockResolvedValue([
      { id: 1, name: 'Test' },
    ]);

    const result = await MyEntityService.getAll();

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Test');
  });
});
```

---

## Testing

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Specific file
npm test -- MyEntityService.test.ts
```

### Test Structure

```
✅ Services: 70%+ coverage (HIGH)
✅ Utilities: 80%+ coverage (HIGH)
✅ API Helpers: 100% coverage (HIGH)
⚠️ Hooks: 6% coverage (LOW)
❌ Components: 0% coverage (NONE)
```

### Current Test Count

- **Total**: 706 tests
- **Test Suites**: 36
- **Coverage**: ~70% (services/utils)

---

## Troubleshooting

### Common Issues

**1. "Module not found" errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

**2. Prisma type errors**
```bash
# Regenerate Prisma client
npx prisma generate
```

**3. Tests failing**
```bash
# Clear Jest cache
npm test -- --clearCache
npm test
```

**4. TypeScript errors after pulling**
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Performance Tips

1. **React Query DevTools** (enabled in dev):
   - Shows cache state
   - Debug stale/fresh queries
   - See refetch behavior

2. **Check bundle size**:
   ```bash
   npm run build
   # Check .next/standalone size
   ```

3. **Database query optimization**:
   - Use Prisma includes selectively
   - Add indexes for frequent queries
   - Monitor slow query log

---

## Key Files Reference

### Configuration
- `tsconfig.json` - TypeScript config
- `next.config.ts` - Next.js config
- `tailwind.config.ts` - Tailwind config
- `jest.config.js` - Test config
- `.eslintrc.json` - Linting rules
- `.prettierrc.json` - Formatting rules

### Entry Points
- `app/layout.tsx` - Root layout
- `app/page.tsx` - Home page (redirects)
- `app/dashboard/layout.tsx` - Dashboard layout with ErrorBoundary
- `middleware.ts` - Auth middleware

### Key Utilities
- `lib/db.ts` - Prisma client singleton
- `lib/api/client.ts` - Axios API client
- `lib/errors/handler.ts` - Error handler
- `lib/constants/routes.ts` - Route constants

---

## Resources

- **Documentation**: `/docs` folder
- **Architecture**: `docs/architecture-overview.md`
- **Migration Summary**: `docs/MIGRATION_SUMMARY_2026.md`
- **SOLID Analysis**: `docs/solid-principles-analysis.md`

---

**Questions?** Check the docs or ask the team!

**Contributing?** Follow the patterns above and add tests! ✅
