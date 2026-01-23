import { InvoiceData } from '@/types/pdf-data';
import { PrintTemplate } from '@/types/print-template';
import { PDFService } from '../PDFService';

// Mock pdfkit to avoid actual PDF generation
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    fontSize: jest.fn().mockReturnThis(),
    text: jest.fn().mockReturnThis(),
    addPage: jest.fn().mockReturnThis(),
    end: jest.fn(),
    on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'end') {
        // Trigger end immediately
        setTimeout(() => handler(), 0);
      }
    }),
  }));
});

function makeTemplate(overrides: Partial<PrintTemplate> = {}): PrintTemplate {
  return {
    name: 'test-template',
    pageSize: { width: 595, height: 842 },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    font: { family: 'Helvetica', size: 10 },
    fields: {
      fecha: { x: 10, y: 10 },
      numeroFactura: { x: 10, y: 30 },
      razonSocial: { x: 10, y: 50 },
      domicilio: { x: 10, y: 70 },
      localidad: { x: 10, y: 90 },
      provincia: { x: 10, y: 110 },
      condicionIVA: { x: 10, y: 130 },
      cuit: { x: 10, y: 150 },
      subTotal: { x: 10, y: 170 },
      iva: { x: 10, y: 190 },
      total: { x: 10, y: 210 },
    },
    ...overrides,
  } as PrintTemplate;
}

function makeInvoice(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    id: 1,
    invoice_number: 'FC-A-00001',
    invoice_date: '2024-01-15',
    net_amount: 1000,
    tax_amount: 210,
    total_amount: 1210,
    invoice_items: [],
    sales_orders: {
      clients: {
        business_name: 'Test Corp',
        address: '123 Main St',
        city: 'Buenos Aires',
        cuit: '20123456789',
        provinces: { name: 'Buenos Aires' },
        tax_conditions: { name: 'Responsable Inscripto' },
      },
    },
    ...overrides,
  } as unknown as InvoiceData;
}

describe('PDFService', () => {
  let service: PDFService;

  beforeEach(() => {
    service = new PDFService();
  });

  describe('generateInvoicePDF input validation', () => {
    it('throws when invoice data is null', async () => {
      const template = makeTemplate();
      await expect(
        service.generateInvoicePDF(null as unknown as InvoiceData, template)
      ).rejects.toThrow('Invoice data is required');
    });

    it('throws when invoice data is undefined', async () => {
      const template = makeTemplate();
      await expect(
        service.generateInvoicePDF(undefined as unknown as InvoiceData, template)
      ).rejects.toThrow('Invoice data is required');
    });

    it('throws when template is null', async () => {
      const invoice = makeInvoice();
      await expect(
        service.generateInvoicePDF(invoice, null as unknown as PrintTemplate)
      ).rejects.toThrow('Print template is required');
    });

    it('throws when template is undefined', async () => {
      const invoice = makeInvoice();
      await expect(
        service.generateInvoicePDF(invoice, undefined as unknown as PrintTemplate)
      ).rejects.toThrow('Print template is required');
    });

    it('throws when template has no pageSize', async () => {
      const invoice = makeInvoice();
      const template = makeTemplate({
        pageSize: undefined as unknown as { width: number; height: number },
      });
      await expect(service.generateInvoicePDF(invoice, template)).rejects.toThrow(
        'Template must define pageSize'
      );
    });

    it('does not throw with valid inputs', async () => {
      const invoice = makeInvoice();
      const template = makeTemplate();
      // Should not throw - the mock PDFDocument will handle the rest
      await expect(service.generateInvoicePDF(invoice, template)).resolves.toBeDefined();
    });
  });
});
