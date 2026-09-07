export type BdContractLineItem = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  from_sow?: boolean;
};

export type BdContractClause = {
  id: string;
  title: string;
  body: string;
  /** 1 = § clause, 2 = sub-clause (1.1, 1.2, …) */
  level?: 1 | 2;
};

export type BdContractParties = {
  agency_name: string;
  agency_poc: string;
  agency_address: string;
  agency_tax_id: string;
  client_name: string;
  client_contact: string;
  client_poc: string;
  client_address: string;
  client_email: string | null;
  client_tax_id: string;
};

export type BdContractPayload = {
  status: "draft" | "ready" | "sent" | "signed" | "finalized";
  title: string;
  parties: BdContractParties;
  preamble: string;
  /** Last auto-generated preamble — used to avoid clobbering manual edits. */
  preamble_auto?: string | null;
  line_items: BdContractLineItem[];
  clauses: BdContractClause[];
  currency: "EUR";
  notes: string | null;
  updated_at: string | null;
  finalized_at: string | null;
};

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_GERMAN_CLAUSES: BdContractClause[] = [
  {
    id: "clause_scope",
    title: "§1 Gegenstand / Scope of services",
    body: "WIDE erbringt die in diesem Vertrag genannten Leistungen als Werk- bzw. Dienstleistung nach deutschem Recht. Änderungen des Leistungsumfangs bedürfen der Schriftform (Textform genügt).",
    level: 1,
  },
  {
    id: "clause_fees",
    title: "§2 Vergütung / Fees",
    body: "Die Vergütung ergibt sich aus den Positionen unten zuzüglich gesetzlicher Umsatzsteuer (derzeit 19 %), sofern nicht anders vereinbart. Rechnungen sind innerhalb von 14 Tagen netto zahlbar.",
    level: 1,
  },
  {
    id: "clause_ip",
    title: "§3 Nutzungsrechte / Intellectual property",
    body: "Mit vollständiger Zahlung räumt WIDE dem Auftraggeber die für den Vertragszweck erforderlichen Nutzungsrechte an den Arbeitsergebnissen ein. Vorbehaltlich abweichender Vereinbarung verbleiben Urheberrechte bei WIDE bzw. den jeweiligen Urhebern.",
    level: 1,
  },
  {
    id: "clause_confidentiality",
    title: "§4 Vertraulichkeit / Confidentiality",
    body: "Beide Parteien behandeln vertrauliche Informationen der anderen Partei vertraulich und verwenden sie nur zur Vertragserfüllung.",
    level: 1,
  },
  {
    id: "clause_liability",
    title: "§5 Haftung / Liability",
    body: "WIDE haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Im Übrigen ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt und der Höhe nach auf die Nettovergütung dieses Vertrags beschränkt, soweit gesetzlich zulässig.",
    level: 1,
  },
  {
    id: "clause_term",
    title: "§6 Laufzeit / Term",
    body: "Der Vertrag beginnt mit Unterzeichnung bzw. Annahme und endet mit Abnahme der Leistungen bzw. zum vereinbarten Enddatum. Ordentliche Kündigung richtet sich nach den projektbezogenen Meilensteinen.",
    level: 1,
  },
  {
    id: "clause_law",
    title: "§7 Anwendbares Recht / Governing law",
    body: "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Gerichtsstand ist, soweit zulässig, München.",
    level: 1,
  },
];

