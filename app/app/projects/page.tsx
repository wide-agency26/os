import { Workspace, Section, ShortcutCard, MasterList } from "@/components/frappe-ui/Workspace";
import { Briefcase, Clock, Calendar, CheckSquare } from "lucide-react";

export default function ProjectsWorkspace() {
  return (
    <Workspace>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <p className="text-gray-500 mt-1">Manage projects, tasks, and timesheets.</p>
      </div>

      <Section title="Your Shortcuts">
        <ShortcutCard title="Projects" icon={Briefcase} href="/app/projects/list" count={12} />
        <ShortcutCard title="Tasks" icon={CheckSquare} href="/app/projects/task" count={45} />
        <ShortcutCard title="Timesheets" icon={Clock} href="/app/projects/timesheet" />
      </Section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 border-t border-gray-100 pt-8">
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Time Tracking</h4>
          <MasterList items={[
            { label: "Timesheet", href: "/app/projects/timesheet" },
            { label: "Activity Type", href: "/app/projects/activity-type" },
          ]} />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Projects</h4>
          <MasterList items={[
            { label: "Project", href: "/app/projects/list" },
            { label: "Task", href: "/app/projects/task" },
            { label: "Project Type", href: "/app/projects/project-type" },
          ]} />
        </div>
      </div>
    </Workspace>
  );
}
