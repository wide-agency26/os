/**
 * Rewrite Sign2x Sept IG captions into "Im Stack bleiben" series + mark carousels.
 * Usage: node scripts/rewrite-sign2x-ig-substance.mjs
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

const TYPE =
  "Type contrast: dark bg → white/cream #EAEAEA; light bg → blue #1041F4. No floating logo.";

/** @type {Record<number, object>} */
const UPDATES = {
  85: {
    hook: "Im Stack bleiben · Teil 1 — Cloud Act klartext",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description:
        "Series opener. Klartext Cloud Act. Light desk → blue type. Teaching: EU server ≠ sovereignty.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 1 🔷

„Server in der EU“ klingt sicher.
Reicht aber nicht, wenn der Anbieter unter US-Recht steht.

Cloud Act in einem Satz: Standort ≠ Jurisdiktion.

Morgen: der Check vor dem ersten Envelope.

#sign2x #CloudAct #ImStackBleiben`,
      en: `Stay in the stack · Part 1 🔷

“Server in the EU” sounds safe.
It’s not enough if the provider sits under US law.

Cloud Act in one line: location ≠ jurisdiction.

Tomorrow: the check before the first envelope.

#sign2x #CloudAct #StayInTheStack`,
    },
  },
  67: {
    hook: "Im Stack bleiben · Teil 2 — Stecker-Check (Carousel)",
    carousel: true,
    slides: 4,
    brief: {
      typography_notes: TYPE,
      graphic_description:
        "4-slide carousel 4:5. 1 US-Stecker vs Schuko. 2 Cloud Act. 3 STACKIT+Telekom. 4 Quiz CTA. Dark slides→white type; light→blue.",
      slide_1: "PASST NICHT — US-Stecker vs Schuko metaphor",
      slide_2: "CLOUD ACT — EU floor, US law",
      slide_3: "STACKIT + TELEKOM — German hosting",
      slide_4: "2 MIN — sign2x.com/quiz",
    },
    ig: {
      de: `Im Stack bleiben · Teil 2 🔷

Der falsche Stecker. Die falsche Cloud.
Gleiches Gefühl.

Swipe:
1) Passt nicht
2) Cloud Act
3) STACKIT + Telekom
4) 2-Min-Check

https://www.sign2x.com/quiz

#sign2x #CloudAct #ImStackBleiben`,
      en: `Stay in the stack · Part 2 🔷

Wrong plug. Wrong cloud.
Same feeling.

Swipe:
1) Doesn’t fit
2) Cloud Act
3) STACKIT + Telekom
4) 2-min check

https://www.sign2x.com/quiz

#sign2x #CloudAct #StayInTheStack`,
    },
  },
  86: {
    hook: "Im Stack bleiben · Teil 3 — Native vs Portal (Carousel)",
    carousel: true,
    slides: 3,
    brief: {
      typography_notes: TYPE,
      graphic_description:
        "3-slide. 1 Extra-Tab. 2 Markenbruch. 3 Native im Stack. Light scenes → blue type.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 3 🔷

Gestern: Jurisdiktion.
Heute: der Tab.

Fremdes Portal = Extra-Tab = Marke weg in der kritischsten Sekunde.

Sign2x: native Schicht. Euer Name. Kein daneben.

#sign2x #Whitelabel #ImStackBleiben`,
      en: `Stay in the stack · Part 3 🔷

Yesterday: jurisdiction.
Today: the tab.

Foreign portal = extra tab = brand gone in the critical second.

Sign2x: native layer. Your name. Not beside you.

#sign2x #Whitelabel #StayInTheStack`,
    },
  },
  63: {
    hook: "Im Stack bleiben · Teil 4 — Auch vom Couchtisch aus",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Homecare/couch still. Blue type on light. Kein Extra-Tab — series callback.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 4 🔷

Auch wenn’s auf dem Couchtisch startet:
kein Extra-Tab. Kein US-Portal.

Native im Stack.
STACKIT + Telekom.

Wochenende: der Vertrag bleibt im Haus.

#sign2x #ImStackBleiben`,
      en: `Stay in the stack · Part 4 🔷

Even from the couch:
no extra tab. No US portal.

Native in the stack.
STACKIT + Telekom.

Weekend: the contract stays in the house.

#sign2x #StayInTheStack`,
    },
  },
  71: {
    hook: "Im Stack bleiben · Wochenende — Bleibt im Haus",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Folder in bag / hallway. Series weekend beat. Blue type on light.",
    },
    ig: {
      de: `Bleibt im Haus. 🔷

Der Vertrag muss nicht durch ein US-Portal, nur weil Freitag ist.

Im Stack bleiben — auch unterwegs.
STACKIT + Telekom. 🇩🇪

Montag: drei RFP-Fragen.

#sign2x #ImStackBleiben`,
      en: `Stays in the house. 🔷

The contract doesn’t need a US portal just because it’s Friday.

Stay in the stack — even on the move.
STACKIT + Telekom. 🇩🇪

Monday: three RFP questions.

#sign2x #StayInTheStack`,
    },
  },
  89: {
    hook: "Im Stack bleiben · Teil 5 — Drei RFP-Fragen",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Three questions still. Checklist energy. Light→blue type.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 5 🔷

Bevor der Envelope rausgeht — drei Fragen:

1) Server + Recht?
2) Wer prüft die ID — wo landet sie?
3) On-prem möglich?

