-- Add parent_id column to certificates for parent-child relationships
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "parent_id" BIGINT;

-- Add foreign key constraint
ALTER TABLE "certificates" ADD CONSTRAINT "fk_certificates_parent"
  FOREIGN KEY ("parent_id") REFERENCES "certificates"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add index for parent_id lookups
CREATE INDEX IF NOT EXISTS "IX_certificates_parent_id" ON "certificates"("parent_id");
