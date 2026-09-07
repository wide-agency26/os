/**
 * One-shot prod CRM reset follow-up: delete leftover client auth users,
 * company-first upsert from WIDE + Tooling Studio CSVs, then resync ledger.
 *
 * Usage: node scripts/reset-and-import-crm.mjs
 */
import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const Papa = require("papaparse");

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const KEEP = {
  protocolCompany: "8db1b41f-cf21-473f-b646-7ac14e2b6e02",
  protocolProject: "572786a3-b8b7-4f35-ba93-762b7b28a185",
  protocolBd: "b0c74e13-61a7-4b9a-af4e-3d26e900798b",
  bauconsultCompany: "1c820d37-52e9-424e-9603-abbf8f3e132c",
  bauconsultProject: "0c9ad253-285a-4aae-95db-63c6d4e2f3c3",
  bauconsultBd: "d05cf29f-8ac1-4479-9227-70ba5afc4e95",
  andreasContact: "a1638980-566c-44b9-a227-845888a03459",
  aliProfile: "ad6e052d-6985-4359-a92d-f2084fa2f89c",
  thomasProfile: "220f8323-b783-4718-8a96-a37d2c0b3dc8",
  sowSlugs: [
    "protocol-health-ai-83cf9b86",
    "protocol-health-ai-2284167b",
    "bauconsult-84b2613b",
  ],
};

const ALIASES = {
  "andreas lerge": "bauconsult",
  "bauconsult andreas lerge": "bauconsult",
  "bauconsult": "bauconsult",
  "protocol health": "protocol health ai",
  "protocol health ai": "protocol health ai",
  "tf tax aka tara": "tf tax",
  "tara": "tf tax",
  "tara tax": "tf tax",
  "mgh - munchener gewerbehofe": "mgh munchener gewerbehofe",
  "mgh munchener gewerbehofe": "mgh munchener gewerbehofe",
  "heal health": "heal",
  "esavea.com": "esavea",
  "bavaroona.com": "bavaroona",
  "reavo.net": "reavo",
  "yumiqo.de": "yumiqo",
  "www.yumiqo.de": "yumiqo",
  "llv8.me": "llv8",
  "www.llv8.me": "llv8",
  "heal.health": "heal",
  "nunq.ai": "nunq",
  "ai-thea.com": "ai thea",
  "ai thea": "ai thea",
  "agoramaven.com": "agoramaven",
  "beevvy.com": "beevvy",
  "spark-and-sustain.eu": "spark and sustain",
  "spark and sustain": "spark and sustain",
  "isfort-handelsgesellschaft.de": "isfort handelsgesellschaft",
  "www.isfort-handelsgesellschaft.de": "isfort handelsgesellschaft",
  "fairoo.de": "fairoo",
  "quantum systems - chief of staff": "quantum systems",
  "startup-manager bei stadtsparkasse munchen": "sskm",
  "max mller consulting": "max muller consulting",
  "independent / tech advisory": "independent / tech advisory",
};

function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function throwIf(error, ctx) {
  if (error) throw new Error(`${ctx}: ${error.message || error}`);
}

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .trim();
}

function stripUrl(raw) {
  let s = String(raw || "").trim();
  s = s.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  s = s.replace(/\/.*$/, "");
  return s;
}

