-- CreateTable
CREATE TABLE "stock_category_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "count" INTEGER NOT NULL,
    "total_value" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_category_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_category_snapshots_date_status_key" ON "stock_category_snapshots"("date", "status");

-- CreateIndex
CREATE INDEX "stock_category_snapshots_date_idx" ON "stock_category_snapshots"("date");
