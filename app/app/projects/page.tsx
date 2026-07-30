import { Workspace, MasterList } from "@/components/frappe-ui/Workspace";
import { ProjectWorkspaceDashboard } from "./ProjectWorkspaceDashboard";

export default function ProjectsWorkspace() {
  return (
    <Workspace>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <p className="text-gray-500 mt-1">Track work, manage tasks, and log time.</p>
      </div>

      {/* KPI Dashboard */}
      <ProjectWorkspaceDashboard />

      {/* Master Lists */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mt-12 border-t border-gray-100 pt-8">
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Projects</h4>
          <MasterList items={[
            { label: "Project", href: "/app/projects/project" },
            { label: "Project Type", href: "/app/projects/project-type" },
            { label: "Project Template", href: "/app/projects/project-template" },
            { label: "Project Update", href: "/app/projects/project-update" },
          ]} />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Time Tracking</h4>
          <MasterList items={[
            { label: "Task", href: "/app/projects/task" },
            { label: "Task Type", href: "/app/projects/task-type" },
            { label: "Timesheet", href: "/app/projects/timesheet" },
            { label: "Activity Type", href: "/app/projects/activity-type" },
            { label: "Activity Cost", href: "/app/projects/activity-cost" },
          ]} />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Reports</h4>
          <MasterList items={[
            { label: "Project Profitability", href: "/app/projects/reports/profitability" },
            { label: "Daily Timesheet Summary", href: "/app/projects/reports/daily-timesheet" },
            { label: "Project Billing Summary", href: "/app/projects/reports/billing-summary" },
          ]} />
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-gray-900 mb-3">Configuration</h4>
          <MasterList items={[
            { label: "Projects Settings", href: "/app/projects/settings" },
          ]} />
        </div>
      </div>
    </Workspace>
  );
}
