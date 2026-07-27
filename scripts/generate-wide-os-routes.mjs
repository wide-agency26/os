#!/usr/bin/env node
/**
 * Generates thin Next.js page.tsx wrappers for WIDE OS route tree.
 * Run: node scripts/generate-wide-os-routes.mjs
 */
import fs from "fs";
import path from "path";

const root = path.join(process.cwd(), "app");

function write(rel, content) {
  const file = path.join(root, rel, "page.tsx");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trim() + "\n");
  console.log("wrote", rel);
}

const financePages = [
  ["finance/dashboard", "FinanceDashboardView", "finance"],
  ["finance/actuals", "FinanceActualsView", "finance"],
  ["finance/identified", "FinanceIdentifiedView", "finance"],
  ["finance/unidentified", "FinanceUnidentifiedView", "finance"],
];

const bdPages = [
  ["bd/dashboard", "BdDashboardView", "bd"],
  ["bd/pipeline", "BdPipelineView", "bd"],
  ["bd/tasks", "BdTasksView", "bd"],
];

const hrPages = [
  ["hr/dashboard", "HrDashboardView", "hr"],
  ["hr/directory", "HrDirectoryView", "hr"],
];

function deptPage(route, view, dept) {
  return `import { ${view} } from "@/modules/${dept}/views/${view}";
import { resolveDepartmentAccess } from "@/lib/wide-os/resolve-access";
import { DepartmentShell } from "@/components/wide-os/shells/DepartmentShell";

export default async function Page() {
  const access = await resolveDepartmentAccess("${dept}");
  return (
    <DepartmentShell department="${dept}" access={access}>
      <${view} access={access} />
    </DepartmentShell>
  );
}
`;
}

function execDeptPage(route, view, dept) {
  return `import { ${view} } from "@/modules/${dept}/views/${view}";
import { resolveExecutiveDepartmentAccess } from "@/lib/wide-os/resolve-access";
import { ExecutiveShell } from "@/components/wide-os/shells/ExecutiveShell";

export default async function Page() {
  const access = await resolveExecutiveDepartmentAccess("${dept}");
  return (
    <ExecutiveShell access={access}>
      <${view} access={access} />
    </ExecutiveShell>
  );
}
`;
}

for (const [route, view, dept] of financePages) {
  write(route, deptPage(route, view, dept));
  write(`admin/${route}`, execDeptPage(route, view, dept));
}

for (const [route, view, dept] of bdPages) {
  write(route, deptPage(route, view, dept));
  write(`admin/${route}`, execDeptPage(route, view, dept));
}

for (const [route, view, dept] of hrPages) {
  write(route, deptPage(route, view, dept));
  write(`admin/${route}`, execDeptPage(route, view, dept));
}

// BD prospect dynamic
write(
  "bd/prospect/[prospect_id]",
  `import { BdProspectWorkspaceView } from "@/modules/bd/views/BdProspectWorkspaceView";
import { resolveBdProspectAccess } from "@/lib/wide-os/resolve-access";
import { DepartmentShell } from "@/components/wide-os/shells/DepartmentShell";

export default async function Page({ params }: { params: Promise<{ prospect_id: string }> }) {
  const { prospect_id } = await params;
  const access = await resolveBdProspectAccess(prospect_id, false);
  return (
    <DepartmentShell department="bd" access={access}>
      <BdProspectWorkspaceView access={access} />
    </DepartmentShell>
  );
}
`
);

write(
  "admin/bd/prospect/[prospect_id]",
  `import { BdProspectWorkspaceView } from "@/modules/bd/views/BdProspectWorkspaceView";
import { resolveBdProspectAccess } from "@/lib/wide-os/resolve-access";
import { ExecutiveShell } from "@/components/wide-os/shells/ExecutiveShell";

export default async function Page({ params }: { params: Promise<{ prospect_id: string }> }) {
  const { prospect_id } = await params;
  const access = await resolveBdProspectAccess(prospect_id, true);
  return (
    <ExecutiveShell access={access}>
      <BdProspectWorkspaceView access={access} />
    </ExecutiveShell>
  );
}
`
);

// CM roster
write(
  "cm/roster",
  `import { CmRosterView } from "@/modules/cm/views/CmRosterView";
import { resolveCmRosterAccess } from "@/lib/wide-os/resolve-access";
import { DepartmentShell } from "@/components/wide-os/shells/DepartmentShell";

export default async function Page() {
  const access = await resolveCmRosterAccess(false);
  return (
    <DepartmentShell department="cm" access={access}>
      <CmRosterView access={access} />
    </DepartmentShell>
  );
}
`
);

