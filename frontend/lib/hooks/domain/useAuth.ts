import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/constants/routes';
import { useAuthStore } from '@/store/authStore';
import type { LoginRequest } from '@/types/api';
import { authApi } from '../../api/auth';

export const useLogin = () => {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (credentials: LoginRequest) => authApi.login(credentials),
    onSuccess: (data) => {
      // Token is in HTTP-only cookie, we just need user info
      setAuth(data.user);
      toast.success(`¡Bienvenido, ${data.user.fullName}!`);
      router.push(ROUTES.DASHBOARD);
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
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }

    // Clear auth state (this will also clear localStorage due to persistence)
    clearAuth();

    // Redirect to login
    router.push('/login');
    toast.success('Sesión cerrada');
  };
};
