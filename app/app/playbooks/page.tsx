"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { PM_ICONS } from "@/lib/pm/icons";
import { GateIcon } from "@/components/pm/PmBadges";

export default function PlaybooksPage() {
  const [services, setServices] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: sp } = await (supabase as any)
        .from("service_playbooks")
        .select(`id, cadence_type, service:service_id ( name, category, sort_order )`)
        .order("created_at");
      setServices(
        (sp || []).sort(
          (a: any, b: any) =>
            (a.service?.sort_order ?? 0) - (b.service?.sort_order ?? 0)
        )
      );

      const { data: pp } = await (supabase as any)
        .from("package_playbooks")
        .select(`id, cadence_type, package:package_id ( name, sort_order )`)
        .order("created_at");
      setPackages(
        (pp || []).sort(
          (a: any, b: any) =>
            (a.package?.sort_order ?? 0) - (b.package?.sort_order ?? 0)
        )
      );
      setLoading(false);
    }
    void load();
  }, []);

  return (
    <Workspace>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Playbooks</h1>
        <p className="text-sm text-gray-500 mt-1">
          Reusable service task templates and package assemblies
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          <Section title="Package playbooks">
            <ul className="grid gap-2 sm:grid-cols-2">
              {packages.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/app/playbooks/packages/${p.id}`}
                    className="flex items-center gap-2 border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50"
                  >
                    {p.cadence_type === "recurring" ? (
                      <PM_ICONS.recurring className="w-4 h-4 text-gray-500" />
                    ) : (
                      <GateIcon cleared />
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {p.package?.name}
                      </div>
                      <div className="text-xs text-gray-500">{p.cadence_type}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Service playbooks">
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/app/playbooks/services/${s.id}`}
                    className="block border border-gray-200 rounded-lg px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {s.service?.name}
                      {s.cadence_type === "recurring" ? (
                        <PM_ICONS.recurring className="w-3.5 h-3.5 text-gray-400" />
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {s.service?.category} · {s.cadence_type}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </Workspace>
  );
}
