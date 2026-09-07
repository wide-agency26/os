/**
 * STACKIT → Telekom OTC scrub + pricing angle for Sign2x Sept calendar.
 * Usage: node scripts/scrub-sign2x-otc-pricing.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const CALENDAR_ID = "19977dc0-c755-4a4b-93a1-f214230be38c";

function loadEnvLocal() {
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvLocal();

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function scrubText(s) {
  if (!s || typeof s !== "string") return s;
  let out = s;
  // Long forms first
  out = out.replace(/STACKIT\s*\+\s*Telekom/gi, "Deutsche Telekom · Open Telekom Cloud (OTC)");
  out = out.replace(/STACKIT\s+and\s+Telekom/gi, "Deutsche Telekom · Open Telekom Cloud (OTC)");
  out = out.replace(/STACKIT\s*\/\s*Telekom/gi, "Deutsche Telekom · Open Telekom Cloud (OTC)");
  out = out.replace(/STACKIT-Cloud/gi, "Telekom OTC");
  out = out.replace(/STACKIT Cloud/gi, "Open Telekom Cloud (OTC)");
  out = out.replace(/\bSTACKIT\b/g, "Telekom OTC");
  return out;
}

function scrubJson(value) {
  if (value == null) return value;
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map(scrubJson);
  if (typeof value === "object") {
    const next = {};
    for (const [k, v] of Object.entries(value)) next[k] = scrubJson(v);
    return next;
  }
  return value;
}

/** Dedicated pricing / OTC caption patches for key posts */
const OVERRIDES = {
  63: {
    hook_angle: "Homecare — kein Extra-Tab am Clipboard",
    captions: {
      instagram: {
        de: `Auch im Außendienst. 🔷

Kein Extra-Tab.
Kein US-Portal zwischen Besuch und Unterschrift.

Native im Stack.
Hosting: Deutsche Telekom · Open Telekom Cloud (OTC).

#sign2x #Homecare #ImStackBleiben`,
        en: `Even in the field. 🔷

No extra tab.
No US portal between visit and signature.

Native in the stack.
Hosting: Deutsche Telekom · Open Telekom Cloud (OTC).

#sign2x #Homecare #StayInTheStack`,
      },
    },
    visual_brief: {
      background: "Homecare visit: clipboard + tablet, soft clinical daylight, no kitchen, no people faces.",
      style_notes: "Unique concept — stylized patient contract/consent UI, not reporting dashboard.",
      typography_notes:
        "Type contrast: dark bg → white/cream #EAEAEA; light bg → blue #1041F4. No floating logo.",
      graphic_description:
        "Homecare nurse clipboard with tablet showing abstract stylized patient consent / care-contract UI (Sign2x blue #1041F4). Simple blocks + signature line — not a full legal document, not Reporting.png.",
    },
  },
  87: {
    captions: {
      linkedin: {
        de: `Native vs. Portal — der harte Unterschied für ISVs.

Wenn die Signatur in einem fremden Tab liegt, passiert typischerweise Folgendes:

1. Nutzer:innen verlassen euren Produktkontext
2. Ein fremdes Logo und eine fremde URL übernehmen die Aufmerksamkeit
3. Support-Tickets fragen: „Bin ich noch bei euch?“
4. Compliance fragt: „Wo liegt jetzt das Protokoll?“

Das ist kein Design-Detail. Das ist ein Vertrauens- und Markenbruch in der kritischsten Sekunde des Deals.

Sign2x sitzt im Stack. Kein Extra-Portal. Envelope in eurer Marke. Hosting auf Deutsche Telekom · Open Telekom Cloud (OTC) — oder on-prem.

https://www.sign2x.com

#sign2x #Whitelabel #ProductUX #Datensouveränität`,
        en: `Native vs portal — the hard distinction for ISVs.

When the signature lives in a foreign tab, this is what usually happens:

1. Users leave your product context
2. A foreign logo and URL take the attention
3. Support tickets ask: “Am I still with you?”
4. Compliance asks: “Where does the log live now?”

That is not a design detail. It is a trust and brand break in the most critical second of the deal.

Sign2x sits in the stack. No extra portal. Envelope in your brand. Hosting on Deutsche Telekom · Open Telekom Cloud (OTC) — or on-prem.

https://www.sign2x.com

#sign2x #Whitelabel #ProductUX #DataSovereignty`,
      },
    },
  },
  88: {
    hook_angle: "Four RFP checks: jurisdiction, ID, white-label — and Best Price DE",
    captions: {
      linkedin: {
        de: `Vier Fragen, bevor ihr einen E-Signatur-Anbieter festnagelt.

1. Wo liegen die Server — und unter welchem Recht?
   (Standort und Anbieterland sind zwei Antworten.)

2. Wer prüft die Identität — und wo landet der Ausweis?
   (GwG braucht Kontrolle, keinen Export in ein Fremdportal.)

3. Bleibt eure Marke auf dem Envelope — und geht on-prem, wenn nötig?
   (White-label und Deploy-Optionen gehören in denselben Vertrag.)

4. Passt der Preis — ohne Lock-in-Falle?
   (Sign2x: garantiert bester Preis in Deutschland, bei voller Funktion — und ehrlich bis zu 20 % TCO, nicht „mehr“.)

Wenn eine dieser Antworten weich wird, wird es später teuer.

Sign2x antwortet klar: Deutsche Telekom · Open Telekom Cloud (OTC), native Layer, White-label, on-prem möglich.

Self-Check:
https://www.sign2x.com/quiz

#sign2x #RFP #TCO #Datensouveränität`,
        en: `Four questions before you lock an e-sign vendor.

1. Where do the servers sit — and under which law?
   (Location and provider jurisdiction are two answers.)

2. Who checks identity — and where does the ID land?
   (AML needs control, not export into a foreign portal.)

3. Does your brand stay on the envelope — and can it run on-prem if needed?
   (White-label and deploy options belong in the same contract.)

4. Does the price hold — without a lock-in trap?
   (Sign2x: guaranteed best price in Germany at full feature set — and honestly up to 20% TCO, not “more”.)

If any answer goes soft, it gets expensive later.

Sign2x answers clearly: Deutsche Telekom · Open Telekom Cloud (OTC), native layer, white-label, on-prem when needed.

Self-check:
https://www.sign2x.com/quiz

#sign2x #RFP #TCO #DataSovereignty`,
      },
    },
    visual_brief: {
      background: "Electric blue #1041F4.",
      style_notes: "WHERE / WHO / ON-PREM / PRICE. Logo once.",
      graphic_description:
        "FOUR QUESTIONS. Vendor RFP: jurisdiction, ID path, white-label/on-prem, Best Price DE + ≤20% TCO.",
    },
  },
  90: {
    captions: {
      linkedin: {
        de: `Wo die Unterhaltung endet, sollten die Daten bleiben.

Nicht in einem US-Portal.
Nicht in einem Extra-Tab.
Im Stack — unter dem Recht, das ihr euren Kund:innen versprecht.

Und der Preis sollte halten: garantiert bester Preis in Deutschland, ohne Lock-in als Geschäftsmodell. Ehrlich bis zu 20 % TCO.

Sign2x: Deutsche Telekom · Open Telekom Cloud (OTC). Native. White-label.

#sign2x #Datensouveränität #TCO`,
        en: `Where the conversation ends is where the data should stay.

Not in a US portal.
Not in an extra tab.
In the stack — under the law you promise your customers.

And the price should hold: guaranteed best price in Germany, without lock-in as a business model. Honestly up to 20% TCO.

Sign2x: Deutsche Telekom · Open Telekom Cloud (OTC). Native. White-label.

#sign2x #DataSovereignty #TCO`,
      },
    },
  },
  83: {
    captions: {
      instagram: {
        de: `Woche vorbei. 🔷

Die Daten sind hier geblieben.
Kein Cloud Act im Protokoll.
Telekom OTC. Fairer Preis — bis zu 20 % TCO.

#sign2x #Datensouveränität`,
        en: `Week done. 🔷

The data stayed here.
No Cloud Act in the log.
Telekom OTC. Fair price — up to 20% TCO.

#sign2x #DataSovereignty`,
      },
    },
  },
  58: {
    hook_angle: "September close — Best Price DE + honest TCO ≤20%, Telekom OTC",
    captions: {
      linkedin: {
        de: `September in echten Namen.

NRW Grundbesitz. Vertu-Invest. Kauz. Keil KTM.
Deutsche Telekom · Open Telekom Cloud (OTC) auf dem Board.

Was wir diesen Monat nicht machen: Versprechen aufblasen.
Lock-in ist der teure Teil. Veröffentlicht sprechen wir von bis zu 20 % TCO — nicht „mehr“, nicht „mindestens“.
Und: garantiert bester Preis in Deutschland — bei voller Funktion, ohne US-Portal-Aufschlag.

Dazu die Substanz aus September:

• Cloud Act: EU-Standort ≠ Souveränität
• Native Layer statt Portal-Tab
• SES · AES · QES nach Haftung wählen
• GwG ohne Ausweis-Export
• White-label als Wettbewerbsschutz

Weiter:
https://www.sign2x.com
https://www.sign2x.com/quiz

#sign2x #TCO #Datensouveränität`,
        en: `September in real names.

NRW Grundbesitz. Vertu-Invest. Kauz. Keil KTM.
Deutsche Telekom · Open Telekom Cloud (OTC) on the board.

What we will not do this month: inflate claims.
Lock-in is the expensive part. As published we say up to 20% TCO — not “more”, not “at least”.
And: guaranteed best price in Germany — full feature set, no US-portal premium.

Plus September’s substance:

• Cloud Act: EU location ≠ sovereignty
• Native layer instead of a portal tab
• SES · AES · QES picked by liability
• AML without ID export
• White-label as competitive protection

Next:
https://www.sign2x.com
https://www.sign2x.com/quiz

#sign2x #TCO #DataSovereignty`,
      },
    },
    visual_brief: {
      background: "Navy #000C3A.",
      style_notes: "4:3, Work Sans, real Sign2x logo only, blue #1041F4. No fake partner logos.",
      graphic_description:
        "SEPTEMBER WRAP. Real names + Telekom OTC. Best Price DE + TCO up to 20% only — never inflate.",
    },
  },
  52: {
    hook_angle: "Telekom OTC on the board — not “some EU server”.",
  },
  68: {
    hook_angle: "Mahbobi: why Telekom OTC sits on the board.",
  },
  55: {
    hook_angle: "On-prem: same native layer when even Telekom OTC cloud is not enough",
  },
  114: {
    hook_angle: "Story · Telekom OTC auf dem Board",
  },
};

