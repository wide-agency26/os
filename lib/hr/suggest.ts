/**
 * Suggest assignable roster people for a playbook task template (RACI).
 * Matches active people by required skill + engagement type.
 * Assignees on pm_tasks still require profiles.id — use auth_user_id bridge.
 */

export interface RosterSuggestPerson {
  id: string;
  full_name: string;
  auth_user_id: string | null;
  engagement_label: string | null;
  skill_labels: string[];
  score: number;
  reason: string;
}

export interface StepRoleSpec {
  raci: string;
  required_skill_id: string | null;
  required_engagement_type_id: string | null;
}

type PersonCandidate = {
  id: string;
  full_name: string;
  auth_user_id: string | null;
  engagement_type_id: string | null;
  roster_status: string;
  engagement_types?: { label: string; assignable_to_tasks: boolean } | null;
  person_skills?: { skill_id: string; skills?: { label: string } | null }[];
};

export function scorePeopleForRoles(
  people: PersonCandidate[],
  roles: StepRoleSpec[]
): RosterSuggestPerson[] {
  const relevant = roles.filter(
    (r) => r.raci === "responsible" || r.raci === "accountable"
  );
  const specs = relevant.length ? relevant : roles;
  if (!specs.length) return [];

  const out: RosterSuggestPerson[] = [];

  for (const p of people) {
    if (p.roster_status !== "active") continue;
    if (p.engagement_types && p.engagement_types.assignable_to_tasks === false) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];
    const skillIds = new Set((p.person_skills || []).map((s) => s.skill_id));
    const skillLabels = (p.person_skills || [])
      .map((s) => s.skills?.label)
      .filter(Boolean) as string[];

    for (const spec of specs) {
      if (spec.required_engagement_type_id) {
        if (p.engagement_type_id === spec.required_engagement_type_id) {
          score += 3;
          reasons.push(`engagement match (${spec.raci})`);
        } else {
          continue;
        }
      }
      if (spec.required_skill_id) {
        if (skillIds.has(spec.required_skill_id)) {
          score += 2;
          reasons.push(`skill match (${spec.raci})`);
        }
      } else if (!spec.required_engagement_type_id) {
        score += 1;
      }
    }

    if (score <= 0) continue;
    out.push({
      id: p.id,
      full_name: p.full_name,
      auth_user_id: p.auth_user_id,
      engagement_label: p.engagement_types?.label || null,
      skill_labels: skillLabels,
      score,
      reason: reasons.join(", ") || "roster match",
    });
  }

  return out.sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name));
}
