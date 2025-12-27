-- AlterTable
ALTER TABLE "supplier_order_items" 
ADD COLUMN "unit_weight" DECIMAL(10,3),
ADD COLUMN "proforma_unit_price" DECIMAL(12,2),
ADD COLUMN "proforma_total_price" DECIMAL(15,2),
ADD COLUMN "db_unit_price" DECIMAL(12,2),
ADD COLUMN "db_total_price" DECIMAL(15,2),
ADD COLUMN "margin_absolute" DECIMAL(12,2),
ADD COLUMN "margin_percent" DECIMAL(10,2);
