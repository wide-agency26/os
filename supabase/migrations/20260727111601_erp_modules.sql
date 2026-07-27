-- =====================================================================
-- WIDE OS Custom ERP Modules
-- Financials, Resources, Times
-- =====================================================================

-- =====================================================================
-- FINANCIALS: Invoices, Payments, Expenses
-- =====================================================================

-- erp_invoices
CREATE TABLE IF NOT EXISTS public.erp_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL UNIQUE,
    status TEXT CHECK (status IN ('Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled')) DEFAULT 'Draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    currency TEXT DEFAULT 'USD',
    subtotal NUMERIC(12, 2) DEFAULT 0.00,
    tax_total NUMERIC(12, 2) DEFAULT 0.00,
    grand_total NUMERIC(12, 2) DEFAULT 0.00,
    amount_paid NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- erp_invoice_line_items
CREATE TABLE IF NOT EXISTS public.erp_invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.erp_invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) DEFAULT 1.00,
    unit_price NUMERIC(12, 2) DEFAULT 0.00,
    total NUMERIC(12, 2) DEFAULT 0.00,
    sort_order INT DEFAULT 0
);

-- erp_payments
CREATE TABLE IF NOT EXISTS public.erp_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES public.erp_invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT CHECK (payment_method IN ('Bank Transfer', 'Credit Card', 'Cash', 'Other')),
    reference_number TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- erp_expenses
CREATE TABLE IF NOT EXISTS public.erp_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL, -- Optional: Tie expense to a specific client/workspace
    incurred_by UUID REFERENCES public.people(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT CHECK (category IN ('Software', 'Travel', 'Meals', 'Office Supplies', 'Marketing', 'Other')),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT,
    receipt_url TEXT,
    status TEXT CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Reimbursed')) DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- RESOURCES (HR): Leave Requests (builds on existing `people` table)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.erp_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
    leave_type TEXT CHECK (leave_type IN ('PTO', 'Sick', 'Maternity/Paternity', 'Unpaid', 'Other')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('Pending', 'Approved', 'Rejected')) DEFAULT 'Pending',
    approved_by UUID REFERENCES public.people(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- TIMES (Time Tracking & Tasks)
-- =====================================================================

-- erp_tasks
CREATE TABLE IF NOT EXISTS public.erp_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES public.people(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT CHECK (status IN ('Todo', 'In Progress', 'Review', 'Done')) DEFAULT 'Todo',
    due_date DATE,
    estimated_hours NUMERIC(6, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- erp_timesheets
CREATE TABLE IF NOT EXISTS public.erp_timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.erp_tasks(id) ON DELETE SET NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hours NUMERIC(6, 2) NOT NULL,
    is_billable BOOLEAN DEFAULT true,
    billing_rate NUMERIC(10, 2), -- Fetched from people.hourly_rate_cost at time of entry
    notes TEXT,
    status TEXT CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Billed')) DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =====================================================================
-- Triggers for updated_at
-- =====================================================================

CREATE OR REPLACE FUNCTION public.touch_erp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_erp_invoices_updated_at BEFORE UPDATE ON public.erp_invoices FOR EACH ROW EXECUTE FUNCTION public.touch_erp_updated_at();
CREATE TRIGGER trg_erp_expenses_updated_at BEFORE UPDATE ON public.erp_expenses FOR EACH ROW EXECUTE FUNCTION public.touch_erp_updated_at();
CREATE TRIGGER trg_erp_leave_requests_updated_at BEFORE UPDATE ON public.erp_leave_requests FOR EACH ROW EXECUTE FUNCTION public.touch_erp_updated_at();
CREATE TRIGGER trg_erp_tasks_updated_at BEFORE UPDATE ON public.erp_tasks FOR EACH ROW EXECUTE FUNCTION public.touch_erp_updated_at();
CREATE TRIGGER trg_erp_timesheets_updated_at BEFORE UPDATE ON public.erp_timesheets FOR EACH ROW EXECUTE FUNCTION public.touch_erp_updated_at();

-- =====================================================================
-- Row Level Security (RLS)
-- Superadmin gets ALL. Clients get read-only on their own invoices/tasks.
-- =====================================================================

ALTER TABLE public.erp_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_timesheets ENABLE ROW LEVEL SECURITY;

-- Superadmin Policies (Assuming public.is_superadmin() exists from migration 0007)
CREATE POLICY erp_invoices_founder_all ON public.erp_invoices FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_invoice_lines_founder_all ON public.erp_invoice_line_items FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_payments_founder_all ON public.erp_payments FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_expenses_founder_all ON public.erp_expenses FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_leave_requests_founder_all ON public.erp_leave_requests FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_tasks_founder_all ON public.erp_tasks FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
CREATE POLICY erp_timesheets_founder_all ON public.erp_timesheets FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- Client (Workspace) Policies - Clients can view invoices/tasks linked to their workspace profile
-- Note: Assuming clients authenticate and have a profile linked to `workspaces.client_profile_id`
-- Or we use workspace members (depending on exact client auth implementation in WIDE OS).
-- For now, relying on superadmin for full control. Client RLS can be tuned based on exact client portal auth mechanism.
