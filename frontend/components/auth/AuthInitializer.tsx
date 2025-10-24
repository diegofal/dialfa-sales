'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';

export function AuthInitializer() {
  const { user, isAuthenticated, setAuth, clearAuth, setHydrated, hydrated } = useAuthStore();
  const hasValidated = useRef(false);

  useEffect(() => {
    // Wait for zustand to hydrate from localStorage
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setHydrated();
    });

    return () => unsubscribe();
  }, [setHydrated]);

  useEffect(() => {
    // Only validate once after hydration
    if (!hydrated || hasValidated.current) return;
    
    hasValidated.current = true;

    const validateSession = async () => {
      // If we have user data in localStorage, validate it with the server
      if (isAuthenticated && user) {
        try {
          // Validate the session with the server
          const response = await fetch('/api/auth/me', {
            credentials: 'include',
          });

          if (!response.ok) {
            // Token is invalid or expired, clear auth
            console.log('Session validation failed, clearing auth');
            clearAuth();
            return;
          }

          const data = await response.json();
          // Update auth state with fresh data from server
          setAuth(data.user);
        } catch (error) {
          console.error('Error validating session:', error);
          clearAuth();
        }
      }
      // If there's no user in localStorage, we don't need to do anything
      // The user is simply not logged in
    };

    validateSession();
  }, [hydrated, isAuthenticated, user, setAuth, clearAuth]);

  // This component doesn't render anything
  return null;
}

