# Hooks Organization Guide

## Overview

All React hooks are now organized under `frontend/lib/hooks/` with a clear three-tier structure that separates concerns and improves discoverability.

## Directory Structure

```
frontend/lib/hooks/
├── api/                    # Factory functions for generating CRUD hooks
│   ├── createCRUDHooks.ts  # Main factory for CRUD operations
│   ├── useEntityMutation.ts # Generic mutation hook
│   ├── useEntityQuery.ts    # Generic query hook
│   ├── index.ts
│   └── __tests__/           # Tests for factory functions
├── generic/               # Reusable utility hooks (4 files)
│   ├── useFixedBottomBar.ts
│   ├── useFormValidation.ts
│   ├── usePagination.ts
│   └── usePrintDocument.ts
└── domain/                # Business-specific hooks (29 files)
    ├── useActivityLogs.ts
    ├── useArticles.ts
    ├── useAuth.ts
    ├── useCategories.ts
    ├── useCategoryPaymentDiscounts.ts
    ├── useCertificates.ts
    ├── useClientClassification.ts
    ├── useClients.ts
    ├── useDashboard.ts
    ├── useDeliveryNotes.ts
    ├── useFeedback.ts
    ├── useImportProforma.ts
    ├── useInvoices.ts
    ├── usePaymentTerms.ts
    ├── usePriceHistory.ts
    ├── usePriceImportDraft.ts
    ├── usePriceLists.ts
    ├── useQuickCart.ts
    ├── useQuickCartTabs.ts
    ├── useQuickDeliveryNoteTabs.ts
    ├── useQuickInvoiceTabs.ts
    ├── useSalesOrderPermissions.ts
    ├── useSalesOrders.ts
    ├── useSettings.ts
    ├── useStockMovements.ts
    ├── useStockValuation.ts
    ├── useSupplierOrderDraft.ts
    ├── useSupplierOrders.ts
    └── useUsers.ts
```

## Hook Categories

### 1. API Hooks (`lib/hooks/api/`)

**Purpose**: Factory functions that generate standardized CRUD hooks.

**When to use**: Never import these directly in components. These are internal utilities used by domain hooks.

**Key files**:
- `createCRUDHooks.ts` - Main factory that generates useList, useById, useCreate, useUpdate, useDelete hooks
- `useEntityMutation.ts` - Generic mutation wrapper with optimistic updates and caching
- `useEntityQuery.ts` - Generic query wrapper with caching strategies

**Example usage** (in domain hooks only):
```typescript
import { createCRUDHooks } from '../api/createCRUDHooks';

const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  Article,
  CreateArticleDto,
  UpdateArticleDto,
  ArticleListParams
>({
  entityName: 'Article',
  api: articlesApi,
  queryKey: 'articles',
});

export {
  useList as useArticles,
  useById as useArticle,
  useCreate as useCreateArticle,
  useUpdate as useUpdateArticle,
  useDelete as useDeleteArticle,
};
```

### 2. Generic Hooks (`lib/hooks/generic/`)

**Purpose**: Reusable utility hooks that have no business logic dependencies.

**When to use**: Use these for common UI patterns and utilities that could be used across any project.

**Available hooks**:

#### `useFixedBottomBar`
Manages fixed bottom bar positioning with window resize handling.

```typescript
import { useFixedBottomBar } from '@/lib/hooks/generic/useFixedBottomBar';

function MyComponent() {
  const { bottomBarHeight, windowSize } = useFixedBottomBar();
  // Use for responsive layouts with fixed bottom bars
}
```

#### `useFormValidation`
Provides form validation with flexible validator functions.

```typescript
import { useFormValidation, validators } from '@/lib/hooks/generic/useFormValidation';

function MyForm() {
  const { validate, getError, clearError } = useFormValidation([
    {
      field: 'email',
      validate: validators.required('Email is required'),
    },
    {
      field: 'password',
      validate: validators.minLength(8, 'Password must be at least 8 characters'),
    },
  ]);

  const handleSubmit = () => {
    if (validate(formData)) {
      // Submit form
    }
  };
}
```

#### `usePagination`
Manages pagination state for lists and tables.

```typescript
import { usePagination } from '@/lib/hooks/generic/usePagination';

function MyTable() {
  const { pagination, setPage, setPageSize, setSorting } = usePagination(10);

  // Use pagination.pageNumber, pagination.pageSize, etc.
}
```

#### `usePrintDocument`
Manages document printing with preview functionality.

```typescript
import { usePrintDocument } from '@/lib/hooks/generic/usePrintDocument';

function InvoicePage() {
  const {
    fetchPreview,
    printDocument,
    previewUrl,
    isLoading,
    closePreview,
  } = usePrintDocument('invoice');

  const handlePrint = async (id: number) => {
    await fetchPreview(id);
    // Show preview modal
    await printDocument(id);
  };
}
```

### 3. Domain Hooks (`lib/hooks/domain/`)

**Purpose**: Business-specific hooks that encapsulate application logic and API calls.

**When to use**: Import these in components that need to interact with specific business entities.

