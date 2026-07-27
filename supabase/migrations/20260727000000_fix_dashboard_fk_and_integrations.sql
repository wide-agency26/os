-- Migration: Fix FK constraints for workspace IDs & add client_integrations table

-- 1. Drop foreign key constraints on client_id to allow both workspace UUIDs and profile UUIDs
ALTER TABLE IF EXISTS dashboard_layouts DROP CONSTRAINT IF EXISTS dashboard_layouts_client_id_fkey;
ALTER TABLE IF EXISTS marketing_daily_snapshots DROP CONSTRAINT IF EXISTS marketing_daily_snapshots_client_id_fkey;

-- 2. Create table for client data source integrations
CREATE TABLE IF NOT EXISTS client_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id text NOT NULL,
    provider text NOT NULL, -- 'meta_instagram', 'ga4', 'gsc', 'linkedin', 'youtube'
    credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_connected boolean NOT NULL DEFAULT false,
    last_synced_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(client_id, provider)
);

-- RLS for client_integrations
ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founders can manage all integrations"
ON client_integrations
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'manager', 'client_manager')
    )
);

CREATE POLICY "Clients can view their own integrations"
ON client_integrations
FOR SELECT
TO authenticated
USING (
    client_id = auth.uid()::text
);
