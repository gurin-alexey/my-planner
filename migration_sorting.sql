-- Add order_index column to folders and lists for manual sorting
ALTER TABLE folders ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
