-- Container planner sourcing: where an article can be imported from, and
-- the country of each supplier (used to derive origin and to block origins
-- under anti-dumping).

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "import_origin" VARCHAR(20);

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN "country" VARCHAR(50);
