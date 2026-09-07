"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, Eye, Loader2, Search } from "lucide-react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { PageHeader, buttonClass } from "@/components/frappe-ui/primitives";
import { CompanyLogoMark } from "@/components/crm/CompanyLogo";
import { startViewAsClient } from "@/app/actions/view-as-client";
import type { ViewAsCatalogCompany, ViewAsContactOption } from "@/app/actions/view-as-client";
import { portalAccessLabel } from "@/lib/client/permissions";

export function ViewAsClientPicker({ clients }: { clients: ViewAsCatalogCompany[] }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.projectTitle && c.projectTitle.toLowerCase().includes(q)) return true;
      return c.contacts.some(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.email && p.email.toLowerCase().includes(q))
      );
    });
  }, [clients, query]);

  function openAs(companyId: string, contactId?: string | null) {
    setError(null);
    setPendingKey(`${companyId}:${contactId || ""}`);
    startTransition(async () => {
      const result = await startViewAsClient(companyId, contactId, {
        clearReturn: true,
      });
      if (result?.error) {
        setError(result.error);
        setPendingKey(null);
      }
    });
  }

  return (
    <Workspace>
      <div className="space-y-6">
        <PageHeader
          title="View as client"
          subtitle="Open the portal as a company, or as a specific contact — same tabs and permission they would get."
        />

        <label className="relative block">
          <Search
            size={14}
            strokeWidth={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search companies or contacts"
            className="w-full border border-border rounded-lg bg-surface pl-9 pr-3 py-2.5 text-[13px] outline-none focus:ring-1 focus:ring-accent"
          />
        </label>

        {error ? <p className="text-[13px] text-danger">{error}</p> : null}

        {visible.length === 0 ? (
          <p className="text-[13px] text-text-secondary py-8 text-center">
            No live clients match that search.
          </p>
        ) : (
          <ul className="space-y-2">
            {visible.map((c) => {
              const expanded = openId === c.id || Boolean(query.trim());
              const companyBusy = pending && pendingKey === `${c.id}:`;
              return (
                <li key={c.id} className="rounded-lg border border-border bg-surface overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenId((id) => (id === c.id ? null : c.id))}
                      className="p-1 text-text-muted hover:text-text-primary"
                      aria-expanded={expanded}
                      aria-label={expanded ? "Hide contacts" : "Show contacts"}
                    >
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${expanded ? "" : "-rotate-90"}`}
                      />
                    </button>
                    <CompanyLogoMark
                      label={c.name}
                      logoUrl={c.logoUrl}
                      website={c.website}
                      size={32}
                    />
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setOpenId((id) => (id === c.id ? null : c.id))}
                    >
                      <p className="font-semibold text-text-primary truncate">{c.name}</p>
                      <p className="text-[12px] text-text-muted truncate">
                        {c.contacts.length} contact{c.contacts.length === 1 ? "" : "s"}
                        {c.projectTitle && c.projectTitle !== c.name ? ` · ${c.projectTitle}` : ""}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openAs(c.id)}
                      className={`${buttonClass("secondary")} shrink-0`}
                    >
                      {companyBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Eye size={14} strokeWidth={1.75} />
                      )}
                      As company
                    </button>
                  </div>
                  {expanded ? (
                    <ul className="border-t border-border divide-y divide-border">
                      {c.contacts.length === 0 ? (
                        <li className="px-4 py-3 text-[12px] text-text-muted">
                          No CRM contacts on this company yet.
                        </li>
                      ) : (
                        c.contacts.map((p) => (
                          <ContactRow
                            key={p.id}
                            companyId={c.id}
                            contact={p}
                            pending={pending}
                            busy={pending && pendingKey === `${c.id}:${p.id}`}
                            onOpen={openAs}
                          />
                        ))
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Workspace>
  );
}

function ContactRow({
  companyId,
  contact,
  pending,
  busy,
  onOpen,
}: {
  companyId: string;
  contact: ViewAsContactOption;
  pending: boolean;
  busy: boolean;
  onOpen: (companyId: string, contactId: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-text-primary truncate">{contact.name}</p>
        <p className="text-[11px] text-text-muted truncate">
          {contact.email || "No email"}
          {contact.isMember ? ` · member · ${portalAccessLabel(contact.portalAccess)}` : " · CRM only"}
          {contact.projectTitles.length
            ? ` · ${contact.projectTitles.slice(0, 2).join(", ")}`
            : " · no project link"}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => onOpen(companyId, contact.id)}
        className={`${buttonClass("secondary")} shrink-0`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} strokeWidth={1.75} />}
        As contact
      </button>
    </li>
  );
}
