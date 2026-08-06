import { Workspace } from "@/components/frappe-ui/Workspace";
import { PM_ICONS } from "@/lib/pm/icons";

export default function IntegrationsStubPage() {
  const Icon = PM_ICONS.fromEmail;
  return (
    <Workspace>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
        <Icon className="w-6 h-6" />
        Integrations
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        Per-project inbound email aliases for email→task proposals. Nothing lands on a
        board without the review queue.
      </p>
      <div className="border border-dashed border-gray-300 rounded-lg px-4 py-8 text-sm text-gray-500">
        Configure forwarding addresses here (stores on{" "}
        <code className="text-xs bg-gray-100 px-1 rounded">projects.pm_inbound_email</code>
        ). Parser + review queue UI ships in a later phase.
      </div>
    </Workspace>
  );
}
