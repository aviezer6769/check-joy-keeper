
CREATE TABLE public.saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  report_type text NOT NULL DEFAULT 'payee_chalikah',
  filters jsonb DEFAULT '{}'::jsonb,
  report_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to saved_reports" ON public.saved_reports
  FOR ALL TO public
  USING (true)
  WITH CHECK (true);
