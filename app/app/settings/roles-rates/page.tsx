import { Workspace } from "@/components/frappe-ui/Workspace";

export default function RolesRatesStubPage() {
  return (
    <Workspace>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Roles & Rates</h1>
      <p className="text-sm text-gray-500 mb-4">
        Placeholder for HR / rate-card integration. Stub rates already live in{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">pm_role_rates</code> and
        feed the Cost Center.
      </p>
      <div className="border border-dashed border-gray-300 rounded-lg px-4 py-8 text-sm text-gray-500">
        Coming soon — wire person-level rates here without rearchitecting Cost Center.
      </div>
    </Workspace>
  );
}
