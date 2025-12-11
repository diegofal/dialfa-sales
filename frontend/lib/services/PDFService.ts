/* eslint-disable @typescript-eslint/no-explicit-any */
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib';
import { PrintTemplate, PrintField, ItemsConfiguration } from '@/types/print-template';
import { formatCuit } from '@/lib/utils/formatters';

interface InvoiceItem {
    quantity: number;
    unit_price: any;
    articles?: {
        description: string | null;
    } | null;
}

interface Invoice {
    invoice_date: Date | string;
    invoice_number: string;
    net_amount: any;
    tax_amount: any;
    total_amount: any;
    sales_orders?: {
        clients?: {
            business_name?: string | null;
            address?: string | null;
            city?: string | null;
            provinces?: { name: string } | null;
            tax_conditions?: { name: string } | null;
            cuit?: string | null;
        } | null;
        sales_order_items?: InvoiceItem[];
    } | null;
}

interface RenderedItem {
    quantity: number;
    articleDescription: string;
    unitPrice: number;
    lineTotal: number;
}

interface DeliveryNoteItem {
    quantity: number;
    article_code: string;
    article_description: string;
}

interface DeliveryNote {
    delivery_date: Date | string;
    delivery_number: string;
    weight_kg?: any;
    packages_count?: number | null;
    declared_value?: any;
    notes?: string | null;
    sales_orders?: {
        order_number?: string;
        clients?: {
            business_name?: string | null;
            address?: string | null;
            city?: string | null;
            provinces?: { name: string } | null;
            tax_conditions?: { name: string } | null;
            cuit?: string | null;
        } | null;
    } | null;
    transporters?: {
        name?: string;
        address?: string | null;
    } | null;
    delivery_note_items?: DeliveryNoteItem[];
}

export class PDFService {
    private currentTemplate: PrintTemplate | null = null;
    private pageHeight: number = 0;

