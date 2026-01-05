-- CreateTable
CREATE TABLE "price_import_drafts" (
    "id" BIGSERIAL NOT NULL PRIMARY KEY,
    "user_id" INT NOT NULL,
    "draft_data" JSONB NOT NULL,
    "article_count" INT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_price_import_drafts_user_id" ON "price_import_drafts"("user_id");

-- AddComment
COMMENT ON TABLE "price_import_drafts" IS 'Almacena borradores temporales de importaciones de precios desde CSV';
COMMENT ON COLUMN "price_import_drafts"."draft_data" IS 'JSON con estructura: { "articleId": newPrice }';
COMMENT ON COLUMN "price_import_drafts"."article_count" IS 'Número de artículos en el borrador para queries rápidas';
