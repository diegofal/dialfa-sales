-- CreateTable
CREATE TABLE "stock_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "stock_value" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_snapshots_date_idx" ON "stock_snapshots"("date");
