-- 20260726230000_dashboard_snapshots.sql

CREATE TABLE marketing_daily_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    log_date date NOT NULL,
    source text NOT NULL, -- e.g., 'meta', 'ga4', 'gsc', 'linkedin'
    impressions numeric DEFAULT 0,
    clicks numeric DEFAULT 0,
    cost numeric DEFAULT 0,
    sessions numeric DEFAULT 0,
    users numeric DEFAULT 0,
    conversions numeric DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id, log_date, source)
);

CREATE TABLE dashboard_layouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    layout_config jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(client_id)
);

-- RLS for marketing_daily_snapshots
ALTER TABLE marketing_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage all marketing snapshots"
ON marketing_daily_snapshots
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'manager')
    )
);

CREATE POLICY "Clients can read their own marketing snapshots"
ON marketing_daily_snapshots
FOR SELECT
TO authenticated
USING (
    auth.uid() = client_id
);

-- RLS for dashboard_layouts
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage all dashboard layouts"
ON dashboard_layouts
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'manager')
    )
);

CREATE POLICY "Clients can read their own dashboard layouts"
ON dashboard_layouts
FOR SELECT
TO authenticated
USING (
    auth.uid() = client_id
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column_marketing_daily_snapshots()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_marketing_daily_snapshots_modtime
BEFORE UPDATE ON marketing_daily_snapshots
FOR EACH ROW
EXECUTE FUNCTION update_modified_column_marketing_daily_snapshots();

CREATE OR REPLACE FUNCTION update_modified_column_dashboard_layouts()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboard_layouts_modtime
BEFORE UPDATE ON dashboard_layouts
FOR EACH ROW
EXECUTE FUNCTION update_modified_column_dashboard_layouts();
