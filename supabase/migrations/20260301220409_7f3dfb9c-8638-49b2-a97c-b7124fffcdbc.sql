
ALTER TABLE public.checks ADD COLUMN voided BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.checks ADD COLUMN original_amount NUMERIC;
