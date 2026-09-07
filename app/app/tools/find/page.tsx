import { Workspace } from "@/components/frappe-ui/Workspace";
import { OpportunityFinderClient } from "@/components/bd/OpportunityFinderClient";
import { requireStaffPage } from "@/lib/auth/staff-session";

export const dynamic = "force-dynamic";

export default async function DealFinderPage() {
  const session = await requireStaffPage();
  if (!session.isStaff) {
    return (
      <Workspace>
        <p className="text-red-600 font-medium">Access denied.</p>
      </Workspace>
    );
  }

  return (
    <Workspace wide>
      <OpportunityFinderClient />
    </Workspace>
  );
}
