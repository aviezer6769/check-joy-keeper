
-- Create accounts table
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  routing_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to accounts"
  ON public.accounts FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add account_id to checks (nullable initially so existing data isn't broken)
ALTER TABLE public.checks ADD COLUMN account_id UUID REFERENCES public.accounts(id);

-- Create index for faster lookups
CREATE INDEX idx_checks_account_id ON public.checks(account_id);

-- Insert two default accounts
INSERT INTO public.accounts (account_name) VALUES ('Account 1'), ('Account 2');

-- Update trigger for accounts
CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