export function emptyContract(): BdContractPayload {
  const parties: BdContractParties = {
    agency_name: "WIDE Communication",
    agency_poc: "",
    agency_address: "München, Deutschland",
    agency_tax_id: "",
    client_name: "",
    client_contact: "",
    client_poc: "",
    client_address: "",
    client_email: null,
    client_tax_id: "",
  };
  const preamble = buildPartiesPreamble(parties);
  return {
    status: "draft",
    title: "Dienstleistungsvertrag / Service Agreement",
    parties,
    preamble:
      preamble ||
      "Dieser Vertrag regelt die Zusammenarbeit zwischen WIDE und dem Auftraggeber über die nachfolgend beschriebenen Leistungen.",
    preamble_auto: preamble || null,
    line_items: [],
    clauses: DEFAULT_GERMAN_CLAUSES.map((c) => ({ ...c, id: uid(), level: 1 })),
    currency: "EUR",
    notes: null,
    updated_at: null,
    finalized_at: null,
  };
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

export function mergeContract(
  raw: Record<string, unknown> | null | undefined
): BdContractPayload {
  const base = emptyContract();
  if (!raw || Object.keys(raw).length === 0) return base;
  const parties =
    raw.parties && typeof raw.parties === "object"
      ? (raw.parties as Record<string, unknown>)
      : {};
  const clientContact = asString(parties.client_contact, base.parties.client_contact);
  const clientPoc = asString(parties.client_poc, clientContact || base.parties.client_poc);
  return {
    ...base,
    ...raw,
    status:
      typeof raw.status === "string"
        ? (raw.status as BdContractPayload["status"])
        : "draft",
    parties: {
      ...base.parties,
      agency_name: asString(parties.agency_name, base.parties.agency_name),
      agency_poc: asString(parties.agency_poc, base.parties.agency_poc),
      agency_address: asString(parties.agency_address, base.parties.agency_address),
      agency_tax_id: asString(parties.agency_tax_id, base.parties.agency_tax_id),
      client_name: asString(parties.client_name, base.parties.client_name),
      client_contact: clientContact,
      client_poc: clientPoc,
      client_address: asString(parties.client_address, base.parties.client_address),
      client_email:
        typeof parties.client_email === "string" ? parties.client_email : null,
      client_tax_id: asString(parties.client_tax_id, base.parties.client_tax_id),
    },
    preamble: asString(raw.preamble, base.preamble),
    preamble_auto:
      typeof raw.preamble_auto === "string" ? raw.preamble_auto : null,
    line_items: Array.isArray(raw.line_items)
      ? (raw.line_items as BdContractLineItem[])
      : [],
    clauses: Array.isArray(raw.clauses)
      ? (raw.clauses as BdContractClause[]).map((c) => ({
          ...c,
          level: c.level === 2 ? 2 : 1,
        }))
      : base.clauses,
    currency: "EUR",
  };
}

/** Defined-term / hereinafter block when both parties have names. */
export function buildPartiesPreamble(parties: BdContractParties): string {
  const agency = parties.agency_name.trim();
  const client = parties.client_name.trim();
  if (!agency || !client) return "";
  const agencyPoc = parties.agency_poc.trim();
  const clientPoc = (parties.client_poc || parties.client_contact).trim();
  const agencyBit = agencyPoc ? `${agency} (vertreten durch ${agencyPoc})` : agency;
  const clientBit = clientPoc ? `${client} (vertreten durch ${clientPoc})` : client;
  return (
    `${agencyBit}, hereinafter referred to as the "Contractor", and ${clientBit}, ` +
    `hereinafter referred to as the "Client", agree as follows. / ` +
    `${agencyBit}, nachfolgend „Auftragnehmer“, und ${clientBit}, nachfolgend „Auftraggeber“, vereinbaren Folgendes.`
  );
}

export function applyAutoPreamble(contract: BdContractPayload): BdContractPayload {
  const nextAuto = buildPartiesPreamble(contract.parties);
  if (!nextAuto) return contract;
  const current = contract.preamble || "";
  const prevAuto = contract.preamble_auto || "";
  const canReplace =
    !current.trim() || current === prevAuto || current === buildPartiesPreamble(emptyContract().parties);
  if (!canReplace) return { ...contract, preamble_auto: prevAuto || null };
  return { ...contract, preamble: nextAuto, preamble_auto: nextAuto };
}

/**
 * Merge a freshly generated draft into an existing contract.
 * Preserves edited parties/clauses/preamble; refreshes line_items;
 * fills empty party fields from the draft.
 */
export function mergeGeneratedContract(
  existingRaw: Record<string, unknown> | null | undefined,
  draft: BdContractPayload
): BdContractPayload {
  const existing = mergeContract(existingRaw);
  const hasExistingContent =
    Boolean(existingRaw && Object.keys(existingRaw).length > 0) &&
    (existing.line_items.length > 0 ||
      existing.clauses.some((c) => c.body.trim() || (c.title && !c.title.startsWith("New"))) ||
      Boolean(existing.parties.client_name));

  if (!hasExistingContent) {
    return applyAutoPreamble(draft);
  }

  const fill = (cur: string, next: string) => (cur.trim() ? cur : next);
  const parties: BdContractParties = {
    agency_name: fill(existing.parties.agency_name, draft.parties.agency_name),
    agency_poc: fill(existing.parties.agency_poc, draft.parties.agency_poc),
    agency_address: fill(existing.parties.agency_address, draft.parties.agency_address),
    agency_tax_id: fill(existing.parties.agency_tax_id, draft.parties.agency_tax_id),
    client_name: fill(existing.parties.client_name, draft.parties.client_name),
    client_contact: fill(existing.parties.client_contact, draft.parties.client_contact),
    client_poc: fill(
      existing.parties.client_poc || existing.parties.client_contact,
      draft.parties.client_poc || draft.parties.client_contact
    ),
    client_address: fill(existing.parties.client_address, draft.parties.client_address),
    client_email: existing.parties.client_email || draft.parties.client_email,
    client_tax_id: fill(existing.parties.client_tax_id, draft.parties.client_tax_id),
  };

  let next: BdContractPayload = {
    ...existing,
    title: existing.title.trim() ? existing.title : draft.title,
    parties,
    line_items: draft.line_items.length > 0 ? draft.line_items : existing.line_items,
    notes: existing.notes || draft.notes,
    updated_at: new Date().toISOString(),
  };
  next = applyAutoPreamble(next);
  return next;
}

export function generateContractDraft(input: {
  companyName: string;
  contactName: string;
  email: string | null;
  clientAddress?: string | null;
  agencyPoc?: string | null;
  agencyTaxId?: string | null;
  clientTaxId?: string | null;
  discoveryNeeds?: string | null;
  discoveryBudget?: string | null;
  proposalTitle?: string | null;
  serviceNames?: string[];
  pricedLines?: { title: string; description?: string; price: number }[];
}): BdContractPayload {
  const draft = emptyContract();
  draft.title = `Dienstleistungsvertrag — ${input.companyName}`;
  draft.parties.client_name = input.companyName;
  draft.parties.client_contact = input.contactName;
  draft.parties.client_poc = input.contactName;
  draft.parties.client_email = input.email;
  if (input.clientAddress) draft.parties.client_address = input.clientAddress;
  if (input.agencyPoc) draft.parties.agency_poc = input.agencyPoc;
  if (input.agencyTaxId) draft.parties.agency_tax_id = input.agencyTaxId;
  if (input.clientTaxId) draft.parties.client_tax_id = input.clientTaxId;

  const auto = buildPartiesPreamble(draft.parties);
  draft.preamble =
    auto ||
    `Zwischen WIDE Communication und ${input.companyName} (vertreten durch ${input.contactName}) wird Folgendes vereinbart. Bezug: ${input.proposalTitle || "angenommenes Angebot"}.`;
  draft.preamble_auto = draft.preamble;

  if (input.pricedLines && input.pricedLines.length > 0) {
    draft.line_items = input.pricedLines.map((line) => ({
      id: uid(),
      title: line.title,
      description: line.description || `Leistungen gemäß Scope of Work für ${line.title}.`,
      price: line.price,
      from_sow: true,
    }));
  } else {
    const services =
      input.serviceNames && input.serviceNames.length > 0
        ? input.serviceNames
        : ["Brand & digital services as scoped in the accepted proposal"];

    draft.line_items = services.map((name, i) => ({
      id: uid(),
      title: name,
      description:
        i === 0 && input.discoveryNeeds
          ? String(input.discoveryNeeds)
          : `Leistungen gemäß Proposal / Scope für ${name}.`,
      price: null,
    }));
  }

  if (input.discoveryBudget) {
    draft.notes = `Budget signal from discovery: ${input.discoveryBudget}`;
  }

  draft.updated_at = new Date().toISOString();
  return draft;
}

export function contractTotal(items: BdContractLineItem[]): number {
  return items.reduce((sum, i) => sum + (typeof i.price === "number" ? i.price : 0), 0);
}

/** Parent § index (1-based among level-1 clauses) for a clause at `idx`. */
export function parentSectionNumber(clauses: BdContractClause[], idx: number): number {
  let n = 0;
  for (let i = 0; i <= idx; i++) {
    if ((clauses[i]?.level || 1) === 1) n += 1;
  }
  return Math.max(1, n);
}

export function nextSubClauseTitle(clauses: BdContractClause[], parentIdx: number): string {
  const section = parentSectionNumber(clauses, parentIdx);
  let sub = 0;
  for (let i = parentIdx + 1; i < clauses.length; i++) {
    if ((clauses[i].level || 1) === 1) break;
    sub += 1;
  }
  return `${section}.${sub + 1}`;
}

/** Parse pasted Google Sheets / numbered list text into lines. */
export function parseNumberedPaste(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!raw) return [];
  // TSV from Sheets: take first column per row
  const rows = raw.split("\n").map((line) => {
    const cell = line.includes("\t") ? line.split("\t")[0] : line;
    return cell.trim();
  });
  const numbered = rows.filter((r) => /^\d+[\.\)\-]\s*\S/.test(r) || /^\d+\s+\S/.test(r));
  if (numbered.length >= 2) return numbered;
  if (rows.length >= 2 && rows.every((r) => r.length > 0)) return rows;
  return [raw];
}

export function clausesFromNumberedLines(lines: string[]): BdContractClause[] {
  return lines.map((line, i) => {
    const m = line.match(/^\d+[\.\)\-]?\s*(.*)$/);
    const body = (m ? m[1] : line).trim() || line;
    return {
      id: uid(),
      title: `${i + 1}.`,
      body,
      level: 1 as const,
    };
  });
}
