# CUITInput Component

Componente reutilizable para entrada de CUIT argentino con formato automático.

## Formato

El componente formatea automáticamente el CUIT mientras el usuario escribe:

- Formato visual: `XX-XXXXXXXX-X`
- Ejemplo: `20-12345678-9`
- Valor guardado: `20123456789` (sin guiones)

## Características

- ✅ Formato automático mientras se escribe
- ✅ Solo permite números
- ✅ Máximo 11 dígitos
- ✅ Compatible con react-hook-form
- ✅ Limpia los guiones al guardar

## Uso con react-hook-form

```tsx
import { CUITInput } from '@/components/ui/cuit-input';

<FormField
  control={form.control}
  name="cuit"
  render={({ field }) => (
    <FormItem>
      <FormLabel>CUIT *</FormLabel>
      <FormControl>
        <CUITInput
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          name={field.name}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>;
```

## Uso standalone

```tsx
import { CUITInput } from '@/components/ui/cuit-input';

const [cuit, setCuit] = useState('');

<CUITInput value={cuit} onChange={(value) => setCuit(value)} placeholder="20-12345678-9" />;
```

## Props

Hereda todas las props de `Input` excepto:

- `value`: string - El valor del CUIT (sin formato, solo números)
- `onChange`: (value: string) => void - Callback que recibe el valor limpio (sin guiones)

## Notas

- El valor que se pasa a `onChange` está limpio (solo números) para facilitar el guardado en la base de datos
- El formato se aplica automáticamente solo para la visualización
- El componente maneja internamente la conversión entre valor limpio y formateado
