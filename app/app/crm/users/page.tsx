"use client";

import { useCallback, useEffect, useMemo, useState, useActionState } from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  inviteCompanyUser,
  linkExistingCompanyUser,
  loadCompanyUsersData,
  revokeCompanyUser,
  type CompanyMemberRow,
  type CompanyOption,
  type CompanyUsersState,
} from "@/app/actions/company-members";
import {
  Building2,
  Loader2,
  Trash2,
  UserPlus,
  Users,
  Link2,
  Mail,
} from "lucide-react";

const initialState: CompanyUsersState = {};

export default function CrmCompanyUsersPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [members, setMembers] = useState<CompanyMemberRow[]>([]);
  const [existingClients, setExistingClients] = useState<{ id: string; full_name: string }[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const [inviteState, inviteAction, invitePending] = useActionState(inviteCompanyUser, initialState);
  const [linkState, linkAction, linkPending] = useActionState(linkExistingCompanyUser, initialState);

  const refresh = useCallback(async (companyId?: string) => {
    setLoading(true);
    setError(null);
    const data = await loadCompanyUsersData(companyId || undefined);
    if (data.error) setError(data.error);
    setCompanies(data.companies);
    setMembers(data.members);
    setExistingClients(data.existingClients);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh(companyFilter);
  }, [refresh, companyFilter]);

  useEffect(() => {
    if (inviteState.success || linkState.success) {
      setShowInvite(false);
      setShowLink(false);
      void refresh(companyFilter);
    }
  }, [inviteState.success, linkState.success, refresh, companyFilter]);

  const active = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members]
  );
  const pending = useMemo(
    () => members.filter((m) => m.status === "pending"),
    [members]
  );

  const handleRevoke = async (id: string) => {
    if (!confirm("Revoke this user’s company access?")) return;
    const res = await revokeCompanyUser(id);
    if (res.error) alert(res.error);
    else void refresh(companyFilter);
  };

  return (
    <Workspace>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
              <Users className="w-6 h-6 text-blue-600" />
              Company Users
            </h1>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Create client logins at the company level. One CRM company can have multiple users
              across different projects — invite them here and they get active access immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs min-w-[200px]"
            >
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowLink(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-semibold rounded-lg"
            >
              <Link2 className="w-4 h-4" />
              Link existing
            </button>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg"
            >
              <UserPlus className="w-4 h-4" />
              Invite user
            </button>
          </div>
        </div>

        {(inviteState.success || linkState.success) && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            {inviteState.success || linkState.success}
          </div>
        )}
        {(error || inviteState.error || linkState.error) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {error || inviteState.error || linkState.error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-amber-50/50 border-b border-gray-200 text-sm font-bold text-amber-900">
                  Pending ({pending.length}) — review also in Access Requests
                </div>
                <div className="divide-y divide-gray-200">
                  {pending.map((m) => (
                    <MemberRow key={m.id} member={m} onRevoke={handleRevoke} />
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Building2 className="w-4 h-4 text-blue-600" />
                Active company members ({active.length})
              </div>
              {active.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No active members{companyFilter ? " for this company" : ""}. Invite a user to get
                  started.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {active.map((m) => (
                    <MemberRow key={m.id} member={m} onRevoke={handleRevoke} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {showInvite && (
        <Modal title="Invite company user" onClose={() => setShowInvite(false)}>
          <p className="text-xs text-gray-500 mb-4">
            Creates a client account, emails an invite link, and grants active access to the
            selected CRM company.
          </p>
          <form action={inviteAction} className="space-y-4">
            <Field label="Full name">
              <input
                name="full_name"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                placeholder="Jane Client"
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                placeholder="jane@client.com"
              />
            </Field>
            <Field label="Company">
              <select
                name="company_id"
                required
                defaultValue={companyFilter}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
              >
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={invitePending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
              >
                <Mail className="w-4 h-4" />
                {invitePending ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showLink && (
        <Modal title="Link existing client" onClose={() => setShowLink(false)}>
          <p className="text-xs text-gray-500 mb-4">
            Grant an existing client account active membership on a company (no new invite email).
          </p>
          <form action={linkAction} className="space-y-4">
            <Field label="Existing client">
              <select
                name="user_id"
                required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
              >
                <option value="">Select user…</option>
                {existingClients.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Company">
              <select
                name="company_id"
                required
                defaultValue={companyFilter}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
              >
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowLink(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={linkPending}
                className="px-4 py-2 bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
              >
                {linkPending ? "Linking…" : "Grant access"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Workspace>
  );
}

function MemberRow({
  member,
  onRevoke,
}: {
  member: CompanyMemberRow;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50/50">
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-xs text-gray-900">{member.user_name}</span>
          <span className="text-xs text-gray-400 truncate">({member.user_email})</span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
              member.status === "active"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-amber-50 text-amber-800 border border-amber-200"
            }`}
          >
            {member.status}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 font-medium text-gray-700">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            {member.company_name}
          </span>
          <span>•</span>
          <span className="capitalize">via {member.source.replaceAll("_", " ")}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onRevoke(member.id)}
        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
        title="Revoke"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-700">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
