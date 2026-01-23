import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

interface EntityMutationConfig<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateKeys?: string[][];
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: unknown, variables: TVariables) => void;
  mutationOptions?: Omit<
    UseMutationOptions<TData, unknown, TVariables>,
    'mutationFn' | 'onSuccess' | 'onError'
  >;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  // Axios error shape
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  // Standard Error
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  return fallback;
}

export function useEntityMutation<TData = unknown, TVariables = unknown>({
  mutationFn,
  invalidateKeys = [],
  successMessage,
  errorMessage = 'Ocurrio un error',
  onSuccess: onSuccessCallback,
  onError: onErrorCallback,
  mutationOptions,
}: EntityMutationConfig<TData, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation<TData, unknown, TVariables>({
    mutationFn,
    onSuccess: (data, variables) => {
      for (const key of invalidateKeys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      if (successMessage) {
        toast.success(successMessage);
      }
      onSuccessCallback?.(data, variables);
    },
    onError: (error, variables) => {
      const message = extractErrorMessage(error, errorMessage);
      toast.error(message);
      onErrorCallback?.(error, variables);
    },
    ...mutationOptions,
  });
}

export { extractErrorMessage };
