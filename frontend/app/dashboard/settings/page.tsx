'use client';

import { Save, DollarSign, Palette, Moon, Sun, Check } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSystemSettings, useUpdateSystemSettings } from '@/lib/hooks/domain/useSettings';
import { COLOR_THEMES, useColorTheme } from '@/lib/hooks/generic/useColorTheme';

export default function SettingsPage() {
  const { data: settings, isLoading } = useSystemSettings();
  const updateSettingsMutation = useUpdateSystemSettings();
  const { colorTheme, setColorTheme, mounted: colorMounted } = useColorTheme();
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const [exchangeRate, setExchangeRate] = useState('');

  useEffect(() => {
    if (settings) {
      setExchangeRate(settings.usdExchangeRate.toString());
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error('El tipo de cambio debe ser un número positivo');
      return;
    }

    updateSettingsMutation.mutate(
      { usdExchangeRate: rate },
      {
        onSuccess: () => {
          toast.success('El tipo de cambio ha sido actualizado correctamente');
        },
        onError: (error) => {
          toast.error(error.message || 'No se pudo actualizar la configuración');
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-muted-foreground">Configura los parámetros globales del sistema</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            <CardTitle>Apariencia</CardTitle>
          </div>
          <CardDescription>Personaliza los colores y el modo de visualización</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Tema de Color</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
              {COLOR_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setColorTheme(t.id)}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:shadow-md ${
                    colorMounted && colorTheme === t.id
                      ? 'border-primary bg-accent shadow-sm'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="h-8 w-full rounded-md" style={{ backgroundColor: t.preview }} />
                  <span className="text-sm font-medium">{t.name}</span>
                  {colorMounted && colorTheme === t.id && (
                    <Check className="text-primary h-4 w-4" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Modo</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-all ${
                  themeMounted && theme === 'light'
                    ? 'border-primary bg-accent'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Sun className="h-4 w-4" />
                <span className="text-sm font-medium">Claro</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 transition-all ${
                  themeMounted && theme === 'dark'
                    ? 'border-primary bg-accent'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Moon className="h-4 w-4" />
                <span className="text-sm font-medium">Oscuro</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <CardTitle>Tipo de Cambio USD a ARS</CardTitle>
            </div>
            <CardDescription>
              Este valor se utilizará como predeterminado al crear nuevas facturas. Puede
              modificarse individualmente en cada factura.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exchangeRate">Valor del Dólar (ARS) *</Label>
              <Input
                id="exchangeRate"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ej: 1000.50"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                required
              />
              <p className="text-muted-foreground text-sm">
                Los precios de los artículos están en USD. Este valor se multiplicará por el precio
                en USD para obtener el precio en ARS en las facturas.
              </p>
            </div>

            {settings && settings.updatedAt && (
              <div className="text-muted-foreground text-sm">
                Última actualización: {new Date(settings.updatedAt).toLocaleString('es-AR')}
              </div>
            )}

            <div className="flex justify-end gap-4 pt-4">
              <Button type="submit" disabled={updateSettingsMutation.isPending || !exchangeRate}>
                <Save className="mr-2 h-4 w-4" />
                {updateSettingsMutation.isPending ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Información Importante</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>• Inmutabilidad de facturas:</strong> Una vez creada, cada factura guarda su
            propio tipo de cambio. Cambiar este valor no afecta facturas existentes.
          </div>
          <div>
            <strong>• Precios en USD:</strong> Todos los artículos tienen precios en USD. La
            conversión a ARS se realiza al momento de crear la factura.
          </div>
          <div>
            <strong>• Edición de facturas:</strong> Puede editar el tipo de cambio de una factura
            individual antes de imprimirla, lo que recalculará todos los importes.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
