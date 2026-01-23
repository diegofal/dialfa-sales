'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/spinner';
import { ROUTES } from '@/lib/constants/routes';
import { useAuthStore } from '@/store/authStore';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, hydrated } = useAuthStore();

  useEffect(() => {
    // Wait for hydration before redirecting
    if (!hydrated) return;

    // Redirect based on authentication status
    if (isAuthenticated) {
      router.push(ROUTES.DASHBOARD);
    } else {
      router.push('/login');
    }
  }, [hydrated, isAuthenticated, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}
