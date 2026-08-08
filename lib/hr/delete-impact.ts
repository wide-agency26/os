/**
 * Impact analysis before deleting an HR roster person.
 */

export type PersonDeleteImpact = {
  openTasks: {
    id: string;
    title: string;
    status: string;
    project_id: string;
    project_title: string | null;
  }[];
  doneTasks: number;
  compensationRecords: number;
  overheadCosts: number;
  esopAllocations: number;
  documents: number;
  pipelineLinks: number;
};

export function summarizeDeleteImpact(impact: PersonDeleteImpact): string {
  const lines: string[] = [];
  if (impact.openTasks.length) {
    lines.push(
      `${impact.openTasks.length} open task(s) will become Unassigned:`
    );
    for (const t of impact.openTasks.slice(0, 8)) {
      lines.push(
        `  • ${t.project_title || "Project"} — ${t.title} (${t.status})`
      );
    }
    if (impact.openTasks.length > 8) {
      lines.push(`  …and ${impact.openTasks.length - 8} more`);
    }
  }
  if (impact.doneTasks > 0) {
    lines.push(
      `${impact.doneTasks} completed/cancelled task(s) will lose this assignee link.`
    );
  }
  if (impact.compensationRecords > 0) {
    lines.push(
      `${impact.compensationRecords} compensation record(s) will be deleted.`
    );
  }
  if (impact.overheadCosts > 0) {
    lines.push(
      `${impact.overheadCosts} overhead cost line(s) (desk/office/etc.) will be deleted.`
    );
  }
  if (impact.esopAllocations > 0) {
    lines.push(`${impact.esopAllocations} ESOP allocation(s) will be deleted.`);
  }
  if (impact.documents > 0) {
    lines.push(`${impact.documents} document(s) will be deleted.`);
  }
  if (impact.pipelineLinks > 0) {
    lines.push(
      `${impact.pipelineLinks} pipeline card(s) linked as converted will be unlinked.`
    );
  }
  if (!lines.length) {
    return "No project assignments or linked HR records found.";
  }
  return lines.join("\n");
}
