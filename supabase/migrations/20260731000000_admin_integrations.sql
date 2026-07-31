-- Migration: Create admin_integrations table for internal workspace integrations (e.g., Google Workspace)

CREATE TABLE IF NOT EXISTS admin_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider text NOT NULL, -- e.g., 'google_workspace'
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamptz,
    scope text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(profile_id, provider)
);

-- RLS for admin_integrations
ALTER TABLE admin_integrations ENABLE ROW LEVEL SECURITY;

-- Admins and founders can manage their own integrations
CREATE POLICY "Admins can manage their own integrations"
ON admin_integrations
FOR ALL
TO authenticated
USING (
    profile_id = auth.uid()
);

-- Note: We might want all admins to see the active status of integrations, 
-- but only the owner can modify them. Let's allow admins to read all admin_integrations.
CREATE POLICY "Admins can view all admin integrations"
ON admin_integrations
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'superadmin', 'founder') -- Assumed roles for internal admins
    )
);
