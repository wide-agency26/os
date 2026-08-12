import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { FileText } from "lucide-react";
import { SOW_STATUS_LABELS } from "@/lib/sow/constants";

export default async function ClientSowLibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-sm text-gray-600">Sign in to view scopes of work.</p>
      </div>
    );
  }

  const { data: sows } = await supabase
    .from("sows")
    .select(
      `
      id,
      title,
      status,
      published_at,
      updated_at,
      crm_customers!company_id (
        company,
        name
      )
    `
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <div className="flex-1 overflow-y-auto bg-[#0A0A0A] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">
            WIDE
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-[-0.03em]">
            Scope of Work
          </h1>
          <p className="mt-2 text-sm text-white/55 max-w-xl">
            Published scopes for your company. Open any document to read or
            download PDF.
          </p>
        </div>

        <div className="grid gap-3">
          {(sows ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-white/45">
              No published scopes yet.
            </div>
          )}
          {(sows ?? []).map((sow) => {
            const co = sow.crm_customers as
              | { company?: string; name?: string }
              | { company?: string; name?: string }[]
              | null;
            const company = Array.isArray(co) ? co[0] : co;
            return (
              <Link
                key={sow.id}
                href={`/app/client-sow/${sow.id}`}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition-colors"
              >
                <div className="rounded-lg bg-white text-black p-2">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white truncate">{sow.title}</p>
                  <p className="text-xs text-white/45 mt-0.5">
                    {company?.company || company?.name || "Company"} ·{" "}
                    {SOW_STATUS_LABELS[sow.status] || sow.status}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
