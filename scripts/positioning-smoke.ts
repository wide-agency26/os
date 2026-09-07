/**
 * Synthesis / positioning smoke — TARA MVB full-digital strategy.
 * Creates temporary audience + competition rows, then deletes them.
 * Usage: npx tsx scripts/positioning-smoke.ts
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { collectPositioningContext } from "../lib/positioning/inputs";
import { draftPositioning } from "../lib/positioning/generate";
import { inputsUsedToJson, loadPositioning } from "../lib/positioning/load";
import { syncPositioningModuleStatus } from "../lib/positioning/sync";
import { syncAudienceModuleStatus } from "../lib/audience/sync";
import { syncCompetitionModuleStatus } from "../lib/competition/sync";
import { moduleToCard } from "../lib/strategy/load";
import { positioningSnapshot } from "../lib/positioning/types";
import {
  AUDIENCE_MODULE_KEY,
  COMPETITION_MODULE_KEY,
  SYNTHESIS_MODULE_KEY,
} from "../lib/strategy/modules";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const match = t.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    let value = match[2] || "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const PROJECT_ID = "2eb67cac-9150-4a48-9d5d-54d340da7e24";
const SCOPE_ID = "3a3659bf-6581-4452-aadf-d08d636d9ae1";
const STRATEGY_ID = "0fbcae5a-1473-44ea-a895-31880debef94";
const MARKER = "__TEST__ positioning";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const admin = createClient(url, key) as any;

  const created: { segments: string[]; competitors: string[]; extraStrategy?: string } = {
    segments: [],
    competitors: [],
  };
  let priorSynth: { id: string; gaps: string | null; status: string } | null = null;

  try {
    console.log("phase 1: gate blocked without audience");
    const blocked = await collectPositioningContext(admin, PROJECT_ID, STRATEGY_ID);
    assert("gate" in blocked, "context missing gate");
    assert(!blocked.gate.canGenerate, "generate should be blocked");
    assert(
      /Audience Analysis must be finalized/i.test(blocked.gate.reason || ""),
      `reason: ${blocked.gate.reason}`
    );
    console.log("  blocked:", blocked.gate.reason);

    const { data: seg, error: segErr } = await admin
      .from("audience_segments")
      .insert({
        project_id: PROJECT_ID,
        name: `${MARKER} Kanzlei principals`,
        demographic_summary: "Steuerberater-Inhaber in DACH Mittelstand practices.",
        size_or_value: "High lifetime value; few, high-touch accounts.",
        rationale: "Practice owners decide digital investment.",
        status: "draft",
        accepted: true,
        ai_generated: true,
        sort_order: 99,
      })
      .select("id")
      .single();
    if (segErr || !seg) throw new Error(segErr?.message || "segment insert failed");
    created.segments.push(seg.id);
    await admin.from("audience_insight_profiles").insert({
      segment_id: seg.id,
      pains: "Fee pressure and shortage of Steuerfachangestellte.",
      motivations: "Protect professional standing while digitizing Buchhaltung.",
      channel_habits: "DATEV circles, Kanzlei newsletters, peer Empfehlung.",
      language_cues: "Mandant, Kanzlei, E-Rechnung — not 'customers' or 'SaaS'.",
      objections: "Tools that look like consumer software.",
      triggers: "E-Rechnung mandate and staff attrition.",
      status: "draft",
      ai_generated: true,
    });
    await syncAudienceModuleStatus(admin, PROJECT_ID);
    const stillBlocked = await collectPositioningContext(admin, PROJECT_ID, STRATEGY_ID);
    assert("gate" in stillBlocked && !stillBlocked.gate.canGenerate, "draft audience must still block");

    await admin
      .from("audience_segments")
      .update({ status: "finalized", updated_at: new Date().toISOString() })
      .eq("id", seg.id);
    await admin
      .from("audience_insight_profiles")
      .update({ status: "finalized", updated_at: new Date().toISOString() })
      .eq("segment_id", seg.id);
    await syncAudienceModuleStatus(admin, PROJECT_ID);
    const unlocked = await collectPositioningContext(admin, PROJECT_ID, STRATEGY_ID);
    assert("gate" in unlocked && unlocked.gate.canGenerate, "finalized audience should unlock");
    assert(
      unlocked.gate.chips.some((c) => c.moduleKey === AUDIENCE_MODULE_KEY && c.finalized),
      "audience chip not ready"
    );
    const competitionChip = unlocked.gate.chips.find((c) => c.moduleKey === COMPETITION_MODULE_KEY);
    assert(competitionChip && !competitionChip.finalized && competitionChip.optional, "competition should be optional/unready");
    console.log("  unlocked after audience finalize");

    console.log("phase 2: generate from audience only");
    const first = await draftPositioning({
      company: "TF Tax",
      projectTitle: "TARA MVB",
      strategyType: unlocked.strategyType,
      pack: unlocked.pack,
    });
    if (!first.ok) throw new Error(first.error);
    assert(!unlocked.inputsUsed[COMPETITION_MODULE_KEY], "competition should not be in first inputs");
    assert(unlocked.inputsUsed[AUDIENCE_MODULE_KEY], "audience missing from inputs_used");

    await admin.from("strategy_positioning").upsert(
      {
        strategy_id: STRATEGY_ID,
        positioning_statement: first.statement,
        rationale: first.rationale,
        inputs_used: inputsUsedToJson(unlocked.inputsUsed),
        status: "draft",
        ai_generated: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "strategy_id" }
    );
    await syncPositioningModuleStatus(admin, STRATEGY_ID);
    console.log("  first statement:", first.statement.slice(0, 120));

    const { data: competitor, error: compErr } = await admin
      .from("competitors")
      .insert({
        project_id: PROJECT_ID,
        name: `${MARKER} Generic Buchhaltung SaaS`,
        url: "https://example.com",
        notes: "Horizontal SME bookkeeping tool.",
        positioning_summary: "One-size DATEV-light for everyone.",
        status: "finalized",
        accepted: true,
        ai_generated: true,
        sort_order: 99,
      })
      .select("id")
      .single();
    if (compErr || !competitor) throw new Error(compErr?.message || "competitor insert failed");
    created.competitors.push(competitor.id);

    const { data: existingSynth } = await admin
      .from("competition_synthesis")
      .select("id, gaps_and_opportunities, status")
      .eq("project_id", PROJECT_ID)
      .maybeSingle();
    priorSynth = existingSynth
      ? {
          id: existingSynth.id as string,
          gaps: existingSynth.gaps_and_opportunities as string | null,
          status: existingSynth.status as string,
        }
      : null;
    const synthPayload = {
      project_id: PROJECT_ID,
      gaps_and_opportunities:
        "The opening is a DATEV-native Kanzlei workflow that generic Buchhaltungssoftware cannot occupy — professional standing plus E-Rechnung, not DIY bookkeeping.",
      status: "finalized",
      ai_generated: true,
      updated_at: new Date().toISOString(),
    };
    if (existingSynth?.id) {
      await admin.from("competition_synthesis").update(synthPayload).eq("id", existingSynth.id);
    } else {
      await admin.from("competition_synthesis").insert(synthPayload);
    }
    await syncCompetitionModuleStatus(admin, PROJECT_ID);

    const withComp = await collectPositioningContext(admin, PROJECT_ID, STRATEGY_ID);
    assert("gate" in withComp, "context after competition");
    assert(withComp.inputsUsed[AUDIENCE_MODULE_KEY], "audience dropped");
    assert(withComp.inputsUsed[COMPETITION_MODULE_KEY], "competition not in inputs_used");
    assert(/DATEV-native Kanzlei workflow/.test(withComp.pack), "pack missing competition text");

    const second = await draftPositioning({
      company: "TF Tax",
      projectTitle: "TARA MVB",
      strategyType: withComp.strategyType,
      pack: withComp.pack,
      previousStatement: first.statement,
      previousRationale: first.rationale,
    });
    if (!second.ok) throw new Error(second.error);
    assert(second.statement !== first.statement, "regenerate did not change the statement");
    await admin.from("strategy_positioning").upsert(
      {
        strategy_id: STRATEGY_ID,
        positioning_statement: second.statement,
        rationale: second.rationale,
        inputs_used: inputsUsedToJson(withComp.inputsUsed),
        status: "draft",
        ai_generated: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "strategy_id" }
    );
    await syncPositioningModuleStatus(admin, STRATEGY_ID);
    console.log("  second statement:", second.statement.slice(0, 120));
    console.log("  inputs_used:", Object.keys(withComp.inputsUsed).join(", "));

    console.log("phase 3: finalize + strategy scope");
    await admin
      .from("strategy_positioning")
      .update({
        positioning_statement: second.statement,
        rationale: second.rationale,
        status: "finalized",
        updated_at: new Date().toISOString(),
      })
      .eq("strategy_id", STRATEGY_ID);
    const finalStatus = await syncPositioningModuleStatus(admin, STRATEGY_ID);
    assert(finalStatus === "finalized", `module status ${finalStatus}`);
    const { data: slot } = await admin
      .from("strategy_modules")
      .select("status")
      .eq("strategy_id", STRATEGY_ID)
      .eq("module_key", SYNTHESIS_MODULE_KEY)
      .maybeSingle();
    assert(slot?.status === "finalized", `slot ${slot?.status}`);

    const row = await loadPositioning(admin, STRATEGY_ID);
    const snap = positioningSnapshot(row, true);
    assert(snap?.statement === second.statement, "client snapshot missing statement");
    const card = moduleToCard(
      { moduleKey: SYNTHESIS_MODULE_KEY, status: "finalized" },
      { positioning: snap }
    );
    assert(card.summary === second.statement, "embed headline is not the statement");
    assert(card.positioningRationale === second.rationale, "embed missing rationale");

    const { data: extra, error: extraErr } = await admin
      .from("strategies")
      .insert({
        scope_id: SCOPE_ID,
        strategy_type: "brand",
        status: "draft",
      })
      .select("id")
      .single();
    if (extraErr || !extra) throw new Error(extraErr?.message || "extra strategy failed");
    created.extraStrategy = extra.id;
    await admin.from("strategy_modules").insert({
      strategy_id: extra.id,
      module_key: SYNTHESIS_MODULE_KEY,
      status: "not_started",
      sort_order: 1,
    });
    const extraRow = await loadPositioning(admin, extra.id);
    assert(!extraRow, "second strategy inherited positioning");
    const extraStatus = await syncPositioningModuleStatus(admin, extra.id);
    assert(extraStatus === "not_started", `extra status ${extraStatus}`);
    const { data: extraSlot } = await admin
      .from("strategy_modules")
      .select("status")
      .eq("strategy_id", extra.id)
      .eq("module_key", SYNTHESIS_MODULE_KEY)
      .maybeSingle();
    assert(extraSlot?.status === "not_started", "finalizing one strategy leaked");
    console.log("  second strategy untouched");
  } finally {
    console.log("cleanup");
    if (created.extraStrategy) {
      await admin.from("strategy_modules").delete().eq("strategy_id", created.extraStrategy);
      await admin.from("strategies").delete().eq("id", created.extraStrategy);
    }
    await admin.from("strategy_positioning").delete().eq("strategy_id", STRATEGY_ID);
    for (const id of created.competitors) {
      await admin.from("competitors").delete().eq("id", id);
    }
    if (priorSynth) {
      await admin
        .from("competition_synthesis")
        .update({
          gaps_and_opportunities: priorSynth.gaps,
          status: priorSynth.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", priorSynth.id);
    } else {
      await admin.from("competition_synthesis").delete().eq("project_id", PROJECT_ID);
    }
    for (const id of created.segments) {
      await admin.from("audience_insight_profiles").delete().eq("segment_id", id);
      await admin.from("audience_segments").delete().eq("id", id);
    }
    await syncAudienceModuleStatus(admin, PROJECT_ID);
    await syncCompetitionModuleStatus(admin, PROJECT_ID);
    await syncPositioningModuleStatus(admin, STRATEGY_ID);
    console.log("ok");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
