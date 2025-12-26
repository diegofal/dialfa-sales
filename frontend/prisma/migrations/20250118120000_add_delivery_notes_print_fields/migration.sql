-- Add is_printed and printed_at fields to delivery_notes table
ALTER TABLE delivery_notes 
ADD COLUMN is_printed BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN printed_at TIMESTAMPTZ(6) NULL;






