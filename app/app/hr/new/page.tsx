"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import {
  ROSTER_STATUSES,
  legacyPersonType,
  type EngagementType,
  type RosterStatus,
  type Skill,
} from "@/lib/hr/types";

export default function NewPersonPage() {
  const router = useRouter();
  const [engagementTypes, setEngagementTypes] = useState<EngagementType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
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
  });

  useEffect(() => {
    const supabase = createClient();
    void (async () => {
      const [{ data: types }, { data: skillRows }] = await Promise.all([
        (supabase as any)
          .from("engagement_types")
          .select("*")
          .order("sort_order"),
        (supabase as any).from("skills").select("id, label").order("label"),
      ]);
      setEngagementTypes(types || []);
      setSkills(skillRows || []);
      const projectFreelance = (types || []).find(
        (t: EngagementType) => t.key === "project_freelancer"
      );
      if (projectFreelance) {
        setForm((f) => ({ ...f, engagement_type_id: projectFreelance.id }));
      }
    })();
  }, []);

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

  const toggleSkill = (id: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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

    const { data, error } = await (supabase as any)
      .from("people")
      .insert([
        {
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
        },
      ])
      .select("id")
      .single();

    if (error || !data?.id) {
      setLoading(false);
      alert("Error creating person: " + (error?.message || "unknown"));
      return;
    }

    if (selectedSkillIds.length) {
      const { error: skErr } = await (supabase as any).from("person_skills").insert(
        selectedSkillIds.map((skill_id) => ({
          person_id: data.id,
          skill_id,
        }))
      );
      if (skErr) {
        console.error(skErr);
      }
    }

    setLoading(false);
    router.push(`/app/hr/${data.id}`);
  };

  return (
    <Workspace>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Link
              href="/app/hr/roster"
              className="p-2 rounded hover:bg-gray-100 text-gray-600"
              aria-label="Back to roster"
            >
              <ArrowLeft size={18} />
            </Link>
            <h2 className="text-xl font-bold text-gray-900">Add person</h2>
          </div>
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

        <Section title="Identity">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2">
              <span className="text-[12px] font-semibold text-gray-700">Full name</span>
              <input
                name="full_name"
                value={form.full_name}
                onChange={onChange}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                placeholder="Ali Hashemi"
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

        <Section title="Engagement">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Engagement type
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
              <span className="text-[12px] font-semibold text-gray-700">Status</span>
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
            <label className="flex items-center gap-2 sm:col-span-2 mt-1">
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
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-semibold text-gray-700">
                  Co-founder notes
                </span>
                <textarea
                  name="co_founder_track_notes"
                  value={form.co_founder_track_notes}
                  onChange={onChange}
                  rows={2}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                  placeholder="Sub-brand name, stage…"
                />
              </label>
            ) : null}
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
              <span className="text-[12px] font-semibold text-gray-700">Bio / quality notes</span>
              <textarea
                name="bio_notes"
                value={form.bio_notes}
                onChange={onChange}
                rows={3}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
              />
            </label>
            <label className="block">
              <span className="text-[12px] font-semibold text-gray-700">
                Rate notes (summary)
              </span>
              <textarea
                name="rate_notes"
                value={form.rate_notes}
                onChange={onChange}
                rows={2}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-[13px]"
                placeholder="Actual numbers land in Compensation (Phase 2)"
              />
            </label>
          </div>
        </Section>
      </div>
    </Workspace>
  );
}
