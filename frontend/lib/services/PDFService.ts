import PDFDocument from 'pdfkit';
import { PrintTemplate, PrintField, ItemsConfiguration } from '@/types/print-template';
import { PDFItem } from '@/types/pdf-data';

export class PDFService {
    private currentTemplate: PrintTemplate | null = null;

    async generateInvoicePDF(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        invoice: any,
        template: PrintTemplate
    ): Promise<Buffer> {
        this.currentTemplate = template;

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [template.pageSize.width, template.pageSize.height],
                    margins: template.margins || { top: 0, bottom: 0, left: 0, right: 0 },
                    autoFirstPage: false,
                    bufferPages: true
                });

                const chunks: Buffer[] = [];
                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Add page and explicitly set font to one of the standard 14 PDF fonts
                // that don't require external font files
                doc.addPage();
                doc.font('Courier');

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
                this.renderField(doc, template.fields.cuit, cuit);

                if (template.items && invoice.sales_orders?.sales_order_items) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const items: PDFItem[] = invoice.sales_orders.sales_order_items.map((item: any) => ({
                        quantity: item.quantity,
                        articleDescription: item.articles?.description || '',
                        unitPrice: Number(item.unit_price || 0),
                        lineTotal: Number(item.quantity || 0) * Number(item.unit_price || 0)
                    }));
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
            const textWidth = doc.widthOfString(stringValue);
            doc.text(stringValue, finalX - textWidth, finalY, {
                width: field.maxWidth,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        deliveryNote: any,
        template: PrintTemplate
    ): Promise<Buffer> {
        this.currentTemplate = template;

        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [template.pageSize.width, template.pageSize.height],
                    margins: template.margins || { top: 0, bottom: 0, left: 0, right: 0 },
                    autoFirstPage: false,
                    bufferPages: true
                });

                const chunks: Buffer[] = [];
                doc.on('data', (chunk) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', reject);

                // Add page and explicitly set font to one of the standard 14 PDF fonts
                // that don't require external font files
                doc.addPage();
                doc.font('Courier');

                // Renderizar campos estáticos
                this.renderField(doc, template.fields.fecha,
                    new Date(deliveryNote.delivery_date).toLocaleDateString());

                this.renderField(doc, template.fields.numeroRemito || template.fields.numeroFactura,
                    deliveryNote.delivery_number);

                const clientName = deliveryNote.sales_orders?.clients?.business_name || '';
                this.renderField(doc, template.fields.razonSocial, clientName);

                const address = deliveryNote.sales_orders?.clients?.address || '';
                this.renderField(doc, template.fields.domicilio, address);

                const city = deliveryNote.sales_orders?.clients?.city || '';
                this.renderField(doc, template.fields.localidad, city);

                const province = deliveryNote.sales_orders?.clients?.provinces?.name || '';
                this.renderField(doc, template.fields.provincia, province);

                const taxCondition = deliveryNote.sales_orders?.clients?.tax_conditions?.name || '';
                this.renderField(doc, template.fields.condicionIVA, taxCondition);

                const cuit = deliveryNote.sales_orders?.clients?.cuit || '';
                this.renderField(doc, template.fields.cuit, cuit);

                // Datos específicos del remito
                if (deliveryNote.transporter_id && deliveryNote.transporters) {
                    const transporterName = deliveryNote.transporters.business_name || '';
                    this.renderField(doc, template.fields.transportista, transporterName);
                }

                if (deliveryNote.weight_kg) {
                    this.renderField(doc, template.fields.peso, `${deliveryNote.weight_kg} kg`);
                }

                if (deliveryNote.packages_count) {
                    this.renderField(doc, template.fields.bultos, deliveryNote.packages_count.toString());
                }

                // Renderizar items si existen
                if (template.items && deliveryNote.delivery_note_items) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const items: PDFItem[] = deliveryNote.delivery_note_items.map((item: any) => ({
                        quantity: item.quantity,
                        articleDescription: item.article_description || '',
                        unitPrice: 0, // Los remitos normalmente no muestran precios
                        lineTotal: 0
                    }));
                    this.renderItems(doc, items, template.items);
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
}

export const pdfService = new PDFService();
