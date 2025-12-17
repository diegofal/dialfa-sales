import PDFDocument from 'pdfkit';
import { PrintTemplate, PrintField, ItemsConfiguration } from '@/types/print-template';

export class PDFService {
    private currentTemplate: PrintTemplate | null = null;

    async generateInvoicePDF(
        invoice: any,
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
                this.renderField(doc, template.fields.cuit, cuit);

                if (template.items && invoice.sales_orders?.sales_order_items) {
                    const items = invoice.sales_orders.sales_order_items.map((item: any) => ({
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
        items: any[],
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
}

export const pdfService = new PDFService();
