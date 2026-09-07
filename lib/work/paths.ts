/** Canonical staff URLs for Work / Tools / Infra. */

export const workPaths = {
  hub: "/app/work",
  board: "/app/work?view=board",
  prospects: "/app/work/prospects",
  leads: "/app/work/leads",
  clients: "/app/work/clients",
  archived: "/app/work/archived",
  prospecting: "/app/work/prospects",
  lead: "/app/work/leads",
  archive: "/app/work/archived",
  qualify: "/app/work/prospects?filter=qualify",
  live: "/app/work/clients",
  done: "/app/work/archived?filter=done",
  lose: "/app/work/archived?filter=lose",
  find: "/app/work?filter=find",
  findTool: "/app/work/find",
  viewAs: "/app/work/view-as",
  toolsFind: "/app/tools/find",
  sow: "/app/work/sow",
  sowNew: "/app/work/sow/new",
  sowId: (id: string) => `/app/work/sow/${id}`,
  sowPrint: (id: string) => `/app/work/sow/${id}/print`,
  propose: "/app/work/propose",
  proposeNew: "/app/work/propose",
  proposeSlide: (id: string) => `/app/work/propose/slides/${id}`,
  proposeProject: (projectId: string) => `/app/work/propose/${projectId}`,
  proposeAudience: (projectId: string) => `/app/work/propose/${projectId}/audience`,
  proposeMarket: (projectId: string) => `/app/work/propose/${projectId}/market`,
  proposeCompetition: (projectId: string) => `/app/work/propose/${projectId}/competition`,
  proposeScope: (projectId: string, scopeId: string) =>
    `/app/work/propose/${projectId}/scope/${scopeId}`,
  proposeBuilder: (projectId: string, scopeId: string, strategyId: string) =>
    `/app/work/propose/${projectId}/scope/${scopeId}/${strategyId}/builder`,
  proposeContext: (projectId: string, scopeId: string, strategyId: string) =>
    `/app/work/propose/${projectId}/scope/${scopeId}/${strategyId}/context`,
  proposeTheme: (projectId: string, scopeId: string, strategyId: string) =>
    `/app/work/propose/${projectId}/scope/${scopeId}/${strategyId}/theme`,
  proposeShare: (projectId: string, scopeId: string, strategyId: string) =>
    `/app/work/propose/${projectId}/scope/${scopeId}/${strategyId}/share`,
  proposePositioning: (projectId: string, scopeId: string, strategyId: string) =>
    `/app/work/propose/${projectId}/scope/${scopeId}/${strategyId}/positioning`,
  playbooksStrategy: "/app/playbooks/strategy",
  contract: "/app/work/contract",
  contractId: (id: string) => `/app/work/contract/${id}`,
  quotes: "/app/work/quotes",
  quoteId: (id: string) => `/app/work/quotes/${id}`,
  pipelineId: (id: string) => `/app/work/pipeline/${id}`,
  qualifyId: (id: string) => `/app/work/qualify/${id}`,
  company: (id: string) => `/app/work/c/${id}`,
  wrap: (companyId: string) => `/app/work/c/${companyId}/wrap`,
  projects: "/app/projects",
  project: (id: string) => `/app/projects/${id}`,
  projectContent: (id: string) => `/app/projects/${id}/content`,
  projectBlog: (id: string) => `/app/projects/${id}/blog`,
  projectBlogArticle: (projectId: string, articleId: string) =>
    `/app/projects/${projectId}/blog/${articleId}`,
  toolsCi: "/app/tools/ci",
  projectCi: (id: string) => `/app/projects/${id}/ci-builder`,
  toolsContent: "/app/tools/content",
  blogBuilder: "/app/tools/blog",
  toolsReports: "/app/tools/reports",
  toolsReportsSources: "/app/projects/report-data",
  seo: "/app/seo",
  playbooks: "/app/playbooks",
} as const;

export function workCardHref(row: {
  bdRecordId?: string | null;
  companyId: string;
}) {
  return row.bdRecordId
    ? workPaths.pipelineId(row.bdRecordId)
    : workPaths.company(row.companyId);
}

export function workSowHref(sowId: string, opts?: { bd?: string; company?: string }) {
  const q = new URLSearchParams();
  if (opts?.bd) q.set("bd", opts.bd);
  if (opts?.company) q.set("company", opts.company);
  const suffix = q.toString() ? `?${q}` : "";
  return `${workPaths.sowId(sowId)}${suffix}`;
}