**Naming convention**: `use[EntityName](s)`
- Plural for lists: `useArticles`, `useClients`
- Singular for single entity: `useArticle`, `useClient`
- Action prefix for mutations: `useCreateArticle`, `useUpdateClient`

**Standard CRUD hooks** (generated by factory):

Most domain entities expose these standard hooks:

```typescript
// List all entities with filters
const { data, isLoading, error } = useArticles({
  searchTerm: 'laptop',
  categoryId: 5,
  pageNumber: 1,
  pageSize: 20,
});

// Get single entity by ID
const { data: article, isLoading } = useArticle(123);

// Create new entity
const createMutation = useCreateArticle();
createMutation.mutate(newArticleData);

// Update existing entity
const updateMutation = useUpdateArticle();
updateMutation.mutate({ id: 123, data: updates });

// Delete entity
const deleteMutation = useDeleteArticle();
deleteMutation.mutate(123);
```

**Custom domain hooks**:

Some domain hooks provide additional functionality beyond standard CRUD:

```typescript
// Sales orders have custom hooks for generating documents
import {
  useSalesOrders,
  useSalesOrder,
  useGenerateInvoice,
  useGenerateDeliveryNote,
} from '@/lib/hooks/domain/useSalesOrders';

const generateInvoice = useGenerateInvoice();
generateInvoice.mutate({ id: salesOrderId });
```

## Import Paths

### ✅ Correct

```typescript
// Generic hooks
import { usePagination } from '@/lib/hooks/generic/usePagination';
import { useFormValidation } from '@/lib/hooks/generic/useFormValidation';

// Domain hooks
import { useArticles, useCreateArticle } from '@/lib/hooks/domain/useArticles';
import { useClients } from '@/lib/hooks/domain/useClients';
```

### ❌ Incorrect

```typescript
// Don't import from root
import { usePagination } from '@/lib/hooks/usePagination'; // Wrong!

// Don't import from old location
import { useFormValidation } from '@/hooks/useFormValidation'; // Wrong!

// Don't import API hooks directly
import { createCRUDHooks } from '@/lib/hooks/api/createCRUDHooks'; // Wrong (unless in a domain hook)!
```

## Migration Guide

If you're updating code that used the old hook locations:

### Before
```typescript
import { usePagination } from '@/lib/hooks/usePagination';
import { useFormValidation } from '@/hooks/useFormValidation';
import { useArticles } from '@/lib/hooks/useArticles';
```

### After
```typescript
import { usePagination } from '@/lib/hooks/generic/usePagination';
import { useFormValidation } from '@/lib/hooks/generic/useFormValidation';
import { useArticles } from '@/lib/hooks/domain/useArticles';
```

## Creating New Hooks

### Adding a Generic Hook

1. Place in `frontend/lib/hooks/generic/`
2. Ensure it has no business logic dependencies
3. Export from the file directly
4. Add JSDoc comments

```typescript
/**
 * Custom hook for [purpose]
 * @param [params] - Description
 * @returns [return value description]
 */
export function useMyGenericHook(params: Params) {
  // Implementation
}
```

### Adding a Domain Hook

1. Check if entity needs standard CRUD operations
2. If yes, use the factory pattern:

```typescript
// frontend/lib/hooks/domain/useMyEntity.ts
import { createCRUDHooks } from '../api/createCRUDHooks';
import { myEntityApi } from '../../api/myEntity';

const { useList, useById, useCreate, useUpdate, useDelete } = createCRUDHooks<
  MyEntity,
  CreateMyEntityDto,
  UpdateMyEntityDto,
  MyEntityListParams
>({
  entityName: 'MyEntity',
  api: myEntityApi,
  queryKey: 'my-entities',
});

export {
  useList as useMyEntities,
  useById as useMyEntity,
  useCreate as useCreateMyEntity,
  useUpdate as useUpdateMyEntity,
  useDelete as useDeleteMyEntity,
};
```

3. If custom logic is needed, add it to the same file:

```typescript
export function useCustomMyEntityOperation() {
  return useMutation({
    mutationFn: (id: number) => myEntityApi.customOperation(id),
    onSuccess: () => {
      // Custom success handling
    },
  });
}
```

## Testing Hooks

Hooks should be tested using `@testing-library/react-hooks`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useMyHook } from './useMyHook';

describe('useMyHook', () => {
  it('should return expected value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current).toBeDefined();
  });
});
```

## Benefits of This Organization

1. **Clear Separation of Concerns**: Generic vs Domain vs Factory
2. **Improved Discoverability**: Developers know where to find hooks
3. **Reduced Coupling**: Generic hooks have zero business logic
4. **Easier Testing**: Each category can be tested independently
5. **Better Reusability**: Generic hooks can be used across projects
6. **Consistent Patterns**: CRUD operations follow the same pattern
7. **Type Safety**: Factory pattern ensures consistent typing

## Related Documentation

- [CRUD Hooks Factory Pattern](./CRUD_HOOKS_PATTERN.md)
- [Folder Structure Analysis](./folder-structure-analysis.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
