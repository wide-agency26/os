import { Workspace, Section, ShortcutCard } from "@/components/frappe-ui/Workspace";
import { FileText, Users, Briefcase } from "lucide-react";

export default function HomeWorkspace() {
  return (
    <Workspace>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to WIDE OS</h2>
        <p className="text-gray-500 mt-1">Your central operating system.</p>
      </div>

      <Section title="Your Shortcuts">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          <ShortcutCard title="Accounting" icon={FileText} href="/app/accounting" />
          <ShortcutCard title="HR" icon={Users} href="/app/hr" />
          <ShortcutCard title="Projects" icon={Briefcase} href="/app/projects" />
        </div>
      </Section>
    </Workspace>
  );
}
