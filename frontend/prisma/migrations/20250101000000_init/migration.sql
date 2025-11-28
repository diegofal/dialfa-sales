-- CreateTable
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" VARCHAR(150) NOT NULL,
    "ProductVersion" VARCHAR(32) NOT NULL,

    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "account_movements" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "movement_type" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "payment_method_id" INTEGER,
    "movement_date" TIMESTAMPTZ(6) NOT NULL,
    "reference_document" TEXT,
    "check_number" TEXT,
    "check_due_date" TIMESTAMPTZ(6),
    "bank_name" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "PK_account_movements" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "articles" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "category_id" BIGINT NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "stock" DECIMAL(12,3) NOT NULL,
    "minimum_stock" DECIMAL(12,3) NOT NULL,
    "location" VARCHAR(200),
    "is_discontinued" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "cost_price" DECIMAL(18,4),
    "display_order" VARCHAR(20),
    "historical_price1" DECIMAL(18,2),
    "series" INTEGER,
    "size" VARCHAR(100),
    "supplier_id" INTEGER,
    "thickness" VARCHAR(100),
    "type" VARCHAR(500),
    "weight_kg" DECIMAL(18,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PK_articles" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "categories" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "default_discount_percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_categories" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "client_discounts" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "discount_percent" DECIMAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_client_discounts" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "clients" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "cuit" VARCHAR(11),
    "tax_condition_id" INTEGER NOT NULL,
    "address" VARCHAR(200),
    "city" VARCHAR(100),
    "postal_code" VARCHAR(10),
    "province_id" INTEGER,
    "phone" VARCHAR(50),
    "email" VARCHAR(100),
    "operation_type_id" INTEGER NOT NULL,
    "transporter_id" INTEGER,
    "credit_limit" DECIMAL(18,2),
    "current_balance" DECIMAL(18,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "seller_id" INTEGER,

    CONSTRAINT "PK_clients" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_notes" (
    "id" BIGSERIAL NOT NULL,
    "delivery_number" TEXT NOT NULL,
    "sales_order_id" BIGINT NOT NULL,
    "delivery_date" TIMESTAMPTZ(6) NOT NULL,
    "transporter_id" INTEGER,
    "weight_kg" DECIMAL,
    "packages_count" INTEGER,
    "declared_value" DECIMAL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "PK_delivery_notes" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoices" (
    "id" BIGSERIAL NOT NULL,
    "invoice_number" VARCHAR(20) NOT NULL,
    "sales_order_id" BIGINT NOT NULL,
    "invoice_date" TIMESTAMPTZ(6) NOT NULL,
    "net_amount" DECIMAL(18,4) NOT NULL,
    "tax_amount" DECIMAL(18,4) NOT NULL,
    "total_amount" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "is_cancelled" BOOLEAN NOT NULL DEFAULT false,
    "is_printed" BOOLEAN NOT NULL DEFAULT false,
    "printed_at" TIMESTAMPTZ(6),
    "usd_exchange_rate" DECIMAL(10,4),
    "is_credit_note" BOOLEAN NOT NULL DEFAULT false,
    "is_quotation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PK_invoices" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "delivery_note_items" (
    "id" BIGSERIAL NOT NULL,
    "delivery_note_id" BIGINT NOT NULL,
    "sales_order_item_id" BIGINT,
    "article_id" BIGINT NOT NULL,
    "article_code" VARCHAR(50) NOT NULL,
    "article_description" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_delivery_note_items" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invoice_items" (
    "id" BIGSERIAL NOT NULL,
    "invoice_id" BIGINT NOT NULL,
    "sales_order_item_id" BIGINT,
    "article_id" BIGINT NOT NULL,
    "article_code" VARCHAR(50) NOT NULL,
    "article_description" VARCHAR(500) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_usd" DECIMAL(18,4) NOT NULL,
    "unit_price_ars" DECIMAL(18,4) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_invoice_items" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "operation_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_operation_types" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_methods" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "requires_check_data" BOOLEAN NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_payment_methods" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "provinces" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_provinces" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_order_items" (
    "id" BIGSERIAL NOT NULL,
    "sales_order_id" BIGINT NOT NULL,
    "article_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "line_total" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_sales_order_items" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sales_orders" (
    "id" BIGSERIAL NOT NULL,
    "client_id" BIGINT NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "order_date" TIMESTAMPTZ(6) NOT NULL,
    "delivery_date" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL,
    "total" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,
    "special_discount_percent" DECIMAL NOT NULL DEFAULT 0.0,

    CONSTRAINT "PK_sales_orders" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "article_id" BIGINT NOT NULL,
    "movement_type" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference_document" TEXT,
    "movement_date" TIMESTAMPTZ(6) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,
    "updated_by" INTEGER,

    CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tax_conditions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_tax_conditions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "transporters" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "PK_transporters" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PK_users" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "system_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "usd_exchange_rate" DECIMAL(10,4) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_account_movements_client_id" ON "account_movements"("client_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_account_movements_payment_method_id" ON "account_movements"("payment_method_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_client_discounts_category_id" ON "client_discounts"("category_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_client_discounts_client_id" ON "client_discounts"("client_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_clients_operation_type_id" ON "clients"("operation_type_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_clients_province_id" ON "clients"("province_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_clients_tax_condition_id" ON "clients"("tax_condition_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_clients_transporter_id" ON "clients"("transporter_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_delivery_notes_sales_order_id" ON "delivery_notes"("sales_order_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_delivery_notes_transporter_id" ON "delivery_notes"("transporter_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_delivery_note_items_delivery_note_id" ON "delivery_note_items"("delivery_note_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_delivery_note_items_article_id" ON "delivery_note_items"("article_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_delivery_note_items_sales_order_item_id" ON "delivery_note_items"("sales_order_item_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_invoice_items_invoice_id" ON "invoice_items"("invoice_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_invoice_items_article_id" ON "invoice_items"("article_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ix_invoice_items_sales_order_item_id" ON "invoice_items"("sales_order_item_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_sales_order_items_article_id" ON "sales_order_items"("article_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_sales_order_items_sales_order_id_article_id" ON "sales_order_items"("sales_order_id", "article_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IX_sales_orders_order_number" ON "sales_orders"("order_number");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_sales_orders_client_id" ON "sales_orders"("client_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IX_stock_movements_article_id" ON "stock_movements"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IX_users_username" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IX_users_email" ON "users"("email");

-- AddForeignKey (only if they don't already exist, idempotent)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_account_movements__clients_client_id'
    ) THEN
        ALTER TABLE "account_movements" ADD CONSTRAINT "f_k_account_movements__clients_client_id" 
        FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_account_movements__payment_methods_payment_method_id'
    ) THEN
        ALTER TABLE "account_movements" ADD CONSTRAINT "f_k_account_movements__payment_methods_payment_method_id" 
        FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_articles__categories_category_id'
    ) THEN
        ALTER TABLE "articles" ADD CONSTRAINT "f_k_articles__categories_category_id" 
        FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_client_discounts_categories_category_id'
    ) THEN
        ALTER TABLE "client_discounts" ADD CONSTRAINT "f_k_client_discounts_categories_category_id" 
        FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_client_discounts_clients_client_id'
    ) THEN
        ALTER TABLE "client_discounts" ADD CONSTRAINT "f_k_client_discounts_clients_client_id" 
        FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_clients__operation_types_operation_type_id'
    ) THEN
        ALTER TABLE "clients" ADD CONSTRAINT "f_k_clients__operation_types_operation_type_id" 
        FOREIGN KEY ("operation_type_id") REFERENCES "operation_types"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_clients__provinces_province_id'
    ) THEN
        ALTER TABLE "clients" ADD CONSTRAINT "f_k_clients__provinces_province_id" 
        FOREIGN KEY ("province_id") REFERENCES "provinces"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_clients__tax_conditions_tax_condition_id'
    ) THEN
        ALTER TABLE "clients" ADD CONSTRAINT "f_k_clients__tax_conditions_tax_condition_id" 
        FOREIGN KEY ("tax_condition_id") REFERENCES "tax_conditions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_clients__transporters_transporter_id'
    ) THEN
        ALTER TABLE "clients" ADD CONSTRAINT "f_k_clients__transporters_transporter_id" 
        FOREIGN KEY ("transporter_id") REFERENCES "transporters"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_delivery_notes__sales_orders_sales_order_id'
    ) THEN
        ALTER TABLE "delivery_notes" ADD CONSTRAINT "f_k_delivery_notes__sales_orders_sales_order_id" 
        FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_delivery_notes__transporters_transporter_id'
    ) THEN
        ALTER TABLE "delivery_notes" ADD CONSTRAINT "f_k_delivery_notes__transporters_transporter_id" 
        FOREIGN KEY ("transporter_id") REFERENCES "transporters"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_invoices__sales_orders_sales_order_id'
    ) THEN
        ALTER TABLE "invoices" ADD CONSTRAINT "f_k_invoices__sales_orders_sales_order_id" 
        FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_delivery_note_items__delivery_notes_delivery_note_id'
    ) THEN
        ALTER TABLE "delivery_note_items" ADD CONSTRAINT "f_k_delivery_note_items__delivery_notes_delivery_note_id" 
        FOREIGN KEY ("delivery_note_id") REFERENCES "delivery_notes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_delivery_note_items__articles_article_id'
    ) THEN
        ALTER TABLE "delivery_note_items" ADD CONSTRAINT "f_k_delivery_note_items__articles_article_id" 
        FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_invoice_items__invoices_invoice_id'
    ) THEN
        ALTER TABLE "invoice_items" ADD CONSTRAINT "f_k_invoice_items__invoices_invoice_id" 
        FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_invoice_items__articles_article_id'
    ) THEN
        ALTER TABLE "invoice_items" ADD CONSTRAINT "f_k_invoice_items__articles_article_id" 
        FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_sales_order_items_articles_article_id'
    ) THEN
        ALTER TABLE "sales_order_items" ADD CONSTRAINT "f_k_sales_order_items_articles_article_id" 
        FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_sales_order_items_sales_orders_sales_order_id'
    ) THEN
        ALTER TABLE "sales_order_items" ADD CONSTRAINT "f_k_sales_order_items_sales_orders_sales_order_id" 
        FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_sales_orders_clients_client_id'
    ) THEN
        ALTER TABLE "sales_orders" ADD CONSTRAINT "f_k_sales_orders_clients_client_id" 
        FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'f_k_stock_movements_articles_article_id'
    ) THEN
        ALTER TABLE "stock_movements" ADD CONSTRAINT "f_k_stock_movements_articles_article_id" 
        FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    END IF;
END $$;

-- Insert default system_settings if not exists
INSERT INTO "system_settings" ("id", "usd_exchange_rate", "updated_at")
VALUES (1, 1000.0000, NOW())
ON CONFLICT ("id") DO NOTHING;
