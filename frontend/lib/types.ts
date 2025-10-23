import { Prisma } from '@prisma/client';

// Helper types for Prisma where clauses
export type ArticleWhereInput = Prisma.articlesWhereInput;
export type CategoryWhereInput = Prisma.categoriesWhereInput;
export type ClientWhereInput = Prisma.clientsWhereInput;
export type SalesOrderWhereInput = Prisma.sales_ordersWhereInput;
export type InvoiceWhereInput = Prisma.invoicesWhereInput;

// Helper for API responses
export type ActionResponse<T = unknown> = 
  | { success: true; data: T; message?: string }
  | { success: false; error: string };


