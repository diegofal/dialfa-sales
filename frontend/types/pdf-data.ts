// Types for PDF generation data structures
import { Decimal } from '@prisma/client/runtime/library';

interface InvoiceItem {
  quantity: number;
  articles?: {
    description: string;
  };
  unit_price: number | string | Decimal;
}

interface Client {
  business_name?: string | null;
  address?: string | null;
  city?: string | null;
  cuit?: string | null;
  provinces?: {
    name: string;
  } | null;
  tax_conditions?: {
    name: string;
  } | null;
}

interface SalesOrder {
  clients?: Client;
  sales_order_items?: InvoiceItem[];
}

export interface InvoiceData {
  invoice_date: Date | string;
  invoice_number: string;
  net_amount?: number | string | Decimal;
  tax_amount?: number | string | Decimal;
  total_amount?: number | string | Decimal;
  sales_orders?: SalesOrder;
}

interface DeliveryNoteItem {
  quantity: number;
  article_description: string;
}

interface Transporter {
  business_name: string;
}

export interface DeliveryNoteData {
  delivery_date: Date | string;
  delivery_number: string;
  transporter_id?: number | null;
  weight_kg?: number | string | Decimal | null;
  packages_count?: number | null;
  notes?: string | null;
  sales_orders?: SalesOrder;
  transporters?: Transporter | null;
  delivery_note_items?: DeliveryNoteItem[];
}

export interface PDFItem {
  quantity: number;
  articleDescription: string;
  unitPrice: number;
  lineTotal: number;
}

