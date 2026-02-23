
CREATE TABLE public.payees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id TEXT,
  sort_order INTEGER DEFAULT 0,
  urgent_level INTEGER DEFAULT 0,
  title_1_yiddish TEXT,
  first_name_yiddish TEXT,
  middle_name_yiddish TEXT,
  last_name_yiddish TEXT,
  title_2_yiddish TEXT,
  title TEXT,
  title_to_use TEXT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  street_no TEXT,
  street_name TEXT,
  apt TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  payee_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to payees"
ON public.payees
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_payees_updated_at
BEFORE UPDATE ON public.payees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
