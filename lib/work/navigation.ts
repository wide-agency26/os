import type { WorkHubRow } from "@/lib/work/load-hub";
import { workPaths } from "@/lib/work/paths";

export type WorkNavContext =
  | "full"
  | "prospect"
  | "lead"
  | "client"
  | "archive";

function pipelineHref(row: WorkHubRow): string {
  return row.bdRecordId
    ? workPaths.pipelineId(row.bdRecordId)
    : workPaths.company(row.companyId);
}

function projectHref(row: WorkHubRow): string | null {
  return row.projectId ? workPaths.project(row.projectId) : null;
}

/** Smart routing for Full Pipeline — prospecting → pipeline; lead/client → project. */
function fullPipelineHref(row: WorkHubRow): string {
  const project = projectHref(row);
  if (row.group === "find" || row.group === "qualify") {
    return pipelineHref(row);
  }
  if (
    project &&
    (row.group === "propose" ||
      row.group === "contract" ||
      row.group === "live")
  ) {
    return project;
  }
  if (project && (row.group === "done" || row.group === "lose")) {
    return project;
  }
  return pipelineHref(row);
}

export function workRowHref(
  row: WorkHubRow,
  context: WorkNavContext = "full"
): string {
  switch (context) {
    case "prospect":
      return pipelineHref(row);
    case "lead":
    case "client":
      return projectHref(row) ?? pipelineHref(row);
    case "archive":
      return projectHref(row) ?? pipelineHref(row);
    case "full":
    default:
      return fullPipelineHref(row);
  }
}
