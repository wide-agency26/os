"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import {
  inviteCompanyUser,
  linkExistingCompanyUser,
  loadCompanyUsersData,
  loadCrmContactBrief,
  revokeCompanyUser,
  createCrmContactFromMember,
  resetPortalMemberPassword,
  type CompanyMemberRow,
  type CompanyOption,
  type CompanyUsersState,
} from "@/app/actions/company-members";
import {
  persistPortalCredentials,
  loadPortalCredentials,
  PortalCredentials,
} from "@/components/crm/PortalCredentials";
import { AccessRequestRow } from "@/components/notifications/AccessRequestRow";
import {
  Building2,
  Eye,
  Loader2,
  Mail,
  Trash2,
  UserPlus,
  Users,
  Link2,
} from "lucide-react";
import { startViewAsClient, setMemberPortalAccess } from "@/app/actions/view-as-client";
import { CLIENT_NAV_KEYS, CLIENT_NAV_LABELS, type ClientNavKey } from "@/lib/client/nav";
import { type PortalAccessLevel } from "@/lib/client/permissions";

const initialState: CompanyUsersState = {};

export default function CrmAccessPage() {
  return (
    <Suspense
      fallback={
        <Workspace>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        </Workspace>
      }
    >
      <CrmAccessPageInner />
    </Suspense>
  );
}

