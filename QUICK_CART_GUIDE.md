# Guía de Uso: Consulta Rápida de Artículos v2

## Descripción

La funcionalidad de **Consulta Rápida** (Quick Cart) permite a los vendedores buscar y agregar artículos con sus cantidades a una lista temporal mientras están al teléfono con clientes, sin necesidad de tener el cliente seleccionado primero. Una vez completada la lista, pueden crear el pedido asignando el cliente correspondiente.

## Flujo de Uso

### 1. Agregar Artículos Rápidamente

En el **navbar superior** encontrarás dos campos para entrada rápida:

**Campo 1: Código de Artículo**
- Escribe el código del artículo (ej: BRS1501)
- Se convierte automáticamente a MAYÚSCULAS
- Muestra resultados mientras escribes
- Presiona `Enter` o `Tab` para seleccionar el primer resultado

**Campo 2: Cantidad**
- Se activa automáticamente después de seleccionar artículo
- El valor se selecciona para sobrescribir fácilmente
- Presiona `Enter` para agregar a la lista

**Características:**
- ⌨️ **Navegación con teclado**: Tab/Enter para moverte entre campos
- 🚀 **Super rápido**: Código → Tab → Cantidad → Enter → Listo
- 📦 **Información visible**: Stock, precio y descripción siempre visibles
- 🎨 **Indicadores de stock**: Colores que indican disponibilidad
  - 🔴 Rojo = Sin stock (0)
  - 🟠 Naranja = Bajo stock (< 10)
  - 🟢 Verde = Stock disponible

**Ejemplo de uso rápido:**
```
1. Escribes: "BRS" 
   → Aparece dropdown con BRS1501, BRS1502...
   
2. Presionas: Enter (o Tab)
   → Se selecciona BRS1501
   → Focus va a campo Cantidad
   → Cantidad "1" queda seleccionada
   
3. Escribes: "185"
   → Sobrescribe el "1"
   
4. Presionas: Enter
   → Artículo agregado a lista ✅
   → Campos se limpian
   → Focus vuelve a Código
   → Listo para agregar otro artículo
```

### 2. Lista de Consulta Temporal

Los artículos agregados se guardan en una **lista temporal** que:
- ✅ Persiste entre navegaciones (localStorage)
- ✅ Muestra un botón flotante con contador cuando hay items
- ✅ Es independiente del cliente
- ✅ Permite editar cantidades antes de crear el pedido

**Acceso a la lista:**
- Aparece un **botón flotante circular** en la esquina inferior derecha
- El botón muestra un badge con el número total de items
- Click en el botón para abrir/cerrar el popup

### 3. Gestión de la Lista (Popup Flotante)

El **popup de consulta rápida** aparece en la esquina inferior derecha y te permite:

**Editar cantidades:**
- Click en el campo numérico
- Se selecciona automáticamente para sobrescribir
- Los cambios se guardan al perder el focus

**Ver información detallada:**
- Código del artículo (font monoespaciada)
- Descripción completa
- Precio unitario y stock disponible
- Total estimado del pedido completo

**Eliminar items:**
- Click en el icono de papelera 🗑️ para remover un artículo
- Botón "Limpiar" para vaciar toda la lista (con confirmación)

**Características del Popup:**
- No bloquea la navegación (no es modal)
- Se puede cerrar con la `X` o clickeando el botón flotante
- Scroll automático si hay muchos items
- Siempre visible sobre el contenido

### 4. Crear Pedido desde la Lista

Cuando estés listo para formalizar el pedido:

1. Click en **"Crear Pedido"** en el popup
2. El sistema te lleva al wizard de nuevo pedido
3. Los artículos se cargan automáticamente (verás una alerta informativa)
4. Selecciona el cliente en el Paso 1
5. Revisa los items en el Paso 2 (puedes ajustar precios y descuentos)
6. Confirma en el Paso 3
7. La lista de consulta se limpia automáticamente al guardar ✨

## Caso de Uso Real

### Escenario: Llamada Telefónica

