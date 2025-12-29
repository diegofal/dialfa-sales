-- CreateTable (with IF NOT EXISTS for idempotency)
CREATE TABLE IF NOT EXISTS "certificates" (
    "id" BIGSERIAL NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "original_path" TEXT,
    "file_type" TEXT NOT NULL,
    "file_size_bytes" BIGINT,
    "category" TEXT,
    "notes" TEXT,
    "extracted_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),
    "created_by" INTEGER,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "coladas" (
    "id" BIGSERIAL NOT NULL,
    "colada_number" TEXT NOT NULL,
    "description" TEXT,
    "supplier" TEXT,
    "material_type" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coladas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "certificate_coladas" (
    "id" BIGSERIAL NOT NULL,
    "certificate_id" BIGINT NOT NULL,
    "colada_id" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_coladas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'certificates_storage_path_key') THEN
        CREATE UNIQUE INDEX "certificates_storage_path_key" ON "certificates"("storage_path");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'certificates_category_idx') THEN
        CREATE INDEX "certificates_category_idx" ON "certificates"("category");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'certificates_created_at_idx') THEN
        CREATE INDEX "certificates_created_at_idx" ON "certificates"("created_at");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'coladas_colada_number_key') THEN
        CREATE UNIQUE INDEX "coladas_colada_number_key" ON "coladas"("colada_number");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'coladas_colada_number_idx') THEN
        CREATE INDEX "coladas_colada_number_idx" ON "coladas"("colada_number");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'certificate_coladas_certificate_id_colada_id_key') THEN
        CREATE UNIQUE INDEX "certificate_coladas_certificate_id_colada_id_key" ON "certificate_coladas"("certificate_id", "colada_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'certificate_coladas_certificate_id_idx') THEN
        CREATE INDEX "certificate_coladas_certificate_id_idx" ON "certificate_coladas"("certificate_id");
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'certificate_coladas_colada_id_idx') THEN
        CREATE INDEX "certificate_coladas_colada_id_idx" ON "certificate_coladas"("colada_id");
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_coladas_certificate_id_fkey'
    ) THEN
        ALTER TABLE "certificate_coladas" ADD CONSTRAINT "certificate_coladas_certificate_id_fkey" 
        FOREIGN KEY ("certificate_id") REFERENCES "certificates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'certificate_coladas_colada_id_fkey'
    ) THEN
        ALTER TABLE "certificate_coladas" ADD CONSTRAINT "certificate_coladas_colada_id_fkey" 
        FOREIGN KEY ("colada_id") REFERENCES "coladas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;







