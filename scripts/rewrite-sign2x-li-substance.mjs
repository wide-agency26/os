/**
 * Rewrite September Sign2x LinkedIn captions/hooks/team reshare for substance.
 * Keeps IG captions; does not touch media.
 *
 * Usage: node scripts/rewrite-sign2x-li-substance.mjs
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

/** @type {Record<number, { hook: string, briefPatch?: Record<string, string>, li: {de:string,en:string}, team: {de:string,en:string} }>} */
const UPDATES = {
  // Sep 1 — Cloud Act
  84: {
    hook: "Cloud Act: EU location ≠ sovereignty when the provider is US-jurisdiction.",
    briefPatch: {
      graphic_description:
        "CLOUD ACT IN ONE LINE. Sub: US-Recht kann US-Anbieter treffen — auch auf EU-Boden. Teaching: Standort ≠ Anbieterland.",
    },
    li: {
      de: `Der US Cloud Act in einem Satz.

US-Behörden können unter Bedingungen auf Daten bei US-Anbietern zugreifen — auch wenn die Server physisch in der EU stehen.

Für Softwarehersteller heißt das konkret:

• „Server in der EU“ allein ist keine Datensouveränität
• Entscheidend ist das Anbieterrecht, nicht nur der Rechenzentrums-Standort
• Envelope, Protokoll und Identitätsstrecke gehören in dieselbe Jurisdiktion wie euer Compliance-Versprechen

Sign2x läuft auf STACKIT + Telekom. 100 % deutsches Hosting. Native im Stack — oder on-prem, wenn Cloud auch STACKIT nicht reicht.

Nicht Panik. Klarheit, bevor der erste Envelope rausgeht.

https://www.sign2x.com

#sign2x #CloudAct #Datensouveränität`,
      en: `The US Cloud Act in one sentence.

US authorities can, under conditions, reach data held by US providers — even when the servers physically sit in the EU.

For software manufacturers that means:

• “Server in the EU” alone is not data sovereignty
• Provider jurisdiction matters as much as DC location
• Envelope, audit log, and ID path should live under the same jurisdiction as your compliance promise

Sign2x runs on STACKIT + Telekom. 100% German hosting. Native in the stack — or on-prem when even STACKIT cloud is not enough.

Clarity before the first envelope goes out.

https://www.sign2x.com

#sign2x #CloudAct #DataSovereignty`,
    },
    team: {
      de: `Kurzer Reminder aus dem Team #sign2x: EU-Standort ≠ Souveränität. Der Cloud Act erklärt, warum Hosting und Anbieterland zusammengehören.`,
      en: `From Team #sign2x: an EU location is not sovereignty. The Cloud Act is why hosting and provider jurisdiction both matter.`,
    },
  },

  // Sep 2 — Compliance quiz (#078) — caption upgrade only
  78: {
    hook: "Before the first envelope: a 5-question compliance check for ISVs.",
    briefPatch: {
      graphic_description:
        "5-slide quiz. 1 COMPLIANCE CHECK. 2 WHERE ARE THE SERVERS. 3 WHO CHECKS THE ID. 4 CAN IT RUN ON-PREM. 5 TWO MINUTES + quiz URL. Teaching checklist, not slogan.",
    },
    li: {
      de: `Bevor der erste Envelope rausgeht: fünf Fragen, die in jedem Vendor-Gespräch sitzen sollten.

1. Wo stehen die Server — und unter welchem Recht?
2. Wer prüft die Identität — und wo landet der Ausweis?
3. Bleibt das Audit-Log in derselben Jurisdiktion wie euer Versprechen?
4. Kann die Strecke on-prem, wenn Cloud nicht reicht?
5. Trägt der Envelope euren Namen — oder den eines fremden Portals?

„EU-Server“ ist nicht die ganze Geschichte. Souveränität ist Prozessdesign: Hosting, Identität, Protokoll, UX.

Sign2x: STACKIT + Telekom. Native Layer. White-label. On-prem möglich.

2 Minuten Self-Check:
https://www.sign2x.com/quiz

#sign2x #eIDAS #Datensouveränität #ISV`,
      en: `Before the first envelope goes out: five questions every vendor conversation should survive.

1. Where do the servers sit — and under which law?
2. Who checks identity — and where does the ID land?
3. Does the audit log share the same jurisdiction as your promise?
4. Can the path run on-prem when cloud is not enough?
5. Does the envelope carry your name — or a foreign portal’s?

“EU server” is not the whole story. Sovereignty is process design: hosting, identity, log, UX.

Sign2x: STACKIT + Telekom. Native layer. White-label. On-prem when needed.

2-minute self-check:
https://www.sign2x.com/quiz

#sign2x #eIDAS #DataSovereignty #ISV`,
    },
    team: {
      de: `Team #sign2x: Compliance-Check für ISVs — Server, ID, Log, on-prem, Marke. 2 Minuten Quiz, bevor der Envelope rausgeht.`,
      en: `Team #sign2x: ISV compliance check — servers, ID, log, on-prem, brand. 2-minute quiz before the first envelope.`,
    },
  },

  // Sep 3 — Native layer carousel
  79: {
    hook: "Native layer vs portal: the engine stays invisible — your product stays the product.",
    briefPatch: {
      graphic_description:
        "4-slide native layer. Teaching: no tab switch, your name on envelope, your servers/on-prem, Sign2x silent. Not empty slogans.",
      slide_1: "NATIVE LAYER — Not a portal. Engine in your stack.",
      slide_2: "YOUR NAME ON THE ENVELOPE — No foreign brand in the flow.",
      slide_3: "YOUR SERVERS — Or on-prem. Same native layer.",
      slide_4: "WE STAY SILENT — White-label by default.",
    },
    li: {
      de: `Viele E-Signatur-Tools sind Portale.
Nutzer:innen verlassen euren Flow, öffnen einen Extra-Tab — und landen bei einer fremden Marke.

Das kostet mehr als UX:

• Abbruchrate steigt, weil der Kontext wechselt
• Marke und Vertrauen wandern mit dem Tab
• Compliance-Fragen (wo Protokoll, wo ID) werden unscharf

Sign2x ist eine native Schicht im Stack.
Euer Name auf dem Envelope. Eure Farbe. Eure Server — oder on-prem.
Wir bleiben unsichtbar. Das ist White-label als Produktentscheidung, nicht als Folie.

2 Minuten Überblick:
https://www.sign2x.com

#sign2x #Whitelabel #NativeIntegration #ISV`,
      en: `Many e-sign tools are portals.
Users leave your flow, open another tab — and land on someone else’s brand.

That costs more than UX:

• Drop-off rises when context switches
• Brand and trust travel with the tab
• Compliance (where the log lives, where the ID lands) gets fuzzy

Sign2x is a native layer in the stack.
Your name on the envelope. Your color. Your servers — or on-prem.
We stay invisible. White-label as a product decision, not a slide.

2-minute overview:
https://www.sign2x.com

#sign2x #Whitelabel #NativeIntegration #ISV`,
    },
    team: {
      de: `Team #sign2x: Native Layer heißt — kein Extra-Portal, euer Name auf dem Envelope. So erklären wir ISVs den Unterschied.`,
      en: `Team #sign2x: native layer means no extra portal — your name on the envelope. How we explain the difference to ISVs.`,
    },
  },

  // Sep 4 — Native vs portal trust cost
  87: {
    hook: "The tab switch is a trust break — not just a UX annoyance.",
    briefPatch: {
      graphic_description:
        "NATIVE VS PORTAL. Sub: Tab-Wechsel = Markenbruch. Concrete failure mode for ISVs.",
    },
    li: {
      de: `Native vs. Portal — der harte Unterschied für ISVs.

Wenn die Signatur in einem fremden Tab liegt, passiert typischerweise Folgendes:

1. Nutzer:innen verlassen euren Produktkontext
2. Ein fremdes Logo und eine fremde URL übernehmen die Aufmerksamkeit
3. Support-Tickets fragen: „Bin ich noch bei euch?“
4. Compliance fragt: „Wo liegt jetzt das Protokoll?“

Das ist kein Design-Detail. Das ist ein Vertrauens- und Markenbruch in der kritischsten Sekunde des Deals.

Sign2x sitzt im Stack. Kein Extra-Portal. Envelope in eurer Marke. Hosting auf STACKIT + Telekom — oder on-prem.

https://www.sign2x.com

#sign2x #Whitelabel #ProductUX #Datensouveränität`,
      en: `Native vs portal — the hard distinction for ISVs.

When the signature lives in a foreign tab, this is what usually happens:

1. Users leave your product context
2. A foreign logo and URL take the attention
3. Support tickets ask: “Am I still with you?”
4. Compliance asks: “Where does the log live now?”

That is not a design detail. It is a trust and brand break in the most critical second of the deal.

Sign2x sits in the stack. No extra portal. Envelope in your brand. Hosting on STACKIT + Telekom — or on-prem.

https://www.sign2x.com

#sign2x #Whitelabel #ProductUX #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: Native vs Portal — der Tab-Wechsel ist ein Markenbruch, kein UX-Detail.`,
      en: `Team #sign2x: native vs portal — the tab switch is a brand break, not a UX footnote.`,
    },
  },

  // Sep 7 — Vendor RFP checklist
  88: {
    hook: "Three RFP questions before you lock an e-sign vendor.",
    briefPatch: {
      graphic_description:
        "THREE QUESTIONS. Vendor RFP checklist: jurisdiction, ID path, white-label/on-prem. Useful for buyers.",
    },
    li: {
      de: `Drei Fragen, bevor ihr einen E-Signatur-Anbieter festnagelt.

1. Wo liegen die Server — und unter welchem Recht?
   (Standort und Anbieterland sind zwei Antworten.)

2. Wer prüft die Identität — und wo landet der Ausweis?
   (GwG braucht Kontrolle, keinen Export in ein Fremdportal.)

3. Bleibt eure Marke auf dem Envelope — und geht on-prem, wenn nötig?
   (White-label und Deploy-Optionen gehören in denselben Vertrag.)

Wenn eine dieser Antworten weich wird, wird es später teuer: Lock-in, Support-Chaos, Audit-Stress.

Sign2x antwortet klar: STACKIT + Telekom, native Layer, White-label, on-prem möglich.

Self-Check:
https://www.sign2x.com/quiz

#sign2x #RFP #eIDAS #Datensouveränität`,
      en: `Three questions before you lock an e-sign vendor.

1. Where do the servers sit — and under which law?
   (Location and provider jurisdiction are two answers.)

2. Who checks identity — and where does the ID land?
   (AML needs control, not export into a foreign portal.)

3. Does your brand stay on the envelope — and can it run on-prem if needed?
   (White-label and deploy options belong in the same contract.)

If any answer goes soft, it gets expensive later: lock-in, support chaos, audit stress.

Sign2x answers clearly: STACKIT + Telekom, native layer, white-label, on-prem when needed.

Self-check:
https://www.sign2x.com/quiz

#sign2x #RFP #eIDAS #DataSovereignty`,
    },
    team: {
      de: `Aus dem Team #sign2x: drei harte RFP-Fragen vor dem nächsten E-Signatur-Deal. Speichern lohnt sich.`,
      en: `From Team #sign2x: three hard RFP questions before the next e-sign deal. Worth saving.`,
    },
  },

  // Sep 8 — short punch (conversation / data)
  90: {
    hook: "Sovereignty is process design — not a server pin on a slide.",
    briefPatch: {
      graphic_description:
        "WHERE IT ENDS. Teaching: conversation, data, jurisdiction stay together. Short punch.",
    },
    li: {
      de: `Wo die Unterhaltung endet, sollten die Daten bleiben.

Nicht in einem US-Portal.
Nicht in einem Extra-Tab.
Im Stack — unter dem Recht, das ihr euren Kund:innen versprecht.

Sign2x: STACKIT + Telekom. Native. White-label.

#sign2x #Datensouveränität`,
      en: `Where the conversation ends is where the data should stay.

Not in a US portal.
Not in an extra tab.
In the stack — under the law you promise your customers.

Sign2x: STACKIT + Telekom. Native. White-label.

#sign2x #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: Souveränität ist Prozessdesign — nicht nur ein Serverstandort auf der Folie.`,
      en: `Team #sign2x: sovereignty is process design — not just a server pin on a slide.`,
    },
  },

  // Sep 9 — STACKIT + Telekom carousel
  52: {
    hook: "STACKIT + Telekom on the board — not “some EU server”.",
    briefPatch: {
      graphic_description:
        "4-slide. On the board STACKIT+Telekom. Not some EU server. German hosting. Native. Type-only partner names — no fake logos.",
      slide_1: "ON THE BOARD — STACKIT + Telekom (type-only).",
      slide_2: "NOT SOME EU SERVER — Location ≠ German hosting under DE jurisdiction.",
      slide_3: "GERMAN HOSTING — 100% DE DCs, EU-only routing as published.",
      slide_4: "NATIVE IN THE STACK — Engine invisible; product stays yours.",
    },
    li: {
      de: `„Wir hosten in der EU“ klingt gut — und ist oft unvollständig.

US-Anbieter auf EU-Boden bleiben unter dem US Cloud Act.
Ein Rechenzentrum in Frankfurt ändert das Anbieterrecht nicht.

Deshalb stehen bei Sign2x STACKIT + Telekom auf dem Board:

• 100 % deutsches Hosting
• Native Schicht im Produkt — kein Extra-Portal
• White-label: euer Name auf dem Envelope
• On-prem, wenn auch STACKIT-Cloud nicht reicht

Das ist der Unterschied zwischen „EU-Server“ und deutscher Hosting-Entscheidung.

https://www.sign2x.com

#sign2x #STACKIT #Telekom #Datensouveränität`,
      en: `“We host in the EU” sounds good — and is often incomplete.

US providers on EU soil remain under the US Cloud Act.
A Frankfurt DC does not change provider jurisdiction.

That is why STACKIT + Telekom sit on the Sign2x board:

• 100% German hosting
• Native layer in the product — no extra portal
• White-label: your name on the envelope
• On-prem when even STACKIT cloud is not enough

That is the difference between “EU server” and a German hosting decision.

https://www.sign2x.com

#sign2x #STACKIT #Telekom #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: STACKIT + Telekom stehen auf dem Board — nicht „irgendein EU-Server“.`,
      en: `Team #sign2x: STACKIT + Telekom are on the board — not “some EU server”.`,
    },
  },

  // Sep 10 — Mahbobi personal
  68: {
    hook: "Mahbobi: why STACKIT + Telekom sit on the board.",
    briefPatch: {
      graphic_description:
        "Personal LI voice. WHY ON THE BOARD. STACKIT + Telekom — sovereignty is not a feature slide.",
    },
    li: {
      de: `Ich baue Sign2x nicht als weiteres US-Portal.

STACKIT + Telekom stehen auf dem Board, weil Datensouveränität keine Feature-Liste ist.
Sie ist eine Hosting- und Jurisdiktions-Entscheidung — bevor der erste Envelope rausgeht.

Was das für Softwarehersteller heißt:

• Envelope und Protokoll bleiben unter deutschem Hosting
• Die Signatur sitzt native im Stack — kein Tab zu einer fremden Marke
• On-prem bleibt möglich, wenn Cloud auch STACKIT nicht reicht

Wenn ihr euren Kund:innen Souveränität versprecht, muss die Signaturstrecke das halten — nicht nur die Folie.

https://www.sign2x.com

#sign2x #Datensouveränität #Founder`,
      en: `I am not building Sign2x as another US portal.

STACKIT + Telekom sit on the board because data sovereignty is not a feature list.
It is a hosting and jurisdiction decision — before the first envelope goes out.

What that means for software manufacturers:

• Envelope and log stay under German hosting
• Signature sits native in the stack — no tab to a foreign brand
• On-prem stays possible when even STACKIT cloud is not enough

If you promise customers sovereignty, the signature path has to hold it — not just the slide.

https://www.sign2x.com

#sign2x #DataSovereignty #Founder`,
    },
    team: {
      de: `Team #sign2x: warum STACKIT + Telekom auf dem Board stehen — die Begründung hinter der Company-Page.`,
      en: `Team #sign2x: why STACKIT + Telekom are on the board — the reasoning behind the company page.`,
    },
  },

  // Sep 11 — minutes / audit log
  93: {
    hook: "After the meeting: where did the minutes and audit log go?",
    briefPatch: {
      graphic_description:
        "AFTER THE MEETING. Teaching: minutes/audit-log jurisdiction travels with the signature path.",
    },
    li: {
      de: `Nach der Runde: wohin ist das Protokoll?

Viele Teams prüfen nur, ob alle unterschrieben haben.
Zu selten fragen sie: unter welchem Recht liegt jetzt das Audit-Log?

Wenn die Signaturstrecke ein US-Portal mitzieht, zieht oft auch das Protokoll mit — inklusive Metadaten und Identitätsnachweisen.

Für ISVs heißt das:

• Signatur und Log gehören in dieselbe Jurisdiktion
• „Fertig unterschrieben“ ist kein Compliance-Abschluss
• Hosting-Entscheidung = Audit-Entscheidung

Sign2x: Protokoll unter deutschem Hosting (STACKIT + Telekom). Native im Stack.

https://www.sign2x.com

#sign2x #AuditLog #CloudAct #Datensouveränität`,
      en: `After the meeting: where did the minutes go?

Many teams only check that everyone signed.
Too few ask: under which law does the audit log live now?

If the signature path pulls in a US portal, the log often follows — including metadata and identity evidence.

For ISVs that means:

• Signature and log belong in the same jurisdiction
• “Fully signed” is not a compliance close
• Hosting decision = audit decision

Sign2x: log under German hosting (STACKIT + Telekom). Native in the stack.

https://www.sign2x.com

#sign2x #AuditLog #CloudAct #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: nach dem Meeting zählt, wo das Protokoll landet — nicht nur, dass alle unterschrieben haben.`,
      en: `Team #sign2x: after the meeting, where the log lands matters — not only that everyone signed.`,
    },
  },

  // Sep 14 — white-label competitive
  94: {
    hook: "White-label as competitive brand: your color, your name, our silence.",
    briefPatch: {
      graphic_description:
        "WHITE-LABEL. Your color, your name, our silence. Competitive brand for ISVs — match live LI tone.",
    },
    li: {
      de: `White-label ist für Softwarehersteller kein Nice-to-have.
Es ist Wettbewerbsschutz.

Wenn der Envelope eine fremde Marke trägt:

• eure Produktwahrnehmung bricht in der Signatur-Sekunde
• Upsell und Trust wandern zum Portal-Anbieter
• Support erklärt plötzlich zwei Oberflächen

Sign2x bleibt still:

• eure Farbe
• euer Name auf dem Envelope
• keine Fremdlogos im Flow
• native Schicht — kein Extra-Portal

So bleibt die Signatur Teil eures Produkts — nicht der Einstieg in fremde Software.

https://www.sign2x.com

#sign2x #Whitelabel #ISV #Product`,
      en: `For software manufacturers, white-label is not a nice-to-have.
It is competitive protection.

When the envelope carries a foreign brand:

• product perception breaks in the signature second
• upsell and trust migrate to the portal vendor
• support suddenly explains two UIs

Sign2x stays quiet:

• your color
• your name on the envelope
• no foreign logos in the flow
• native layer — no extra portal

The signature stays part of your product — not an on-ramp into someone else’s software.

https://www.sign2x.com

#sign2x #Whitelabel #ISV #Product`,
    },
    team: {
      de: `Team #sign2x: White-label = eure Marke vorne, wir im Hintergrund. So sollte Software für ISVs aussehen.`,
      en: `Team #sign2x: white-label = your brand in front, us in the background. How software for ISVs should look.`,
    },
  },

  // Sep 15 — Kauz short punch
  53: {
    hook: "Kauz bleibt Kauz. White-label without foreign logos.",
    briefPatch: {
      graphic_description:
        "KAUZ BLEIBT KAUZ. Type-only. No fake Kauz logo. White-label proof name.",
    },
    li: {
      de: `Kauz bleibt Kauz.

White-label heißt: keine Fremdlogos, keine fremde Farbe, kein Extra-Portal.
Die Signatur trägt den Namen des Produkts — nicht den des Engines.

So arbeiten wir mit Partnern.
So sollte Software für Softwarehersteller aussehen.

#sign2x #Whitelabel #Kauz`,
      en: `Kauz stays Kauz.

White-label means: no foreign logos, no foreign color, no extra portal.
The signature carries the product name — not the engine’s.

That is how we work with partners.
That is how software for software manufacturers should look.

#sign2x #Whitelabel #Kauz`,
    },
    team: {
      de: `Team #sign2x: White-label heißt Kauz bleibt Kauz — keine Fremdlogos im Envelope.`,
      en: `Team #sign2x: white-label means Kauz stays Kauz — no foreign logos on the envelope.`,
    },
  },

  // Sep 16 — real names
  51: {
    hook: "Two real names in the room: NRW Grundbesitz + Vertu-Invest.",
    briefPatch: {
      graphic_description:
        "TWO NEW NAMES. NRW Grundbesitz + Vertu-Invest. Real names only — no invented quotes.",
    },
    li: {
      de: `Zwei neue Namen im Raum — ohne erfundenes Testimonial-Theater.

NRW Grundbesitz GmbH
Leverkusen, HRB 97760

Vertu-Invest GmbH
Köln, HRB 97310 · KWG-Beteiligungen

Wir nennen echte Unternehmen, weil Social Proof ohne Beleg schnell peinlich wird.
Keine erfundenen Zitate. Keine Fake-Logos.

Wer Signatur und Souveränität ernst nimmt, verdient Klarheit — auch in der Kommunikation.

https://www.sign2x.com

#sign2x #SocialProof #B2B`,
      en: `Two new names in the room — without invented testimonial theater.

NRW Grundbesitz GmbH
Leverkusen, HRB 97760

Vertu-Invest GmbH
Cologne, HRB 97310 · KWG holdings

We name real companies because social proof without evidence gets awkward fast.
No invented quotes. No fake logos.

Anyone serious about signatures and sovereignty deserves clarity — including in the messaging.

https://www.sign2x.com

#sign2x #SocialProof #B2B`,
    },
    team: {
      de: `Team #sign2x: zwei neue Namen im Raum. Ohne erfundenes Logo-Theater.`,
      en: `Team #sign2x: two new names in the room. No invented logo theater.`,
    },
  },

  // Sep 17 — EU ≠ DE hosting
  54: {
    hook: "EU server ≠ German hosting — Cloud Act in plain language.",
    briefPatch: {
      graphic_description:
        "EU SERVER ≠ GERMAN HOSTING. Deep dive: US provider on EU soil still Cloud Act.",
    },
    li: {
      de: `EU-Server ist nicht gleich deutsches Hosting.

Kurzer Mechanismus:

• Ein US-Anbieter kann Server in Frankfurt betreiben
• Das ändert nicht, dass er unter US-Recht (Cloud Act) steht
• „Daten in der EU“ ≠ „Anbieter außerhalb US-Zugriffspfad“

Für ISVs in regulierten Flows zählt deshalb:

1. Anbieterland / Jurisdiktion
2. Rechenzentrums-Standort
3. Wo ID und Audit-Log physisch und rechtlich liegen

Sign2x läuft auf STACKIT + Telekom. 100 % deutsches Hosting. Native im Stack.

https://www.sign2x.com

#sign2x #CloudAct #Hosting #Datensouveränität`,
      en: `An EU server is not the same as German hosting.

Short mechanism:

• A US provider can run servers in Frankfurt
• That does not remove US jurisdiction (Cloud Act)
• “Data in the EU” ≠ “provider outside a US access path”

For ISVs in regulated flows, therefore:

1. Provider country / jurisdiction
2. Data-center location
3. Where ID and audit log sit physically and legally

Sign2x runs on STACKIT + Telekom. 100% German hosting. Native in the stack.

https://www.sign2x.com

#sign2x #CloudAct #Hosting #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: EU-Server ≠ deutsches Hosting. Der harte Unterschied in einem Post.`,
      en: `Team #sign2x: EU server ≠ German hosting. The hard distinction in one post.`,
    },
  },

  // Sep 18 — eIDAS SES/AES/QES (#069)
  69: {
    hook: "SES · AES · QES — which eIDAS level the process actually needs.",
    briefPatch: {
      slide_1: "THREE LEVELS — SES · AES · QES. Pick by liability, not marketing.",
      slide_2: "THE CONTRACT DECIDES — Welches Level der Vorgang braucht.",
      slide_3: "NO FIELD AI — Keine KI-Feldanerkennung.",
      slide_4: "NATIVE IN THE STACK — STACKIT + Telekom (type-only).",
      graphic_description:
        "4-slide. 1 THREE LEVELS — SES · AES · QES (not EES/FES). 2 THE CONTRACT DECIDES. 3 NO FIELD AI. 4 NATIVE IN THE STACK — STACKIT + Telekom type-only.",
    },
    li: {
      de: `SES · AES · QES — drei eIDAS-Stufen. Nicht Marketing-Namen.

Kurz und korrekt:

• SES — einfache elektronische Signatur · geringe Haftung / einfache Vorgänge
• AES — fortgeschritten · kalkulierbare B2B-Haftung
• QES — qualifiziert · hohe Haftung, Identitätsprüfung

Das Level wählt der Vorgang und der Vertrag — nicht die Folie des Anbieters.

Sign2x deckt die Stufen im native Layer ab. Hosting: STACKIT + Telekom.
Keine KI-Feldanerkennung als Ersatz für saubere Signaturstufen.

Welches Level braucht euer Prozess?
https://www.sign2x.com/quiz

#sign2x #eIDAS #SES #AES #QES`,
      en: `SES · AES · QES — three eIDAS levels. Not marketing names.

Short and correct:

• SES — simple electronic signature · low liability / simple flows
• AES — advanced · calculable B2B liability
• QES — qualified · high liability, identity check

The process and the contract pick the level — not the vendor slide.

Sign2x covers the levels in a native layer. Hosting: STACKIT + Telekom.
No field AI as a substitute for clean signature levels.

Which level does your process need?
https://www.sign2x.com/quiz

#sign2x #eIDAS #SES #AES #QES`,
    },
    team: {
      de: `Team #sign2x: SES · AES · QES — drei Stufen, gewählt nach Haftung. Kurz und korrekt.`,
      en: `Team #sign2x: SES · AES · QES — three levels, picked by liability. Short and correct.`,
    },
  },

  // Sep 19 — short white-label punch
  99: {
    hook: "If users see our logo, white-label failed.",
    briefPatch: {
      graphic_description: "IF THEY SEE OUR LOGO. Short punch: white-label success = our silence.",
    },
    li: {
      de: `Wenn eure Nutzer unser Logo sehen, haben wir White-label verfehlt.

Der Envelope trägt euren Namen.
Die Farbe ist eure.
Wir bleiben im Hintergrund.

#sign2x #Whitelabel`,
      en: `If your users see our logo, we failed white-label.

The envelope carries your name.
The color is yours.
We stay in the background.

#sign2x #Whitelabel`,
    },
    team: {
      de: `Team #sign2x: wenn Kund:innen unser Logo sehen, war White-label nicht fertig.`,
      en: `Team #sign2x: if customers see our logo, white-label was not done.`,
    },
  },

  // Sep 21 — GwG path
  100: {
    hook: "GwG/AML for ISVs: check ID without shipping it to a foreign portal.",
    briefPatch: {
      graphic_description:
        "GwG WITHOUT EXPORT. ID stays with user/path; audit log in DE. AML path for ISVs.",
    },
    li: {
      de: `GwG, ohne den Ausweis ins Ausland zu schicken.

Für Softwarehersteller mit AML-Pflicht zählt die Strecke:

• Identität prüfen — ja
• Ausweis in ein US-Portal exportieren — nein
• Protokoll unter deutschem Hosting halten — ja

Sign2x: Identitätsstrecke im native Layer. Audit-Log in Deutschland (STACKIT + Telekom). Kein Extra-Portal, das Marke und Jurisdiktion aufbricht.

Kontrolle behalten. Nicht abgeben.

https://www.sign2x.com

#sign2x #GwG #AML #Datensouveränität`,
      en: `AML without shipping the ID abroad.

For software manufacturers with AML duties, the path matters:

• Check identity — yes
• Export the ID into a US portal — no
• Keep the log under German hosting — yes

Sign2x: identity path in the native layer. Audit log in Germany (STACKIT + Telekom). No extra portal that breaks brand and jurisdiction.

Keep control. Don’t hand it off.

https://www.sign2x.com

#sign2x #AML #KYC #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: GwG ohne Ausweis-Export. Kurz erklärt, warum die Strecke zählt.`,
      en: `Team #sign2x: AML without ID export. Why the path matters.`,
    },
  },

  // Sep 22 — identity ≠ portal capture
  102: {
    hook: "Identity check ≠ portal capture of the ID.",
    briefPatch: {
      graphic_description:
        "IDENTITY ≠ CAPTURE. Distinction: verifying ID vs exporting ID into a foreign portal.",
    },
    li: {
      de: `Identität prüfen ≠ Daten abgeben.

GwG braucht Kontrolle über den Nachweis.
Es braucht nicht, dass der Ausweis in einem fremden Portal landet — inklusive Screenshots, Uploads und Support-Tickets außerhalb eurer Marke.

Haltet die Unterscheidung fest:

• Prüfung: wer ist die Person?
• Capture: wo speichert welches System den Nachweis — und unter welchem Recht?

Sign2x trennt das sauber im native Layer. Protokoll in DE.

https://www.sign2x.com

#sign2x #GwG #Identity #Datensouveränität`,
      en: `Checking identity ≠ handing the data over.

AML needs control over the evidence.
It does not need the ID landing in a foreign portal — including screenshots, uploads, and support tickets outside your brand.

Keep the distinction:

• Check: who is the person?
• Capture: which system stores the evidence — and under which law?

Sign2x keeps that clean in the native layer. Log in DE.

https://www.sign2x.com

#sign2x #AML #Identity #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: Identität prüfen heißt nicht, den Ausweis zu exportieren. Wichtiger Unterschied.`,
      en: `Team #sign2x: checking identity is not exporting the ID. Important distinction.`,
    },
  },

  // Sep 23 — AML carousel
  82: {
    hook: "GwG for ISVs: ID with the user, audit log in Germany.",
    briefPatch: {
      graphic_description:
        "4-slide AML. ID stays, log in DE, no US portal in path, native for manufacturers.",
      slide_1: "GwG STAYS WITH YOU — Control of the path.",
      slide_2: "ID WITH THE USER — No unnecessary export.",
      slide_3: "LOG IN GERMANY — STACKIT + Telekom.",
      slide_4: "NO US PORTAL IN THE PATH — Native layer.",
    },
    li: {
      de: `GwG-Strecke für Softwarehersteller — ohne Portal-Umweg.

Was wir in der Praxis meinen:

• Ausweis-/Identitätsprüfung im Flow, den ihr kontrolliert
• Protokoll und Nachweis unter deutschem Hosting
• Keine US-Cloud in der kritischen Strecke
• Dieselbe native Schicht wie für die Signatur selbst

So bleibt AML Teil eures Produkts — nicht der Einstieg in fremde Infrastruktur.

https://www.sign2x.com

#sign2x #GwG #AML #ISV #Datensouveränität`,
      en: `AML path for software manufacturers — without a portal detour.

What we mean in practice:

• ID check inside the flow you control
• Log and evidence under German hosting
• No US cloud in the critical path
• The same native layer as the signature itself

AML stays part of your product — not an on-ramp into foreign infrastructure.

https://www.sign2x.com

#sign2x #AML #ISV #DataSovereignty`,
    },
    team: {
      de: `Team #sign2x: GwG-Strecke für Softwarehersteller — Ausweis beim Nutzer, Protokoll in DE.`,
      en: `Team #sign2x: AML path for manufacturers — ID with the user, log in DE.`,
    },
  },

  // Sep 24 — on-prem
  55: {
    hook: "On-prem: same native layer when even STACKIT cloud is not enough.",
    briefPatch: {
      graphic_description:
        "LÄUFT HIER. On-prem same native layer. 100% sovereignty path for hard requirements.",
    },
    li: {
      de: `Läuft hier.

Manchmal reicht auch STACKIT-Cloud nicht — Policy, Branche, Kundenvertrag.
Dann muss die Signatur on-prem können, ohne den Produktcharakter zu wechseln.

Sign2x: dieselbe native Schicht.
Kein zweites Portal-Produkt „für On-Prem“.
100 % Datensouveränität, wenn Cloud keine Option ist.

White-label bleibt. Engine bleibt unsichtbar. Envelope bleibt eurer.

https://www.sign2x.com

#sign2x #OnPrem #Datensouveränität #ISV`,
      en: `Runs here.

Sometimes even STACKIT cloud is not enough — policy, industry, customer contract.
Then the signature must run on-prem without becoming a different product.

Sign2x: the same native layer.
No second “on-prem portal” product.
100% data sovereignty when cloud is not an option.

White-label stays. Engine stays invisible. Envelope stays yours.

https://www.sign2x.com

#sign2x #OnPrem #DataSovereignty #ISV`,
    },
    team: {
      de: `Team #sign2x: On-prem, wenn auch STACKIT-Cloud nicht reicht. Dieselbe native Schicht.`,
      en: `Team #sign2x: on-prem when even STACKIT cloud is not enough. Same native layer.`,
    },
  },

  // Sep 25 — short brand punch
  105: {
    hook: "Brand stays when the room empties — white-label you can feel.",
    briefPatch: {
      graphic_description: "BRAND STAYS. Short: after-hours screen still shows your product, not ours.",
    },
    li: {
      de: `Die Marke bleibt, wenn der Raum leer ist.

Kein Fremdlogo auf dem Screen.
Kein fremdes Portal in der Erinnerung der Nutzer:innen.

White-label merkt man daran, was übrig bleibt.

#sign2x #Whitelabel`,
      en: `The brand stays when the room empties.

No foreign logo on the screen.
No foreign portal in users’ memory.

You feel white-label in what is left behind.

#sign2x #Whitelabel`,
    },
    team: {
      de: `Team #sign2x: White-label merkt man daran, was übrig bleibt, wenn der Screen dunkel ist.`,
      en: `Team #sign2x: you feel white-label in what remains when the screen goes dark.`,
    },
  },

  // Sep 28 — proof > promises
  106: {
    hook: "Proof over promises — real names already in the room.",
    briefPatch: {
      graphic_description:
        "PROOF OVER PROMISES. Real names only: Keil KTM, NRW, Vertu-Invest, Kauz. No invented quotes.",
    },
    li: {
      de: `Beweis vor Versprechen.

Namen, die schon im Raum sind — keine erfundenen Stimmen:

• Keil KTM
• NRW Grundbesitz
• Vertu-Invest
• Kauz

Kein neues Fake-Testimonial.
Keine erfundenen Zitate.
Kein Logo-Theater mit Marken, die uns keine Freigabe gegeben haben.

Wer Signatur und Souveränität verkauft, sollte in der Kommunikation denselben Standard halten.

https://www.sign2x.com

#sign2x #SocialProof #B2B`,
      en: `Proof over promises.

Names already in the room — no invented voices:

• Keil KTM
• NRW Grundbesitz
• Vertu-Invest
• Kauz

No new fake testimonial.
No invented quotes.
No logo theater with brands that never cleared us.

If you sell signatures and sovereignty, messaging should hold the same standard.

https://www.sign2x.com

#sign2x #SocialProof #B2B`,
    },
    team: {
      de: `Team #sign2x: lieber echte Namen als erfundene Zitate. So arbeiten wir an Social Proof.`,
      en: `Team #sign2x: real names over invented quotes. How we do social proof.`,
    },
  },

  // Sep 29 — Mahbobi names
  56: {
    hook: "Mahbobi: real names, no invented voices.",
    briefPatch: {
      graphic_description:
        "Personal LI. REAL NAMES. Keil KTM, NRW, Vertu-Invest, Kauz — no invented quotes.",
    },
    li: {
      de: `Echte Namen. Keine erfundenen Stimmen.

Keil KTM habe ich selbst geschrieben — 13. August, auf dieser Seite.
NRW Grundbesitz. Vertu-Invest. Kauz.

Ich will keine erfundenen Testimonials für Sign2x.
Wenn wir über Souveränität sprechen, gilt dasselbe für die Kommunikation: belegt oder weglassen.

STACKIT + Telekom stehen auf dem Board aus demselben Grund — Entscheidung, nicht Slogan.

https://www.sign2x.com

#sign2x #Founder #SocialProof`,
      en: `Real names. No invented voices.

I wrote Keil KTM myself — 13 August, on this page.
NRW Grundbesitz. Vertu-Invest. Kauz.

I do not want invented testimonials for Sign2x.
If we talk sovereignty, the same standard applies to messaging: evidenced or leave it out.

STACKIT + Telekom sit on the board for the same reason — decision, not slogan.

https://www.sign2x.com

#sign2x #Founder #SocialProof`,
    },
    team: {
      de: `Team #sign2x: echte Namen, keine erfundenen Stimmen. So machen wir Social Proof.`,
      en: `Team #sign2x: real names, no invented voices. How we do social proof.`,
    },
  },

  // Sep 30 — September wrap + TCO ≤20%
  58: {
    hook: "September in real names — honest TCO up to 20%, not inflated.",
    briefPatch: {
      graphic_description:
        "SEPTEMBER WRAP. Real names + STACKIT/Telekom. TCO up to 20% only — never inflate.",
    },
    li: {
      de: `September in echten Namen.

NRW Grundbesitz. Vertu-Invest. Kauz. Keil KTM.
STACKIT + Telekom auf dem Board.

Was wir diesen Monat nicht machen: Versprechen aufblasen.
Lock-in ist der teure Teil. Veröffentlicht sprechen wir von bis zu 20 % TCO — nicht „mehr“, nicht „mindestens“.

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
STACKIT + Telekom on the board.

What we will not do this month: inflate claims.
Lock-in is the expensive part. As published we say up to 20% TCO — not “more”, not “at least”.

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
    team: {
      de: `Team #sign2x: September in echten Namen. Lock-in ist der teure Teil — TCO bis 20 %.`,
      en: `Team #sign2x: September in real names. Lock-in is the expensive part — TCO up to 20%.`,
    },
  },
};

