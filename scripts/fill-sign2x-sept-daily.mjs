/**
 * Fill Sign2x September 2026 with weekday LI+IG static pairs,
 * convert reels to static, and write team_reshare_captions for all LI.
 *
 * Usage: node scripts/fill-sign2x-sept-daily.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const PROJECT_ID = "96468999-a1df-4393-9a5a-6b1cd5b970ae";
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

function weekdaysInSept2026() {
  const out = [];
  for (let d = 1; d <= 30; d++) {
    const dt = new Date(Date.UTC(2026, 8, d));
    const day = dt.getUTCDay(); // 0 Sun
    if (day !== 0 && day !== 6) out.push(`2026-09-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** New posts to insert (missing twins / empty weekdays). */
const NEW_POSTS = [
  // Sep 1 — kickoff
  {
    date: "2026-09-01",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "Cloud Act in one sentence. What it means for your envelope.",
    brief: {
      background: "Electric blue #1041F4.",
      style_notes: "Type card + one glass seal. Logo once. Educational, not hype.",
      graphic_description: "CLOUD ACT IN ONE LINE. Sub: US-Recht kann US-Anbieter treffen — auch auf EU-Boden.",
    },
    captions: {
      linkedin: {
        de: `Der US Cloud Act in einem Satz. 🔷

US-Behörden können unter Bedingungen auf Daten bei US-Anbietern zugreifen — auch wenn die Server in der EU stehen.

Deshalb reicht „EU-Server“ als Antwort nicht.
Sign2x läuft auf STACKIT + Telekom. Deutsches Hosting. Native im Stack.

Nicht Panik. Klarheit.

#sign2x #CloudAct #Datensouveränität`,
        en: `The US Cloud Act in one sentence. 🔷

US authorities can, under conditions, reach data held by US providers — even when servers sit in the EU.

That is why “EU server” is not the whole answer.
Sign2x runs on STACKIT + Telekom. German hosting. Native in the stack.

Clarity, not panic.

#sign2x #CloudAct #DataSovereignty`,
      },
    },
    team: {
      de: `Kurzer Reminder aus dem Team #sign2x: EU-Standort ≠ Souveränität. Der Cloud Act erklärt, warum Hosting und Anbieterland zusammengehören.`,
      en: `From Team #sign2x: an EU location is not sovereignty. The Cloud Act is why hosting and provider jurisdiction both matter.`,
    },
  },
  {
    date: "2026-09-01",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Klartext. Cloud Act.",
    brief: {
      background: "Office desk, soft daylight, lived-in — not kitchen.",
      style_notes: "3:4 lifestyle. Big type KLARTEXT. Tablet with Reporting UI optional. No floating logo. No crumbs.",
      graphic_description: "Desk still + depth type KLARTEXT / CLOUD ACT. Authentic German office, not showroom.",
    },
    captions: {
      instagram: {
        de: `Klartext. Cloud Act. 🔷
EU-Server allein reicht nicht.

STACKIT + Telekom. 🇩🇪
#sign2x #Datensouveränität`,
        en: `Plain talk. Cloud Act. 🔷
An EU server alone is not enough.

STACKIT + Telekom. 🇩🇪
#sign2x #DataSovereignty`,
      },
    },
  },
  // Sep 3 — twin IG for Native Layer LI
  {
    date: "2026-09-03",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Im Stack. Nicht daneben.",
    brief: {
      background: "Co-working desk / monitor glow, soft day.",
      style_notes: "3:4. Type IM STACK. Monitor shows Signing-Fields UI crop. No floating logo.",
      graphic_description: "Monitor with Sign2x fields UI. Depth type IM STACK.",
    },
    captions: {
      instagram: {
        de: `Im Stack. Nicht daneben. 🔷
Kein Extra-Portal.

#sign2x #Whitelabel`,
        en: `In the stack. Not beside it. 🔷
No extra portal.

#sign2x #Whitelabel`,
      },
    },
  },
  // Sep 4 — twin LI for Homecare IG
  {
    date: "2026-09-04",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "Native vs portal. Why the tab switch costs trust.",
    brief: {
      background: "Navy #000C3A.",
      style_notes: "Type card. Educational. Logo once.",
      graphic_description: "NATIVE VS PORTAL. Sub: Jeder Tab-Wechsel ist ein Vertrauensbruch im Prozess.",
    },
    captions: {
      linkedin: {
        de: `Native vs. Portal. 🔷

Wenn die Signatur in einem fremden Tab liegt, verlassen Nutzer:innen euren Flow — und oft eure Marke.

Native heißt: dieselbe Oberfläche, derselbe Stack, derselbe Name auf dem Envelope.
Kein Extra-Login. Kein Tab-Wechsel.

Das ist kein Design-Geschmack. Das ist Prozessvertrauen.

#sign2x #Datensouveränität #Whitelabel`,
        en: `Native vs portal. 🔷

If the signature lives in a foreign tab, users leave your flow — and often your brand.

Native means: same UI, same stack, same name on the envelope.
No extra login. No tab hop.

That is not taste. That is process trust.

#sign2x #DataSovereignty #Whitelabel`,
      },
    },
    team: {
      de: `Team #sign2x: Native vs Portal — warum der Tab-Wechsel mehr kostet als UX. Kurz und klar.`,
      en: `Team #sign2x: native vs portal — why the tab switch costs more than UX.`,
    },
  },
  // Sep 7
  {
    date: "2026-09-07",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "Three questions before you pick an e-sign vendor.",
    brief: {
      background: "Electric blue #1041F4.",
      style_notes: "3-slide or single: WHERE / WHO / ON-PREM. Logo once.",
      graphic_description: "THREE QUESTIONS. Where are the servers. Who checks the ID. Can it run on-prem.",
    },
    captions: {
      linkedin: {
        de: `Drei Fragen, bevor ihr einen E-Signatur-Anbieter wählt. 🔷

1. Wo liegen die Server — und unter welchem Recht?
2. Wer prüft die Identität — und wo bleibt der Ausweis?
3. Kann die Strecke on-prem, wenn Cloud nicht reicht?

Wenn eine Antwort weich wird, wird der Envelope weich.

2 Minuten Check: https://www.sign2x.com/quiz

#sign2x #eIDAS #Datensouveränität`,
        en: `Three questions before you pick an e-sign vendor. 🔷

1. Where do the servers sit — under which law?
2. Who checks identity — and where does the ID stay?
3. Can the path run on-prem when cloud is not enough?

If an answer goes soft, the envelope goes soft.

2-minute check: https://www.sign2x.com/quiz

#sign2x #eIDAS #DataSovereignty`,
      },
    },
    team: {
      de: `Aus dem Team #sign2x: drei harte Fragen vor dem nächsten E-Signatur-Deal. Speichern lohnt sich.`,
      en: `From Team #sign2x: three hard questions before your next e-sign deal. Worth saving.`,
    },
  },
  {
    date: "2026-09-07",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Drei Fragen.",
    brief: {
      background: "Window sill / office ledge, soft light.",
      style_notes: "3:4. Type DREI FRAGEN. Branded blue folder. No kitchen.",
      graphic_description: "Blue Sign2x folder on ledge. Depth type DREI FRAGEN.",
    },
    captions: {
      instagram: {
        de: `Drei Fragen. 🔷
Server. Identität. On-prem.

Dann erst der Envelope.
#sign2x`,
        en: `Three questions. 🔷
Servers. Identity. On-prem.

Then the envelope.
#sign2x`,
      },
    },
  },
  // Sep 8 twin LI
  {
    date: "2026-09-08",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "Where the conversation ends is where the data should stay.",
    brief: {
      background: "Navy #000C3A.",
      style_notes: "Type card. Educational. Logo once.",
      graphic_description: "WHERE IT ENDS. Sub: Der Prozess endet im Stack — nicht in einem US-Portal.",
    },
    captions: {
      linkedin: {
        de: `Wo die Unterhaltung endet, sollten die Daten bleiben. 🔷

Nicht in einem US-Portal.
Nicht in einem Extra-Tab.
Im Stack — mit STACKIT + Telekom, oder on-prem.

Das ist Datensouveränität als Prozessdesign, nicht als Folie.

#sign2x #Datensouveränität`,
        en: `Where the conversation ends is where the data should stay. 🔷

Not in a US portal.
Not in an extra tab.
In the stack — on STACKIT + Telekom, or on-prem.

Sovereignty as process design, not a slide.

#sign2x #DataSovereignty`,
      },
    },
    team: {
      de: `Team #sign2x: Souveränität ist Prozessdesign — nicht nur ein Serverstandort auf der Folie.`,
      en: `Team #sign2x: sovereignty is process design — not just a server pin on a slide.`,
    },
  },
  // Sep 9 twin IG
  {
    date: "2026-09-09",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Auf dem Board.",
    brief: {
      background: "Office whiteboard edge / desk, soft light.",
      style_notes: "3:4. Type AUF DEM BOARD. No fake partner logos.",
      graphic_description: "Notebook or board traces. Type AUF DEM BOARD.",
    },
    captions: {
      instagram: {
        de: `Auf dem Board. 🔷
STACKIT + Telekom.

Nicht irgendein EU-Server.
#sign2x #STACKIT`,
        en: `On the board. 🔷
STACKIT + Telekom.

Not some EU server.
#sign2x #STACKIT`,
      },
    },
  },
  // Sep 10 twin IG
  {
    date: "2026-09-10",
    platforms: ["instagram"],
    pillar: "PEOPLE",
    hook: "Keine Folie.",
    brief: {
      background: "Quiet founder desk, closed notebook.",
      style_notes: "3:4. Type KEINE FOLIE. No AI portrait.",
      graphic_description: "Desk still. Type KEINE FOLIE.",
    },
    captions: {
      instagram: {
        de: `Keine Folie. 🔷
Souveränität steht auf dem Board.

#sign2x`,
        en: `Not a slide. 🔷
Sovereignty is on the board.

#sign2x`,
      },
    },
  },
  // Sep 11 twin LI + convert video separately
  {
    date: "2026-09-11",
    platforms: ["linkedin"],
    pillar: "PEOPLE",
    hook: "After the meeting: where did the minutes go?",
    brief: {
      background: "Electric blue #1041F4.",
      style_notes: "Type + glass stamp. Logo once.",
      graphic_description: "AFTER THE MEETING. Sub: Protokoll in DE — nicht in US-Cloud.",
    },
    captions: {
      linkedin: {
        de: `Nach der Runde: wohin ist das Protokoll? 🔷

Wenn die Signaturstrecke US-Cloud mitzieht, zieht das Protokoll mit.

Sign2x: Daten bleiben im Stack.
STACKIT + Telekom. Oder on-prem.

Die Runde ist vorbei. Die Daten nicht.

#sign2x #Datensouveränität`,
        en: `After the meeting: where did the minutes go? 🔷

If the signature path pulls US cloud, the minutes follow.

Sign2x: data stays in the stack.
STACKIT + Telekom. Or on-prem.

The meeting ends. The data does not leave.

#sign2x #DataSovereignty`,
      },
    },
    team: {
      de: `Team #sign2x: nach dem Meeting zählt, wo das Protokoll landet — nicht nur, dass alle unterschrieben haben.`,
      en: `Team #sign2x: after the meeting, where the minutes land matters as much as the signatures.`,
    },
  },
  // Sep 14
  {
    date: "2026-09-14",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "White-label means your color, your name, our silence.",
    brief: {
      background: "Navy #000C3A.",
      style_notes: "Type card. Logo subtle. No fake partner marks.",
      graphic_description: "YOUR COLOR. YOUR NAME. OUR SILENCE.",
    },
    captions: {
      linkedin: {
        de: `White-label heißt: eure Farbe, euer Name, unsere Stille. 🔷

Keine Fremdlogos auf dem Envelope.
Kein fremdes Portal im Flow.
Sign2x bleibt unsichtbar — und der Stack deutsch.

Kauz bleibt Kauz. Euer Produkt bleibt euer Produkt.

#sign2x #Whitelabel #Datensouveränität`,
        en: `White-label means: your color, your name, our silence. 🔷

No foreign logos on the envelope.
No foreign portal in the flow.
Sign2x stays invisible — and the stack stays German.

Your product stays your product.

#sign2x #Whitelabel #DataSovereignty`,
      },
    },
    team: {
      de: `Team #sign2x: White-label = eure Marke vorne, wir im Hintergrund. So sollte Software für ISVs aussehen.`,
      en: `Team #sign2x: white-label = your brand in front, us in the background. That is how ISV software should feel.`,
    },
  },
  {
    date: "2026-09-14",
    platforms: ["instagram"],
    pillar: "PEOPLE",
    hook: "Eure Farbe.",
    brief: {
      background: "Closed laptop with blank cream sleeve, late light.",
      style_notes: "3:4. Type EURE FARBE. Not jacket clone of 25 Sep.",
      graphic_description: "Laptop sleeve still. Type EURE FARBE.",
    },
    captions: {
      instagram: {
        de: `Eure Farbe. 🔷
Keine Fremdlogos.

#sign2x #Whitelabel`,
        en: `Your color. 🔷
No foreign logos.

#sign2x #Whitelabel`,
      },
    },
  },
  // Sep 15 twin IG
  {
    date: "2026-09-15",
    platforms: ["instagram"],
    pillar: "PEOPLE",
    hook: "Name bleibt.",
    brief: {
      background: "Envelope on desk, soft light.",
      style_notes: "3:4. Type NAME BLEIBT. Branded blue accent on envelope flap optional.",
      graphic_description: "Envelope still. Type NAME BLEIBT.",
    },
    captions: {
      instagram: {
        de: `Name bleibt. 🔷
White-label. Native.

#sign2x`,
        en: `Name stays. 🔷
White-label. Native.

#sign2x`,
      },
    },
  },
  // Sep 17 twin IG
  {
    date: "2026-09-17",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Nicht gleich.",
    brief: {
      background: "Map/atlas or globe object on desk — not plug gag.",
      style_notes: "3:4. Type NICHT GLEICH. Educational companion to LI EU≠DE.",
      graphic_description: "Desk globe/map still. Type NICHT GLEICH.",
    },
    captions: {
      instagram: {
        de: `Nicht gleich. 🔷
EU-Server ≠ deutsches Hosting.

#sign2x #CloudAct`,
        en: `Not the same. 🔷
EU server ≠ German hosting.

#sign2x #CloudAct`,
      },
    },
  },
  // Sep 18 twin IG
  {
    date: "2026-09-18",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Drei Stempel.",
    brief: {
      background: "Desk with three small stamp objects, soft light.",
      style_notes: "3:4. Type DREI STEMPEL. EES FES QES — no SES/AES.",
      graphic_description: "Three stamp still life. Type DREI STEMPEL.",
    },
    captions: {
      instagram: {
        de: `Drei Stempel. 🔷
EES. FES. QES.

Nie SES. Nie AES.
#sign2x #eIDAS`,
        en: `Three stamps. 🔷
EES. FES. QES.

Never SES. Never AES.
#sign2x #eIDAS`,
      },
    },
  },
  // Sep 19 twin LI
  {
    date: "2026-09-19",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "If your users see our logo, we failed white-label.",
    brief: {
      background: "Electric blue #1041F4.",
      style_notes: "Type card. Logo once subtle.",
      graphic_description: "IF THEY SEE US, WE FAILED. Sub: White-label = unsichtbar im Stack.",
    },
    captions: {
      linkedin: {
        de: `Wenn eure Nutzer unser Logo sehen, haben wir White-label verfehlt. 🔷

Der Envelope trägt euren Namen.
Die Farbe ist eure.
Sign2x bleibt die Schicht darunter — STACKIT + Telekom, oder on-prem.

Unsichtbar ist hier ein Feature.

#sign2x #Whitelabel`,
        en: `If your users see our logo, we failed white-label. 🔷

The envelope carries your name.
The color is yours.
Sign2x stays the layer underneath — STACKIT + Telekom, or on-prem.

Invisible is the feature.

#sign2x #Whitelabel`,
      },
    },
    team: {
      de: `Team #sign2x: wenn Kund:innen unser Logo sehen, war White-label nicht fertig. So denken wir darüber.`,
      en: `Team #sign2x: if customers see our logo, white-label was not done. That is how we think about it.`,
    },
  },
  // Sep 21
  {
    date: "2026-09-21",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "GwG without shipping the ID to a foreign portal.",
    brief: {
      background: "Navy #000C3A.",
      style_notes: "Type card. No PII. Logo once.",
      graphic_description: "ID STAYS. Sub: GwG-Strecke ohne Ausweis in US-Cloud.",
    },
    captions: {
      linkedin: {
        de: `GwG, ohne den Ausweis ins Ausland zu schicken. 🔷

Identität prüfen.
Protokoll in Deutschland halten.
Keine US-Cloud in der Strecke.

Für Softwarehersteller ist das kein Extra-Feature — das ist die Pflichtstrecke.

#sign2x #GwG #Datensouveränität`,
        en: `AML without shipping the ID abroad. 🔷

Check identity.
Keep the log in Germany.
No US cloud on the path.

For software vendors that is not a nice-to-have — it is the duty path.

#sign2x #AML #DataSovereignty`,
      },
    },
    team: {
      de: `Team #sign2x: GwG ohne Ausweis-Export. Kurz erklärt, warum die Strecke zählt.`,
      en: `Team #sign2x: AML without exporting the ID. Why the path matters.`,
    },
  },
  {
    date: "2026-09-21",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Ausweis hier.",
    brief: {
      background: "Desk, ID face-down (no PII), soft light — distinct from 22 Sep.",
      style_notes: "3:4. Type AUSWEIS HIER. No readable PII.",
      graphic_description: "ID face-down still. Type AUSWEIS HIER.",
    },
    captions: {
      instagram: {
        de: `Ausweis hier. 🔷
Nicht im Portal.

#sign2x #GwG`,
        en: `ID here. 🔷
Not in the portal.

#sign2x #AML`,
      },
    },
  },
  // Sep 22 twin LI
  {
    date: "2026-09-22",
    platforms: ["linkedin"],
    pillar: "PRODUCT",
    hook: "Identity check is not the same as portal capture.",
    brief: {
      background: "Electric blue #1041F4.",
      style_notes: "Educational type. Complements IG still. No PII.",
      graphic_description: "CHECK ≠ CAPTURE. Sub: Prüfen ohne die Daten abzugeben.",
    },
    captions: {
      linkedin: {
        de: `Identität prüfen ≠ Daten abgeben. 🔷

GwG braucht Kontrolle.
Es braucht nicht, dass der Ausweis in einem US-Portal landet.

Bei Sign2x bleibt die Prüfung bei euch.
Das Protokoll in Deutschland.

#sign2x #GwG #Datensouveränität`,
        en: `Checking identity ≠ handing the data over. 🔷

AML needs control.
It does not need the ID inside a US portal.

With Sign2x the check stays with you.
The log stays in Germany.

#sign2x #AML #DataSovereignty`,
      },
    },
    team: {
      de: `Team #sign2x: Identität prüfen heißt nicht, den Ausweis zu exportieren. Wichtiger Unterschied.`,
      en: `Team #sign2x: checking identity is not exporting the ID. An important distinction.`,
    },
  },
  // Sep 23 twin IG
  {
    date: "2026-09-23",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Protokoll DE.",
    brief: {
      background: "Server/rack abstract object or stamped log book on desk.",
      style_notes: "3:4. Type PROTOKOLL DE. No PII.",
      graphic_description: "Log book / stamp still. Type PROTOKOLL DE.",
    },
    captions: {
      instagram: {
        de: `Protokoll DE. 🔷
GwG bleibt bei euch.

#sign2x #GwG`,
        en: `Log in DE. 🔷
AML stays with you.

#sign2x #AML`,
      },
    },
  },
  // Sep 24 twin IG
  {
    date: "2026-09-24",
    platforms: ["instagram"],
    pillar: "PRODUCT",
    hook: "Hier.",
    brief: {
      background: "On-prem hint: empty rack silhouette or server brick on desk.",
      style_notes: "3:4. Type HIER. Companion to LI on-prem.",
      graphic_description: "Mini rack object. Type HIER.",
    },
    captions: {
      instagram: {
        de: `Hier. 🔷
On-prem, wenn Cloud nicht reicht.

#sign2x #OnPremise`,
        en: `Here. 🔷
On-prem when cloud is not enough.

#sign2x #OnPremise`,
      },
    },
  },
  // Sep 25 twin LI
  {
    date: "2026-09-25",
    platforms: ["linkedin"],
    pillar: "PEOPLE",
    hook: "Brand stays when the room empties.",
    brief: {
      background: "Navy #000C3A.",
      style_notes: "Type card. Complements jacket IG. Logo once.",
      graphic_description: "BRAND STAYS. Sub: White-label auch nach Feierabend.",
    },
    captions: {
      linkedin: {
        de: `Die Marke bleibt, wenn der Raum leer ist. 🔷

Kein Fremdlogo auf dem Screen.
Kein fremdes Portal in der Erinnerung der Nutzer:innen.

White-label ist auch das, was übrig bleibt, wenn niemand mehr im Büro sitzt.

#sign2x #Whitelabel`,
        en: `The brand stays when the room empties. 🔷

No foreign logo on the screen.
No foreign portal in the user’s memory.

White-label is also what remains after everyone left.

#sign2x #Whitelabel`,
      },
    },
    team: {
      de: `Team #sign2x: White-label merkt man daran, was übrig bleibt, wenn der Screen dunkel ist.`,
      en: `Team #sign2x: you notice white-label by what is left when the screen goes dark.`,
    },
  },
  // Sep 28
  {
    date: "2026-09-28",
    platforms: ["linkedin"],
    pillar: "PEOPLE",
    hook: "Proof over promises. Names already in the room.",
    brief: {
      background: "Electric blue #1041F4.",
      style_notes: "Type card. Real names type-only. Logo once.",
      graphic_description: "PROOF OVER PROMISES. Names in type only.",
    },
    captions: {
      linkedin: {
        de: `Beweis vor Versprechen. 🔷

Namen, die schon im Raum sind — keine erfundenen Stimmen.
Kein neues Fake-Testimonial.

Wer Sign2x native einsetzt, unterschreibt nicht in einem US-Portal.

#sign2x #Datensouveränität`,
        en: `Proof over promises. 🔷

Names already in the room — no invented voices.
No fake testimonial.

If you run Sign2x native, you do not sign in a US portal.

#sign2x #DataSovereignty`,
      },
    },
    team: {
      de: `Team #sign2x: lieber echte Namen als erfundene Zitate. So arbeiten wir an Social Proof.`,
      en: `Team #sign2x: real names over invented quotes. That is how we do social proof.`,
    },
  },
  {
    date: "2026-09-28",
    platforms: ["instagram"],
    pillar: "PEOPLE",
    hook: "Echte Namen.",
    brief: {
      background: "Name cards / typed list on desk — no fake logos.",
      style_notes: "3:4. Type ECHTE NAMEN.",
      graphic_description: "Paper name list still. Type ECHTE NAMEN.",
    },
    captions: {
      instagram: {
        de: `Echte Namen. 🔷
Keine erfundenen Stimmen.

#sign2x`,
        en: `Real names. 🔷
No invented voices.

#sign2x`,
      },
    },
  },
  // Sep 29 twin IG
  {
    date: "2026-09-29",
    platforms: ["instagram"],
    pillar: "PEOPLE",
    hook: "Schon gesagt.",
    brief: {
      background: "Quiet desk, closed folder blue branded.",
      style_notes: "3:4. Type SCHON GESAGT. Companion to Mahbobi LI.",
      graphic_description: "Blue folder still. Type SCHON GESAGT.",
    },
    captions: {
      instagram: {
        de: `Schon gesagt. 🔷
Keine neuen Märchen.

#sign2x`,
        en: `Already said. 🔷
No new fairy tales.

#sign2x`,
      },
    },
  },
  // Sep 30 twin IG
  {
    date: "2026-09-30",
    platforms: ["instagram"],
    pillar: "PEOPLE",
    hook: "September.",
    brief: {
      background: "Calendar page / desk wrap still.",
      style_notes: "3:4. Type SEPTEMBER. Month wrap companion.",
      graphic_description: "Calendar/desk wrap. Type SEPTEMBER.",
    },
    captions: {
      instagram: {
        de: `September. 🔷
Echte Namen. Weniger Lock-in.

#sign2x`,
        en: `September. 🔷
Real names. Less lock-in.

#sign2x`,
      },
    },
  },
];

