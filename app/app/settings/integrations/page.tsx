"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PM_ICONS } from "@/lib/pm/icons";
import { setProjectInboundEmail } from "@/app/actions/pm-review";

const DOMAIN =
  process.env.NEXT_PUBLIC_PM_INBOUND_DOMAIN || "pm.wide.agency";

function suggestAlias(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
  return `${slug || "project"}@${DOMAIN}`;
}

export default function IntegrationsPage() {
  const Icon = PM_ICONS.fromEmail;
  const [projects, setProjects] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await (supabase as any)
      .from("projects")
      .select(
        `id, title, pm_inbound_email, client:client_id ( company, name )`
      )
      .order("title");
    setProjects(data || []);
    const d: Record<string, string> = {};
    for (const p of data || []) {
      d[p.id] = p.pm_inbound_email || "";
    }
    setDrafts(d);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const save = (projectId: string) => {
    setMsg("");
    startTransition(async () => {
      const res = await setProjectInboundEmail(
        projectId,
        drafts[projectId]?.trim() || null
      );
      setMsg(res.ok ? "Saved." : res.error || "Failed");
      if (res.ok) await load();
    });
  };

  return (
    <Workspace>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2 flex items-center gap-2">
        <Icon className="w-6 h-6" />
        Integrations
      </h1>
      <p className="text-sm text-gray-500 mb-2 max-w-2xl">
        Each project gets its own inbound alias. Forward client email (or point a
        webhook) at that address — proposals land in the review queue only. Nothing
        creates a live task without human approval.
      </p>
      <p className="text-xs text-gray-400 mb-6">
        Webhook:{" "}
        <code className="bg-gray-100 px-1 rounded">
          POST /api/pm/email-inbound
        </code>{" "}
        with Bearer{" "}
        <code className="bg-gray-100 px-1 rounded">PM_INBOUND_WEBHOOK_SECRET</code>
      </p>

      {msg ? <p className="text-sm text-gray-600 mb-3">{msg}</p> : null}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Inbound email</th>
                <th className="px-3 py-2 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/app/projects/${p.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {p.title}
                    </Link>
                    <div className="text-xs text-gray-400">
                      {p.client?.company || p.client?.name || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full max-w-md border border-gray-300 rounded px-2 py-1.5 text-sm"
                      placeholder={suggestAlias(p.title)}
                      value={drafts[p.id] ?? ""}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 space-x-2 whitespace-nowrap">
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-gray-600 underline"
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [p.id]: suggestAlias(p.title),
                        }))
                      }
                    >
                      Suggest
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => save(p.id)}
                      className="text-xs bg-gray-900 text-white rounded px-2 py-1 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <Link
                      href={`/app/projects/${p.id}/review`}
                      className="text-xs text-gray-600 underline"
                    >
                      Queue
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Workspace>
  );
}
