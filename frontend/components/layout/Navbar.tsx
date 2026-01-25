'use client';

import { LogOut, User, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { QuickCartPopup } from '@/components/articles/QuickCartPopup';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { calculateCartPositions, CART_CONSTANTS } from '@/lib/constants/cart';
import { useLogout } from '@/lib/hooks/domain/useAuth';
import { useFixedBottomBar, useWindowSize } from '@/lib/hooks/generic/useFixedBottomBar';
import { useAuthStore } from '@/store/authStore';

export default function Navbar() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const [cartOpen, setCartOpen] = useState(false);

  // Automatically detect bottom bar and calculate positions
  const { bottomBarHeight } = useFixedBottomBar();
  const { width: windowWidth } = useWindowSize();
  const cartPositions = calculateCartPositions(bottomBarHeight, windowWidth);

  // Handle SPACE key to toggle cart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only toggle cart with SPACE if:
      // 1. Not focused on an input, textarea, or contenteditable element
      // 2. SPACE key is pressed
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.code === 'Space' && !isInputFocused) {
        e.preventDefault(); // Prevent page scroll
        setCartOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <>
      <header className="bg-card flex h-16 items-center justify-between gap-4 border-b px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold whitespace-nowrap">SPISA</h2>
          <p className="text-muted-foreground text-sm">Sistema de Gestión de Inventario y Ventas</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <User className="h-5 w-5" />
                <span className="hidden sm:inline">{user?.username}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <User className="mr-2 h-4 w-4" />
                <span>Usuario: {user?.username}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <span>Rol: {user?.role}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Floating Cart Button - Always Visible with Dynamic Position */}
      <Button
        size="lg"
        className="fixed rounded-full shadow-2xl"
        style={{
          bottom: `${cartPositions.button.bottom}px`,
          right: `${cartPositions.button.right}px`,
          height: `${CART_CONSTANTS.BUTTON.SIZE}px`,
          width: `${CART_CONSTANTS.BUTTON.SIZE}px`,
          zIndex: CART_CONSTANTS.BUTTON.Z_INDEX,
          transition: 'bottom 0.3s ease, right 0.3s ease',
        }}
        onClick={() => setCartOpen(!cartOpen)}
      >
        <ShoppingCart className="h-6 w-6" />
      </Button>

      {/* Quick Cart Popup with Dynamic Position */}
      <QuickCartPopup
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        positions={cartPositions}
      />
    </>
  );
}
