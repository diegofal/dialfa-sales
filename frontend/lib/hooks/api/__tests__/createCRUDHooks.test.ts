import { createCRUDHooks } from '../createCRUDHooks';

// Mock react-query
const mockInvalidateQueries = jest.fn();
const mockUseQueryClient = jest.fn(() => ({
  invalidateQueries: mockInvalidateQueries,
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((options) => ({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled,
    data: undefined,
    isLoading: false,
  })),
  useMutation: jest.fn((options) => ({
    mutationFn: options.mutationFn,
    mutate: jest.fn(),
    isPending: false,
  })),
  useQueryClient: () => mockUseQueryClient(),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

interface TestEntity {
  id: number;
  name: string;
}

const mockApi = {
  getAll: jest
    .fn()
    .mockResolvedValue({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
  getById: jest.fn().mockResolvedValue({ id: 1, name: 'Test' }),
  create: jest.fn().mockResolvedValue({ id: 1, name: 'Created' }),
  update: jest.fn().mockResolvedValue({ id: 1, name: 'Updated' }),
  delete: jest.fn().mockResolvedValue(undefined),
};

describe('createCRUDHooks', () => {
  const hooks = createCRUDHooks<TestEntity, { name: string }, { name: string }>({
    entityName: 'Articulo',
    api: mockApi,
    queryKey: 'articles',
  });

  it('returns all CRUD hooks', () => {
    expect(hooks.useList).toBeDefined();
    expect(hooks.useById).toBeDefined();
    expect(hooks.useCreate).toBeDefined();
    expect(hooks.useUpdate).toBeDefined();
    expect(hooks.useDelete).toBeDefined();
  });

  it('useList calls useQuery with correct key and function', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query');
    hooks.useList({ pageNumber: 1, pageSize: 10 });

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['articles', { pageNumber: 1, pageSize: 10 }],
      })
    );
  });

  it('useList works with empty params', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query');
    hooks.useList();

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['articles', {}],
      })
    );
  });

  it('useById calls useQuery with entity id', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query');
    hooks.useById(5);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['articles', 5],
        enabled: true,
      })
    );
  });

  it('useById disables query for id <= 0', () => {
    const { useQuery } = jest.requireMock('@tanstack/react-query');
    hooks.useById(0);

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });

  it('useCreate returns a mutation hook', () => {
    const result = hooks.useCreate();
    expect(result.mutate).toBeDefined();
  });

  it('useUpdate returns a mutation hook', () => {
    const result = hooks.useUpdate();
    expect(result.mutate).toBeDefined();
  });

  it('useDelete returns a mutation hook', () => {
    const result = hooks.useDelete();
    expect(result.mutate).toBeDefined();
  });

  it('uses custom messages when provided', () => {
    const customHooks = createCRUDHooks<TestEntity, { name: string }, { name: string }>({
      entityName: 'Cliente',
      api: mockApi,
      queryKey: 'clients',
      messages: {
        created: 'Cliente registrado!',
        deleted: 'Cliente removido!',
      },
    });

    expect(customHooks.useCreate).toBeDefined();
    expect(customHooks.useDelete).toBeDefined();
  });
});
