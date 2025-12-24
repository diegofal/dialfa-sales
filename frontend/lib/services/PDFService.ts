import PDFDocument from 'pdfkit';
import { PrintTemplate, PrintField, ItemsConfiguration } from '@/types/print-template';
import { InvoiceData, DeliveryNoteData, PDFItem, PDFDeliveryNoteItem } from '@/types/pdf-data';
import { formatCuit } from '@/lib/utils';

export class PDFService {
    private currentTemplate: PrintTemplate | null = null;

    async generateInvoicePDF(
        invoice: InvoiceData,
        template: PrintTemplate
    ): Promise<Buffer> {
        this.currentTemplate = template;

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [template.pageSize.width, template.pageSize.height],
                    margins: template.margins || { top: 0, bottom: 0, left: 0, right: 0 },
                    autoFirstPage: true,
                    bufferPages: true
                });

                const chunks: Buffer[] = [];
                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Renderizar campos estáticos
                this.renderField(doc, template.fields.fecha,
                    new Date(invoice.invoice_date).toLocaleDateString());

                this.renderField(doc, template.fields.numeroFactura,
                    invoice.invoice_number);

                const clientName = invoice.sales_orders?.clients?.business_name || '';
                this.renderField(doc, template.fields.razonSocial, clientName);

                const address = invoice.sales_orders?.clients?.address || '';
                this.renderField(doc, template.fields.domicilio, address);

                const city = invoice.sales_orders?.clients?.city || '';
                this.renderField(doc, template.fields.localidad, city);

                const province = invoice.sales_orders?.clients?.provinces?.name || '';
                this.renderField(doc, template.fields.provincia, province);

                const taxCondition = invoice.sales_orders?.clients?.tax_conditions?.name || '';
                this.renderField(doc, template.fields.condicionIVA, taxCondition);

                const cuit = invoice.sales_orders?.clients?.cuit || '';
                this.renderField(doc, template.fields.cuit, formatCuit(cuit));

                if (template.items && invoice.invoice_items) {
                    const items: PDFItem[] = invoice.invoice_items.map((item) => {
                        const unitPriceArs = Number(item.unit_price_ars || 0);
                        const discountPercent = Number(item.discount_percent || 0);
                        
                        // Calculate unit price with discount applied
                        const unitPriceWithDiscount = unitPriceArs * (1 - discountPercent / 100);
                        
                        return {
                            quantity: item.quantity,
                            articleDescription: item.article_description || '',
                            unitPrice: unitPriceWithDiscount,
                            lineTotal: Number(item.line_total || 0)
                        };
                    });
                    this.renderItems(doc, items, template.items);
                }

                const netAmount = Number(invoice.net_amount || 0);
                const taxAmount = Number(invoice.tax_amount || 0);
                const totalAmount = Number(invoice.total_amount || 0);

                this.renderField(doc, template.fields.subTotal, netAmount.toFixed(2));
                this.renderField(doc, template.fields.iva, taxAmount.toFixed(2));
                this.renderField(doc, template.fields.total, totalAmount.toFixed(2));

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    private renderField(
        doc: PDFKit.PDFDocument,
        field: PrintField | undefined,
        value: string | number | null | undefined
    ): void {
        if (!field || value === null || value === undefined) return;
        const stringValue = String(value);

        const offsetX = this.currentTemplate?.globalOffset?.x || 0;
        const offsetY = this.currentTemplate?.globalOffset?.y || 0;
        const finalX = field.x + offsetX;
        const finalY = field.y + offsetY;

        const fontSize = field.fontSize || this.currentTemplate?.font.size || 12;
        doc.fontSize(fontSize);

        if (field.align === 'right') {
            // For right alignment, provide a fixed width for the text box
            // PDFKit will align the text to the right within that width
            const boxWidth = field.maxWidth || 100;
            doc.text(stringValue, finalX - boxWidth, finalY, {
                width: boxWidth,
                align: 'right'
            });
        } else {
            doc.text(stringValue, finalX, finalY, {
                width: field.maxWidth,
                align: field.align || 'left'
            });
        }

        doc.fontSize(12);
    }

    private renderItems(
        doc: PDFKit.PDFDocument,
        items: PDFItem[],
        config: ItemsConfiguration
    ): void {
        let currentY = config.startY;

        items.forEach((item, index) => {
            if (config.maxRows && index > 0 && index % config.maxRows === 0) {
                doc.addPage();
                currentY = config.startY;
            }

            if (config.columns.cantidad) {
                const col = config.columns.cantidad;
                this.renderField(doc, { ...col, y: currentY }, item.quantity);
            }

            if (config.columns.descripcion) {
                const col = config.columns.descripcion;
                this.renderField(doc, { ...col, y: currentY }, item.articleDescription);
            }

            if (config.columns.precioUnitario) {
                const col = config.columns.precioUnitario;
                this.renderField(doc, { ...col, y: currentY }, item.unitPrice.toFixed(2));
            }

            if (config.columns.precioTotal) {
                const col = config.columns.precioTotal;
                this.renderField(doc, { ...col, y: currentY }, item.lineTotal.toFixed(2));
            }

            currentY += config.spacing;
        });
    }

    async generateDeliveryNotePDF(
        deliveryNote: DeliveryNoteData,
        template: PrintTemplate
    ): Promise<Buffer> {
        this.currentTemplate = template;

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [template.pageSize.width, template.pageSize.height],
                    margins: template.margins || { top: 0, bottom: 0, left: 0, right: 0 },
                    autoFirstPage: true,
                    bufferPages: true
                });

                const chunks: Buffer[] = [];
                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Renderizar campos estáticos
                this.renderField(doc, template.fields.fecha,
                    new Date(deliveryNote.delivery_date).toLocaleDateString());

                // NO renderizar número de remito (el formulario preimpreso ya lo tiene)
                // En el sistema legacy, NumeroRemito tiene coordenadas vacías

                const clientName = deliveryNote.sales_orders?.clients?.business_name || '';
                this.renderField(doc, template.fields.razonSocial, clientName);

                const address = deliveryNote.sales_orders?.clients?.address || '';
                this.renderField(doc, template.fields.domicilio, address);

                const city = deliveryNote.sales_orders?.clients?.city || '';
                this.renderField(doc, template.fields.localidad, city);

                const province = deliveryNote.sales_orders?.clients?.provinces?.name || '';
                this.renderField(doc, template.fields.provincia, province);

                const cuit = deliveryNote.sales_orders?.clients?.cuit || '';
                this.renderField(doc, template.fields.cuit, formatCuit(cuit));

                const taxCondition = deliveryNote.sales_orders?.clients?.tax_conditions?.name || '';
                this.renderField(doc, template.fields.condicionIVA, taxCondition);

                // Datos específicos del remito - Transportista
                if (deliveryNote.transporter_id && deliveryNote.transporters) {
                    const transporterName = deliveryNote.transporters.name || '';
                    this.renderField(doc, template.fields.transportista, transporterName);
                    
                    // Dirección del transportista
                    const transporterAddress = deliveryNote.transporters.address || '';
                    this.renderField(doc, template.fields.domicilioTransportista, transporterAddress);
                }

                // Peso - con formato "Peso: X kg."
                if (deliveryNote.weight_kg) {
                    this.renderField(doc, template.fields.peso, `Peso: ${deliveryNote.weight_kg} kg.`);
                }

                // Bultos - con formato "Bultos: X"
                if (deliveryNote.packages_count) {
                    this.renderField(doc, template.fields.bultos, `Bultos: ${deliveryNote.packages_count}`);
                }

                // Valor declarado - con formato "Valor: $X"
                if (deliveryNote.declared_value) {
                    const declaredValue = Number(deliveryNote.declared_value);
                    this.renderField(doc, template.fields.valor, `Valor: $${declaredValue.toFixed(2)}`);
                }

                // Renderizar items si existen
                if (template.items && deliveryNote.delivery_note_items) {
                    const items: PDFDeliveryNoteItem[] = deliveryNote.delivery_note_items.map((item) => ({
                        quantity: item.quantity,
                        articleDescription: item.articles?.description || item.description || item.article_description || '',
                        observations: item.observations || ''
                    }));
                    this.renderDeliveryNoteItems(doc, items, template.items);
                }

                // Observaciones
                if (deliveryNote.notes) {
                    this.renderField(doc, template.fields.observaciones, deliveryNote.notes);
                }

                doc.end();

            } catch (error) {
                reject(error);
            }
        });
    }

    private renderDeliveryNoteItems(
        doc: PDFKit.PDFDocument,
        items: PDFDeliveryNoteItem[],
        config: ItemsConfiguration
    ): void {
        let currentY = config.startY;

        items.forEach((item, index) => {
            if (config.maxRows && index > 0 && index % config.maxRows === 0) {
                doc.addPage();
                currentY = config.startY;
            }

            if (config.columns.cantidad) {
                const col = config.columns.cantidad;
                this.renderField(doc, { ...col, y: currentY }, item.quantity);
            }

            if (config.columns.descripcion) {
                const col = config.columns.descripcion;
                this.renderField(doc, { ...col, y: currentY }, item.articleDescription);
            }

            if (config.columns.observaciones) {
                const col = config.columns.observaciones;
                this.renderField(doc, { ...col, y: currentY }, item.observations);
            }

            currentY += config.spacing;
        });
    }
}

export const pdfService = new PDFService();
