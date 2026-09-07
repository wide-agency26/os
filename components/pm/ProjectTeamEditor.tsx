"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import {
  listAssignablePeople,
  loadProjectTeam,
  setProjectTeamMembers,
  updateProjectStartDate,
  type AssignablePerson,
  type ProjectTeamMember,
} from "@/app/actions/project-team";
import { MONTH_SHORT } from "@/lib/accounting/types";

function formatStartLabel(iso: string | null) {
  if (!iso || iso.length < 7) return "Not set";
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  if (!m || m < 1 || m > 12) return iso.slice(0, 10);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}

function toInputDate(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function ProjectTeamEditor({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<ProjectTeamMember[]>([]);
  const [roster, setRoster] = useState<AssignablePerson[]>([]);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateDraft, setDateDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    const [team, people] = await Promise.all([
      loadProjectTeam(projectId),
      listAssignablePeople(),
    ]);
    if (team.ok) {
      setMembers(team.members);
      setStartDate(team.startDate || team.expectedStartDate);
    } else {
      setError(team.error);
    }
    if (people.ok) setRoster(people.people);
    setLoaded(true);
  };

  useEffect(() => {
    void refresh();
  }, [projectId]);

  const selected = useMemo(
    () => new Set(members.map((m) => m.personId)),
    [members]
  );

  const persistTeam = (nextIds: string[], leadId?: string | null) => {
    const lead =
      leadId ??
      members.find((m) => m.isLead && nextIds.includes(m.personId))?.personId ??
      nextIds[0] ??
      null;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const res = await setProjectTeamMembers(projectId, nextIds, lead);
        if (!res.ok) {
          setError(res.error);
          await refresh();
          return;
        }
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update team");
        await refresh();
      } finally {
        setPending(false);
      }
    })();
  };

  const togglePerson = (personId: string) => {
    const next = selected.has(personId)
      ? members.filter((m) => m.personId !== personId).map((m) => m.personId)
      : [...members.map((m) => m.personId), personId];
    // Optimistic
    const byId = new Map(roster.map((p) => [p.id, p]));
    setMembers(
      next.map((id, i) => {
        const existing = members.find((m) => m.personId === id);
        const person = byId.get(id);
        return {
          personId: id,
          fullName: existing?.fullName || person?.fullName || "Untitled",
          isLead: i === 0,
          authUserId: existing?.authUserId ?? person?.authUserId ?? null,
        };
      })
    );
    persistTeam(next, next[0] || null);
  };

  const setLead = (personId: string) => {
    if (!selected.has(personId)) return;
    setMembers((prev) =>
      prev.map((m) => ({ ...m, isLead: m.personId === personId }))
    );
    persistTeam(
      members.map((m) => m.personId),
      personId
    );
  };

  const saveDate = () => {
    const value = dateDraft.trim() || null;
    setPending(true);
    setError(null);
    void (async () => {
      try {
        const res = await updateProjectStartDate(projectId, value);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setStartDate(value);
        setEditingDate(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update start date");
      } finally {
        setPending(false);
      }
    })();
  };

  if (!loaded) {
    return (
      <div className="mt-3 flex items-center gap-2 text-[12px] text-text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading team…
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 max-w-xl">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted uppercase tracking-wide text-[10px] font-semibold">
            Start
          </span>
          {editingDate ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="date"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                className="rounded border border-border bg-surface px-1.5 py-0.5 text-[12px] text-text-primary"
              />
              <button
                type="button"
                disabled={pending}
                onClick={saveDate}
                className="text-accent font-semibold"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingDate(false)}
                className="text-text-muted"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setDateDraft(toInputDate(startDate));
                setEditingDate(true);
              }}
              className="font-medium text-text-primary hover:underline"
              title="Change start date"
            >
              {formatStartLabel(startDate)}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-text-muted uppercase tracking-wide text-[10px] font-semibold mr-1">
          Team
        </span>
        {members.length === 0 ? (
          <span className="text-[12px] text-text-muted">No one assigned yet</span>
        ) : (
          members.map((m) => (
            <span
              key={m.personId}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-0.5 text-[12px] text-text-primary"
            >
              <button
                type="button"
                onClick={() => setLead(m.personId)}
                className="font-medium hover:underline"
                title={m.isLead ? "Lead" : "Make lead"}
              >
                {m.fullName}
                {m.isLead ? (
                  <span className="ml-1 text-[10px] uppercase text-text-muted">
                    lead
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => togglePerson(m.personId)}
                className="text-text-muted hover:text-danger"
                title="Remove from project"
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          ))
        )}
        <button
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-[12px] font-semibold text-text-secondary hover:border-text-muted hover:text-text-primary"
        >
          <UserPlus size={12} strokeWidth={2} />
          Assign
        </button>
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />
        ) : null}
      </div>

      {pickerOpen ? (
        <div className="rounded-lg border border-border bg-surface p-2 shadow-sm max-h-56 overflow-y-auto">
          <p className="px-1.5 pb-1.5 text-[11px] text-text-muted">
            Pick people from the HR roster. Anyone assigned sees this project on Home.
          </p>
          <ul className="space-y-0.5">
            {roster.map((p) => {
              const on = selected.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => togglePerson(p.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                      on
                        ? "bg-accent/10 text-text-primary"
                        : "hover:bg-surface-raised text-text-primary"
                    }`}
                  >
                    <span>{p.fullName}</span>
                    {on ? <Check size={14} className="text-accent" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : null}
    </div>
  );
}
