CREATE TABLE IF NOT EXISTS public.project_template_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.project_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    weight NUMERIC(5, 2) DEFAULT 0.00,
    expected_time NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS
ALTER TABLE public.project_template_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for authenticated users on project_template_tasks" 
ON public.project_template_tasks FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Fix project_templates RLS as well just to be sure it's accessible
ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users on project_templates" ON public.project_templates;
CREATE POLICY "Enable all access for authenticated users on project_templates" 
ON public.project_templates FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