function companyKey(raw) {
  const stripped = stripUrl(raw);
  const foldedRaw = fold(raw);
  const foldedStripped = fold(stripped);
  if (ALIASES[foldedRaw]) return ALIASES[foldedRaw];
  if (ALIASES[foldedStripped]) return ALIASES[foldedStripped];
  let k = foldedStripped
    .replace(/[_.,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!k) return "";
  if (ALIASES[k]) return ALIASES[k];
  // Drop leftover TLD tokens from URL-derived names (esavea com → esavea)
  k = k.replace(/\b(com|de|net|ai|eu|me|io|org|health)\b/g, "").replace(/\s+/g, " ").trim();
  if (ALIASES[k]) return ALIASES[k];
  return k;
}

function looksLikeUrlName(name) {
  const s = String(name || "").trim();
  return /^https?:\/\//i.test(s) || /^www\./i.test(s) || /\.(com|de|net|ai|eu|me|health|io)\b/i.test(s);
}

function displayName(raw, fallbackKey) {
  const s = String(raw || "").trim();
  if (!s || looksLikeUrlName(s)) {
    return fallbackKey
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return s;
}

function parseMoney(raw) {
  if (raw == null || raw === "") return 0;
  const s = String(raw).replace(/€/g, "").replace(/\s/g, "").replace(/,/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parseJson(raw, fallback) {
  if (raw == null || raw === "") return fallback;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function firstEmail(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("[")) {
    const arr = parseJson(s, []);
    const hit = arr.find((x) => x && x.value);
    return hit?.value ? String(hit.value).trim().toLowerCase() : null;
  }
  return s.toLowerCase();
}

function firstPhone(raw) {
  const arr = parseJson(raw, []);
  if (!Array.isArray(arr) || !arr.length) return null;
  const p = arr[0];
  const val = String(p.value || "").trim();
  if (!val) return null;
  const prefix = String(p.prefix || "").trim();
  return prefix ? `${prefix} ${val}` : val;
}

function findCsv(names) {
  const dirs = [
    join(homedir(), "Downloads"),
    join(root, "scripts/data/crm-import"),
  ];
  for (const dir of dirs) {
    for (const n of names) {
      const p = join(dir, n);
      if (existsSync(p)) return p;
    }
  }
  throw new Error(`CSV not found: ${names.join(" | ")}`);
}

function readCsv(path) {
  const text = readFileSync(path, "utf8");
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  return parsed.data || [];
}

function statusRank(status) {
  const s = String(status || "").trim();
  if (s === "Client") return 3;
  if (s === "Lead") return 2;
  return 1;
}

function ensureCompany(map, rawName, extra = {}) {
  const key = companyKey(rawName || extra.fallbackName || "");
  if (!key) return null;
  if (!map.has(key)) {
    map.set(key, {
      key,
      displayName:
        key === "protocol health ai"
          ? "Protocol health AI"
          : key === "bauconsult"
            ? "Bauconsult Andreas Lerge"
            : displayName(rawName, key),
      status: "Prospect",
      leadStatus: null,
      industry: null,
      source: null,
      sourceCategory: null,
      startDate: null,
      projectType: null,
      contractType: null,
      notes: [],
      contractValue: 0,
      pipelineValue: 0,
      contacts: [],
      deals: [],
      reachedOut: false,
      keep: key === "protocol health ai" || key === "bauconsult",
    });
  }
  const c = map.get(key);
  if (rawName && !looksLikeUrlName(rawName) && !c.keep) {
    const next = String(rawName).trim();
    if (next && (looksLikeUrlName(c.displayName) || next.length > 1)) {
      if (looksLikeUrlName(c.displayName)) c.displayName = next;
    }
  }
  return c;
}

function addContact(company, rec) {
  const name = String(rec.name || "").trim();
  const email = rec.email ? String(rec.email).trim().toLowerCase() : "";
  if (!name && !email) return;
  const existing = company.contacts.find((x) => {
    if (email && x.email && x.email === email) return true;
    if (name && fold(x.name) === fold(name)) return true;
    return false;
  });
  if (existing) {
    if (!existing.email && email) existing.email = email;
    if (!existing.position && rec.position) existing.position = rec.position;
    if (!existing.linkedin && rec.linkedin) existing.linkedin = rec.linkedin;
    if (!existing.role && rec.role) existing.role = rec.role;
    return;
  }
  company.contacts.push({
    name: name || email || company.displayName,
    email: email || null,
    position: rec.position || null,
    linkedin: rec.linkedin || null,
    role: rec.role || null,
    keepId:
      email === "lerge@bauconsult.info" || fold(name) === "andreas lerge"
        ? KEEP.andreasContact
        : null,
  });
}

function addDeal(company, deal) {
  const title = String(deal.title || "Deal").trim();
  const value = Number(deal.value || 0);
  const dup = company.deals.find(
    (d) => fold(d.title) === fold(title) && Math.abs((d.value || 0) - value) < 0.02
  );
  if (dup) {
    if (deal.won) dup.won = true;
    if (deal.startDate && !dup.startDate) dup.startDate = deal.startDate;
    return;
  }
  company.deals.push({
    title,
    value,
    won: !!deal.won,
    startDate: deal.startDate || null,
    projectType: deal.projectType || title,
  });
}

function applyStatus(company, status, leadStatus, sourcePriority) {
  if (company.key === "bauconsult") return; // forced later
  if (company.key === "protocol health ai") return;
  if (status && statusRank(status) >= statusRank(company.status)) {
    company.status = status;
  }
  if (leadStatus) {
    if (status === "Client" || leadStatus === "Won") {
      company.status = "Client";
      company.leadStatus = "Won";
    } else if (!company.leadStatus || sourcePriority >= 3) {
      company.leadStatus = leadStatus;
    }
  }
}

function bdStageFor(company) {
  if (company.key === "bauconsult") return "client_won";
  if (company.key === "protocol health ai") return "proposal_sent";
  const ls = company.leadStatus;
  if (company.status === "Client" || ls === "Won") return "client_won";
  if (ls === "Proposal Sent") return "proposal_sent";
  if (ls === "Reached out" || company.reachedOut) return "outreach";
  if (ls === "On-hold") return "on_hold";
  if (ls === "Lost") return "declined";
  if (company.status === "Lead") return "outreach";
  return "prospect";
}

function monthStart(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function pillarFromStage(stage) {
  if (stage === "prospect") return "unidentified";
  if (stage === "lead") return "identified";
  return "actual";
}

async function upsertBySyncKey(admin, row) {
  const { data: existing, error: selErr } = await admin
    .from("ledger_entries")
    .select("id, pillar, moved_from_pillar, moved_at")
    .eq("sync_key", row.sync_key)
    .maybeSingle();
  throwIf(selErr, "ledger select");
  if (existing?.id) {
    const patch = { ...row };
    delete patch.sync_key;
    if (existing.moved_from_pillar && existing.pillar === patch.pillar) {
      patch.moved_from_pillar = existing.moved_from_pillar;
      patch.moved_at = existing.moved_at;
    }
    const { error } = await admin.from("ledger_entries").update(patch).eq("id", existing.id);
    throwIf(error, "ledger update");
    return;
  }
  const { error } = await admin.from("ledger_entries").insert([row]);
  throwIf(error, "ledger insert");
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const clientsPath = findCsv(["WIDE CRM  - Clients.csv", "clients.csv"]);
  const leadsPath = findCsv(["WIDE CRM  - Leads (1).csv", "WIDE CRM  - Leads.csv", "leads.csv"]);
  const prospectsPath = findCsv(["WIDE CRM  - Prospects.csv", "prospects.csv"]);
  const tsPath = findCsv([
    "tooling-studio-crm-wide-export-2026-08-16-10-10-01.csv",
    "tooling-studio.csv",
  ]);
  console.log("CSV files:");
  console.log("  clients   ", clientsPath);
  console.log("  leads     ", leadsPath);
  console.log("  prospects ", prospectsPath);
  console.log("  tooling   ", tsPath);

  const companies = new Map();
  ensureCompany(companies, "Protocol health AI");
  ensureCompany(companies, "Bauconsult Andreas Lerge");

  // 1) Clients (highest priority)
  for (const row of readCsv(clientsPath)) {
    const companyName = String(row.Company || "").trim();
    if (!companyName) continue;
    const c = ensureCompany(companies, companyName);
    c.status = "Client";
    c.leadStatus = "Won";
    if (row.Industry) c.industry = row.Industry;
    if (row.Source) c.source = row.Source;
    if (row["Source Category"]) c.sourceCategory = row["Source Category"];
    if (row["Start Date"]) c.startDate = parseDate(row["Start Date"]) || c.startDate;
    if (row["Project Type"]) c.projectType = row["Project Type"];
    if (row["Contract Type"]) c.contractType = row["Contract Type"];
    if (row.Notes) c.notes.push(String(row.Notes).trim());
    addContact(c, {
      name: row.Name,
      email: firstEmail(row.Email),
      position: row.Position,
      linkedin: row.Linkedin || row.LinkedIn,
      role: row.Role,
    });
    addDeal(c, {
      title: row["Project Type"] || "Engagement",
      value: parseMoney(row["Contract Value"]),
      won: true,
      startDate: parseDate(row["Start Date"]),
      projectType: row["Project Type"],
    });
  }

  // 2) Leads with non-empty Status (skip 43 blanks)
  for (const row of readCsv(leadsPath)) {
    const status = String(row.Status || "").trim();
    if (!status) continue;
    const companyName = String(row.Company || "").trim();
    if (!companyName) continue;
    const key = companyKey(companyName);
    const leadStatus = String(row["Lead Status"] || "").trim();
    // Ignore On-hold Andreas Lerge row so we do not park Bauconsult in Lose
    if (key === "bauconsult") {
      const c = ensureCompany(companies, companyName);
      addContact(c, {
        name: row.Name,
        email: firstEmail(row.Email),
        position: row.Position,
        linkedin: row.Linkedin || row.LinkedIn,
        role: row.Role,
      });
      continue;
    }
    const c = ensureCompany(companies, companyName);
    applyStatus(c, status, leadStatus, 3);
    if (row.Industry && !c.industry) c.industry = row.Industry;
    if (row.Source && !c.source) c.source = row.Source;
    if (row["Source Category"] && !c.sourceCategory) c.sourceCategory = row["Source Category"];
    if (row["Start Date"] && !c.startDate) c.startDate = parseDate(row["Start Date"]);
    if (row["Project Type"] && !c.projectType) c.projectType = row["Project Type"];
    if (row.Notes) c.notes.push(String(row.Notes).trim());
    if (row["Remarks on Lead Status"]) c.notes.push(String(row["Remarks on Lead Status"]).trim());
    addContact(c, {
      name: row.Name,
      email: firstEmail(row.Email),
      position: row.Position,
      linkedin: row.Linkedin || row.LinkedIn,
      role: row.Role,
    });
    const value = parseMoney(row["Estimated Contract Value (EUR)"]);
    const won = leadStatus === "Won" || status === "Client";
    if (won) {
      addDeal(c, {
        title: row["Project Type"] || "Engagement",
        value,
        won: true,
        startDate: parseDate(row["Start Date"]),
        projectType: row["Project Type"],
      });
    } else if (leadStatus === "Proposal Sent" || leadStatus === "Reached out") {
      c.pipelineValue = Math.max(c.pipelineValue, value);
    }
  }

  // 3) Tooling Studio (orgs, contacts, deals) — fill gaps only
  const tsRows = readCsv(tsPath);
  const tsOrgs = tsRows.filter((r) => fold(r.Type) === "organization");
  const tsContacts = tsRows.filter((r) => fold(r.Type) === "contact");
  const tsDeals = tsRows.filter((r) => fold(r.Type) === "deal");

  for (const row of tsOrgs) {
    const name = String(row.Name || "").trim();
    if (!name) continue;
    const c = ensureCompany(companies, name);
    if (row.Industry && !c.industry) c.industry = row.Industry;
  }

  for (const row of tsDeals) {
    const orgs = parseJson(row["Linked organizations JSON"], []);
    const orgName = orgs[0]?.name || "";
    const c = ensureCompany(companies, orgName);
    if (!c) continue;
    const contacts = parseJson(row["Linked contacts JSON"], []);
    for (const ct of contacts) {
      addContact(c, { name: ct.name, email: firstEmail(ct.email), position: null });
    }
    const list = String(row.List || "").trim();
    const tsStatus = String(row.Status || "").trim().toLowerCase();
    const title = String(row["Deal title"] || row.Name || "Deal").trim();
    const value = parseMoney(row["Deal value"]);
    const closedWon = list === "Closed Won" || tsStatus === "won" || list === "Invoiced";
    // Clients sheet already created won deals; only add if this company has none yet
    if (closedWon && c.status !== "Client" && c.key !== "protocol health ai") {
      // Bauconsult forced Client; other TS-only Closed Won (none expected besides Bauconsult)
      if (c.key === "bauconsult") continue;
    }
    if (value && c.pipelineValue === 0 && c.status !== "Client" && !["Lost", "On-hold"].includes(c.leadStatus || "")) {
      c.pipelineValue = Math.max(c.pipelineValue, value);
    }
    if (c.status === "Prospect" && (list === "Idle" || tsStatus === "open")) {
      // leave as prospect; value for unidentified if no WIDE status
      if (value) c.pipelineValue = Math.max(c.pipelineValue, value);
    }
    void title;
  }

  const emailDomainToKey = new Map();
  for (const c of companies.values()) {
    for (const ct of c.contacts) {
      if (!ct.email || !ct.email.includes("@")) continue;
      const domain = ct.email.split("@")[1];
      if (domain && !emailDomainToKey.has(domain)) emailDomainToKey.set(domain, c.key);
    }
  }
  emailDomainToKey.set("protocol-health.ai", "protocol health ai");
  emailDomainToKey.set("protocolhealth.ai", "protocol health ai");
  emailDomainToKey.set("tf-tax.de", "tf tax");
  emailDomainToKey.set("munich-startup.de", "msf");
  emailDomainToKey.set("bauconsult.info", "bauconsult");
  emailDomainToKey.set("amor-fati.com", "tf tax");

  for (const row of tsContacts) {
    const name = String(row.Name || "").trim();
    const email = firstEmail(row["Email JSON"]);
    const website = String(row.Website || "").trim();
    const linkedin = String(row.LinkedIn || "").trim() || null;
    const position = String(row["Job title"] || "").trim() || null;
    let key = "";
    if (email && email.includes("@")) {
      key = emailDomainToKey.get(email.split("@")[1]) || "";
    }
    if (!key && website) key = companyKey(website);
    if (!key && name) {
      for (const c of companies.values()) {
        if (c.contacts.some((ct) => fold(ct.name) === fold(name))) {
          key = c.key;
          break;
        }
      }
    }
    if (!key && fold(name) === "pary zadeh") key = "protocol health ai";
    if (!key) continue;
    const c = companies.get(key);
    if (!c) continue;
    addContact(c, { name, email, position, linkedin });
  }

  // 4) Prospects (lowest priority — do not downgrade)
  for (const row of readCsv(prospectsPath)) {
    const status = String(row.Status || "").trim();
    if (!status) continue;
    let companyName = String(row.Company || "").trim();
    const person = String(row.Name || "").trim();
    if (!companyName) companyName = person;
    if (!companyName) continue;
    const c = ensureCompany(companies, companyName);
    if (c.status === "Prospect" && !c.leadStatus) {
      c.status = "Prospect";
    }
    const reached = String(row["Reached out?"] || "").trim().toLowerCase();
    if (reached === "yes") c.reachedOut = true;
    if (row.Source && !c.source) c.source = row.Source;
    if (row["Source Category"] && !c.sourceCategory) c.sourceCategory = row["Source Category"];
    if (row.Notes) c.notes.push(String(row.Notes).trim());
    addContact(c, {
      name: person,
      email: firstEmail(row.Email),
      position: row.Position,
      linkedin: row.LinkedIn || row.Linkedin,
      role: row.Role,
    });
  }

  // Force keep-set commercial rules
  const protocol = companies.get("protocol health ai");
  protocol.status = "Lead";
  protocol.leadStatus = "Proposal Sent";
  protocol.displayName = "Protocol health AI";
  protocol.deals = []; // keep existing project, do not recreate
  protocol.pipelineValue = 0;

  const bau = companies.get("bauconsult");
  bau.status = "Client";
  bau.leadStatus = "Won";
  bau.displayName = "Bauconsult Andreas Lerge";
  bau.deals = [];
  bau.pipelineValue = 0;

  // Delete leftover client auth users (profiles already removed)
  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 50 });
  throwIf(listErr, "listUsers");
  const keepAuth = new Set([KEEP.aliProfile, KEEP.thomasProfile]);
  for (const u of listData?.users || []) {
    if (keepAuth.has(u.id)) continue;
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.warn(`auth delete ${u.email}: ${error.message}`);
    else console.log(`deleted auth user ${u.email}`);
  }

  const ownerId = KEEP.aliProfile;
  const companyIdByKey = new Map();
  companyIdByKey.set("protocol health ai", KEEP.protocolCompany);
  companyIdByKey.set("bauconsult", KEEP.bauconsultCompany);

  let companiesUpserted = 0;
  for (const c of companies.values()) {
    const isClient = c.status === "Client" || c.leadStatus === "Won";
    const wonSum = c.deals.filter((d) => d.won).reduce((s, d) => s + (d.value || 0), 0);
    let contractValue = 0;
    if (isClient) contractValue = wonSum || (c.key === "bauconsult" ? 2300 : c.key === "protocol health ai" ? 5800 : 0);
    else if (c.leadStatus === "Lost" || c.leadStatus === "On-hold") contractValue = 0;
    else contractValue = c.pipelineValue || 0;

    const primary = c.contacts[0] || {};
    const payload = {
      name: c.displayName,
      company: c.displayName,
      record_kind: "company",
      status: c.key === "protocol health ai" ? "Lead" : isClient ? "Client" : c.status,
      lead_status: c.leadStatus,
      industry: c.industry,
      source: c.source,
      source_category: c.sourceCategory,
      start_date: c.startDate,
      project_type: c.projectType,
      contract_type: c.contractType,
      contract_value: contractValue || null,
      email: primary.email || null,
      notes: c.notes.filter(Boolean).join("\n") || null,
      updated_at: new Date().toISOString(),
    };

    let id = companyIdByKey.get(c.key);
    if (id) {
      const { error } = await admin.from("crm_customers").update(payload).eq("id", id);
      throwIf(error, `update company ${c.displayName}`);
    } else {
      const { data, error } = await admin
        .from("crm_customers")
        .insert(payload)
        .select("id")
        .single();
      throwIf(error, `insert company ${c.displayName}`);
      id = data.id;
      companyIdByKey.set(c.key, id);
    }
    c.id = id;
    companiesUpserted += 1;
  }

  let contactsUpserted = 0;
  for (const c of companies.values()) {
    for (const ct of c.contacts) {
      const payload = {
        name: ct.name,
        company: c.displayName,
        record_kind: "contact",
        parent_company_id: c.id,
        status: c.status === "Client" ? "Client" : c.status,
        lead_status: c.leadStatus,
        email: ct.email,
        position: ct.position,
        role: ct.role,
        linkedin: ct.linkedin,
        industry: c.industry,
        source: c.source,
        source_category: c.sourceCategory,
        updated_at: new Date().toISOString(),
      };
      if (ct.keepId) {
        const { error } = await admin.from("crm_customers").update(payload).eq("id", ct.keepId);
        throwIf(error, `update contact ${ct.name}`);
        ct.id = ct.keepId;
      } else {
        const { data, error } = await admin
          .from("crm_customers")
          .insert(payload)
          .select("id")
          .single();
        throwIf(error, `insert contact ${ct.name}`);
        ct.id = data.id;
      }
      contactsUpserted += 1;
    }
  }

  const bdIdByKey = new Map();
  bdIdByKey.set("protocol health ai", KEEP.protocolBd);
  bdIdByKey.set("bauconsult", KEEP.bauconsultBd);

  let bdUpserted = 0;
  let sortOrder = 0;
  for (const c of companies.values()) {
    const stage = bdStageFor(c);
    const primary = c.contacts[0] || {};
    const payload = {
      name: primary.name || c.displayName,
      company_name: c.displayName,
      company_id: c.id,
      contact_id: primary.id || null,
      email: primary.email || null,
      position: primary.position || null,
      linkedin_url: primary.linkedin || null,
      owner_id: ownerId,
      created_by: ownerId,
      source: "manual",
      stage,
      stage_entered_at: new Date().toISOString(),
      observer_ids: [],
      demand_signals: [],
      audit_links: [],
      outreach_log: [],
      discovery_call: {},
      proposal: {},
      contract: {},
      quotation: {},
      sort_order: sortOrder++,
      updated_at: new Date().toISOString(),
    };
    let id = bdIdByKey.get(c.key);
    if (id) {
      const { error } = await admin.from("bd_records").update(payload).eq("id", id);
      throwIf(error, `update bd ${c.displayName}`);
    } else {
      const { data, error } = await admin.from("bd_records").insert(payload).select("id").single();
      throwIf(error, `insert bd ${c.displayName}`);
      id = data.id;
      bdIdByKey.set(c.key, id);
    }
    c.bdId = id;
    bdUpserted += 1;
  }

  // Projects: keep two as-is (IDs), update commercial flags; create won deals only
  const { error: protoProjErr } = await admin
    .from("projects")
    .update({
      status: "pipeline",
      stage: "lead",
      deal_value: 5800,
      client_id: KEEP.protocolCompany,
      bd_record_id: KEEP.protocolBd,
      company: "Protocol health AI",
      updated_at: new Date().toISOString(),
    })
    .eq("id", KEEP.protocolProject);
  throwIf(protoProjErr, "update protocol project");

  const { error: bauProjErr } = await admin
    .from("projects")
    .update({
      status: "running",
      stage: "client",
      deal_value: 2300,
      client_id: KEEP.bauconsultCompany,
      bd_record_id: KEEP.bauconsultBd,
      company: "Bauconsult Andreas Lerge",
      contract_confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", KEEP.bauconsultProject);
  throwIf(bauProjErr, "update bauconsult project");

  const pary = protocol.contacts.find((x) => fold(x.name) === "pary zadeh");
  if (pary?.id) {
    await admin.from("project_deal_contacts").delete().eq("project_id", KEEP.protocolProject);
    const { error } = await admin.from("project_deal_contacts").insert({
      project_id: KEEP.protocolProject,
      contact_id: pary.id,
    });
    throwIf(error, "protocol deal contact");
  }
  await admin.from("project_deal_contacts").delete().eq("project_id", KEEP.bauconsultProject);
  const { error: andreasLinkErr } = await admin.from("project_deal_contacts").insert({
    project_id: KEEP.bauconsultProject,
    contact_id: KEEP.andreasContact,
  });
  throwIf(andreasLinkErr, "bauconsult deal contact");

  let projectsCreated = 0;
  for (const c of companies.values()) {
    if (c.key === "protocol health ai" || c.key === "bauconsult") continue;
    const wonDeals = c.deals.filter((d) => d.won && d.value > 0);
    // unique by title+value already
    const sorted = [...wonDeals].sort((a, b) => b.value - a.value);
    for (let i = 0; i < sorted.length; i++) {
      const deal = sorted[i];
      const payload = {
        client_id: c.id,
        title: deal.title,
        company: c.displayName,
        status: "running",
        stage: "client",
        deal_value: deal.value,
        expected_start_date: deal.startDate,
        start_date: deal.startDate,
        contract_confirmed_at: new Date().toISOString(),
        lead_admin_id: ownerId,
        bd_record_id: i === 0 ? c.bdId : null,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin.from("projects").insert(payload).select("id").single();
      throwIf(error, `insert project ${c.displayName} ${deal.title}`);
      const primary = c.contacts[0];
      if (primary?.id) {
        await admin.from("project_deal_contacts").insert({
          project_id: data.id,
          contact_id: primary.id,
        });
      }
      projectsCreated += 1;
    }
  }

  // Ledger: project revenue + CRM unidentified + HR
  const { data: liveProjects, error: lpErr } = await admin
    .from("projects")
    .select("id, title, client_id, stage, deal_value, expected_start_date");
  throwIf(lpErr, "list projects for ledger");
  for (const p of liveProjects || []) {
    const amount = Number(p.deal_value || 0);
    if (!amount) continue;
    const pillar = pillarFromStage(p.stage);
    const entryDate = p.expected_start_date
      ? `${String(p.expected_start_date).slice(0, 7)}-01`
      : monthStart();
    await upsertBySyncKey(admin, {
      sync_key: `auto_project:rev:${p.id}`,
      pillar,
      type: "revenue",
      amount,
      entry_date: entryDate,
      company_id: p.client_id,
      client_id: p.client_id,
      project_id: p.id,
      person_id: null,
      category: p.title ? `Deal — ${p.title}` : "Project deal value",
      source: "auto_project",
      updated_at: new Date().toISOString(),
    });
  }

  const { data: crmCompanies, error: crmErr } = await admin
    .from("crm_customers")
    .select("id, name, company, status, contract_value")
    .eq("record_kind", "company")
    .gt("contract_value", 0)
    .neq("status", "Client");
  throwIf(crmErr, "crm unidentified");
  const claimed = new Set((liveProjects || []).map((p) => p.client_id).filter(Boolean));
  const entryDate = monthStart();
  const activeCrmKeys = new Set();
  for (const co of crmCompanies || []) {
    if (claimed.has(co.id)) continue;
    const amount = Number(co.contract_value || 0);
    if (!amount) continue;
    const syncKey = `auto_crm:rev:${co.id}`;
    activeCrmKeys.add(syncKey);
    await upsertBySyncKey(admin, {
      sync_key: syncKey,
      pillar: "unidentified",
      type: "revenue",
      amount,
      entry_date: entryDate,
      company_id: co.id,
      client_id: co.id,
      project_id: null,
      person_id: null,
      category: `Prospect — ${co.company || co.name || "Prospect"}`,
      source: "auto_crm",
      updated_at: new Date().toISOString(),
    });
  }
  const { data: existingCrm } = await admin
    .from("ledger_entries")
    .select("id, sync_key")
    .eq("source", "auto_crm");
  for (const row of existingCrm || []) {
    if (row.sync_key && !activeCrmKeys.has(row.sync_key)) {
      await admin.from("ledger_entries").delete().eq("id", row.id);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: comps, error: cErr } = await admin
    .from("compensation_records")
    .select("id, person_id, amount, frequency, comp_model, people:person_id ( full_name )")
    .is("project_id", null)
    .or(`effective_to.is.null,effective_to.gte.${today}`);
  throwIf(cErr, "hr comps");
  const activeHr = new Set();
  for (const rec of comps || []) {
    if (rec.frequency === "one_off" || rec.frequency === "per_project" || rec.frequency === "per_hour") continue;
    if (rec.comp_model === "non_monetary" || rec.comp_model === "equity") continue;
    const amount = Number(rec.amount || 0);
    if (!amount) continue;
    const syncKey = `auto_hr:comp:${rec.id}`;
    activeHr.add(syncKey);
    await upsertBySyncKey(admin, {
      sync_key: syncKey,
      pillar: "actual",
      type: "cost",
      amount,
      entry_date: entryDate,
      company_id: null,
      client_id: null,
      project_id: null,
      person_id: rec.person_id,
      category: `Payroll — ${rec.people?.full_name || "Person"}`,
      source: "auto_hr",
      updated_at: new Date().toISOString(),
    });
  }
  const { data: existingHr } = await admin
    .from("ledger_entries")
    .select("id, sync_key")
    .in("source", ["auto_hr", "auto_overhead"]);
  for (const row of existingHr || []) {
    if (row.sync_key && !activeHr.has(row.sync_key)) {
      await admin.from("ledger_entries").delete().eq("id", row.id);
    }
  }

  // Verify
  const { data: sowRows } = await admin.from("sows").select("id, public_slug, title, status");
  const slugs = (sowRows || []).map((s) => s.public_slug).filter(Boolean).sort();
  const { data: projRows } = await admin.from("projects").select("id, title, status, stage, deal_value, client_id");
  const { data: crmCo } = await admin
    .from("crm_customers")
    .select("id, name, company, status, record_kind")
    .eq("record_kind", "company");
  const { data: profiles } = await admin.from("profiles").select("id, full_name, role");
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 50 });

  const companyNames = (crmCo || []).map((x) => x.name);
  const dupes = companyNames.filter((n, i) => companyNames.findIndex((x) => fold(x) === fold(n)) !== i);

  console.log("\nImport summary");
  console.log("  companies", companiesUpserted);
  console.log("  contacts ", contactsUpserted);
  console.log("  bd       ", bdUpserted);
  console.log("  projects+", projectsCreated);
  console.log("  SOW slugs", slugs);
  console.log("  profiles ", (profiles || []).map((p) => `${p.full_name} (${p.role})`).join(", "));
  console.log("  auth     ", (authUsers.users || []).map((u) => u.email).join(", "));
  console.log("  projects ", (projRows || []).map((p) => `${p.title} ${p.stage}/${p.status} €${p.deal_value}`).join(" | "));
  if (dupes.length) console.warn("  DUPLICATE company names:", dupes);
  for (const slug of KEEP.sowSlugs) {
    if (!slugs.includes(slug)) throw new Error(`Missing public slug ${slug}`);
  }
  const protoOk = (projRows || []).some((p) => p.id === KEEP.protocolProject);
  const bauOk = (projRows || []).some((p) => p.id === KEEP.bauconsultProject);
  if (!protoOk || !bauOk) throw new Error("Keep project IDs missing");
  const sign2x = (crmCo || []).filter((x) => fold(x.name).includes("sign2x"));
  const protoCos = (crmCo || []).filter((x) => fold(x.name).includes("protocol"));
  if (sign2x.length !== 1) throw new Error(`Expected 1 Sign2X company, got ${sign2x.length}`);
  if (protoCos.length !== 1) throw new Error(`Expected 1 Protocol company, got ${protoCos.length}`);
  console.log("\nOK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