write(
  "admin/cm/roster",
  `import { CmRosterView } from "@/modules/cm/views/CmRosterView";
import { resolveCmRosterAccess } from "@/lib/wide-os/resolve-access";
import { ExecutiveShell } from "@/components/wide-os/shells/ExecutiveShell";

export default async function Page() {
  const access = await resolveCmRosterAccess(true);
  return (
    <ExecutiveShell access={access}>
      <CmRosterView access={access} />
    </ExecutiveShell>
  );
}
`
);

write(
  "cm/roster/add",
  `import { CmAddClientView } from "@/modules/cm/views/CmAddClientView";
import { resolveCmRosterAccess } from "@/lib/wide-os/resolve-access";
import { DepartmentShell } from "@/components/wide-os/shells/DepartmentShell";

export default async function Page() {
  const access = await resolveCmRosterAccess(false);
  return (
    <DepartmentShell department="cm" access={access}>
      <CmAddClientView access={access} />
    </DepartmentShell>
  );
}
`
);

const cmClientPages = [
  ["dashboard", "CmClientDashboardView"],
  ["brandguideline", "CmBrandGuidelineView"],
  ["webstyleguide", "CmWebStyleGuideView"],
  ["files", "CmFilesView"],
  ["settings", "CmClientSettingsView"],
];

for (const [seg, view] of cmClientPages) {
  write(
    `cm/[client_id]/${seg}`,
    `import { ${view} } from "@/modules/cm/views/${view}";
import { resolveCmClientAccess } from "@/lib/wide-os/resolve-access";
import { CmWorkspaceShell } from "@/components/wide-os/shells/CmWorkspaceShell";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveCmClientAccess(client_id);
  return (
    <CmWorkspaceShell access={access}>
      <${view} access={access} />
    </CmWorkspaceShell>
  );
}
`
  );
  write(
    `admin/cm/[client_id]/${seg}`,
    `import { ${view} } from "@/modules/cm/views/${view}";
import { resolveExecutiveCmClientAccess } from "@/lib/wide-os/resolve-access";
import { CmWorkspaceShell } from "@/components/wide-os/shells/CmWorkspaceShell";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveExecutiveCmClientAccess(client_id);
  return (
    <CmWorkspaceShell access={access}>
      <${view} access={access} />
    </CmWorkspaceShell>
  );
}
`
  );
}

const clientPages = [
  ["dashboard", "ClientDashboardView"],
  ["brandguideline", "ClientBrandGuidelineReadView"],
  ["webstyleguide", "ClientWebStyleGuideReadView"],
  ["files", "ClientFilesReadView"],
  ["settings", "ClientSettingsReadView"],
];

for (const [seg, view] of clientPages) {
  write(
    `client/[client_id]/${seg}`,
    `import { ${view} } from "@/modules/client/views/${view}";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { ClientPortalShell } from "@/components/wide-os/shells/ClientPortalShell";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);
  return (
    <ClientPortalShell access={access}>
      <${view} access={access} />
    </ClientPortalShell>
  );
}
`
  );
}

const kickoff = [
  "phase-1-discovery",
  "phase-2-creative",
  "phase-3-alignment",
  "phase-4-systems",
  "phase-5-lifecycle",
];

for (const phase of kickoff) {
  write(
    `client/[client_id]/kickoff/${phase}`,
    `import { ClientKickoffPhaseView } from "@/modules/client/views/ClientKickoffPhaseView";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { ClientPortalShell } from "@/components/wide-os/shells/ClientPortalShell";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);
  return (
    <ClientPortalShell access={access}>
      <ClientKickoffPhaseView access={access} phase="${phase}" />
    </ClientPortalShell>
  );
}
`
  );
}

write(
  "prospect/[prospect_id]/proposal",
  `import { ProspectProposalView } from "@/modules/prospect/views/ProspectProposalView";
import { resolveProspectReadAccess } from "@/lib/wide-os/resolve-access";

export default async function Page({ params }: { params: Promise<{ prospect_id: string }> }) {
  const { prospect_id } = await params;
  const access = await resolveProspectReadAccess(prospect_id);
  return <ProspectProposalView access={access} />;
}
`
);

write(
  "employee/[employee_id]/portal",
  `import { EmployeePortalView } from "@/modules/hr/views/EmployeePortalView";

export default async function Page() {
  return <EmployeePortalView />;
}
`
);

console.log("Done.");
