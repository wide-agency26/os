"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { workPaths } from "@/lib/work/paths";
import { ArrowRight, Users } from "lucide-react";
import type {
  CompanyContactOption,
  CompanyPortalContext,
  CompanyPortalMember,
} from "@/app/actions/company-members";
import { InviteContactAsMember } from "@/components/crm/InviteContactAsMember";

export function CompanyContextPanel({ companyId }: { companyId: string }) {
  const [contacts, setContacts] = useState<CompanyContactOption[]>([]);
  const [members, setMembers] = useState<CompanyPortalMember[]>([]);
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/crm/portal-context?companyId=${encodeURIComponent(companyId)}`,
      { cache: "no-store" }
    );
    const data = (await res.json()) as CompanyPortalContext;
    if (data.error) return;
    setContacts(data.contacts);
    setMembers(data.members);
    setPipelineId(data.pipelineId);
  }, [companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh, tick]);

  const activeMembers = members.filter((m) => m.status === "active");
  const workHref = pipelineId ? workPaths.pipelineId(pipelineId) : workPaths.company(companyId);

  return (
    <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      <a
        href={workHref}
        className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 hover:shadow-sm flex items-center justify-between"
      >
        <div>
          <p className="text-[13px] font-semibold text-gray-900">Work</p>
          <p className="text-[12px] text-gray-500 mt-0.5">Pipeline card</p>
        </div>
        <ArrowRight size={14} className="text-gray-400" />
      </a>
      <div className="border border-gray-200 rounded-lg p-4 bg-white">
        <p className="text-[13px] font-semibold text-gray-900 mb-2">
          Contacts ({contacts.length})
        </p>
        {contacts.length === 0 ? (
          <p className="text-[12px] text-gray-400">None yet.</p>
        ) : (
          <ul className="space-y-1">
            {contacts.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <Link href={`/app/crm/${c.id}`} className="text-[12px] text-blue-700 hover:underline truncate">
                  {c.name}
                </Link>
                {c.isMember ? (
                  <span className="text-[10px] text-emerald-700 shrink-0">Member</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
        <p className="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
          <Users size={13} /> Members ({activeMembers.length})
        </p>
        {activeMembers.length === 0 ? (
          <p className="text-[12px] text-gray-400">No portal users yet.</p>
        ) : (
          <ul className="space-y-1">
            {activeMembers.slice(0, 5).map((m) => (
              <li key={m.id} className="text-[12px] text-gray-600">
                {m.user_name}
                {m.user_email ? (
                  <span className="text-gray-400"> · {m.user_email}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <InviteContactAsMember
          companyId={companyId}
          compact
          contacts={contacts}
          members={members}
          onInvited={() => setTick((n) => n + 1)}
        />
        <a
          href={`/app/crm/access?company=${encodeURIComponent(companyId)}`}
          className="text-[12px] text-blue-700 hover:underline"
        >
          Manage access
        </a>
      </div>
    </div>
  );
}
