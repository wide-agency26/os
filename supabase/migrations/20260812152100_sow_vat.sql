-- SOW: editable VAT / total line on client preview
ALTER TABLE public.sows
  ADD COLUMN IF NOT EXISTS vat JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "rate": 19,
    "wording": "{{subtotal}} +{{rate}}% VAT = {{total}}"
  }'::jsonb;

NOTIFY pgrst, 'reload schema';
