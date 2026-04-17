-- CreateTable: monthly_costs for storing imported financial data from Excel sources
CREATE TABLE "monthly_costs" (
    "id" BIGSERIAL NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "amount_ars" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount_usd" DECIMAL(18,2),
    "exchange_rate" DECIMAL(10,4),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" INTEGER,

    CONSTRAINT "monthly_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_monthly_costs_unique" ON "monthly_costs"("year_month", "source", "category");

-- CreateIndex
CREATE INDEX "idx_monthly_costs_month" ON "monthly_costs"("year_month");