Weiche Antwort = teurer Lock-in später.

Quiz: https://www.sign2x.com/quiz

#sign2x #RFP #ImStackBleiben`,
      en: `Stay in the stack · Part 5 🔷

Before the envelope — three questions:

1) Servers + law?
2) Who checks ID — where does it land?
3) On-prem possible?

Soft answer = expensive lock-in later.

Quiz: https://www.sign2x.com/quiz

#sign2x #RFP #StayInTheStack`,
    },
  },
  50: {
    hook: "Im Stack bleiben · Teil 6 — Ohne US-Portal (Küche ok, aber Fakt)",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Kitchen still kept. Caption teaches native vs portal. Blue type.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 6 🔷

Küchentisch. Vertrag. Fertig.
Ohne US-Portal dazwischen.

Gestern die RFP-Fragen —
heute der Flow, der sie hält.

Native. White-label. 🇩🇪

#sign2x #ImStackBleiben`,
      en: `Stay in the stack · Part 6 🔷

Kitchen table. Contract. Done.
No US portal in between.

Yesterday’s RFP questions —
today the flow that holds them.

Native. White-label. 🇩🇪

#sign2x #StayInTheStack`,
    },
  },
  91: {
    hook: "Im Stack bleiben · Teil 7 — STACKIT vs EU-Server (Carousel)",
    carousel: true,
    slides: 4,
    brief: {
      typography_notes: TYPE,
      graphic_description:
        "4-slide. Board myth: EU server vs German hosting. Type-only STACKIT/Telekom. Dark→white / light→blue.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 7 🔷

„Wir hosten in der EU“ ≠ deutsches Hosting.

Swipe:
• Mythos EU-Server
• Cloud Act bleibt
• STACKIT + Telekom auf dem Board
• Native im Stack

#sign2x #STACKIT #ImStackBleiben`,
      en: `Stay in the stack · Part 7 🔷

“We host in the EU” ≠ German hosting.

Swipe:
• EU-server myth
• Cloud Act remains
• STACKIT + Telekom on the board
• Native in the stack

#sign2x #STACKIT #StayInTheStack`,
    },
  },
  92: {
    hook: "Im Stack bleiben · Teil 8 — Souveränität ist keine Folie",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Notebook/board still. Short punch advancing series.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 8 🔷

Souveränität steht auf dem Board —
nicht nur auf der Folie.

STACKIT + Telekom.
Entscheidung. Kein Slogan.

Morgen: wohin das Protokoll geht.

#sign2x #ImStackBleiben`,
      en: `Stay in the stack · Part 8 🔷

Sovereignty sits on the board —
not only on the slide.

STACKIT + Telekom.
Decision. Not a slogan.

Tomorrow: where the log goes.

#sign2x #StayInTheStack`,
    },
  },
  64: {
    hook: "Im Stack bleiben · Teil 9 — Die Runde ist vorbei. Das Protokoll?",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "After-meeting still. Audit-log jurisdiction. Dark→light type if dark room.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 9 🔷

Die Runde ist vorbei.
Die Daten sollten geblieben sein.

Unterschrift fertig ≠ Compliance fertig.
Wo liegt das Protokoll — unter welchem Recht?

Sign2x: Log in DE. Native im Stack.

#sign2x #AuditLog #ImStackBleiben`,
      en: `Stay in the stack · Part 9 🔷

Meeting’s over.
The data should have stayed.

Signed ≠ compliance done.
Where does the log live — under which law?

Sign2x: log in DE. Native in the stack.

#sign2x #AuditLog #StayInTheStack`,
    },
  },
  95: {
    hook: "Im Stack bleiben · Teil 10 — White-label als Markenschutz (Carousel)",
    carousel: true,
    slides: 3,
    brief: {
      typography_notes: TYPE,
      graphic_description: "3-slide white-label. Your color / no foreign logos / brand armor.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 10 🔷

White-label ist kein Deko.
Es ist Markenschutz.

Swipe: eure Farbe → keine Fremdlogos → Envelope trägt euch.

Wir bleiben still.

#sign2x #Whitelabel #ImStackBleiben`,
      en: `Stay in the stack · Part 10 🔷

White-label isn’t decoration.
It’s brand armor.

Swipe: your color → no foreign logos → envelope is you.

We stay quiet.

#sign2x #Whitelabel #StayInTheStack`,
    },
  },
  96: {
    hook: "Im Stack bleiben · Teil 11 — Kauz bleibt Kauz",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Name bleibt. Envelope still. Real partner name Kauz — type only.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 11 🔷

Kauz bleibt Kauz.
Name bleibt.

White-label heißt: die Signatur trägt das Produkt — nicht den Engine.

#sign2x #Whitelabel #Kauz`,
      en: `Stay in the stack · Part 11 🔷

Kauz stays Kauz.
Name stays.

White-label means the signature carries the product — not the engine.

#sign2x #Whitelabel #Kauz`,
    },
  },
  80: {
    hook: "Im Stack bleiben · Teil 12 — Hier bleibt es",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Letter slot. Data stays. Series mid-arc.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 12 🔷

Hier bleibt es.
Nicht in irgendeiner Cloud unterwegs.

STACKIT + Telekom. 100% DE.
Morgen: EU-Server ≠ DE-Hosting — nochmal klar.

#sign2x #ImStackBleiben`,
      en: `Stay in the stack · Part 12 🔷

It stays here.
Not wandering through “some cloud”.

STACKIT + Telekom. 100% DE.
Tomorrow: EU server ≠ DE hosting — clear again.

#sign2x #StayInTheStack`,
    },
  },
  97: {
    hook: "Im Stack bleiben · Teil 13 — EU ≠ DE Hosting",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Globe/hosting still. Deep teaching punch.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 13 🔷

EU-Server ≠ deutsches Hosting.

US-Anbieter auf EU-Boden → Cloud Act bleibt.
Frankfurt ändert das Anbieterrecht nicht.

Sign2x: STACKIT + Telekom.

#sign2x #CloudAct #ImStackBleiben`,
      en: `Stay in the stack · Part 13 🔷

EU server ≠ German hosting.

US provider on EU soil → Cloud Act remains.
Frankfurt doesn’t change provider law.

Sign2x: STACKIT + Telekom.

#sign2x #CloudAct #StayInTheStack`,
    },
  },
  98: {
    hook: "Im Stack bleiben · Teil 14 — SES · AES · QES (Carousel)",
    carousel: true,
    slides: 4,
    brief: {
      typography_notes: TYPE,
      graphic_description:
        "4-slide eIDAS. SES AES QES only — never EES/FES. Liability picks level.",
      slide_1: "THREE LEVELS — SES · AES · QES",
      slide_2: "SES — low liability",
      slide_3: "AES — B2B liability",
      slide_4: "QES — high liability + ID",
    },
    ig: {
      de: `Im Stack bleiben · Teil 14 🔷

SES · AES · QES
(nicht Marketing-Namen)

Swipe die Stufen:
• SES — einfach / geringe Haftung
• AES — fortgeschritten / B2B
• QES — qualifiziert / ID-Check

Der Vertrag wählt. Nicht die Folie.

https://www.sign2x.com/quiz

#sign2x #eIDAS #SES #AES #QES`,
      en: `Stay in the stack · Part 14 🔷

SES · AES · QES
(not marketing names)

Swipe the levels:
• SES — simple / low liability
• AES — advanced / B2B
• QES — qualified / ID check

The contract picks. Not the slide.

https://www.sign2x.com/quiz

#sign2x #eIDAS #SES #AES #QES`,
    },
  },
  81: {
    hook: "Im Stack bleiben · Teil 15 — Keine Fremdlogos",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Closed laptop. White-label punch weekend.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 15 🔷

Keine Fremdlogos.
Die Signatur trägt euren Namen.

White-label. Native. Unsichtbar.

Nächste Woche: GwG ohne Ausweis-Export.

#sign2x #Whitelabel`,
      en: `Stay in the stack · Part 15 🔷

No foreign logos.
The signature carries your name.

White-label. Native. Invisible.

Next week: AML without ID export.

#sign2x #Whitelabel`,
    },
  },
  101: {
    hook: "Im Stack bleiben · Teil 16 — Ausweis hier",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "ID face-down. GwG path opener.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 16 🔷

Ausweis hier.
Nicht im fremden Portal.

GwG braucht Kontrolle —
keinen Export der ID.

Morgen: prüfen ≠ abgeben.

#sign2x #GwG #ImStackBleiben`,
      en: `Stay in the stack · Part 16 🔷

ID here.
Not in a foreign portal.

AML needs control —
not ID export.

Tomorrow: check ≠ hand over.

#sign2x #AML #StayInTheStack`,
    },
  },
  70: {
    hook: "Im Stack bleiben · Teil 17 — Prüfen ≠ Capture (Carousel)",
    carousel: true,
    slides: 3,
    brief: {
      typography_notes: TYPE,
      graphic_description: "3-slide GwG. Check vs capture. ID stays / log in DE.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 17 🔷

Identität prüfen ≠ Daten abgeben.

Swipe:
1) Prüfung
2) Capture-Falle
3) Protokoll in DE

