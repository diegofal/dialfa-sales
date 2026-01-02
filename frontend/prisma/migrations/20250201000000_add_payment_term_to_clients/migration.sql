-- AddPaymentTermToClients
-- Add payment_term_id column to clients table

ALTER TABLE "clients" ADD COLUMN "payment_term_id" INTEGER;

-- Add foreign key constraint
ALTER TABLE "clients" ADD CONSTRAINT "f_k_clients__payment_terms_payment_term_id" 
  FOREIGN KEY ("payment_term_id") REFERENCES "payment_terms"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Add index
CREATE INDEX "IX_clients_payment_term_id" ON "clients"("payment_term_id");
