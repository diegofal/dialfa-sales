import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthInitializer } from '@/components/auth/AuthInitializer';
import { Toaster } from '@/components/ui/sonner';
import QueryProvider from '@/lib/providers/QueryProvider';
import { ThemeProvider } from '@/lib/providers/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SPISA - Sistema de Gestión',
  description: 'Sistema de Gestión de Inventario, Ventas y Facturación',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <QueryProvider>
            <AuthInitializer />
            {children}
            <Toaster position="top-center" expand={true} richColors closeButton duration={2000} />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