GwG bleibt bei euch.

#sign2x #GwG #ImStackBleiben`,
      en: `Stay in the stack · Part 17 🔷

Checking identity ≠ handing data over.

Swipe:
1) The check
2) Capture trap
3) Log in DE

AML stays with you.

#sign2x #AML #StayInTheStack`,
    },
  },
  103: {
    hook: "Im Stack bleiben · Teil 18 — Protokoll DE",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "GwG log in Germany. Series continuation.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 18 🔷

Protokoll DE.
GwG-Strecke ohne US-Portal.

Ausweis beim Nutzer.
Log unter STACKIT + Telekom.

#sign2x #GwG #ImStackBleiben`,
      en: `Stay in the stack · Part 18 🔷

Log in DE.
AML path without a US portal.

ID with the user.
Log under STACKIT + Telekom.

#sign2x #AML #StayInTheStack`,
    },
  },
  104: {
    hook: "Im Stack bleiben · Teil 19 — On-prem: läuft hier",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Server/rack still. Same native layer on-prem.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 19 🔷

Hier.
On-prem, wenn auch STACKIT-Cloud nicht reicht.

Dieselbe native Schicht.
Kein zweites Portal-Produkt.

#sign2x #OnPremise #ImStackBleiben`,
      en: `Stay in the stack · Part 19 🔷

Here.
On-prem when even STACKIT cloud isn’t enough.

Same native layer.
No second portal product.

#sign2x #OnPremise #StayInTheStack`,
    },
  },
  57: {
    hook: "Im Stack bleiben · Teil 20 — Marke bleibt nach Feierabend",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Jacket on chair. Brand stays. Dark room → light type.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 20 🔷

Jacke über den Stuhl.
Marke bleibt.

Kein Fremdlogo auf dem Screen —
auch wenn niemand mehr im Raum ist.

White-label merkt man danach.

#sign2x #Whitelabel`,
      en: `Stay in the stack · Part 20 🔷

Jacket on the chair.
Brand stays.

No foreign logo on the screen —
even when the room is empty.

That’s how you feel white-label.

#sign2x #Whitelabel`,
    },
  },
  83: {
    hook: "Im Stack bleiben · Teil 21 — Woche vorbei, Daten hier",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Week wrap. Data stayed. Bridge to proof week.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 21 🔷

Woche vorbei.
Die Daten sind hier geblieben.

Kein Cloud Act im Protokoll.
Nächste Woche: echte Namen — keine erfundenen Stimmen.

#sign2x #ImStackBleiben`,
      en: `Stay in the stack · Part 21 🔷

Week done.
The data stayed here.

No Cloud Act in the log.
Next week: real names — no invented voices.

#sign2x #StayInTheStack`,
    },
  },
  107: {
    hook: "Im Stack bleiben · Teil 22 — Echte Namen (Carousel)",
    carousel: true,
    slides: 4,
    brief: {
      typography_notes: TYPE,
      graphic_description:
        "4-slide proof. Keil KTM / NRW / Vertu-Invest / Kauz — type only, no fake logos.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 22 🔷

Beweis vor Versprechen.

Swipe echte Namen:
• Keil KTM
• NRW Grundbesitz
• Vertu-Invest
• Kauz

Keine erfundenen Zitate.

#sign2x #SocialProof #ImStackBleiben`,
      en: `Stay in the stack · Part 22 🔷

Proof over promises.

Swipe real names:
• Keil KTM
• NRW Grundbesitz
• Vertu-Invest
• Kauz

No invented quotes.

#sign2x #SocialProof #StayInTheStack`,
    },
  },
  108: {
    hook: "Im Stack bleiben · Teil 23 — Schon gesagt",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Mahbobi/voice punch. No new fairy tales.",
    },
    ig: {
      de: `Im Stack bleiben · Teil 23 🔷

Schon gesagt.
Keine neuen Märchen.

Echte Namen. STACKIT + Telekom auf dem Board.
Morgen: September-Close — TCO bis 20%.

#sign2x #ImStackBleiben`,
      en: `Stay in the stack · Part 23 🔷

Already said.
No new fairy tales.

Real names. STACKIT + Telekom on the board.
Tomorrow: September close — TCO up to 20%.

#sign2x #StayInTheStack`,
    },
  },
  109: {
    hook: "Im Stack bleiben · Finale — September in echten Namen",
    carousel: false,
    brief: {
      typography_notes: TYPE,
      graphic_description: "Sept wrap. Honest TCO ≤20%. Series finale.",
    },
    ig: {
      de: `Im Stack bleiben · Finale 🔷

September in echten Namen.
Weniger Lock-in.

Veröffentlicht: bis zu 20% TCO —
nicht „mehr“, nicht aufgeblasen.

Cloud Act. Native. SES·AES·QES. GwG. White-label.

https://www.sign2x.com
https://www.sign2x.com/quiz

#sign2x #TCO #ImStackBleiben`,
      en: `Stay in the stack · Finale 🔷

September in real names.
Less lock-in.

As published: up to 20% TCO —
not “more”, not inflated.

Cloud Act. Native. SES·AES·QES. AML. White-label.

https://www.sign2x.com
https://www.sign2x.com/quiz

#sign2x #TCO #StayInTheStack`,
    },
  },
};