    async generateInvoicePDF(
        invoice: Invoice,
        template: PrintTemplate
    ): Promise<Buffer> {
        this.currentTemplate = template;
        this.pageHeight = template.pageSize.height;

        try {
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            let page = pdfDoc.addPage([template.pageSize.width, template.pageSize.height]);

            // Renderizar campos estáticos
            await this.renderField(page, font, template.fields.fecha,
                new Date(invoice.invoice_date).toLocaleDateString());

            await this.renderField(page, font, template.fields.numeroFactura,
                invoice.invoice_number);

            const clientName = invoice.sales_orders?.clients?.business_name || '';
            await this.renderField(page, font, template.fields.razonSocial, clientName);

            const address = invoice.sales_orders?.clients?.address || '';
            await this.renderField(page, font, template.fields.domicilio, address);

            const city = invoice.sales_orders?.clients?.city || '';
            await this.renderField(page, font, template.fields.localidad, city);

            const province = invoice.sales_orders?.clients?.provinces?.name || '';
            await this.renderField(page, font, template.fields.provincia, province);

            const taxCondition = invoice.sales_orders?.clients?.tax_conditions?.name || '';
            await this.renderField(page, font, template.fields.condicionIVA, taxCondition);

            const cuit = invoice.sales_orders?.clients?.cuit || '';
            await this.renderField(page, font, template.fields.cuit, formatCuit(cuit));

            if (template.items && invoice.sales_orders?.sales_order_items) {
                const items = invoice.sales_orders.sales_order_items.map((item) => ({
                    quantity: item.quantity,
                    articleDescription: item.articles?.description || '',
                    unitPrice: Number(item.unit_price || 0),
                    lineTotal: Number(item.quantity || 0) * Number(item.unit_price || 0)
                }));

                page = await this.renderItems(pdfDoc, page, font, items, template.items);
            }

            const netAmount = Number(invoice.net_amount || 0);
            const taxAmount = Number(invoice.tax_amount || 0);
            const totalAmount = Number(invoice.total_amount || 0);

            await this.renderField(page, font, template.fields.subTotal, netAmount.toFixed(2));
            await this.renderField(page, font, template.fields.iva, taxAmount.toFixed(2));
            await this.renderField(page, font, template.fields.total, totalAmount.toFixed(2));

            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);

        } catch (error) {
            throw error;
        }
    }

    async generateDeliveryNotePDF(
        deliveryNote: DeliveryNote,
        template: PrintTemplate
    ): Promise<Buffer> {
        this.currentTemplate = template;
        this.pageHeight = template.pageSize.height;

        try {
            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            let page = pdfDoc.addPage([template.pageSize.width, template.pageSize.height]);

            // Renderizar campos estáticos
            await this.renderField(page, font, template.fields.fecha,
                new Date(deliveryNote.delivery_date).toLocaleDateString());

            await this.renderField(page, font, template.fields.numeroRemito,
                deliveryNote.delivery_number);

            const orderNumber = deliveryNote.sales_orders?.order_number || '';
            await this.renderField(page, font, template.fields.numeroPedido, orderNumber);

            const clientName = deliveryNote.sales_orders?.clients?.business_name || '';
            await this.renderField(page, font, template.fields.razonSocial, clientName);

            const address = deliveryNote.sales_orders?.clients?.address || '';
            await this.renderField(page, font, template.fields.domicilio, address);

            const city = deliveryNote.sales_orders?.clients?.city || '';
            await this.renderField(page, font, template.fields.localidad, city);

            const province = deliveryNote.sales_orders?.clients?.provinces?.name || '';
            await this.renderField(page, font, template.fields.provincia, province);

            const taxCondition = deliveryNote.sales_orders?.clients?.tax_conditions?.name || '';
            await this.renderField(page, font, template.fields.condicionIVA, taxCondition);

            const cuit = deliveryNote.sales_orders?.clients?.cuit || '';
            await this.renderField(page, font, template.fields.cuit, formatCuit(cuit));

            // Renderizar items
            if (template.items && deliveryNote.delivery_note_items) {
                const items = deliveryNote.delivery_note_items.map((item) => ({
                    quantity: item.quantity,
                    articleDescription: item.article_description || '',
                    unitPrice: 0, // Delivery notes don't show prices
                    lineTotal: 0
                }));

                page = await this.renderDeliveryNoteItems(pdfDoc, page, font, items, template.items);
            }

            // Renderizar información del transportista (solo si existe)
            if (deliveryNote.transporters) {
                const transporterName = deliveryNote.transporters.name || '';
                await this.renderField(page, font, template.fields.transportista,
                    `Transportista: ${transporterName}`);

                const transporterAddress = deliveryNote.transporters.address || '';
                if (transporterAddress) {
                    await this.renderField(page, font, template.fields.domicilioTransportista,
                        `Domicilio: ${transporterAddress}`);
                }
            }

            // Renderizar peso, bultos, valor (solo si existen)
            if (deliveryNote.weight_kg) {
                const weight = Number(deliveryNote.weight_kg || 0);
                await this.renderField(page, font, template.fields.peso,
                    `Peso: ${weight.toFixed(2)} kg`);
            }

            if (deliveryNote.packages_count) {
                await this.renderField(page, font, template.fields.bultos,
                    `Bultos: ${deliveryNote.packages_count}`);
            }

            if (deliveryNote.declared_value) {
                const value = Number(deliveryNote.declared_value || 0);
                await this.renderField(page, font, template.fields.valor,
                    `Valor: $${value.toFixed(2)}`);
            }

            // Renderizar observaciones (si existen)
            if (deliveryNote.notes) {
                await this.renderField(page, font, template.fields.observaciones,
                    `Obs: ${deliveryNote.notes}`);
            }

            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);

        } catch (error) {
            throw error;
        }
    }

    private async renderField(
        page: PDFPage,
        font: PDFFont,
        field: PrintField | undefined,
        value: string | number | null | undefined
    ): Promise<void> {
        if (!field || value === null || value === undefined) return;
        const stringValue = String(value);

        const offsetX = this.currentTemplate?.globalOffset?.x || 0;
        const offsetY = this.currentTemplate?.globalOffset?.y || 0;
        const finalX = field.x + offsetX;

        // Convert from top-left origin to bottom-left origin
        const finalY = this.pageHeight - (field.y + offsetY);

        const fontSize = field.fontSize || this.currentTemplate?.font.size || 12;

        // Handle text alignment
        let xPosition = finalX;
        if (field.align === 'right' && field.maxWidth) {
            const textWidth = font.widthOfTextAtSize(stringValue, fontSize);
            xPosition = finalX + field.maxWidth - textWidth;
        } else if (field.align === 'center' && field.maxWidth) {
            const textWidth = font.widthOfTextAtSize(stringValue, fontSize);
            xPosition = finalX + (field.maxWidth - textWidth) / 2;
        }

        page.drawText(stringValue, {
            x: xPosition,
            y: finalY,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
        });
    }

    private async renderItems(
        pdfDoc: PDFDocument,
        currentPage: PDFPage,
        font: PDFFont,
        items: RenderedItem[],
        config: ItemsConfiguration
    ): Promise<PDFPage> {
        let page = currentPage;
        let currentY = config.startY;

        for (let index = 0; index < items.length; index++) {
            const item = items[index];

            if (config.maxRows && index > 0 && index % config.maxRows === 0) {
                page = pdfDoc.addPage([this.currentTemplate?.pageSize.width || 595, this.pageHeight]);
                currentY = config.startY;
            }

            if (config.columns.cantidad) {
                const col = config.columns.cantidad;
                await this.renderField(page, font, { ...col, y: currentY }, item.quantity);
            }

            if (config.columns.descripcion) {
                const col = config.columns.descripcion;
                await this.renderField(page, font, { ...col, y: currentY }, item.articleDescription);
            }

            if (config.columns.precioUnitario) {
                const col = config.columns.precioUnitario;
                await this.renderField(page, font, { ...col, y: currentY }, item.unitPrice.toFixed(2));
            }

            if (config.columns.precioTotal) {
                const col = config.columns.precioTotal;
                await this.renderField(page, font, { ...col, y: currentY }, item.lineTotal.toFixed(2));
            }

            currentY += config.spacing;
        }

        return page;
    }

    private async renderDeliveryNoteItems(
        pdfDoc: PDFDocument,
        currentPage: PDFPage,
        font: PDFFont,
        items: RenderedItem[],
        config: ItemsConfiguration
    ): Promise<PDFPage> {
        let page = currentPage;
        let currentY = config.startY;

        for (let index = 0; index < items.length; index++) {
            const item = items[index];

            if (config.maxRows && index > 0 && index % config.maxRows === 0) {
                page = pdfDoc.addPage([this.currentTemplate?.pageSize.width || 595, this.pageHeight]);
                currentY = config.startY;
            }

            if (config.columns.cantidad) {
                const col = config.columns.cantidad;
                await this.renderField(page, font, { ...col, y: currentY }, item.quantity);
            }

            if (config.columns.descripcion) {
                const col = config.columns.descripcion;
                await this.renderField(page, font, { ...col, y: currentY }, item.articleDescription);
            }

            currentY += config.spacing;
        }

        return page;
    }
}

export const pdfService = new PDFService();