function CrmAccessPageInner() {
  const searchParams = useSearchParams();
  const companyFromUrl = searchParams.get("company") || "";
  const contactFromUrl = searchParams.get("contact") || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [members, setMembers] = useState<CompanyMemberRow[]>([]);
  const [existingClients, setExistingClients] = useState<{ id: string; full_name: string }[]>(
    []
  );
  const [companyFilter, setCompanyFilter] = useState(companyFromUrl);
  const [showInvite, setShowInvite] = useState(
    Boolean(companyFromUrl || contactFromUrl || searchParams.get("invite") === "1")
  );
  const [showLink, setShowLink] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [issued, setIssued] = useState<{ memberId: string; state: CompanyUsersState } | null>(
    null
  );
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteCompanyUser,
    initialState
  );
  const [linkState, linkAction, linkPending] = useActionState(
    linkExistingCompanyUser,
    initialState
  );

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
    if (!contactFromUrl) return;
    void loadCrmContactBrief(contactFromUrl).then((c) => {
      if (c.error) return;
      if (c.name) setInviteName(c.name);
      if (c.email) setInviteEmail(c.email);
      if (c.companyId) setCompanyFilter(c.companyId);
    });
  }, [contactFromUrl]);

  useEffect(() => {
    if (inviteState.success || linkState.success) {
      setShowInvite(false);
      setShowLink(false);
      const state = inviteState.success ? inviteState : linkState;
      persistPortalCredentials(`invite:${state.username || "last"}`, state);
      void refresh(companyFilter);
    }
  }, [inviteState.success, linkState.success, inviteState, linkState, refresh, companyFilter]);

  useEffect(() => {
    if (!members.length || issued) return;
    for (const m of members) {
      const stored = loadPortalCredentials(`member:${m.id}`);
      if (stored?.tempPassword || stored?.username) {
        setIssued({ memberId: m.id, state: stored });
        return;
      }
    }
  }, [members, issued]);

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
              Company access
            </h1>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Pending portal requests, plus invite or link client logins to a CRM
              company.
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
          <PortalCredentials state={inviteState.success ? inviteState : linkState} />
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
            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-amber-50/50 border-b border-gray-200 text-sm font-bold text-amber-900">
                Pending requests ({pending.length})
              </div>
              {pending.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  No pending access requests.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {pending.map((m) => (
                    <div key={m.id} className="p-4">
                      <AccessRequestRow member={m} onReviewed={() => void refresh(companyFilter)} />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2 text-sm font-bold text-gray-900">
                <Building2 className="w-4 h-4 text-blue-600" />
                Active members ({active.length})
              </div>
              {active.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">
                  No active members{companyFilter ? " for this company" : ""}.
                  Invite a user to get started.
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {active.map((m) => (
                    <div
                      key={m.id}
                      className="p-4 flex flex-col gap-3 hover:bg-gray-50/50"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <MemberMeta
                          member={m}
                          resetting={resettingId === m.id}
                          onCreateContact={async () => {
                            const res = await createCrmContactFromMember(m.id);
                            if (res.error) alert(res.error);
                            else void refresh(companyFilter);
                          }}
                          onResetPassword={async () => {
                            setResettingId(m.id);
                            try {
                              const res = await resetPortalMemberPassword(m.id);
                              setIssued({ memberId: m.id, state: res });
                              persistPortalCredentials(`member:${m.id}`, res);
                            } catch (e) {
                              setIssued({
                                memberId: m.id,
                                state: {
                                  error:
                                    e instanceof Error
                                      ? e.message
                                      : "Could not set a new password.",
                                },
                              });
                            } finally {
                              setResettingId(null);
                            }
                          }}
                          onChanged={() => void refresh(companyFilter)}
                        />
                        <button
                          type="button"
                          onClick={() => void handleRevoke(m.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Revoke"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {issued?.memberId === m.id ? (
                        <PortalCredentials state={issued.state} />
                      ) : null}
                    </div>
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
            Creates a client login with a temporary password. No email is sent
            unless you tick the box — copy the details and share them yourself.
            They set a new password on first login.
          </p>
          <form action={inviteAction} className="space-y-4">
            <Field label="Full name">
              <input
                name="full_name"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                placeholder="Jane Client"
              />
            </Field>
            <Field label="Email">
              <input
                name="email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
                placeholder="jane@client.com"
              />
            </Field>
            <Field label="Company">
              <select
                name="company_id"
                required
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
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
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" name="send_email" value="1" className="mt-0.5" />
              <span>
                Send a Supabase invite email anyway. Leave this off — the
                template is generic. Share username and password yourself.
              </span>
            </label>
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
                {invitePending ? "Creating…" : "Create member"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showLink && (
        <Modal title="Link existing client" onClose={() => setShowLink(false)}>
          <p className="text-xs text-gray-500 mb-4">
            Grant an existing client account active membership on a company (no
            new invite email).
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

function MemberMeta({
  member,
  resetting,
  onCreateContact,
  onResetPassword,
  onChanged,
}: {
  member: CompanyMemberRow;
  resetting?: boolean;
  onCreateContact?: () => void;
  onResetPassword?: () => void;
  onChanged?: () => void;
}) {
  const [pending, setPending] = useState(false);

  async function viewAs() {
    setPending(true);
    const res = await startViewAsClient(member.company_id, member.contact_id, {
      clearReturn: true,
    });
    if (res?.error) {
      alert(res.error);
      setPending(false);
    }
  }

  async function saveAccess(access: PortalAccessLevel, tabs: ClientNavKey[] | null) {
    setPending(true);
    const res = await setMemberPortalAccess(member.id, access, tabs);
    setPending(false);
    if (res.error) alert(res.error);
    else onChanged?.();
  }

  const tabOptions = CLIENT_NAV_KEYS.filter((k) => k !== "files");

  return (
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
        {member.contact_id ? (
          <a
            href={`/app/crm/${member.contact_id}`}
            className="text-blue-700 hover:underline"
          >
            Open CRM contact
          </a>
        ) : onCreateContact ? (
          <button type="button" onClick={onCreateContact} className="text-blue-700 hover:underline">
            Create CRM contact
          </button>
        ) : null}
        {onResetPassword ? (
          <button
            type="button"
            disabled={resetting}
            onClick={onResetPassword}
            className="text-blue-700 hover:underline disabled:opacity-50"
          >
            {resetting ? "Setting password…" : "New temp password"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => void viewAs()}
          className="inline-flex items-center gap-1 text-blue-700 hover:underline disabled:opacity-50"
        >
          <Eye className="w-3.5 h-3.5" />
          View portal as them
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <select
          disabled={pending}
          value={member.portal_access}
          onChange={(e) => {
            const access = e.target.value as PortalAccessLevel;
            void saveAccess(
              access,
              access === "restricted"
                ? member.allowed_nav_tabs?.length
                  ? member.allowed_nav_tabs
                  : ["guidelines", "reports"]
                : null
            );
          }}
          className="border border-gray-200 rounded-md px-2 py-1 text-[11px] bg-white"
        >
          <option value="full">Full portal</option>
          <option value="restricted">Restricted tabs</option>
        </select>
        {member.portal_access === "restricted"
          ? tabOptions.map((key) => {
              const on = Boolean(member.allowed_nav_tabs?.includes(key));
              return (
                <label key={key} className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={pending}
                    onChange={() => {
                      const current = new Set(member.allowed_nav_tabs || []);
                      if (on) current.delete(key);
                      else current.add(key);
                      void saveAccess("restricted", [...current]);
                    }}
                  />
                  {CLIENT_NAV_LABELS[key]}
                </label>
              );
            })
          : null}
      </div>
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
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 max-h-[100dvh] overflow-y-auto">
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
