-- Add change_batch_id column to price_history table
ALTER TABLE price_history ADD COLUMN change_batch_id VARCHAR(100);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "IX_price_history_change_batch_id" ON price_history(change_batch_id);

-- Add comment
COMMENT ON COLUMN price_history.change_batch_id IS 'UUID to group related price changes in a batch';