/** Team reshare for existing LI posts that already have content. */
const EXISTING_LI_TEAM = {
  78: {
    de: `Team #sign2x: Compliance-Check für ISVs — wo Server, wer prüft ID, ob on-prem geht. 2 Minuten.`,
    en: `Team #sign2x: compliance check for ISVs — servers, ID, on-prem. Two minutes.`,
  },
  79: {
    de: `Team #sign2x: Native Layer, kein Extra-Portal. So erklären wir ISVs den Unterschied.`,
    en: `Team #sign2x: native layer, not an extra portal. How we explain the difference to ISVs.`,
  },
  52: {
    de: `Team #sign2x: STACKIT + Telekom stehen auf dem Board — nicht „irgendein EU-Server“.`,
    en: `Team #sign2x: STACKIT + Telekom are on the board — not “some EU server”.`,
  },
  68: {
    de: `Team #sign2x: warum STACKIT + Telekom auf dem Board stehen — die Begründung hinter der Company-Page.`,
    en: `Team #sign2x: why STACKIT + Telekom are on the board — the reason behind the company page.`,
  },
  53: {
    de: `Team #sign2x: White-label heißt Kauz bleibt Kauz — keine Fremdlogos im Envelope.`,
    en: `Team #sign2x: white-label means the product stays the product — no foreign logos on the envelope.`,
  },
  51: {
    de: `Team #sign2x: zwei neue Namen im Raum. Ohne erfundenes Logo-Theater.`,
    en: `Team #sign2x: two new names in the room. No invented logo theater.`,
  },
  54: {
    de: `Team #sign2x: EU-Server ≠ deutsches Hosting. Der harte Unterschied in einem Post.`,
    en: `Team #sign2x: EU server ≠ German hosting. The hard distinction in one post.`,
  },
  69: {
    de: `Team #sign2x: EES · FES · QES — drei Stufen, nie SES/AES. Kurz und korrekt.`,
    en: `Team #sign2x: EES · FES · QES — three levels, never SES/AES. Short and correct.`,
  },
  82: {
    de: `Team #sign2x: GwG-Strecke für Softwarehersteller — Ausweis beim Nutzer, Protokoll in DE.`,
    en: `Team #sign2x: AML path for software vendors — ID with the user, log in DE.`,
  },
  55: {
    de: `Team #sign2x: On-prem, wenn auch STACKIT-Cloud nicht reicht. Dieselbe native Schicht.`,
    en: `Team #sign2x: on-prem when even STACKIT cloud is not enough. Same native layer.`,
  },
  56: {
    de: `Team #sign2x: echte Namen, keine erfundenen Stimmen. So machen wir Social Proof.`,
    en: `Team #sign2x: real names, no invented voices. How we do social proof.`,
  },
  58: {
    de: `Team #sign2x: September in echten Namen. Lock-in ist der teure Teil — TCO bis 20%.`,
    en: `Team #sign2x: September in real names. Lock-in is the expensive part — TCO up to 20%.`,
  },
};

