-- CreateTable
CREATE TABLE "article_status_snapshots" (
    "id" BIGSERIAL NOT NULL,
    "date" TIMESTAMPTZ(6) NOT NULL,
    "article_id" BIGINT NOT NULL,
    "article_code" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_status_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "article_status_snapshots_date_article_id_key" ON "article_status_snapshots"("date", "article_id");

-- CreateIndex
CREATE INDEX "article_status_snapshots_date_status_idx" ON "article_status_snapshots"("date", "status");

-- CreateIndex
CREATE INDEX "article_status_snapshots_date_idx" ON "article_status_snapshots"("date");
