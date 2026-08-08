-- Company (1) → Client/contact (many) on crm_customers (additive).
-- projects.client_id stays FK → crm_customers; prefer pointing at company rows.

ALTER TABLE public.crm_customers
  ADD COLUMN IF NOT EXISTS record_kind text;

ALTER TABLE public.crm_customers
  DROP CONSTRAINT IF EXISTS crm_customers_record_kind_check;
ALTER TABLE public.crm_customers
  ADD CONSTRAINT crm_customers_record_kind_check
  CHECK (record_kind IS NULL OR record_kind IN ('company', 'contact'));

ALTER TABLE public.crm_customers
  ADD COLUMN IF NOT EXISTS parent_company_id uuid
    REFERENCES public.crm_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS crm_customers_parent_company_idx
  ON public.crm_customers (parent_company_id);
CREATE INDEX IF NOT EXISTS crm_customers_record_kind_idx
  ON public.crm_customers (record_kind);

COMMENT ON COLUMN public.crm_customers.record_kind IS
  'company = account org; contact = person under a company (or standalone).';
COMMENT ON COLUMN public.crm_customers.parent_company_id IS
  'For contacts: the parent company crm_customers row.';

UPDATE public.crm_customers
SET record_kind = 'contact'
WHERE record_kind IS NULL;

-- role must satisfy crm_customers_role_check (Decision Maker | Connection | Team Member | Freelancer)
INSERT INTO public.crm_customers (
  name, company, status, lead_status, record_kind, source_category, role
)
SELECT DISTINCT
  trim(c.company) AS name,
  trim(c.company) AS company,
  'Client' AS status,
  'Won' AS lead_status,
  'company' AS record_kind,
  'Activation' AS source_category,
  'Decision Maker' AS role
FROM public.crm_customers c
WHERE c.company IS NOT NULL
  AND trim(c.company) <> ''
  AND coalesce(c.record_kind, 'contact') = 'contact'
  AND NOT EXISTS (
    SELECT 1
    FROM public.crm_customers existing
    WHERE existing.record_kind = 'company'
      AND lower(trim(existing.company)) = lower(trim(c.company))
  );

UPDATE public.crm_customers contact
SET parent_company_id = company.id
FROM public.crm_customers company
WHERE contact.record_kind = 'contact'
  AND contact.parent_company_id IS NULL
  AND contact.company IS NOT NULL
  AND trim(contact.company) <> ''
  AND company.record_kind = 'company'
  AND lower(trim(company.company)) = lower(trim(contact.company));

UPDATE public.projects p
SET client_id = company.id
FROM public.crm_customers contact
JOIN public.crm_customers company
  ON company.id = contact.parent_company_id
 AND company.record_kind = 'company'
WHERE p.client_id = contact.id
  AND contact.record_kind = 'contact';

UPDATE public.ledger_entries le
SET company_id = p.client_id,
    client_id = COALESCE(le.client_id, p.client_id)
FROM public.projects p
WHERE le.project_id = p.id
  AND p.client_id IS NOT NULL;

ALTER TABLE public.crm_customers
  ALTER COLUMN record_kind SET DEFAULT 'contact';

UPDATE public.crm_customers SET record_kind = 'contact' WHERE record_kind IS NULL;
ALTER TABLE public.crm_customers ALTER COLUMN record_kind SET NOT NULL;
