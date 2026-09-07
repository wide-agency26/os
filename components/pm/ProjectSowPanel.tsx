"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { ProjectPmShell } from "@/components/pm/ProjectPmShell";
import { SowBuilder } from "@/components/sow/SowBuilder";
import { createSow } from "@/app/actions/sow";
import type { PmService, SowDocument } from "@/lib/sow/types";
import type { SowVersionPeer } from "@/lib/sow/version";
import { workPaths } from "@/lib/work/paths";

export function ProjectSowPanel({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState("Project");
  const [clientLabel, setClientLabel] = useState<string | undefined>();
  const [sow, setSow] = useState<SowDocument | null>(null);
  const [versions, setVersions] = useState<SowVersionPeer[]>([]);
  const [services, setServices] = useState<PmService[]>([]);
  const [packages, setPackages] = useState<{ id: string; name: string }[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createClient();
    const { data: project } = await supabase
      .from("projects")
      .select("id, title, client_id, company, crm_customers:client_id ( company, name )")
      .eq("id", projectId)
      .maybeSingle();
    setTitle(project?.title || "Project");
    const co = Array.isArray(project?.crm_customers)
      ? project?.crm_customers[0]
      : project?.crm_customers;
    setClientLabel(co?.company || co?.name || project?.company || undefined);
    setCompanyId(project?.client_id || null);

    const { data: sowRows } = await supabase
      .from("sows")
      .select("id, version_number, updated_at")
      .eq("project_id", projectId)
      .order("version_number", { ascending: false });
    const sowId = sowRows?.[0]?.id;
    const { data: svc } = await supabase
      .from("pm_services")
      .select("id, name, category, sort_order, description, short_description")
      .order("sort_order");
    setServices((svc ?? []) as PmService[]);
    const { data: pkgs } = await supabase
      .from("pm_packages")
      .select("id, name")
      .order("sort_order");
    setPackages((pkgs ?? []) as { id: string; name: string }[]);

    if (sowId) {
      const payload = await fetch(
        `/api/sow/builder?sowId=${encodeURIComponent(sowId)}`,
        { cache: "no-store" }
      ).then((r) => r.json()) as {
        ok?: boolean;
        sow?: SowDocument;
        versions?: SowVersionPeer[];
        packages?: { id: string; name: string }[];
      };
      if (payload.ok) {
        setSow(payload.sow || null);
        setVersions(payload.versions || []);
        if (payload.packages?.length) setPackages(payload.packages);
      } else {
        setSow(null);
        setVersions([]);
      }
    } else {
      setSow(null);
      setVersions([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [projectId]);

  return (
    <ProjectPmShell projectId={projectId} title={title} clientLabel={clientLabel}>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-gray-400" />
        </div>
      ) : sow ? (
        <div className="-mx-0 min-h-[70vh]">
          <SowBuilder
            key={sow.id}
            initial={sow}
            services={services}
            packages={packages}
            versions={versions}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 px-6 py-12 text-center space-y-3">
          <p className="text-sm text-gray-600">No SOW on this project yet.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={creating || !companyId}
            onClick={async () => {
              if (!companyId) return;
              setCreating(true);
              setError(null);
              const res = await createSow({
                companyId,
                title,
                projectId,
              });
              setCreating(false);
              if (!res.ok) {
                setError(res.error || "Could not create SOW");
                return;
              }
              await load();
            }}
            className="inline-flex items-center rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2"
          >
            {creating ? "Creating…" : "Create SOW"}
          </button>
          <p className="text-xs text-gray-400">
            Or start from{" "}
            <Link href={workPaths.sowNew} className="text-blue-700 font-medium">
              LMS
            </Link>
          </p>
        </div>
      )}
    </ProjectPmShell>
  );
}
