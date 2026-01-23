import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: () => boolean;
  isVendedor: () => boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  hydrated: boolean;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isAdmin: () => get().user?.role?.toLowerCase() === 'admin',
      isVendedor: () => get().user?.role?.toLowerCase() === 'vendedor',
      hydrated: false,

      setAuth: (user) => {
        // Token is now in HTTP-only cookie, we just store user info
        set({ user, isAuthenticated: true });
      },

      clearAuth: () => {
        set({ user: null, isAuthenticated: false });
      },

      setHydrated: () => {
        set({ hydrated: true });
      },
    }),
    {
      name: 'spisa-auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
