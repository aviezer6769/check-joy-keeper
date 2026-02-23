
-- Create checks table for charity check tracking
CREATE TABLE public.checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payee TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  check_number TEXT,
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  charity TEXT,
  check_given BOOLEAN NOT NULL DEFAULT false,
  memo TEXT,
  payee_record_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS but allow all access (single user, no auth)
ALTER TABLE public.checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to checks"
  ON public.checks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_checks_updated_at
  BEFORE UPDATE ON public.checks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
