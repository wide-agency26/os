CREATE TABLE public.brand_books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    client_slug TEXT NOT NULL UNIQUE,
    figma_file_url TEXT NOT NULL,
    figma_access_token TEXT NOT NULL,
    portal_password TEXT NOT NULL,
    
    -- Stores parsed text data from Figma template
    strategy_data JSONB DEFAULT '{
        "brand_name": null,
        "mission": null,
        "vision": null,
        "manifesto": null,
        "problem_solution": null,
        "value_definition": null,
        "target_group": null
    }'::jsonb,
    
    -- Controls public-facing visibility (Admin toggles)
    visibility_settings JSONB DEFAULT '{
        "show_brand_name": true,
        "show_mission": true,
        "show_vision": true,
        "show_manifesto": true,
        "show_problem_solution": true,
        "show_value_definition": true,
        "show_target_group": true
    }'::jsonb,
    
    token_colors JSONB DEFAULT '[]'::jsonb,
    token_typography JSONB DEFAULT '[]'::jsonb,
    assets_logos JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS on brand_books
ALTER TABLE public.brand_books ENABLE ROW LEVEL SECURITY;

-- Allow all read/write access for authenticated WIDE OS admin users (assuming existing auth logic protects these, but we can set basic policies)
-- For the sake of this migration, we'll allow anon read if password matches (handled in application), but RLS policies should allow read/write for auth users.
CREATE POLICY "Enable read access for all users" ON public.brand_books FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.brand_books FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable update for authenticated users only" ON public.brand_books FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for authenticated users only" ON public.brand_books FOR DELETE TO authenticated USING (true);

-- Create brand-assets storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for brand-assets
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'brand-assets');
CREATE POLICY "Authenticated users can upload assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-assets');
CREATE POLICY "Authenticated users can update assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'brand-assets');
CREATE POLICY "Authenticated users can delete assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'brand-assets');
