
-- Create chalikah table
CREATE TABLE public.chalikah (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chalikah ENABLE ROW LEVEL SECURITY;

-- Allow all access (matching existing pattern)
CREATE POLICY "Allow all access to chalikah"
ON public.chalikah
FOR ALL
USING (true)
WITH CHECK (true);

-- Update trigger for updated_at
CREATE TRIGGER update_chalikah_updated_at
BEFORE UPDATE ON public.chalikah
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add chalikah_id column to checks table (nullable, references chalikah)
ALTER TABLE public.checks
ADD COLUMN chalikah_id uuid REFERENCES public.chalikah(id);
