# Sistema de Impresión PDF - Plan de Implementación

## Índice

1. [Análisis del Sistema Viejo](#análisis-del-sistema-viejo)
2. [Problemas Identificados](#problemas-identificados)
3. [Decisiones de Diseño](#decisiones-de-diseño)
4. [Arquitectura Propuesta](#arquitectura-propuesta)
5. [Plan de Implementación](#plan-de-implementación)
6. [Ejemplos de Código](#ejemplos-de-código)
7. [Schemas y Estructuras](#schemas-y-estructuras)

---

## Análisis del Sistema Viejo

### Arquitectura Actual (SPISA Old - C# WinForms)

El sistema viejo implementa impresión de facturas y remitos mediante:

#### 1. **Archivos XML de Configuración**

Dos archivos definen las posiciones absolutas de los elementos:
- `RemitoObjectsToPrint.xml`
- `FacturaObjectsToPrint.xml`

**Estructura del XML:**
```xml
<Objects>
  <item name="Fecha">
    <x>540</x>
    <y>90</y>
  </item>
  <item name="RazonSocialCliente">
    <x>100</x>
    <y>180</y>
  </item>
  <!-- ... más campos ... -->
  <item name="InicioItems">
    <x>-1</x>
    <y>350</y>
  </item>
  <item name="EspacioEntreItems">
    <x>-1</x>
    <y>15</y>
  </item>
  <item name="ColumnaCantidad">
    <x>80</x>
    <y>-1</y>
  </item>
</Objects>
```

#### 2. **Clase `Printing` (Motor de Impresión)**

**Ubicación:** `SPISA_LogicaDeNegocios/Printing .cs`

Características clave:
```csharp
public class ObjetoAImprimir
{
    string _textToPrint;
    float _x;
    float _y;
}

public class Printing
{
    IList<ObjetoAImprimir> _objetosAImprimir;
    
    public bool Imprimir(short numeroCopias)
    {
        System.Drawing.Printing.PrintDocument a = new PrintDocument();
        a.PrintPage += PrintPage;
        a.Print();
    }
    
    private void PrintPage(object sender, PrintPageEventArgs e)
    {
        foreach (ObjetoAImprimir o in _objetosAImprimir)
        {
            e.Graphics.DrawString(
                o.Texto, 
                new Font("Courier New", 14, FontStyle.Bold, GraphicsUnit.Pixel), 
                Brushes.Black, 
                new PointF(o.X, o.Y)
            );
        }
    }
}
```

#### 3. **Implementación en Facturas/Remitos**

Cada control (`UcFactura.cs`, `UcRemito.cs`) implementa:

```csharp
private PointF ObtenerPosicionDeImpresionDeObjeto(string Objeto)
{
    DataSet ds = Utils.GetDataSetFromXml("Resources/FacturaObjectsToPrint.xml");
    
    foreach (DataRow dr in ds.Tables[0].Rows)
    {
        if (dr[2].ToString() == Objeto)  // ⚠️ Índice hardcodeado
        {
            return new PointF(
                (float)Convert.ToDecimal(dr[0]), 
                (float)Convert.ToDecimal(dr[1])
            );
        }
    }
    return new PointF(-1, -1);
}

private IList<Printing.ObjetoAImprimir> CargarObjetosAImprimir()
{
    IList<Printing.ObjetoAImprimir> _objetos = new List<ObjetoAImprimir>();
    
    // Campos estáticos
    PointF pos = ObtenerPosicionDeImpresionDeObjeto("Fecha");
    _objetos.Add(new ObjetoAImprimir(dtFechaEmision.Value.ToString(), pos.X, pos.Y));
    
    // Items dinámicos (loop)
    float y = ObtenerPosicionDeImpresionDeObjeto("InicioItems").Y;
    foreach (var item in items)
    {
        pos = ObtenerPosicionDeImpresionDeObjeto("ColumnaCantidad");
        _objetos.Add(new ObjetoAImprimir(item.Cantidad, pos.X, y));
        y += ObtenerPosicionDeImpresionDeObjeto("EspacioEntreItems").Y;
    }
    
    return _objetos;
}

public void Imprimir()
{
    Printing p = new Printing();
    p.Objetos = CargarObjetosAImprimir();
    p.Imprimir(numeroCopias);
}
```

---

## Problemas Identificados

### ❌ Problemas Técnicos

1. **XML mal estructurado**: 
   - Usa índices numéricos (`dr[0]`, `dr[1]`, `dr[2]`) en lugar de nombres de columnas
   - Propenso a errores si cambia la estructura

2. **Font hardcodeado**:
   - `Courier New, 14px, Bold` para todos los campos
   - No hay flexibilidad para diferentes estilos

3. **Sin preview**:
   - Va directo al diálogo de impresión física
   - No se puede revisar antes de imprimir

4. **Búsqueda ineficiente**:
   - Itera todo el XML por cada campo (O(n) por campo)
   - Si hay 20 campos, son 20 iteraciones completas del XML

5. **Sin manejo de overflow**:
   - Texto largo puede salirse del área designada
   - No hay truncado ni word wrap

6. **Acoplamiento**:
   - Lógica de posicionamiento mezclada con lógica de UI
   - Difícil de testear

7. **Cálculo manual de alineación**:
   ```csharp
   // Para alinear a la derecha, restan manualmente:
   string cantidad = dr.Cells["Cantidad"].Text;
   _objetos.Add(new ObjetoAImprimir(
       cantidad, 
       pos.X - (cantidad.Length * 8),  // ⚠️ Magic number
       y
   ));
   ```

### ❌ Problemas de Usabilidad

1. **No archivable**: Solo imprime físicamente, no genera PDF
2. **No portable**: Solo funciona en Windows con .NET Framework
3. **Difícil de ajustar**: Cambiar posiciones requiere editar XML y probar imprimiendo
4. **Sin versionado**: No hay forma de tener múltiples templates o versiones

---

## Decisiones de Diseño

### ✅ Por qué PDFKit sobre otras opciones

| Tecnología | Pros | Contras | Decisión |
|------------|------|---------|----------|
| **PDFKit** | Control bajo nivel, performance, servidor Node.js | Menos declarativo | ✅ **ELEGIDO** |
| React-PDF | Componentes React, declarativo | Más pesado, menos control pixel-perfect | ❌ |
| Puppeteer | Usa CSS familiar, WYSIWYG | Muy pesado (Chrome headless), lento | ❌ |

**Razones para PDFKit:**
1. Mejor control sobre posicionamiento absoluto (equivalente al sistema viejo)
2. No requiere dependencias pesadas (Puppeteer usa ~300MB Chrome)
3. Sincronía con el stack Node.js del proyecto
4. Performance superior para generación masiva
5. Stream support nativo (importante para archivos grandes)

### ✅ JSON sobre XML

**Ventajas:**
- Nativo en JavaScript/TypeScript
- Mejor tooling (validación con Zod/JSON Schema)
- Más legible y fácil de mantener
- Permite comentarios (con JSON5 si es necesario)
- Estructuras tipadas en TypeScript

### ✅ Templates como Archivos (no DB)

**Fase 1:** Solo desarrolladores (archivos JSON en código)

**Razones:**
1. Versionado con Git
2. Code review de cambios en templates
3. Deploy simple (no migración de DB)
4. Rollback fácil
5. Menos complejidad inicial

**Fase 2 (futuro):** Si se necesita que usuarios admin editen, mover a DB con versionado.

### ✅ Preview + Download (ambos)

No solo descargar directo porque:
1. Usuario quiere ver antes de imprimir (evita errores)
2. Reduce papel desperdiciado
3. Permite validar datos antes de marcar como "impreso"
4. Mejor UX (industry standard en sistemas modernos)

---

## Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  InvoicesTable.tsx / DeliveryNotesTable.tsx                │
│         │                                                    │
│         ├─→ [Preview Button]                               │
│         │         ↓                                         │
│         │   usePrintDocument Hook                          │
│         │         ↓                                         │
│         │   PDFPreview Component (Modal)                   │
│         │      ├─→ <iframe src={blob://...}>              │
│         │      ├─→ [Download Button]                      │
│         │      └─→ [Print Button] → Marks as printed      │
│         │                                                   │
│         └─→ Template Editor (Admin)                        │
│                  ├─→ TemplateCanvas (Drag & Drop)         │
│                  ├─→ FieldsPanel                          │
│                  └─→ Export/Import JSON                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                      API ROUTES (Next.js)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GET /api/invoices/[id]/preview-pdf                        │
│       ↓                                                      │
│  1. Load invoice from Prisma (with relations)              │
│  2. Load template JSON                                      │
│  3. Generate PDF (PDFService)                              │
│  4. Return PDF stream (NOT marked as printed)              │
│                                                              │
│  POST /api/invoices/[id]/print-pdf                         │
│       ↓                                                      │
│  1. Load invoice from Prisma                               │
│  2. Validate (not cancelled, not already printed, etc.)    │
│  3. Generate PDF (PDFService)                              │
│  4. Mark as printed in DB (is_printed=true, printed_at)   │
│  5. Execute business logic (update stock, account, etc.)   │
│  6. Return PDF stream                                       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                      CORE SERVICES                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  PDFService.ts                                              │
│    ├─→ generateInvoicePDF(invoice, template)              │
│    │     ├─→ Create PDFDocument                           │
│    │     ├─→ Render static fields (fecha, cliente, etc.) │
│    │     ├─→ Render items table (loop)                    │
│    │     ├─→ Render totals                                │
│    │     └─→ Return PDF Buffer/Stream                     │
│    │                                                        │
│    └─→ generateDeliveryNotePDF(deliveryNote, template)    │
│                                                             │
│  TemplateLoader.ts                                          │
│    ├─→ loadTemplate(type, name)                           │
│    ├─→ validateTemplate(json) with Zod                    │
│    └─→ Cache in memory                                     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                      DATA LAYER                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Templates (JSON Files)                                     │
│    ├─→ lib/print-templates/invoice-default.json           │
│    └─→ lib/print-templates/delivery-note-default.json     │
│                                                             │
│  Database (Prisma)                                          │
│    ├─→ invoices table (is_printed, printed_at)            │
│    └─→ delivery_notes table                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Plan de Implementación

### Fase 1: Infraestructura Base (2-3 horas)

#### 1.1 Migración XML → JSON
- **Script:** `tools/migrate-print-templates.ts`
- Lee XMLs viejos del sistema SPISA
- Convierte a JSON estructurado
- Output: `frontend/lib/print-templates/*.json`

#### 1.2 Dependencias
```bash
npm install --save pdfkit blobstream
npm install --save-dev @types/pdfkit
```

#### 1.3 Tipos TypeScript
- **Archivo:** `frontend/types/print-template.ts`
- Definir interfaces para templates, fields, positions

### Fase 2: Generación de PDFs (4-5 horas)

#### 2.1 PDFService Core
- **Archivo:** `frontend/lib/services/PDFService.ts`
- Implementar generación para facturas y remitos
- Métodos privados para render de campos y tablas

#### 2.2 Template Loader
- **Archivo:** `frontend/lib/print-templates/template-loader.ts`
- Cargar, validar y cachear templates
- Validación con Zod

#### 2.3 API Routes
- `app/api/invoices/[id]/preview-pdf/route.ts`
- `app/api/invoices/[id]/print-pdf/route.ts`
- Similar para delivery notes

### Fase 3: Frontend UI (3-4 horas)

#### 3.1 Componente PDFPreview
- Modal con iframe
- Botones: Close, Download, Print

#### 3.2 Hooks
- `usePrintDocument.ts` con estado y lógica

#### 3.3 Integración
- Agregar botones en tablas existentes
- Conectar con hooks

### Fase 4: Editor Visual (6-8 horas)

#### 4.1 Página del Editor
- Ruta: `/dashboard/admin/template-editor`
- Selector de template type

#### 4.2 Canvas Interactivo
- Drag & drop de campos
- Preview en tiempo real
- Grid de alineación

#### 4.3 Panel de Campos
- Lista de campos disponibles
- Inputs para X, Y, fontSize
- Select para alignment

#### 4.4 Export/Import
- Descargar JSON editado
- Cargar JSON existente

### Fase 5: Templates Iniciales (1-2 horas)

#### 5.1 Crear JSONs
- Migrar datos de XMLs viejos
- Ajustar coordenadas si es necesario
- Documentar campos disponibles

### Fase 6: Testing (2-3 horas)

#### 6.1 Unit Tests
- PDFService con mocks
- Template loader validation

#### 6.2 E2E Tests
- Preview → Download → Print flow
- Verificar DB updates

**Total estimado: 18-25 horas de desarrollo**

---

## Ejemplos de Código

### 1. Tipo PrintTemplate

```typescript
// frontend/types/print-template.ts

export interface PrintPosition {
  x: number;
  y: number;
}

export interface PrintField {
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;  // Para word wrap
  color?: string;     // Hex color
}

export interface ItemsConfiguration {
  startY: number;      // Y inicial de la primera fila
  spacing: number;     // Espacio entre filas
  maxRows?: number;    // Máximo de filas por página
  columns: {
    [key: string]: {
      x: number;
      align?: 'left' | 'center' | 'right';
      width?: number;
    };
  };
}

export interface PrintTemplate {
  name: string;
  version: string;
  type: 'invoice' | 'delivery-note';
  pageSize: {
    width: number;   // En puntos (595 = A4 width)
    height: number;  // En puntos (842 = A4 height)
  };
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  font: {
    family: string;
    size: number;
  };
  fields: {
    [fieldName: string]: PrintField;
  };
  items?: ItemsConfiguration;
}
```

### 2. PDFService - Método Principal

```typescript
// frontend/lib/services/PDFService.ts

import PDFDocument from 'pdfkit';
import { PrintTemplate, PrintField } from '@/types/print-template';
import { Invoice } from '@/types/invoice';

export class PDFService {
  
  async generateInvoicePDF(
    invoice: Invoice, 
    template: PrintTemplate
  ): Promise<Buffer> {
    
    return new Promise((resolve, reject) => {
      try {
        // Crear documento PDF
        const doc = new PDFDocument({
          size: [template.pageSize.width, template.pageSize.height],
          margins: template.margins || { top: 0, bottom: 0, left: 0, right: 0 }
        });

        // Buffer para acumular el PDF
        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Configurar fuente por defecto
        doc.font(template.font.family || 'Courier')
           .fontSize(template.font.size || 14);

        // Renderizar campos estáticos
        this.renderField(doc, template.fields.fecha, 
          new Date(invoice.invoiceDate).toLocaleDateString());
        
        this.renderField(doc, template.fields.numeroFactura, 
          invoice.invoiceNumber);
        
        this.renderField(doc, template.fields.razonSocial, 
          invoice.clientBusinessName);
        
        this.renderField(doc, template.fields.domicilio, 
          invoice.salesOrder?.client?.address || '');
        
        this.renderField(doc, template.fields.localidad, 
          invoice.salesOrder?.client?.city || '');
        
        this.renderField(doc, template.fields.provincia, 
          invoice.salesOrder?.client?.province?.name || '');
        
        this.renderField(doc, template.fields.condicionIVA, 
          invoice.clientTaxCondition);
        
        this.renderField(doc, template.fields.cuit, 
          invoice.clientCuit);

        // Renderizar items (tabla dinámica)
        if (template.items) {
          this.renderItems(doc, invoice.items, template.items);
        }

        // Renderizar totales
        this.renderField(doc, template.fields.subTotal, 
          invoice.netAmount.toFixed(2));
        
        this.renderField(doc, template.fields.iva, 
          invoice.taxAmount.toFixed(2));
        
        this.renderField(doc, template.fields.total, 
          invoice.totalAmount.toFixed(2));

        // Finalizar documento
        doc.end();

      } catch (error) {
        reject(error);
      }
    });
  }

  private renderField(
    doc: PDFKit.PDFDocument, 
    field: PrintField | undefined, 
    value: string
  ): void {
    if (!field) return;

    // Aplicar estilos si están definidos
    if (field.fontSize) doc.fontSize(field.fontSize);
    if (field.fontWeight === 'bold') doc.font('Courier-Bold');

    // Renderizar según alineación
    if (field.align === 'right') {
      // Calcular ancho del texto para alinear a derecha
      const textWidth = doc.widthOfString(value);
      doc.text(value, field.x - textWidth, field.y, {
        width: field.maxWidth,
        align: 'right'
      });
    } else {
      doc.text(value, field.x, field.y, {
        width: field.maxWidth,
        align: field.align || 'left'
      });
    }

    // Restaurar fuente por defecto
    doc.font('Courier').fontSize(14);
  }

  private renderItems(
    doc: PDFKit.PDFDocument,
    items: InvoiceItem[],
    config: ItemsConfiguration
  ): void {
    let currentY = config.startY;

    items.forEach((item, index) => {
      // Verificar si hay espacio en la página
      if (config.maxRows && index >= config.maxRows) {
        doc.addPage();
        currentY = config.startY;
      }

      // Renderizar cada columna
      if (config.columns.cantidad) {
        const col = config.columns.cantidad;
        this.renderField(doc, 
          { x: col.x, y: currentY, align: col.align }, 
          item.quantity.toString()
        );
      }

      if (config.columns.descripcion) {
        const col = config.columns.descripcion;
        this.renderField(doc, 
          { x: col.x, y: currentY, align: col.align, maxWidth: col.width }, 
          item.articleDescription
        );
      }

      if (config.columns.precioUnitario) {
        const col = config.columns.precioUnitario;
        this.renderField(doc, 
          { x: col.x, y: currentY, align: col.align }, 
          item.unitPrice.toFixed(2)
        );
      }

      if (config.columns.precioTotal) {
        const col = config.columns.precioTotal;
        this.renderField(doc, 
          { x: col.x, y: currentY, align: col.align }, 
          item.lineTotal.toFixed(2)
        );
      }

      currentY += config.spacing;
    });
  }

  async generateDeliveryNotePDF(
    deliveryNote: DeliveryNote,
    template: PrintTemplate
  ): Promise<Buffer> {
    // Implementación similar para remitos
    // ...
  }
}

export const pdfService = new PDFService();
```

### 3. API Route - Preview

```typescript
// frontend/app/api/invoices/[id]/preview-pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pdfService } from '@/lib/services/PDFService';
import { loadTemplate } from '@/lib/print-templates/template-loader';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = parseInt(params.id);

    // 1. Cargar factura con todas las relaciones
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        sales_orders: {
          include: {
            clients: {
              include: {
                provinces: true,
                tax_conditions: true,
              }
            },
            sales_order_items: {
              include: {
                articles: true
              }
            }
          }
        }
      }
    });

    if (!invoice || invoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // 2. Cargar template
    const template = await loadTemplate('invoice', 'default');

    // 3. Mapear datos al formato esperado
    const mappedInvoice = mapInvoiceToDTO(invoice);

    // 4. Generar PDF
    const pdfBuffer = await pdfService.generateInvoicePDF(
      mappedInvoice, 
      template
    );

    // 5. Retornar PDF (SIN marcar como impreso)
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="factura-${invoice.invoice_number}-preview.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error generating invoice preview:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF preview' },
      { status: 500 }
    );
  }
}
```

### 4. API Route - Print (marca como impreso)

```typescript
// frontend/app/api/invoices/[id]/print-pdf/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pdfService } from '@/lib/services/PDFService';
import { loadTemplate } from '@/lib/print-templates/template-loader';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const invoiceId = parseInt(params.id);

    // 1. Cargar y validar factura
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        sales_orders: {
          include: {
            clients: {
              include: {
                provinces: true,
                tax_conditions: true,
              }
            },
            sales_order_items: {
              include: {
                articles: true
              }
            }
          }
        }
      }
    });

    if (!invoice || invoice.deleted_at) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    if (invoice.is_cancelled) {
      return NextResponse.json(
        { error: 'Cannot print cancelled invoice' },
        { status: 400 }
      );
    }

    // 2. Generar PDF
    const template = await loadTemplate('invoice', 'default');
    const mappedInvoice = mapInvoiceToDTO(invoice);
    const pdfBuffer = await pdfService.generateInvoicePDF(
      mappedInvoice, 
      template
    );

    // 3. Marcar como impreso y ejecutar lógica de negocio
    await prisma.$transaction(async (tx) => {
      // Actualizar estado de impresión
      await tx.invoices.update({
        where: { id: invoiceId },
        data: {
          is_printed: true,
          printed_at: new Date(),
          updated_at: new Date(),
        }
      });

      // Si es primera impresión, ejecutar lógica de negocio
      if (!invoice.is_printed) {
        // TODO: Actualizar stock (restar cantidades)
        // TODO: Registrar movimiento en cuenta corriente
        // TODO: Actualizar estado de orden de venta si corresponde
      }
    });

    // 4. Retornar PDF
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="factura-${invoice.invoice_number}.pdf"`,
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    console.error('Error printing invoice:', error);
    return NextResponse.json(
      { error: 'Failed to print invoice' },
      { status: 500 }
    );
  }
}
```

### 5. Hook Custom - usePrintDocument

```typescript
// frontend/lib/hooks/usePrintDocument.ts

import { useState } from 'react';
import { toast } from 'sonner';

export function useInvoicePrint(invoiceId: number) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const openPreview = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/preview-pdf`);
      
      if (!response.ok) {
        throw new Error('Failed to generate preview');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      setPdfUrl(url);
      setIsPreviewOpen(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('No se pudo generar la vista previa');
    } finally {
      setIsGenerating(false);
    }
  };

  const print = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/print-pdf`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to print invoice');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      // Abrir en nueva ventana para imprimir
      window.open(url, '_blank');
      
      toast.success('Factura impresa correctamente');
      setIsPreviewOpen(false);
      
      // Cleanup
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      
    } catch (error) {
      console.error('Error printing invoice:', error);
      toast.error('No se pudo imprimir la factura');
    } finally {
      setIsGenerating(false);
    }
  };

  const download = async () => {
    if (!pdfUrl) return;

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `factura-${invoiceId}.pdf`;
    link.click();
    
    toast.success('PDF descargado');
  };

  const close = () => {
    setIsPreviewOpen(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  return {
    isPreviewOpen,
    isGenerating,
    pdfUrl,
    openPreview,
    print,
    download,
    close,
  };
}

export function useDeliveryNotePrint(deliveryNoteId: number) {
  // Implementación similar para remitos
  // ...
}
```

### 6. Componente PDFPreview

```typescript
// frontend/components/ui/PDFPreview.tsx

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, X } from 'lucide-react';

interface PDFPreviewProps {
  isOpen: boolean;
  pdfUrl: string | null;
  title: string;
  onClose: () => void;
  onPrint: () => void;
  onDownload: () => void;
  isGenerating?: boolean;
}

export function PDFPreview({
  isOpen,
  pdfUrl,
  title,
  onClose,
  onPrint,
  onDownload,
  isGenerating = false,
}: PDFPreviewProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            onClick={onDownload}
            disabled={!pdfUrl || isGenerating}
            variant="outline"
          >
            <Download className="w-4 h-4 mr-2" />
            Descargar
          </Button>
          
          <Button
            onClick={onPrint}
            disabled={!pdfUrl || isGenerating}
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>

          <Button
            onClick={onClose}
            variant="ghost"
            className="ml-auto"
          >
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
        </div>

        <div className="flex-1 border rounded-lg overflow-hidden bg-gray-100">
          {isGenerating ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-600">Generando PDF...</p>
              </div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No hay PDF para mostrar</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 7. Integración en Tabla de Facturas

```typescript
// frontend/components/invoices/InvoicesTable.tsx (modificado)

import { useInvoicePrint } from '@/lib/hooks/usePrintDocument';
import { PDFPreview } from '@/components/ui/PDFPreview';
import { Eye, Printer } from 'lucide-react';

export function InvoicesTable({ invoices }: InvoicesTableProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  
  const {
    isPreviewOpen,
    isGenerating,
    pdfUrl,
    openPreview,
    print,
    download,
    close,
  } = useInvoicePrint(selectedInvoiceId || 0);

  const handlePreview = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    openPreview();
  };

  return (
    <>
      <Table>
        {/* ... columnas existentes ... */}
        <TableColumn>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handlePreview(invoice.id)}
          >
            <Eye className="w-4 h-4 mr-1" />
            Vista Previa
          </Button>
        </TableColumn>
      </Table>

      <PDFPreview
        isOpen={isPreviewOpen}
        pdfUrl={pdfUrl}
        title={`Factura #${invoices.find(i => i.id === selectedInvoiceId)?.invoiceNumber}`}
        onClose={close}
        onPrint={print}
        onDownload={download}
        isGenerating={isGenerating}
      />
    </>
  );
}
```

---

## Schemas y Estructuras

### Template JSON - Factura

```json
{
  "name": "invoice-default",
  "version": "1.0.0",
  "type": "invoice",
  "description": "Template por defecto para facturas",
  
  "pageSize": {
    "width": 595,
    "height": 842
  },
  
  "margins": {
    "top": 0,
    "bottom": 0,
    "left": 0,
    "right": 0
  },
  
  "font": {
    "family": "Courier",
    "size": 14
  },
  
  "fields": {
    "fecha": {
      "x": 540,
      "y": 90,
      "align": "right"
    },
    "numeroFactura": {
      "x": 100,
      "y": 90,
      "fontWeight": "bold",
      "fontSize": 16
    },
    "razonSocial": {
      "x": 100,
      "y": 180,
      "maxWidth": 400
    },
    "domicilio": {
      "x": 100,
      "y": 195
    },
    "localidad": {
      "x": 100,
      "y": 210
    },
    "provincia": {
      "x": 100,
      "y": 235
    },
    "condicionIVA": {
      "x": 100,
      "y": 265
    },
    "cuit": {
      "x": 460,
      "y": 265
    },
    "subTotal": {
      "x": 520,
      "y": 700,
      "align": "right"
    },
    "iva": {
      "x": 520,
      "y": 720,
      "align": "right"
    },
    "total": {
      "x": 520,
      "y": 750,
      "align": "right",
      "fontWeight": "bold",
      "fontSize": 16
    }
  },
  
  "items": {
    "startY": 350,
    "spacing": 15,
    "maxRows": 20,
    "columns": {
      "cantidad": {
        "x": 80,
        "align": "right",
        "width": 60
      },
      "descripcion": {
        "x": 160,
        "align": "left",
        "width": 300
      },
      "precioUnitario": {
        "x": 470,
        "align": "right",
        "width": 80
      },
      "precioTotal": {
        "x": 560,
        "align": "right",
        "width": 80
      }
    }
  }
}
```

### Template JSON - Remito

```json
{
  "name": "delivery-note-default",
  "version": "1.0.0",
  "type": "delivery-note",
  "description": "Template por defecto para remitos",
  
  "pageSize": {
    "width": 595,
    "height": 842
  },
  
  "font": {
    "family": "Courier",
    "size": 14
  },
  
  "fields": {
    "fecha": {
      "x": 540,
      "y": 90,
      "align": "right"
    },
    "numeroRemito": {
      "x": 100,
      "y": 90,
      "fontWeight": "bold"
    },
    "razonSocial": {
      "x": 100,
      "y": 180
    },
    "domicilio": {
      "x": 100,
      "y": 195
    },
    "localidad": {
      "x": 100,
      "y": 210
    },
    "transportista": {
      "x": 150,
      "y": 700
    },
    "domicilioTransportista": {
      "x": 170,
      "y": 740
    },
    "peso": {
      "x": 630,
      "y": 600,
      "align": "right"
    },
    "bultos": {
      "x": 630,
      "y": 650,
      "align": "right"
    },
    "valor": {
      "x": 630,
      "y": 680,
      "align": "right"
    }
  },
  
  "items": {
    "startY": 350,
    "spacing": 15,
    "maxRows": 25,
    "columns": {
      "cantidad": {
        "x": 80,
        "align": "right"
      },
      "descripcion": {
        "x": 160,
        "align": "left",
        "width": 400
      }
    }
  }
}
```

### Validación Zod del Template

```typescript
// frontend/lib/print-templates/template-schema.ts

import { z } from 'zod';

export const PrintFieldSchema = z.object({
  x: z.number(),
  y: z.number(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  maxWidth: z.number().optional(),
  color: z.string().optional(),
});

export const ItemsConfigurationSchema = z.object({
  startY: z.number(),
  spacing: z.number(),
  maxRows: z.number().optional(),
  columns: z.record(z.object({
    x: z.number(),
    align: z.enum(['left', 'center', 'right']).optional(),
    width: z.number().optional(),
  })),
});

export const PrintTemplateSchema = z.object({
  name: z.string(),
  version: z.string(),
  type: z.enum(['invoice', 'delivery-note']),
  description: z.string().optional(),
  pageSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
  margins: z.object({
    top: z.number(),
    bottom: z.number(),
    left: z.number(),
    right: z.number(),
  }).optional(),
  font: z.object({
    family: z.string(),
    size: z.number(),
  }),
  fields: z.record(PrintFieldSchema),
  items: ItemsConfigurationSchema.optional(),
});

export type PrintTemplate = z.infer<typeof PrintTemplateSchema>;
export type PrintField = z.infer<typeof PrintFieldSchema>;
export type ItemsConfiguration = z.infer<typeof ItemsConfigurationSchema>;
```

---

## Notas Técnicas Importantes

### 1. Conversión de Coordenadas

El sistema viejo probablemente usa **píxeles**, PDFKit usa **puntos** (72 DPI).

**Conversión:**
```typescript
// Píxeles a Puntos (si es necesario)
const points = pixels * 0.75;

// Puntos a Píxeles (para el editor visual)
const pixels = points / 0.75;
```

**Validar con el XML viejo** midiendo un documento impreso para confirmar la unidad.

### 2. Fuentes Disponibles en PDFKit

Fuentes built-in (sin archivos extra):
- `Courier` (equivalente a Courier New)
- `Courier-Bold`
- `Courier-Oblique`
- `Helvetica`, `Helvetica-Bold`
- `Times-Roman`, `Times-Bold`

Para fuentes custom (como Arial), registrar archivos `.ttf`.

### 3. Performance

- **Cache de templates**: Cargar una vez, reutilizar
- **Streaming**: Para facturas con muchos items, usar stream en lugar de buffer
- **Concurrencia**: Si se imprimen muchas facturas simultáneamente, considerar job queue

### 4. Seguridad

- Validar permisos del usuario antes de generar PDF
- No exponer rutas de templates en el cliente
- Sanitizar inputs (aunque PDFKit no ejecuta código)
- Rate limiting en endpoints de generación

### 5. Testing

```typescript
// Ejemplo de test unitario
describe('PDFService', () => {
  it('should generate invoice PDF with correct data', async () => {
    const mockInvoice = createMockInvoice();
    const mockTemplate = loadTestTemplate('invoice');
    
    const pdfBuffer = await pdfService.generateInvoicePDF(
      mockInvoice, 
      mockTemplate
    );
    
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(0);
    
    // Validar que el PDF es válido
    const pdfData = await PDFParser.parse(pdfBuffer);
    expect(pdfData.pages).toHaveLength(1);
  });
});
```

---

## Próximos Pasos

1. ✅ Documentación creada
2. ⏳ Crear issue en GitHub con este plan
3. ⏳ Ejecutar Fase 1: Migración XML → JSON
4. ⏳ Implementar PDFService básico
5. ⏳ Crear API routes de preview
6. ⏳ Integrar en UI de facturas
7. ⏳ Testing end-to-end
8. ⏳ Editor visual (última fase)

---

## Referencias

- [PDFKit Documentation](https://pdfkit.org/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Prisma Transactions](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- Sistema viejo: `d:\dialfa new\spisa\SPISA_LogicaDeNegocios\Printing .cs`



