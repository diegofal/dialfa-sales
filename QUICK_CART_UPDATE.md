# Actualización: Sistema de Consulta Rápida v2

## Cambios Implementados

### 🔧 Rediseño Completo del Flujo

El sistema de consulta rápida ha sido completamente rediseñado para seguir el flujo del sistema original (2007) pero con una interfaz moderna.

### ✨ Nuevas Características

#### 1. Input de Código + Cantidad
**Antes:** Solo búsqueda por código, cantidad por defecto 1  
**Ahora:** Dos campos separados (Código y Cantidad) para entrada rápida

```
┌─────────────────────────────────────────────────────────┐
│ [Código: BRS1501] [Cant: 185] [Artículo seleccionado]  │
└─────────────────────────────────────────────────────────┘
```

#### 2. Navegación con Teclado Mejorada

| Tecla | Acción |
|-------|--------|
| **Tab** | Código → Cantidad (con autoselección) |
| **Enter** en Código | Selecciona primer resultado y va a Cantidad |
| **Enter** en Cantidad | Agrega item a la lista |
| **Escape** en Cantidad | Vuelve al Código |
| **Escape** en Código | Cierra resultados de búsqueda |

#### 3. Popup Flotante (No Modal)

**Antes:** Dialog modal que ocupa toda la pantalla  
**Ahora:** Popup flotante en esquina inferior derecha

- ✅ No bloquea la navegación
- ✅ Botón flotante con contador
- ✅ Aparece/desaparece con animación
- ✅ Posición fija: bottom-right
- ✅ Dimensiones: 450px ancho x 600px max altura

#### 4. Edición Simplificada en Popup

Cada item muestra:
- **Código** (font-mono para fácil lectura)
- **Descripción** (truncada si es muy larga)
- **Precio unitario** y **Stock disponible**
- **Input numérico** para cantidad (se selecciona al hacer focus)
- **Botón eliminar** (icono papelera)

#### 5. Auto-selección Inteligente

Si la búsqueda devuelve **un solo resultado**, se selecciona automáticamente:
```
Usuario escribe: "BRS1501"
Sistema: (solo 1 resultado) → Auto-selecciona
Campo Cantidad → Se activa automáticamente
```

### 🎯 Flujo de Uso Actualizado

```
1. Usuario hace focus en campo "Código"
   └─> Empieza a escribir: "BRS"
   
2. Sistema muestra dropdown con resultados
   └─> BRS1501, BRS1502, etc.
   
3. Usuario presiona Enter o Tab
   └─> Selecciona primer resultado
   └─> Muestra info del artículo
   └─> Focus automático en "Cantidad"
   └─> Cantidad se selecciona para sobrescribir
   
4. Usuario escribe cantidad: "185"
   └─> Presiona Enter
   
5. Sistema agrega item a lista
   └─> Toast de confirmación
   └─> Limpia campos
   └─> Focus vuelve a "Código"
   └─> Botón flotante aparece (si es primer item)
   
6. Usuario puede seguir agregando items
   └─> Repite desde paso 1
   
7. Cuando termina, click en botón flotante
   └─> Abre popup con lista completa
   
8. En el popup puede:
   ├─> Editar cantidades (click en input)
   ├─> Eliminar items (click en papelera)
   ├─> Limpiar todo
   └─> Crear Pedido (va al wizard)
```

### 🎨 Mejoras de UX

1. **Feedback Visual Mejorado**
   - Stock en rojo si es 0
   - Stock en naranja si es < 10
   - Stock en verde si hay disponibilidad
   - Toast de confirmación al agregar

2. **Autoselección en Inputs**
   - Al hacer focus en Cantidad, el valor se selecciona
   - Permite sobrescribir rápidamente sin borrar

3. **Uppercase Automático**
   - El campo Código convierte a mayúsculas automáticamente
   - Coincide con el formato del sistema original

4. **Validaciones**
   - Cantidad mínima: 1
   - Artículo debe estar seleccionado
   - Mensajes de error claros

### 📐 Especificaciones Técnicas

#### Componentes Modificados

1. **`QuickArticleLookup.tsx`**
   - Rediseñado completamente
   - Dos inputs lado a lado
   - Panel de información del artículo seleccionado
   - Manejo de teclado mejorado

2. **`QuickCartPopup.tsx`** (nuevo)
   - Reemplaza `QuickCartDrawer.tsx`
   - Posición: `fixed bottom-24 right-6`
   - Z-index: 50
   - Width: 450px
   - Max-height: 600px

3. **`Navbar.tsx`**
   - Integración más limpia
   - Botón flotante circular con badge
   - Aparece solo cuando hay items

#### Archivos Eliminados

- ❌ `QuickCartDrawer.tsx` (reemplazado por `QuickCartPopup.tsx`)

### 🔍 Comparación Visual

#### Sistema Original (2007)
```
┌──────────────────────────────────────────────────┐
│ [Código] [Editar ▼] [Cantidad ▲▼] [Descripción] │
│ BRS1501   Editar ▼   185          Brida Roscada │
│ BRS1502   Editar ▼   100          Brida Roscada │
└──────────────────────────────────────────────────┘
```

#### Sistema Nuevo (2025)
```
Navbar:
┌─────────────────────────────────────────────────────────┐
│ [Código: ____] [Cant: __] [Artículo: BRS1501 - ...]   │
└─────────────────────────────────────────────────────────┘

Popup Flotante (bottom-right):
┌──────────────────────────────────┐
│ 🛒 Lista de Consulta (2)    [X] │
├──────────────────────────────────┤
│ BRS1501                          │
│ Brida Roscada S-150 de 1"       │
│ $18.71 c/u | Stock: 185          │
│              [185] [🗑️]          │
├──────────────────────────────────┤
│ BRS1502                          │
│ Brida Roscada S-150 de 2"       │
│ $23.79 c/u | Stock: 45           │
│              [100] [🗑️]          │
├──────────────────────────────────┤
│ Total Estimado    $ 5,840.35     │
│ [Limpiar] [Crear Pedido]         │
└──────────────────────────────────┘

Botón Flotante:
    ┌────┐
    │ 🛒 │ (con badge: 2)
    │  2 │
    └────┘
```

### 🚀 Ventajas del Nuevo Sistema

1. **Más Rápido**: Código + Tab + Cantidad + Enter = Agregado
2. **Menos Clicks**: No necesitas abrir modales para ver la lista
3. **No Invasivo**: El popup no bloquea el resto de la interfaz
4. **Familiar**: Similar al sistema original pero moderno
5. **Keyboard-First**: Todo se puede hacer sin mouse
6. **Visual**: Stock con colores, info completa visible

### 🐛 Problemas Resueltos

- ✅ No se podía ingresar cantidad fácilmente
- ✅ La navegación con Tab/Enter no funcionaba bien
- ✅ El drawer ocupaba toda la pantalla
- ✅ No se podía ver el artículo seleccionado antes de agregar
- ✅ La lista no se mostraba cuando tenía items

### 📝 Notas de Implementación

- El popup usa `fixed` positioning para quedar sobre el contenido
- El botón flotante solo aparece cuando `totalCartItems > 0`
- El popup se posiciona en `bottom-24` (debajo del botón flotante)
- La animación de aparición es manejada por el estado `isOpen`
- localStorage se mantiene igual (compatibilidad)

---

**Última actualización**: Octubre 2025  
**Versión**: 2.0.0  
**Breaking Changes**: No (backward compatible con datos guardados)








