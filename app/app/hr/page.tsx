"use client";

import { Workspace } from "@/components/frappe-ui/Workspace";
import { Plus, Trash, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import {
  ROSTER_STATUSES,
  rosterStatusPill,
  type EngagementType,
  type PersonRow,
  type RosterStatus,
  type Skill,
} from "@/lib/hr/types";

export default function HrRosterDirectoryPage() {
  const router = useRouter();
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [engagementTypes, setEngagementTypes] = useState<EngagementType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RosterStatus[]>(["active"]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [skillFilter, setSkillFilter] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const [{ data: types }, { data: skillRows }] = await Promise.all([
      (supabase as any)
        .from("engagement_types")
        .select("*")
        .order("sort_order"),
      (supabase as any).from("skills").select("id, label").order("label"),
    ]);
    setEngagementTypes(types || []);
    setSkills(skillRows || []);

    let query = (supabase as any)
      .from("people")
      .select(
        `
        id,
        full_name,
        primary_email,
        phone,
        engagement_type_id,
        roster_status,
        bio_notes,
        rate_notes,
        co_founder_track,
        co_founder_track_notes,
        person_type,
        expertise_tags,
        hourly_rate_cost,
        created_at,
        engagement_types ( id, key, label, assignable_to_tasks ),
        person_skills ( skill_id, skills ( id, label ) )
      `
      )
      .order("full_name", { ascending: true });

    if (statusFilter.length > 0) {
      query = query.in("roster_status", statusFilter);
    }
    if (typeFilter.length > 0) {
      query = query.in("engagement_type_id", typeFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error(error);
      setPeople([]);
    } else {
      let rows = (data || []) as PersonRow[];
      if (skillFilter.length > 0) {
        rows = rows.filter((p) =>
          (p.person_skills || []).some((ps) => skillFilter.includes(ps.skill_id))
        );
      }
      setPeople(rows);
    }
    setLoading(false);
  }, [statusFilter, typeFilter, skillFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const coreFilled = useMemo(() => {
    const coreId = engagementTypes.find((t) => t.key === "core")?.id;
    if (!coreId) return 0;
    return people.filter(
      (p) => p.engagement_type_id === coreId && p.roster_status === "active"
    ).length;
  }, [people, engagementTypes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => {
      const hay = [
        p.full_name,
        p.primary_email,
        p.phone,
        p.engagement_types?.label,
        ...(p.person_skills || []).map((ps) => ps.skills?.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [people, search]);

  const toggleStatus = (value: RosterStatus) => {
    setStatusFilter((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const toggleType = (id: string) => {
    setTypeFilter((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const toggleSkill = (id: string) => {
    setSkillFilter((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    setIsDeleting(true);
    const { getPersonDeleteImpact } = await import("@/app/actions/hr");
    const { summarizeDeleteImpact } = await import("@/lib/hr/delete-impact");

    const impactLines: string[] = [];
    let openTaskTotal = 0;
    for (const pid of ids) {
      const res = await getPersonDeleteImpact(pid);
      if (!res.ok) continue;
      openTaskTotal += res.impact.openTasks.length;
      const person = people.find((p) => p.id === pid);
      impactLines.push(
        `${person?.full_name || pid}:\n${summarizeDeleteImpact(res.impact)}`
      );
    }

    const confirmed = confirm(
      [
        `Delete ${ids.length} person record(s) from HR?`,
        "",
        impactLines.join("\n\n") || "No linked impact found.",
        "",
        openTaskTotal > 0
          ? `${openTaskTotal} open task(s) total will become Unassigned.`
          : "",
        "Continue?",
      ]
        .filter(Boolean)
        .join("\n")
    );
    if (!confirmed) {
      setIsDeleting(false);
      return;
    }

    const supabase = createClient();
    await (supabase as any)
      .from("pm_tasks")
      .update({ assignee_person_id: null, assignee_id: null })
      .in("assignee_person_id", ids);

    const { error } = await (supabase as any)
      .from("people")
      .delete()
      .in("id", ids);
    setIsDeleting(false);
    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }
    setSelectedIds(new Set());
    await fetchData();
  };

  return (
    <Workspace wide>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Roster Directory</h2>
          <p className="text-[13px] text-gray-500 mt-1">
            Core seats filled:{" "}
            <span className="font-semibold text-gray-800">{coreFilled} of 5</span>
            {" · "}
            People we work with (not CRM clients)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              disabled={isDeleting}
              className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-100 transition-colors flex items-center gap-2"
            >
              <Trash size={16} />
              Delete ({selectedIds.size})
            </button>
          )}
          <Link
            href="/app/hr/new"
            className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Add person
          </Link>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        <aside className="w-56 shrink-0 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
              Status
            </p>
            <div className="space-y-1.5">
              {ROSTER_STATUSES.map((s) => (
                <label
                  key={s.value}
                  className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(s.value)}
                    onChange={() => toggleStatus(s.value)}
                    className="rounded border-gray-300"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
              Engagement
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {engagementTypes.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={typeFilter.includes(t.id)}
                    onChange={() => toggleType(t.id)}
                    className="rounded border-gray-300"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
              Skills
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {skills.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-[13px] text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={skillFilter.includes(s.id)}
                    onChange={() => toggleSkill(s.id)}
                    className="rounded border-gray-300"
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 bg-gray-50">
            <Search size={16} className="text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, skill…"
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-gray-400"
            />
            <span className="text-[12px] text-gray-500 tabular-nums">
              {filtered.length}
            </span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-[13px] text-gray-500">Loading roster…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <UserPlus className="mx-auto text-gray-300" size={32} />
              <p className="text-[14px] font-medium text-gray-800">No people yet</p>
              <p className="text-[13px] text-gray-500 max-w-sm mx-auto">
                Add founders, freelancers, and partners to the roster. Clients stay in CRM.
              </p>
              <Link
                href="/app/hr/new"
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium"
              >
                <Plus size={14} />
                Add first person
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={
                          filtered.length > 0 && selectedIds.size === filtered.length
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left px-4 py-2.5">Name</th>
                    <th className="text-left px-4 py-2.5">Engagement</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    <th className="text-left px-4 py-2.5">Skills</th>
                    <th className="text-left px-4 py-2.5">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/app/hr/${p.id}`)}
                      className="border-t border-gray-50 hover:bg-blue-50/50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(p.id)}
                          onClick={(e) => toggleSelect(p.id, e)}
                          onChange={() => {}}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-gray-900">
                        {p.full_name}
                        {p.co_founder_track ? (
                          <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                            Co-founder track
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">
                        {p.engagement_types?.label || "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${rosterStatusPill(
                            p.roster_status
                          )}`}
                        >
                          {p.roster_status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {(p.person_skills || [])
                          .map((ps) => ps.skills?.label)
                          .filter(Boolean)
                          .slice(0, 3)
                          .join(", ") || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {p.primary_email || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Workspace>
  );
}
