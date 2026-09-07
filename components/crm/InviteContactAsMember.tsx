"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Loader2, UserPlus } from "lucide-react";
import {
  inviteContactAsMember,
  resetPortalMemberPassword,
  type CompanyContactOption,
  type CompanyPortalContext,
  type CompanyPortalMember,
  type CompanyUsersState,
} from "@/app/actions/company-members";
import { startViewAsClient } from "@/app/actions/view-as-client";
import {
  loadPortalCredentials,
  persistPortalCredentials,
  PortalCredentials,
} from "@/components/crm/PortalCredentials";

async function fetchPortalContext(companyId: string): Promise<CompanyPortalContext> {
  const res = await fetch(
    `/api/crm/portal-context?companyId=${encodeURIComponent(companyId)}`,
    { cache: "no-store" }
  );
  return (await res.json()) as CompanyPortalContext;
}

export function InviteContactAsMember({
  companyId,
  contactId,
  contactName,
  contactEmail,
  compact = false,
  contacts: preloadedContacts,
  members: preloadedMembers,
  onInvited,
}: {
  companyId?: string | null;
  contactId?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  compact?: boolean;
  contacts?: CompanyContactOption[];
  members?: CompanyPortalMember[];
  onInvited?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<CompanyContactOption[]>(preloadedContacts || []);
  const [members, setMembers] = useState<CompanyPortalMember[]>(preloadedMembers || []);
  const [portalUrl, setPortalUrl] = useState("");
  const [selectedId, setSelectedId] = useState(contactId || "");
  const [email, setEmail] = useState(contactEmail || "");
  const [sendEmail, setSendEmail] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanyUsersState | null>(null);

  const locked = Boolean(contactId);
  const skipFetch = preloadedContacts !== undefined;
  const credsKey = contactId ? `contact:${contactId}` : selectedId ? `contact:${selectedId}` : "";

  const refresh = useCallback(async () => {
    if (!companyId) return;
    const data = await fetchPortalContext(companyId);
    if (data.error) {
      setLoadError(data.error);
      return;
    }
    setLoadError(null);
    setContacts(data.contacts);
    setMembers(data.members);
    setPortalUrl(data.portalUrl);
    if (!locked) {
      setSelectedId((prev) => {
        if (prev && data.contacts.some((c) => c.id === prev)) return prev;
        const withEmail = data.contacts.find((c) => c.email);
        return withEmail?.id || data.contacts[0]?.id || "";
      });
    }
  }, [companyId, locked]);

  useEffect(() => {
    if (preloadedContacts) setContacts(preloadedContacts);
  }, [preloadedContacts]);

  useEffect(() => {
    if (preloadedMembers) setMembers(preloadedMembers);
  }, [preloadedMembers]);

  useEffect(() => {
    if (skipFetch) {
      if (!locked && preloadedContacts?.length) {
        setSelectedId((prev) => {
          if (prev && preloadedContacts.some((c) => c.id === prev)) return prev;
          const withEmail = preloadedContacts.find((c) => c.email);
          return withEmail?.id || preloadedContacts[0]?.id || "";
        });
      }
      return;
    }
    void refresh();
  }, [refresh, skipFetch, locked, preloadedContacts]);

  useEffect(() => {
    if (contactEmail) setEmail(contactEmail);
  }, [contactEmail]);

  useEffect(() => {
    if (!credsKey) return;
    const stored = loadPortalCredentials(credsKey);
    if (stored) setResult((prev) => prev ?? stored);
  }, [credsKey]);

  const selected = useMemo(() => {
    if (locked) {
      return {
        id: contactId || "",
        name: contactName || "This contact",
        email: contactEmail || email || null,
        isMember: members.some(
          (m) =>
            m.status === "active" &&
            (contactEmail || email) &&
            m.user_email.toLowerCase() === (contactEmail || email || "").toLowerCase()
        ),
      } satisfies CompanyContactOption;
    }
    return contacts.find((c) => c.id === selectedId) || null;
  }, [
    locked,
    contactId,
    contactName,
    contactEmail,
    email,
    members,
    contacts,
    selectedId,
  ]);

  const existingMember = useMemo(() => {
    const addr = (selected?.email || contactEmail || email || "").trim().toLowerCase();
    if (!addr) return null;
    return (
      members.find((m) => m.status === "active" && m.user_email.toLowerCase() === addr) ||
      null
    );
  }, [members, selected?.email, contactEmail, email]);

  useEffect(() => {
    if (!locked && selected?.email) setEmail(selected.email);
    if (!locked && selected && !selected.email) setEmail("");
  }, [locked, selected?.id, selected?.email]);

  if (!companyId) {
    return (
      <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        Link a CRM company first, then you can turn a contact into a portal member.
      </p>
    );
  }

  const already = Boolean(selected?.isMember);
  const displayPortal = result?.portalUrl || portalUrl;

  function applyResult(res: CompanyUsersState) {
    setResult(res);
    if (!res.error && credsKey) persistPortalCredentials(credsKey, res);
  }

  function invite() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await inviteContactAsMember({
          companyId,
          contactId: selected?.id || contactId || null,
          email: email || selected?.email || null,
          fullName: selected?.name || contactName || null,
          sendEmail,
        });
        applyResult(res);
        if (!res.error) {
          await refresh();
          onInvited?.();
        }
      } catch (e) {
        applyResult({
          error: e instanceof Error ? e.message : "Could not create the portal member.",
        });
      }
    });
  }

  function resetPassword() {
    if (!existingMember) return;
    startTransition(async () => {
      try {
        const res = await resetPortalMemberPassword(existingMember.id);
        applyResult(res);
      } catch (e) {
        applyResult({
          error: e instanceof Error ? e.message : "Could not set a new password.",
        });
      }
    });
  }

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact ? (
        <div>
          <p className="text-[13px] font-semibold text-gray-900">Portal member</p>
          <p className="text-[12px] text-gray-500 mt-0.5">
            Turns this person into a client viewer. No login email is sent
            unless you tick the box below — copy the username and temporary
            password and share them yourself.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <p className="text-[12px] text-red-700">{loadError}</p>
      ) : null}

      {!locked ? (
        contacts.length === 0 ? (
          <p className="text-[12px] text-gray-400">
            Add a contact on this company first.{" "}
            <Link href="/app/crm/new?kind=contact" className="text-blue-700 hover:underline">
              New contact
            </Link>
          </p>
        ) : (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-[12px] bg-white"
          >
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isMember ? " · member" : c.email ? "" : " · no email"}
              </option>
            ))}
          </select>
        )
      ) : null}

      {selected && !already ? (
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Contact email"
          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-[12px]"
        />
      ) : null}

      {selected && !already ? (
        <label className="flex items-start gap-2 text-[12px] text-gray-600">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={(e) => setSendEmail(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Send a Supabase invite email anyway. Skip this — the mailer is
            generic. Share username and password yourself.
          </span>
        </label>
      ) : null}

      {already ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12px] text-emerald-800">
            {selected?.name} is already a portal viewer.
          </p>
          {existingMember ? (
            <button
              type="button"
              disabled={pending}
              onClick={resetPassword}
              className="text-[12px] text-blue-700 hover:underline disabled:opacity-50"
            >
              {pending ? "Setting password…" : "New temp password"}
            </button>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={pending || !selected || !email.trim()}
          onClick={invite}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent text-white px-3 py-1.5 text-[12px] font-medium hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <UserPlus size={13} />
          )}
          {pending ? "Creating…" : "Create portal member"}
        </button>
      )}

      {companyId && (selected?.id || contactId) ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const res = await startViewAsClient(companyId, selected?.id || contactId, {
                clearReturn: true,
              });
              if (res?.error) setResult({ error: res.error });
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[12px] font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          <Eye size={13} />
          View portal as this contact
        </button>
      ) : null}

      {result ? <PortalCredentials state={result} /> : null}

      {(already || result?.portalUrl) && displayPortal && !result?.loginUrl ? (
        <PortalCredentials
          state={{ portalUrl: displayPortal, success: "Portal link for this company." }}
        />
      ) : null}
    </div>
  );
}
