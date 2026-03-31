-- CreateTable sync_customers
CREATE TABLE "sync_customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(500) NOT NULL,
    "type" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_customers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sync_customers_name_idx" ON "sync_customers"("name");

-- CreateTable sync_transactions
CREATE TABLE "sync_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "row_num" INTEGER NOT NULL,
    "invoice_number" VARCHAR(100),
    "invoice_date" TIMESTAMPTZ(6),
    "invoice_amount" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_receipt" VARCHAR(200),
    "payment_bank" VARCHAR(200),
    "payment_date" TIMESTAMPTZ(6),
    "payment_amount" DOUBLE PRECISION,
    "type" INTEGER NOT NULL,
    "customer_id" UUID NOT NULL,
    CONSTRAINT "sync_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sync_transactions_customer_id_idx" ON "sync_transactions"("customer_id");
ALTER TABLE "sync_transactions" ADD CONSTRAINT "sync_transactions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "sync_customers"("id") ON DELETE CASCADE;

-- CreateTable sync_balances
CREATE TABLE "sync_balances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "amount" DOUBLE PRECISION NOT NULL,
    "due" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "customer_id" UUID NOT NULL,
    CONSTRAINT "sync_balances_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sync_balances_customer_id_idx" ON "sync_balances"("customer_id");
ALTER TABLE "sync_balances" ADD CONSTRAINT "sync_balances_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "sync_customers"("id") ON DELETE CASCADE;

-- CreateTable sync_errors
CREATE TABLE "sync_errors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "row_num" INTEGER NOT NULL DEFAULT 0,
    "file_name" VARCHAR(500) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "stack_trace" TEXT,
    "customer_id" UUID,
    CONSTRAINT "sync_errors_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sync_errors_customer_id_idx" ON "sync_errors"("customer_id");
ALTER TABLE "sync_errors" ADD CONSTRAINT "sync_errors_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "sync_customers"("id") ON DELETE SET NULL;

-- CreateTable sync_runs
CREATE TABLE "sync_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "duration_ms" DOUBLE PRECISION NOT NULL,
    "has_error" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);