async function nextPostNumber() {
  const { data } = await admin
    .from("content_settings")
    .select("next_post_number")
    .eq("project_id", PROJECT_ID)
    .single();
  let n = Number(data?.next_post_number || 84);
  return {
    take() {
      const v = n;
      n += 1;
      return v;
    },
    async commit() {
      await admin
        .from("content_settings")
        .update({ next_post_number: n, updated_at: new Date().toISOString() })
        .eq("project_id", PROJECT_ID);
    },
  };
}

async function main() {
  const { data: existing, error } = await admin
    .from("content_posts")
    .select("*")
    .eq("calendar_id", CALENDAR_ID);
  if (error) throw new Error(error.message);

  // Convert video reels → static feed
  for (const row of existing || []) {
    if (row.is_video || row.media_kind === "video" || row.visual_format === "reel") {
      const { error: uErr } = await admin
        .from("content_posts")
        .update({
          is_video: false,
          media_kind: "image",
          visual_format: "feed",
          remarks: [row.remarks || "", "Converted reel→static for Sept daily fill."].filter(Boolean).join(" | "),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (uErr) throw new Error(uErr.message);
      console.log(`Converted #${row.post_number} reel→static`);
    }
  }

  // Team reshare on existing LI
  for (const row of existing || []) {
    const plats = row.platforms || [];
    if (!plats.includes("linkedin")) continue;
    const team = EXISTING_LI_TEAM[row.post_number];
    if (!team) continue;
    const { error: tErr } = await admin
      .from("content_posts")
      .update({
        team_reshare_captions: team,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (tErr) throw new Error(tErr.message);
    console.log(`Team reshare → #${row.post_number}`);
  }

  const counter = await nextPostNumber();
  let inserted = 0;
  for (const spec of NEW_POSTS) {
    const already = (existing || []).some(
      (r) =>
        r.scheduled_date === spec.date &&
        (r.platforms || []).includes(spec.platforms[0]) &&
        (r.platforms || []).length === 1
    );
    // Also skip if any post that day already covers that single platform
    const dayHas = (existing || []).some(
      (r) => r.scheduled_date === spec.date && (r.platforms || []).includes(spec.platforms[0])
    );
    if (dayHas) {
      console.log(`Skip ${spec.date} ${spec.platforms[0]} (exists)`);
      continue;
    }

    const postNumber = counter.take();
    const row = {
      calendar_id: CALENDAR_ID,
      project_id: PROJECT_ID,
      post_number: postNumber,
      platforms: spec.platforms,
      scheduled_date: spec.date,
      pillar: spec.pillar,
      hook_angle: spec.hook,
      visual_brief: spec.brief,
      captions: spec.captions,
      hashtags: {},
      team_reshare_captions: spec.team || {},
      voiceover_script: {},
      media: [],
      media_by_platform: {},
      media_kind: "image",
      is_video: false,
      visual_format: "feed",
      visual_asset_url: null,
      ad_status: "organic",
      story_repost: null,
      status_production: "wip",
      status_approval: "needs_review",
      angle_approved: true,
      locked: false,
      remarks: "Sept daily fill — weekday LI+IG pair.",
      version_history: [],
      published_links: {},
      updated_at: new Date().toISOString(),
    };
    const { error: iErr } = await admin.from("content_posts").insert([row]);
    if (iErr) throw new Error(`Insert ${spec.date} ${spec.platforms}: ${iErr.message}`);
    inserted += 1;
    console.log(`Inserted #${postNumber} ${spec.date} ${spec.platforms[0]}`);
  }

  await counter.commit();
  await admin
    .from("content_settings")
    .update({
      cadence: { linkedin: 5, instagram: 5 },
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", PROJECT_ID);

  // Coverage report
  const { data: all } = await admin
    .from("content_posts")
    .select("scheduled_date, platforms, post_number, visual_asset_url")
    .eq("calendar_id", CALENDAR_ID)
    .order("scheduled_date");
  const byDay = {};
  for (const p of all || []) {
    byDay[p.scheduled_date] = byDay[p.scheduled_date] || { li: false, ig: false, posts: [] };
    const plats = p.platforms || [];
    if (plats.includes("linkedin")) byDay[p.scheduled_date].li = true;
    if (plats.includes("instagram")) byDay[p.scheduled_date].ig = true;
    byDay[p.scheduled_date].posts.push(p.post_number);
  }
  console.log("\nWeekday coverage:");
  for (const d of weekdaysInSept2026()) {
    const info = byDay[d] || { li: false, ig: false };
    const ok = info.li && info.ig ? "OK" : `MISSING li=${info.li} ig=${info.ig}`;
    console.log(`  ${d} ${ok}`);
  }
  console.log(`\nInserted ${inserted}. Done.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
