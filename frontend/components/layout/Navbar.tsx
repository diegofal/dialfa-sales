'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useLogout } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User, ShoppingCart } from 'lucide-react';
import { QuickCartPopup } from '@/components/articles/QuickCartPopup';
import { useQuickCartTabs } from '@/lib/hooks/useQuickCartTabs';
import { Badge } from '@/components/ui/badge';

export default function Navbar() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();
  const [cartOpen, setCartOpen] = useState(false);
  const { getTotalItems } = useQuickCartTabs();
  const pathname = usePathname();
  
  const totalCartItems = getTotalItems();
  
  // Handle SPACE key to toggle cart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only toggle cart with SPACE if:
      // 1. Not focused on an input, textarea, or contenteditable element
      // 2. SPACE key is pressed
      const target = e.target as HTMLElement;
      const isInputFocused = 
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable;

      if (e.code === 'Space' && !isInputFocused) {
        e.preventDefault(); // Prevent page scroll
        setCartOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Check if we're on a page with fixed bottom buttons
  const hasFixedBottomButtons = 
    pathname === '/dashboard/sales-orders/new' || 
    pathname === '/dashboard/invoices/new' ||
    pathname?.includes('/dashboard/sales-orders/') && pathname?.includes('/edit');
  
  // Adjust cart button position based on page
  const cartButtonClass = hasFixedBottomButtons 
    ? "fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl z-40" 
    : "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-40";

  return (
    <>
      <header className="flex h-16 items-center justify-between gap-4 border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold whitespace-nowrap">SPISA</h2>
          <p className="text-sm text-muted-foreground">Sistema de Gestión de Inventario y Ventas</p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Floating Cart Button - Always Visible */}
      <Button
        size="lg"
        className={cartButtonClass}
        onClick={() => setCartOpen(!cartOpen)}
      >
        <div className="relative">
          <ShoppingCart className="h-6 w-6" />
          {totalCartItems > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {totalCartItems}
            </Badge>
          )}
        </div>
      </Button>

      {/* Quick Cart Popup */}
      <QuickCartPopup 
        isOpen={cartOpen} 
        onClose={() => setCartOpen(false)} 
        hasFixedBottomButtons={hasFixedBottomButtons}
      />
    </>
  );
}








