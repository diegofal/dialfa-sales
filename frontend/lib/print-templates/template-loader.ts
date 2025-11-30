import { PrintTemplate } from '@/types/print-template';
import invoiceDefault from './invoice-default.json';
import deliveryNoteDefault from './delivery-note-default.json';

// In a real application, we might load these from the filesystem or database.
// For now, we'll import the JSON directly to keep it simple and bundled.

const templates: Record<string, PrintTemplate> = {
    'invoice-default': invoiceDefault as unknown as PrintTemplate,
    'delivery-note-default': deliveryNoteDefault as unknown as PrintTemplate,
};

export async function loadTemplate(type: 'invoice' | 'delivery-note', name: 'default'): Promise<PrintTemplate> {
    const key = `${type}-${name}`;
    const template = templates[key];

    if (!template) {
        throw new Error(`Template not found: ${key}`);
    }

    return template;
}
