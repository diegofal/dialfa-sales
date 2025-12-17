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
      
      // Use replace instead of push to avoid browser back issues
      // Add a small delay to ensure cookie and state are fully synced
      setTimeout(() => {
        router.replace('/dashboard');
      }, 100);
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



