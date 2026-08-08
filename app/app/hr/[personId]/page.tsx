"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save, Trash } from "lucide-react";
import Link from "next/link";
import {
  ROSTER_STATUSES,
  legacyPersonType,
  rosterStatusPill,
  type EngagementType,
  type RosterStatus,
  type Skill,
} from "@/lib/hr/types";

export default function PersonDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.personId as string;

  const [engagementTypes, setEngagementTypes] = useState<EngagementType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    primary_email: "",
    phone: "",
    engagement_type_id: "",
    roster_status: "active" as RosterStatus,
    bio_notes: "",
    rate_notes: "",
    co_founder_track: false,
    co_founder_track_notes: "",
    hourly_rate_cost: "",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setFetching(true);
    const supabase = createClient();
    const [{ data: types }, { data: skillRows }, { data: person }] =
      await Promise.all([
        (supabase as any)
          .from("engagement_types")
          .select("*")
          .order("sort_order"),
        (supabase as any).from("skills").select("id, label").order("label"),
        (supabase as any)
          .from("people")
          .select(
            `
            *,
            person_skills ( skill_id )
          `
          )
          .eq("id", id)
          .single(),
      ]);

    setEngagementTypes(types || []);
    setSkills(skillRows || []);

    if (person) {
      setForm({
        full_name: person.full_name || "",
        primary_email: person.primary_email || "",
        phone: person.phone || "",
        engagement_type_id: person.engagement_type_id || "",
        roster_status: (person.roster_status || "active") as RosterStatus,
        bio_notes: person.bio_notes || "",
        rate_notes: person.rate_notes || "",
        co_founder_track: Boolean(person.co_founder_track),
        co_founder_track_notes: person.co_founder_track_notes || "",
        hourly_rate_cost:
          person.hourly_rate_cost != null ? String(person.hourly_rate_cost) : "",
      });
      setSelectedSkillIds(
        (person.person_skills || []).map((ps: { skill_id: string }) => ps.skill_id)
      );
    }
    setFetching(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setForm((f) => ({
        ...f,
        [name]: (e.target as HTMLInputElement).checked,
      }));
      return;
    }
    setForm((f) => ({ ...f, [name]: value }));
  };

  const toggleSkill = (skillId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((x) => x !== skillId)
        : [...prev, skillId]
    );
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      alert("Full name is required.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const eng = engagementTypes.find((t) => t.id === form.engagement_type_id);
    const skillLabels = skills
      .filter((s) => selectedSkillIds.includes(s.id))
      .map((s) => s.label);

    const { error } = await (supabase as any)
      .from("people")
      .update({
        full_name: form.full_name.trim(),
        name: form.full_name.trim(),
        primary_email: form.primary_email.trim() || null,
        phone: form.phone.trim() || null,
        engagement_type_id: form.engagement_type_id || null,
        roster_status: form.roster_status,
        bio_notes: form.bio_notes.trim() || null,
        rate_notes: form.rate_notes.trim() || null,
        co_founder_track: form.co_founder_track,
        co_founder_track_notes: form.co_founder_track
          ? form.co_founder_track_notes.trim() || null
          : null,
        person_type: legacyPersonType(eng?.key),
        expertise_tags: skillLabels,
        hourly_rate_cost: form.hourly_rate_cost
          ? Number(form.hourly_rate_cost)
          : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setLoading(false);
      alert("Error saving: " + error.message);
      return;
    }

    await (supabase as any).from("person_skills").delete().eq("person_id", id);
    if (selectedSkillIds.length) {
      await (supabase as any).from("person_skills").insert(
        selectedSkillIds.map((skill_id) => ({
          person_id: id,
          skill_id,
        }))
      );
    }

    setLoading(false);
    router.push("/app/hr");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this person from the roster? This cannot be undone.")) {
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("people").delete().eq("id", id);
    setLoading(false);
    if (error) {
      alert("Error deleting: " + error.message);
      return;
    }
    router.push("/app/hr");
  };

  if (fetching) {
    return (
      <Workspace>
        <div className="p-8 text-center text-gray-500 text-[13px]">Loading person…</div>
      </Workspace>
    );
  }

  const engLabel =
    engagementTypes.find((t) => t.id === form.engagement_type_id)?.label || "—";

  return (
    <Workspace>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200 gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/app/hr"
              className="p-2 rounded hover:bg-gray-100 text-gray-600 shrink-0"
              aria-label="Back to roster"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {form.full_name || "Person"}
              </h2>
              <p className="text-[12px] text-gray-500 flex items-center gap-2 flex-wrap">
                <span>{engLabel}</span>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${rosterStatusPill(
                    form.roster_status
                  )}`}
                >
                  {form.roster_status}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={loading}
              className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-[13px] font-medium hover:bg-red-100 flex items-center gap-2"
            >
              <Trash size={16} />
              Delete
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={16} />
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-2">
            <Section title="Contact">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block sm:col-span-2">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Full name
                  </span>
                  <input
                    name="full_name"
                    value={form.full_name}
                    onChange={onChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">Email</span>
                  <input
                    name="primary_email"
                    type="email"
                    value={form.primary_email}
                    onChange={onChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">Phone</span>
                  <input
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
              </div>
            </Section>

            <Section title="Skills">
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => {
                  const on = selectedSkillIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSkill(s.id)}
                      className={`px-2.5 py-1 rounded-full text-[12px] border transition-colors ${
                        on
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Notes">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Bio / quality notes
                  </span>
                  <textarea
                    name="bio_notes"
                    value={form.bio_notes}
                    onChange={onChange}
                    rows={4}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Rate notes
                  </span>
                  <textarea
                    name="rate_notes"
                    value={form.rate_notes}
                    onChange={onChange}
                    rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                </label>
              </div>
            </Section>

            <Section title="Activity">
              <p className="text-[13px] text-gray-500 leading-relaxed">
                Project history from the PM module will appear here in a later phase
                (read-only). Compensation ledger ships in Phase 2.
              </p>
            </Section>
          </div>

          <aside>
            <Section title="Engagement">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Type
                  </span>
                  <select
                    name="engagement_type_id"
                    value={form.engagement_type_id}
                    onChange={onChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  >
                    <option value="">Select…</option>
                    {engagementTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Status
                  </span>
                  <select
                    name="roster_status"
                    value={form.roster_status}
                    onChange={onChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  >
                    {ROSTER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold text-gray-700">
                    Hourly cost (capacity)
                  </span>
                  <input
                    name="hourly_rate_cost"
                    type="number"
                    step="0.01"
                    value={form.hourly_rate_cost}
                    onChange={onChange}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Existing PM capacity field — full comp ledger comes in Phase 2.
                  </p>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="co_founder_track"
                    checked={form.co_founder_track}
                    onChange={onChange}
                    className="rounded border-gray-300"
                  />
                  <span className="text-[13px] text-gray-800">Co-founder track</span>
                </label>
                {form.co_founder_track ? (
                  <label className="block">
                    <span className="text-[12px] font-semibold text-gray-700">
                      Co-founder notes
                    </span>
                    <textarea
                      name="co_founder_track_notes"
                      value={form.co_founder_track_notes}
                      onChange={onChange}
                      rows={3}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                    />
                  </label>
                ) : null}
              </div>
            </Section>
          </aside>
        </div>
      </div>
    </Workspace>
  );
}
