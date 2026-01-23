import { useQuery } from '@tanstack/react-query';
import type { PaginationParams, PagedResult } from '@/types/pagination';
import { useEntityMutation } from './useEntityMutation';

interface CRUDApi<TEntity, TCreateData, TUpdateData, TListParams> {
  getAll: (params?: TListParams) => Promise<PagedResult<TEntity>>;
  getById: (id: number) => Promise<TEntity>;
  create: (data: TCreateData) => Promise<TEntity>;
  update: (id: number, data: TUpdateData) => Promise<TEntity>;
  delete: (id: number) => Promise<void>;
}

interface CRUDMessages {
  created?: string;
  updated?: string;
  deleted?: string;
  createError?: string;
  updateError?: string;
  deleteError?: string;
}

interface CRUDHooksConfig<TEntity, TCreateData, TUpdateData, TListParams> {
  entityName: string;
  api: CRUDApi<TEntity, TCreateData, TUpdateData, TListParams>;
  queryKey: string;
  messages?: CRUDMessages;
}

export function createCRUDHooks<
  TEntity,
  TCreateData = Partial<TEntity>,
  TUpdateData = Partial<TEntity>,
  TListParams extends PaginationParams = PaginationParams,
>({
  entityName,
  api,
  queryKey,
  messages = {},
}: CRUDHooksConfig<TEntity, TCreateData, TUpdateData, TListParams>) {
  const {
    created = `${entityName} creado exitosamente`,
    updated = `${entityName} actualizado exitosamente`,
    deleted = `${entityName} eliminado exitosamente`,
    createError = `Error al crear ${entityName.toLowerCase()}`,
    updateError = `Error al actualizar ${entityName.toLowerCase()}`,
    deleteError = `Error al eliminar ${entityName.toLowerCase()}`,
  } = messages;

  function useList(params: TListParams = {} as TListParams) {
    return useQuery({
      queryKey: [queryKey, params],
      queryFn: () => api.getAll(params),
    });
  }

  function useById(id: number) {
    return useQuery({
      queryKey: [queryKey, id],
      queryFn: () => api.getById(id),
      enabled: id > 0,
    });
  }

  function useCreate() {
    return useEntityMutation<TEntity, TCreateData>({
      mutationFn: (data) => api.create(data),
      invalidateKeys: [[queryKey]],
      successMessage: created,
      errorMessage: createError,
    });
  }

  function useUpdate() {
    return useEntityMutation<TEntity, { id: number; data: TUpdateData }>({
      mutationFn: ({ id, data }) => api.update(id, data),
      invalidateKeys: [[queryKey]],
      successMessage: updated,
      errorMessage: updateError,
    });
  }

  function useDelete() {
    return useEntityMutation<void, number>({
      mutationFn: (id) => api.delete(id),
      invalidateKeys: [[queryKey]],
      successMessage: deleted,
      errorMessage: deleteError,
    });
  }

  return {
    useList,
    useById,
    useCreate,
    useUpdate,
    useDelete,
  };
}
