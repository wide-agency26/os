-- BD ↔ CRM: contact person link (company_id already exists)
ALTER TABLE public.bd_records
  ADD COLUMN IF NOT EXISTS contact_id UUID
    REFERENCES public.crm_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bd_records_contact_id_idx
  ON public.bd_records (contact_id);

COMMENT ON COLUMN public.bd_records.company_id IS
  'CRM company row (record_kind=company). Projects attach here.';
COMMENT ON COLUMN public.bd_records.contact_id IS
  'CRM contact person row (record_kind=contact) under company_id.';
