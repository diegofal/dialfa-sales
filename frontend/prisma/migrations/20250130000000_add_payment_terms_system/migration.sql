-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_terms" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "days" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "PK_payment_terms" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "category_payment_discounts" (
    "id" BIGSERIAL NOT NULL,
    "category_id" BIGINT NOT NULL,
    "payment_term_id" INTEGER NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_category_payment_discounts" PRIMARY KEY ("id")
);

-- AlterTable invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "payment_term_id" INTEGER;

-- AlterTable sales_orders
ALTER TABLE "sales_orders" ADD COLUMN IF NOT EXISTS "payment_term_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_terms_code_key" ON "payment_terms"("code");
CREATE INDEX IF NOT EXISTS "IX_payment_terms_code" ON "payment_terms"("code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_category_payment_discounts" ON "category_payment_discounts"("category_id", "payment_term_id");
CREATE INDEX IF NOT EXISTS "IX_category_payment_discounts_category_id" ON "category_payment_discounts"("category_id");
CREATE INDEX IF NOT EXISTS "IX_category_payment_discounts_payment_term_id" ON "category_payment_discounts"("payment_term_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_invoices_payment_term_id" ON "invoices"("payment_term_id");
CREATE INDEX IF NOT EXISTS "IX_sales_orders_payment_term_id" ON "sales_orders"("payment_term_id");

-- AddForeignKey
ALTER TABLE "category_payment_discounts" ADD CONSTRAINT "f_k_category_payment_discounts__categories_category_id" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "category_payment_discounts" ADD CONSTRAINT "f_k_category_payment_discounts__payment_terms_payment_term_id" FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "f_k_invoices__payment_terms_payment_term_id" FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "f_k_sales_orders__payment_terms_payment_term_id" FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Insert default payment term (Contado)
INSERT INTO "payment_terms" ("code", "name", "days", "is_active", "created_at", "updated_at")
VALUES ('CONTADO', 'Contado', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;