**Cliente (METALGFOX) llama:**
```
Cliente: "Hola, necesito consultar disponibilidad y precios"

Vendedor: [Abre el dashboard, hace focus en campo Código]
  
  Escribe: "BRS1501"
  Ve dropdown: Stock 185, $18.71
  Presiona Tab → Va a Cantidad
  Escribe: "1"
  Presiona Enter → Agregado a consulta ✅
  [Aparece botón flotante con "1"]

Cliente: "¿Y tienen el BRS1502?"

Vendedor: [Focus ya está en Código]
  Escribe: "BRS1502"
  Ve dropdown: Stock 45, $25.30
  Presiona Tab → Va a Cantidad
  Escribe: "1"
  Presiona Enter → Agregado ✅
  [Botón flotante ahora muestra "2"]

Cliente: "Del primero necesito 100 unidades, no 1"

Vendedor: [Click en botón flotante]
  Se abre popup con la lista
  Click en cantidad de BRS1501
  Escribe: "100"
  
Cliente: "¿Cuánto sería todo?"

Vendedor: [Mira el popup]
  "El total estimado sería $5,840.35"
  
Cliente: "Dale, confirmame el pedido"

Vendedor: [Click "Crear Pedido" en el popup]
  Selecciona cliente: METALGFOX
  Confirma pedido
  ✅ Listo! Lista limpiada automáticamente
```

## Atajos de Teclado

| Contexto | Tecla | Acción |
|----------|-------|--------|
| **Campo Código** | `Enter` o `Tab` | Selecciona primer resultado y va a Cantidad |
| **Campo Código** | `Escape` | Cierra dropdown de resultados |
| **Campo Cantidad** | `Enter` | Agrega item a la lista |
| **Campo Cantidad** | `Escape` | Vuelve al campo Código |
| **Inputs numéricos** | `Focus` | Auto-selecciona el contenido para sobrescribir |

## Persistencia de Datos

⚠️ **Importante**: La lista de consulta rápida se guarda en el navegador (localStorage).

**Esto significa:**
- ✅ Los items persisten si cierras/abres pestañas
- ✅ Los items persisten si recargas la página
- ❌ Los items NO se comparten entre dispositivos
- ❌ Los items se pierden si limpias el caché del navegador

## Integración con el Sistema Actual

### Comparación con el Sistema Original (2007)

| Aspecto | Sistema Original | Sistema Nuevo |
|---------|-----------------|---------------|
| **Flujo** | Cliente → Artículos | Artículos → Cliente |
| **Búsqueda** | Escribir en grilla | Navbar siempre disponible |
| **Cantidad** | Editar después | Ingresar al agregar |
| **Lista** | En la grilla del pedido | Popup flotante independiente |
| **Navegación** | Mouse-driven | Keyboard-first |
| **Velocidad** | ~5-6 clicks por item | ~3 acciones por item |

### Ventajas del Nuevo Sistema

✅ **Mucho más rápido**: Código → Tab → Cantidad → Enter  
✅ **Keyboard-first**: Todo se puede hacer sin mouse  
✅ **No invasivo**: Popup flotante, no modal que bloquea  
✅ **Mejor flujo**: Ideal para llamadas telefónicas  
✅ **Visual**: Colores indican stock disponible  
✅ **Flexible**: Lista temporal independiente del cliente  
✅ **Persistente**: No pierdes tu trabajo si navegas  
✅ **Familiar**: Similar al sistema original pero modernizado

## Preguntas Frecuentes

**P: ¿Qué pasa si cierro el navegador sin crear el pedido?**
R: Los items quedan guardados en la lista de consulta hasta que los uses o los elimines manualmente.

**P: ¿Puedo usar la consulta rápida para varios clientes?**
R: Sí, pero debes crear el pedido para un cliente antes de armar la lista para otro (o usar "Limpiar Todo").

**P: ¿Se actualiza el stock en tiempo real?**
R: El stock se muestra al momento de buscar el artículo. Para ver el stock actualizado, búscalo nuevamente.

**P: ¿Puedo editar los precios antes de crear el pedido?**
R: Sí, en el Paso 2 del wizard (Items) puedes editar precios, cantidades y descuentos antes de confirmar.

## Soporte Técnico

Si encuentras algún problema o tienes sugerencias:
1. Verifica que tu navegador sea compatible (Chrome, Firefox, Edge modernos)
2. Asegúrate de tener permisos para usar localStorage
3. Contacta al equipo de desarrollo

---

**Última actualización**: Octubre 2025
**Versión**: 1.0.0

