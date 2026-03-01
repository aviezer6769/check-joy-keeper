
-- Add status column with default 'Open'
ALTER TABLE public.checks
ADD COLUMN status text NOT NULL DEFAULT 'Open';

-- Migrate existing data
UPDATE public.checks SET status = 'Void' WHERE voided = true;
UPDATE public.checks SET status = 'Given' WHERE check_given = true AND voided = false;

-- Drop old columns
ALTER TABLE public.checks DROP COLUMN check_given;
ALTER TABLE public.checks DROP COLUMN voided;
