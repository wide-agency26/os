import { PROSPECT_STATUSES } from "@/lib/bd/constants";

export type CsvImportRow = {
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  project_name: string | null;
  value_amount: number | null;
  status: string;
  record_kind: "prospect" | "client";
  services: string | null;
  description: string | null;
  possible_start_date: string | null;
};

export type CsvImportPreview = {
  rows: CsvImportRow[];
  errors: string[];
  summary: { total: number; prospects: number; clients: number; byStatus: Record<string, number> };
};

const HEADER_ALIASES: Record<string, string> = {
  company: "company_name",
  company_name: "company_name",
  name: "company_name",
  organization: "company_name",
  contact: "contact_name",
  contact_name: "contact_name",
  email: "contact_email",
  contact_email: "contact_email",
  status: "status",
  stage: "status",
  journey: "status",
  project: "project_name",
  project_name: "project_name",
  value: "value_amount",
  value_amount: "value_amount",
  amount: "value_amount",
  services: "services",
  description: "description",
  notes: "description",
  start: "possible_start_date",
  possible_start_date: "possible_start_date",
  type: "record_kind",
  record_kind: "record_kind",
  kind: "record_kind",
};

const STATUS_MAP: Record<string, string> = {
  lead: "lead",
  prospect: "prospect",
  qualified: "prospect",
  proposal: "proposal",
  "final nego": "final_nego",
  final_nego: "final_nego",
  negotiation: "final_nego",
  agreement: "agreement",
  accepted: "accepted",
  won: "accepted",
  client: "accepted",
  closed: "accepted",
  "closed won": "accepted",
  lost: "lost",
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if ((c === "," || c === ";") && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function normalizeHeader(h: string): string {
  const key = h.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
  return HEADER_ALIASES[key] ?? key;
}

function parseStatus(raw: string, recordKindRaw: string): { status: string; record_kind: "prospect" | "client" } {
  const kind = recordKindRaw.toLowerCase().trim();
  if (kind === "client" || kind === "customer") {
    return { status: "accepted", record_kind: "client" };
  }

  const s = raw.toLowerCase().trim();
  if (s === "client" || s === "customer" || s === "won" || s === "accepted") {
    return { status: "accepted", record_kind: "client" };
  }

  const mapped = STATUS_MAP[s] ?? (PROSPECT_STATUSES.some((x) => x.value === s) ? s : "lead");
  return {
    status: mapped,
    record_kind: mapped === "accepted" ? "client" : "prospect",
  };
}

export function parseProspectsCsv(text: string): CsvImportPreview {
  const errors: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      rows: [],
      errors: ["CSV needs a header row and at least one data row."],
      summary: { total: 0, prospects: 0, clients: 0, byStatus: {} },
    };
  }

  const headers = splitCsvLine(lines[0]).map(normalizeHeader);
  if (!headers.includes("company_name")) {
    errors.push('Missing a company column (use "company" or "company_name").');
  }

  const rows: CsvImportRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = cells[idx] ?? "";
    });

    const company = (rec.company_name ?? "").trim();
    if (!company) {
      errors.push(`Row ${i + 1}: missing company name — skipped.`);
      continue;
    }

    const { status, record_kind } = parseStatus(rec.status ?? "lead", rec.record_kind ?? "");

    const valueRaw = (rec.value_amount ?? "").replace(/[$,]/g, "");
    const value_amount = valueRaw ? parseFloat(valueRaw) : null;

    rows.push({
      company_name: company,
      contact_name: rec.contact_name?.trim() || null,
      contact_email: rec.contact_email?.trim() || null,
      project_name: rec.project_name?.trim() || null,
      value_amount: value_amount != null && Number.isFinite(value_amount) ? value_amount : null,
      status,
      record_kind,
      services: rec.services?.trim() || null,
      description: rec.description?.trim() || null,
      possible_start_date: rec.possible_start_date?.trim() || null,
    });
  }

  const byStatus: Record<string, number> = {};
  let clients = 0;
  let prospects = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    if (r.record_kind === "client") clients++;
    else prospects++;
  }

  return {
    rows,
    errors,
    summary: { total: rows.length, prospects, clients, byStatus },
  };
}