async function main() {
  const { data: posts, error } = await admin
    .from("content_posts")
    .select("id, post_number, captions, visual_brief, media_kind, visual_format, remarks")
    .eq("calendar_id", CALENDAR_ID)
    .contains("platforms", ["instagram"]);
  if (error) throw new Error(error.message);

  let n = 0;
  for (const post of posts || []) {
    if (post.visual_format === "story") continue;
    const spec = UPDATES[post.post_number];
    if (!spec) continue;
    const captions = { ...(post.captions || {}) };
    captions.instagram = { de: spec.ig.de, en: spec.ig.en };
    const visual_brief = { ...(post.visual_brief || {}), ...(spec.brief || {}) };
    const patch = {
      hook_angle: spec.hook,
      captions,
      visual_brief,
      updated_at: new Date().toISOString(),
    };
    if (spec.carousel) {
      patch.media_kind = "carousel";
      patch.remarks = [post.remarks || "", "IG carousel — Im Stack bleiben"]
        .filter(Boolean)
        .join(" | ");
    }
    const { error: uErr } = await admin.from("content_posts").update(patch).eq("id", post.id);
    if (uErr) throw new Error(`#${post.post_number}: ${uErr.message}`);
    n++;
    console.log(`IG #${post.post_number}${spec.carousel ? " (carousel)" : ""}`);
  }
  console.log(`Done. Updated ${n} IG feed posts.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
