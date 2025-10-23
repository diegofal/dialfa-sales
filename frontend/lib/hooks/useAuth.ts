import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authApi } from '../api/auth';
import { useAuthStore } from '@/store/authStore';
import type { LoginRequest } from '@/types/api';
import { toast } from 'sonner';

export const useLogin = () => {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authApi.login(credentials),
    onSuccess: (data) => {
      // Token is in HTTP-only cookie, we just need user info
      setAuth(data.user);
      toast.success(`¡Bienvenido, ${data.user.fullName}!`);
      router.push('/dashboard');
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Error al iniciar sesión');
    },
  });
};

export const useLogout = () => {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return async () => {
    await authApi.logout();
    clearAuth();
    router.push('/login');
    toast.success('Sesión cerrada');
  };
};



