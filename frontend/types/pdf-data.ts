// Types for PDF generation data structures
import { Decimal } from '@prisma/client/runtime/library';

interface InvoiceItemForPDF {
  quantity: number;
  article_description: string;
  unit_price_ars: number | string | Decimal;
  discount_percent?: number | string | Decimal;
  line_total: number | string | Decimal;
}

interface SalesOrderItem {
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
  sales_order_items?: SalesOrderItem[];
}

export interface InvoiceData {
  invoice_date: Date | string;
  invoice_number: string;
  net_amount?: number | string | Decimal;
  tax_amount?: number | string | Decimal;
  total_amount?: number | string | Decimal;
  sales_orders?: SalesOrder;
  invoice_items?: InvoiceItemForPDF[];
}

interface DeliveryNoteItem {
  quantity: number;
  article_description?: string;
  description?: string;
  articles?: {
    description: string;
  };
  observations?: string | null;
}

interface Transporter {
  name: string;
  address?: string | null;
}

export interface DeliveryNoteData {
  delivery_date: Date | string;
  delivery_number: string;
  transporter_id?: number | null;
  weight_kg?: number | string | Decimal | null;
  packages_count?: number | null;
  declared_value?: number | string | Decimal | null;
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

export interface PDFDeliveryNoteItem {
  quantity: number;
  articleDescription: string;
  observations: string;
}

