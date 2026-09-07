/**
 * Upload unique IG creatives + patch captions/briefs for Sign2x Sept redo.
 * Usage: node scripts/redo-sign2x-ig-unique.mjs [batch1|batch2|batch3|batch4|batch5|all]
 */
import { readFileSync, copyFileSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import { resolve, dirname, basename, join } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const ASSETS =
  "/Users/alihashemi/.cursor/projects/Users-alihashemi-Desktop-WIDE-wide-portal-V02/assets";
const SEPT = "/Users/alihashemi/Desktop/WIDE/Sign2x/Social/Sept";
const CALENDAR_ID = "19977dc0-c755-4a4b-93a1-f214230be38c";
const TYPE =
  "Type contrast: dark bg → white/cream #EAEAEA; light bg → blue #1041F4. No floating logo. Unique concept — no plug/kitchen trope.";

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

/** @type {Record<number, { files: string[], hook: string, brief: string, kind: 'image'|'carousel', de: string, en: string }>} */
const POSTS = {
  85: {
    files: ["IGU_P85.jpg"],
    kind: "image",
    hook: "Cloud Act — EU landing ≠ US-free",
    brief: "Airport passport stamp desk. Teaching: location ≠ jurisdiction. No plugs/kitchen.",
    de: `Standort ≠ Jurisdiktion. 🔷

Ein EU-Stempel ändert nicht, unter welchem Recht der Anbieter steht.

Cloud Act klar:
Server in der EU reicht nicht, wenn der Provider US-Recht unterliegt.

Sign2x: STACKIT + Telekom. DE-Hosting.

#sign2x #CloudAct #Datensouveränität`,
    en: `Location ≠ jurisdiction. 🔷

An EU entry stamp doesn’t change the provider’s law.

Cloud Act clear:
An EU server isn’t enough under a US provider.

Sign2x: STACKIT + Telekom. DE hosting.

#sign2x #CloudAct #DataSovereignty`,
  },
  67: {
    files: ["IGU_P67_01.jpg", "IGU_P67_02.jpg", "IGU_P67_03.jpg", "IGU_P67_04.jpg"],
    kind: "carousel",
    hook: "Vor dem Envelope — 3 Vendor-Fragen",
    brief: "Glass conference wall RFP checklist. NO plugs. 4 slides: overview + 3 questions.",
    de: `Bevor der Envelope rausgeht. 🔷

Drei Fragen an jeden Vendor:

1) Server + Recht?
2) Wer prüft die ID — wo landet sie?
3) On-prem möglich?

Weiche Antworten = Lock-in später.

https://www.sign2x.com/quiz

#sign2x #RFP #ImStackBleiben`,
    en: `Before the envelope. 🔷

Three questions for every vendor:

1) Servers + law?
2) Who checks ID — where does it land?
3) On-prem possible?

Soft answers = lock-in later.

https://www.sign2x.com/quiz

#sign2x #RFP #StayInTheStack`,
  },
  86: {
    files: ["IGU_P86_01.jpg", "IGU_P86_02.jpg", "IGU_P86_03.jpg"],
    kind: "carousel",
    hook: "Native vs Portal — der Tab bricht die Marke",
    brief: "Split laptop: product UI vs foreign browser tab. Brand break. No plugs.",
    de: `Fremdes Portal = Extra-Tab. 🔷

In der kritischsten Sekunde verlassen Nutzer:innen euren Flow —
und landen bei einer fremden Marke.

Sign2x: native Schicht. Euer Name. Kein daneben.

#sign2x #Whitelabel #Native`,
    en: `Foreign portal = extra tab. 🔷

In the critical second, users leave your flow —
and land on someone else’s brand.

Sign2x: native layer. Your name. Not beside you.

#sign2x #Whitelabel #Native`,
  },
  63: {
    files: ["IGU_P63.jpg"],
    kind: "image",
    hook: "Homecare — kein Extra-Tab am Clipboard",
    brief: "Nurse clipboard + tablet clinical setting. Not kitchen crumbs.",
    de: `Auch im Außendienst. 🔷

Kein Extra-Tab.
Kein US-Portal zwischen Besuch und Unterschrift.

Native im Stack.
STACKIT + Telekom.

#sign2x #Homecare #ImStackBleiben`,
    en: `Even in the field. 🔷

No extra tab.
No US portal between visit and signature.

Native in the stack.
STACKIT + Telekom.

#sign2x #Homecare #StayInTheStack`,
  },
  71: {
    files: ["IGU_P71.jpg"],
    kind: "image",
    hook: "Unterwegs — Vertrag bleibt im DE-Pfad",
    brief: "Car glovebox with ONE blue folder (only folder use of month).",
    de: `Unterwegs. Trotzdem im Stack. 🔷

Der Vertrag muss nicht durch ein US-Portal, nur weil ihr im Auto sitzt.

DE-Hosting. Native. White-label.

#sign2x #Datensouveränität`,
    en: `On the road. Still in the stack. 🔷

The contract doesn’t need a US portal just because you’re in the car.

DE hosting. Native. White-label.

#sign2x #DataSovereignty`,
  },
  89: {
    files: ["IGU_P89.jpg"],
    kind: "image",
    hook: "Whiteboard — Server / ID / On-prem",
    brief: "Sticky-free whiteboard three columns. Not glass wall clone of #67 — markers + columns close.",
    de: `Drei Spalten. Eine Entscheidung. 🔷

Server · Identität · On-prem

Wenn eine Spalte weich bleibt, wird der Vendor-Deal teuer.

https://www.sign2x.com/quiz

#sign2x #RFP`,
    en: `Three columns. One decision. 🔷

Servers · Identity · On-prem

If one column stays soft, the vendor deal gets expensive.

https://www.sign2x.com/quiz

#sign2x #RFP`,
  },
  50: {
    files: ["IGU_P50.jpg"],
    kind: "image",
    hook: "Architektentisch — Flow ohne US-Portal",
    brief: "Blueprint/architect studio table + tablet Upload UI. NOT kitchen.",
    de: `Planungstisch. Vertrag. Fertig. 🔷

Ohne US-Portal dazwischen.

Native E-Signatur im Produkt —
nicht als Extra-Tab.

#sign2x #Native #ImStackBleiben`,
    en: `Planning table. Contract. Done. 🔷

No US portal in between.

Native e-sign in the product —
not as an extra tab.

#sign2x #Native #StayInTheStack`,
  },
  91: {
    files: ["IGU_P91_01.jpg", "IGU_P91_02.jpg", "IGU_P91_03.jpg", "IGU_P91_04.jpg"],
    kind: "carousel",
    hook: "Frankfurt-Skyline — EU-Server ≠ DE-Hosting",
    brief: "Skyline + jurisdiction diagram carousel. Not board photo.",
    de: `Frankfurt allein reicht nicht. 🔷

EU-Standort ≠ deutsches Hosting.
US-Anbieter → Cloud Act bleibt.

Swipe: Mythos → Mechanik → STACKIT+Telekom → Native.

#sign2x #STACKIT #CloudAct`,
    en: `Frankfurt alone isn’t enough. 🔷

EU location ≠ German hosting.
US provider → Cloud Act remains.

Swipe: myth → mechanism → STACKIT+Telekom → native.

#sign2x #STACKIT #CloudAct`,
  },
  92: {
    files: ["IGU_P92.jpg"],
    kind: "image",
    hook: "Entscheidungsmemo — Souveränität ist keine Folie",
    brief: "Board deck face-down + signed decision memo. Not board photo.",
    de: `Die Folie ist zu. 🔷

Souveränität steht in der Entscheidung —
STACKIT + Telekom auf dem Board —
nicht nur im Pitch.

#sign2x #Datensouveränität`,
    en: `The slide deck is closed. 🔷

Sovereignty lives in the decision —
STACKIT + Telekom on the board —
not only in the pitch.

#sign2x #DataSovereignty`,
  },
  64: {
    files: ["IGU_P64.jpg"],
    kind: "image",
    hook: "Nach der Runde — wohin das Protokoll?",
    brief: "Empty meeting room: recording puck + closed laptop glow. No jacket.",
    de: `Runde vorbei. Protokoll? 🔷

Unterschrieben ≠ Compliance fertig.
Wo liegt das Audit-Log — unter welchem Recht?

Sign2x: Log in DE.

#sign2x #AuditLog`,
    en: `Meeting over. The log? 🔷

Signed ≠ compliance done.
Where does the audit log live — under which law?

Sign2x: log in DE.

#sign2x #AuditLog`,
  },
  95: {
    files: ["IGU_P95_01.jpg", "IGU_P95_02.jpg", "IGU_P95_03.jpg"],
    kind: "carousel",
    hook: "Farbchips — White-label als Markenschutz",
    brief: "Paint swatches / brand color chips + unsigned envelope corner. Color story.",
    de: `White-label ist Markenschutz. 🔷

Eure Farbe.
Keine Fremdlogos.
Envelope trägt euch.

Wir bleiben still.

#sign2x #Whitelabel`,
    en: `White-label is brand armor. 🔷

Your color.
No foreign logos.
Envelope carries you.

We stay quiet.

#sign2x #Whitelabel`,
  },
  96: {
    files: ["IGU_P96.jpg"],
    kind: "image",
    hook: "Reception — Kauz bleibt Kauz",
    brief: "Type-only partner name card on reception counter. No envelope hero.",
    de: `Kauz bleibt Kauz. 🔷

White-label heißt:
die Signatur trägt das Produkt —
nicht den Engine.

#sign2x #Whitelabel #Kauz`,
    en: `Kauz stays Kauz. 🔷

White-label means:
the signature carries the product —
not the engine.

#sign2x #Whitelabel #Kauz`,
  },
  80: {
    files: ["IGU_P80.jpg"],
    kind: "image",
    hook: "Rack-Tür — Daten bleiben hier",
    brief: "Server cage door / rack lock close-up. Not letter slot.",
    de: `Hier bleibt es. 🔷

Nicht in irgendeiner Cloud unterwegs.
STACKIT + Telekom. 100% DE.

#sign2x #Hosting`,
    en: `It stays here. 🔷

Not wandering through “some cloud”.
STACKIT + Telekom. 100% DE.

#sign2x #Hosting`,
  },
  97: {
    files: ["IGU_P97.jpg"],
    kind: "image",
    hook: "EU-Karte — Provider-HQ unter US-Recht",
    brief: "EU map with US flag pin on provider HQ. Mechanism diagram.",
    de: `Mechanik, nicht Mythos. 🔷

US-Anbieter auf EU-Boden → Cloud Act bleibt.
Frankfurt ändert das Anbieterrecht nicht.

Sign2x: STACKIT + Telekom.

#sign2x #CloudAct`,
    en: `Mechanism, not myth. 🔷

US provider on EU soil → Cloud Act remains.
Frankfurt doesn’t change provider law.

Sign2x: STACKIT + Telekom.

#sign2x #CloudAct`,
  },
  98: {
    files: ["IGU_P98_01.jpg", "IGU_P98_02.jpg", "IGU_P98_03.jpg", "IGU_P98_04.jpg"],
    kind: "carousel",
    hook: "Haftungs-Dials — SES · AES · QES",
    brief: "Three liability dials/gauges. Not stamp pile. SES AES QES only.",
    de: `SES · AES · QES 🔷

Nicht Marketing-Namen.
Haftung wählt das Level.

Swipe die drei Dials.
https://www.sign2x.com/quiz

#sign2x #eIDAS #SES #AES #QES`,
    en: `SES · AES · QES 🔷

Not marketing names.
Liability picks the level.

Swipe the three dials.
https://www.sign2x.com/quiz

#sign2x #eIDAS #SES #AES #QES`,
  },
  81: {
    files: ["IGU_P81.jpg"],
    kind: "image",
    hook: "Privacy Screen — keine Fremdlogos",
    brief: "Laptop privacy screen covering third-party mark.",
    de: `Keine Fremdlogos. 🔷

Die Signatur trägt euren Namen.
White-label. Native. Unsichtbar.

#sign2x #Whitelabel`,
    en: `No foreign logos. 🔷

The signature carries your name.
White-label. Native. Invisible.

#sign2x #Whitelabel`,
  },
  101: {
    files: ["IGU_P101.jpg"],
    kind: "image",
    hook: "Geschlossenes Portemonnaie — Prüfung ≠ Export",
    brief: "Closed wallet on table. No face-down Ausweis hero.",
    de: `GwG braucht Kontrolle. 🔷

Nicht den Ausweis-Export ins Fremdportal.

Prüfung ≠ Capture.

#sign2x #GwG`,
    en: `AML needs control. 🔷

Not shipping the ID into a foreign portal.

Check ≠ capture.

#sign2x #AML`,
  },
  70: {
    files: ["IGU_P70_01.jpg", "IGU_P70_02.jpg", "IGU_P70_03.jpg"],
    kind: "carousel",
    hook: "Prüfung vs Capture — GwG-Strecke",
    brief: "Blurred phone screen vs sealed evidence folder. No ID card face.",
    de: `Identität prüfen ≠ Daten abgeben. 🔷

1) Prüfung
2) Capture-Falle
3) Protokoll in DE

#sign2x #GwG`,
    en: `Checking identity ≠ handing data over. 🔷

1) The check
2) Capture trap
3) Log in DE

#sign2x #AML`,
  },
  103: {
    files: ["IGU_P103.jpg"],
    kind: "image",
    hook: "Aktenordner Protokoll — Log in DE",
    brief: "German file binder spine Protokoll. Not stamp pad.",
    de: `Protokoll DE. 🔷

GwG-Strecke ohne US-Portal.
Log unter STACKIT + Telekom.

#sign2x #GwG #AuditLog`,
    en: `Log in DE. 🔷

AML path without a US portal.
Log under STACKIT + Telekom.

#sign2x #AML #AuditLog`,
  },
  104: {
    files: ["IGU_P104.jpg"],
    kind: "image",
    hook: "Kunden-Rack — On-prem dieselbe Schicht",
    brief: "On-prem appliance in customer rack + KVM native UI.",
    de: `Läuft hier. 🔷

On-prem, wenn Cloud nicht reicht.
Dieselbe native Schicht — kein zweites Portal-Produkt.

#sign2x #OnPremise`,
    en: `Runs here. 🔷

On-prem when cloud isn’t enough.
Same native layer — no second portal product.

#sign2x #OnPremise`,
  },
  57: {
    files: ["IGU_P57.jpg"],
    kind: "image",
    hook: "Screensaver — Marke nach Feierabend",
    brief: "Dark office: client logo screensaver only. No jacket.",
    de: `Raum leer. Marke bleibt. 🔷

Kein Fremdlogo auf dem Screen —
auch nach Feierabend.

So fühlt sich White-label an.

#sign2x #Whitelabel`,
    en: `Room empty. Brand stays. 🔷

No foreign logo on the screen —
even after hours.

That’s how white-label feels.

#sign2x #Whitelabel`,
  },
  83: {
    files: ["IGU_P83.jpg"],
    kind: "image",
    hook: "Wochenende — Daten hier geblieben",
    brief: "Weekend calendar page + green check on DE DC icon.",
    de: `Woche vorbei. 🔷

Die Daten sind hier geblieben.
Kein Cloud Act im Protokoll.

#sign2x #Datensouveränität`,
    en: `Week done. 🔷

The data stayed here.
No Cloud Act in the log.

#sign2x #DataSovereignty`,
  },
  107: {
    files: ["IGU_P107_01.jpg", "IGU_P107_02.jpg", "IGU_P107_03.jpg", "IGU_P107_04.jpg"],
    kind: "carousel",
    hook: "Vier Namenskarten — Beweis vor Versprechen",
    brief: "Four type-only proof cards: Keil / NRW / Vertu / Kauz.",
    de: `Beweis vor Versprechen. 🔷

Keil KTM · NRW Grundbesitz · Vertu-Invest · Kauz

Keine erfundenen Zitate.

#sign2x #SocialProof`,
    en: `Proof over promises. 🔷

Keil KTM · NRW Grundbesitz · Vertu-Invest · Kauz

No invented quotes.

#sign2x #SocialProof`,
  },
  108: {
    files: ["IGU_P108.jpg"],
    kind: "image",
    hook: "Durchgestrichenes Testimonial — keine Märchen",
    brief: "Notepad with strikethrough Testimonial draft.",
    de: `Schon gesagt. 🔷

Keine erfundenen Stimmen.
Echte Namen. STACKIT + Telekom auf dem Board.

#sign2x #SocialProof`,
    en: `Already said. 🔷

No invented voices.
Real names. STACKIT + Telekom on the board.

#sign2x #SocialProof`,
  },
  109: {
    files: ["IGU_P109.jpg"],
    kind: "image",
    hook: "TCO-Wasserfall — Lock-in ist der teure Balken",
    brief: "TCO waterfall sketch, lock-in bar tallest. Up to 20% claim.",
    de: `September-Close. 🔷

Lock-in ist der teure Teil.
Veröffentlicht: bis zu 20% TCO — nicht aufgeblasen.

https://www.sign2x.com/quiz

#sign2x #TCO`,
    en: `September close. 🔷

Lock-in is the expensive part.
As published: up to 20% TCO — not inflated.

https://www.sign2x.com/quiz

#sign2x #TCO`,
  },
};

const BATCHES = {
  batch1: [85, 67, 86, 63, 71],
  batch2: [89, 50, 91, 92, 64],
  batch3: [95, 96, 80, 97, 98, 81],
  batch4: [101, 70, 103, 104, 57, 83],
  batch5: [107, 108, 109],
};

async function uploadPost(post, spec) {
  const missing = spec.files.filter((f) => !existsSync(join(ASSETS, f)));
  if (missing.length) {
    console.log(`#${post.post_number} skip missing: ${missing.join(", ")}`);
    return false;
  }
  mkdirSync(SEPT, { recursive: true });
  for (const f of spec.files) copyFileSync(join(ASSETS, f), join(SEPT, f));

  const oldPaths = (Array.isArray(post.media) ? post.media : [])
    .map((m) => m?.storage_path)
    .filter(Boolean);
  if (oldPaths.length) await admin.storage.from("content-media").remove(oldPaths);

  const media = [];
  for (const f of spec.files) {
    const bytes = readFileSync(join(ASSETS, f));
    const path = `${post.project_id}/${post.id}/${Date.now()}-${basename(f)}`;
    const { error: upErr } = await admin.storage.from("content-media").upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (upErr) throw new Error(`#${post.post_number} ${f}: ${upErr.message}`);
    const { data: pub } = admin.storage.from("content-media").getPublicUrl(path);
    media.push({
      id: randomUUID(),
      url: pub.publicUrl,
      kind: "image",
      source: "upload",
      storage_path: path,
    });
  }

  const captions = { ...(post.captions || {}) };
  captions.instagram = { de: spec.de, en: spec.en };
  const visual_brief = {
    ...(post.visual_brief || {}),
    graphic_description: spec.brief,
    typography_notes: TYPE,
    style_notes: "Unique concept redo — banned plug/kitchen defaults.",
  };

  const { error } = await admin
    .from("content_posts")
    .update({
      hook_angle: spec.hook,
      captions,
      visual_brief,
      media,
      media_kind: spec.kind,
      media_by_platform: {},
      visual_format: "feed",
      is_video: false,
      visual_asset_url: media[0].url,
      remarks: [post.remarks || "", "Unique IG redo"].filter(Boolean).join(" | "),
      updated_at: new Date().toISOString(),
    })
    .eq("id", post.id);
  if (error) throw new Error(error.message);
  console.log(`#${post.post_number} ← ${spec.files.length} (${spec.kind})`);
  return true;
}

async function main() {
  const arg = process.argv[2] || "all";
  const nums =
    arg === "all"
      ? Object.keys(POSTS).map(Number)
      : BATCHES[arg] || arg.split(",").map(Number);

  const { data: posts, error } = await admin
    .from("content_posts")
    .select("id, post_number, project_id, media, captions, visual_brief, remarks, status_production")
    .eq("calendar_id", CALENDAR_ID)
    .in("post_number", nums);
  if (error) throw new Error(error.message);
  const byNum = Object.fromEntries((posts || []).map((p) => [p.post_number, p]));

  let ok = 0;
  for (const n of nums) {
    const post = byNum[n];
    const spec = POSTS[n];
    if (!post || !spec) {
      console.log(`Missing post or spec #${n}`);
      continue;
    }
    if (post.status_production === "live") {
      console.log(`Skip live #${n}`);
      continue;
    }
    if (await uploadPost(post, spec)) ok++;
  }
  console.log(`Done. Uploaded ${ok}/${nums.length} for ${arg}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