async function main() {
  const { data: rows, error } = await admin
    .from("content_posts")
    .select("id, post_number, hook_angle, captions, visual_brief, team_reshare_captions, remarks")
    .eq("calendar_id", CALENDAR_ID);
  if (error) throw error;

  let updated = 0;
  for (const row of rows || []) {
    const override = OVERRIDES[row.post_number];
    let hook = scrubText(row.hook_angle || "");
    let captions = scrubJson(row.captions || {});
    let brief = scrubJson(row.visual_brief || {});
    let reshare = scrubJson(row.team_reshare_captions || {});
    let remarks = scrubText(row.remarks || "");

    if (override?.hook_angle) hook = override.hook_angle;
    if (override?.captions) captions = override.captions;
    if (override?.visual_brief) brief = override.visual_brief;

    // Always scrub even overrides (safety)
    hook = scrubText(hook);
    captions = scrubJson(captions);
    brief = scrubJson(brief);

    const patch = {
      hook_angle: hook,
      captions,
      visual_brief: brief,
      team_reshare_captions: reshare,
      remarks: remarks || null,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await admin.from("content_posts").update(patch).eq("id", row.id);
    if (upErr) {
      console.error(`#${row.post_number}`, upErr.message);
      continue;
    }
    updated += 1;
    process.stdout.write(`#${row.post_number} `);
  }
  console.log(`\nDone. Updated ${updated}/${(rows || []).length} Sept posts.`);

  // Verify no STACKIT left
  const { data: check } = await admin
    .from("content_posts")
    .select("post_number")
    .eq("calendar_id", CALENDAR_ID)
    .or(
      "hook_angle.ilike.%STACKIT%,captions.cs.{\"x\":1}"
    );
  // Fallback verify via text search in JS
  const { data: all } = await admin
    .from("content_posts")
    .select("post_number, hook_angle, captions, visual_brief")
    .eq("calendar_id", CALENDAR_ID);
  const leftovers = (all || []).filter((p) => {
    const blob = JSON.stringify(p);
    return /STACKIT/i.test(blob);
  });
  if (leftovers.length) {
    console.warn(
      "Still contain STACKIT:",
      leftovers.map((p) => p.post_number).join(", ")
    );
  } else {
    console.log("Verify: no STACKIT left in Sept calendar posts.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