async function main() {
  const { data: posts, error } = await admin
    .from("content_posts")
    .select("id, post_number, captions, visual_brief, platforms")
    .eq("calendar_id", CALENDAR_ID)
    .contains("platforms", ["linkedin"]);
  if (error) throw new Error(error.message);

  let updated = 0;
  const missing = [];
  for (const post of posts || []) {
    const spec = UPDATES[post.post_number];
    if (!spec) {
      missing.push(post.post_number);
      continue;
    }
    const captions = { ...(post.captions || {}) };
    captions.linkedin = { de: spec.li.de, en: spec.li.en };
    const visual_brief = { ...(post.visual_brief || {}), ...(spec.briefPatch || {}) };
    const { error: uErr } = await admin
      .from("content_posts")
      .update({
        hook_angle: spec.hook,
        captions,
        team_reshare_captions: spec.team,
        visual_brief,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);
    if (uErr) throw new Error(`#${post.post_number}: ${uErr.message}`);
    updated++;
    console.log(`Updated #${post.post_number}`);
  }

  const expected = Object.keys(UPDATES).map(Number).sort((a, b) => a - b);
  const found = new Set((posts || []).map((p) => p.post_number));
  const notInDb = expected.filter((n) => !found.has(n));
  console.log(`Done. updated=${updated} liPosts=${(posts || []).length}`);
  if (missing.length) console.log("LI posts without rewrite map:", missing.join(", "));
  if (notInDb.length) console.log("Mapped but missing in DB:", notInDb.join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
