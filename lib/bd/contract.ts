export type BdContractLineItem = {
  id: string;
  title: string;
  description: string;
  price: number | null;
};

export type BdContractClause = {
  id: string;
  title: string;
  body: string;
};

export type BdContractPayload = {
  status: "draft" | "ready" | "sent" | "signed" | "finalized";
  title: string;
  parties: {
    agency_name: string;
    agency_address: string;
    client_name: string;
    client_contact: string;
    client_email: string | null;
  };
  preamble: string;
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
  },
  {
    id: "clause_fees",
    title: "§2 Vergütung / Fees",
    body: "Die Vergütung ergibt sich aus den Positionen unten zuzüglich gesetzlicher Umsatzsteuer (derzeit 19 %), sofern nicht anders vereinbart. Rechnungen sind innerhalb von 14 Tagen netto zahlbar.",
  },
  {
    id: "clause_ip",
    title: "§3 Nutzungsrechte / Intellectual property",
    body: "Mit vollständiger Zahlung räumt WIDE dem Auftraggeber die für den Vertragszweck erforderlichen Nutzungsrechte an den Arbeitsergebnissen ein. Vorbehaltlich abweichender Vereinbarung verbleiben Urheberrechte bei WIDE bzw. den jeweiligen Urhebern.",
  },
  {
    id: "clause_confidentiality",
    title: "§4 Vertraulichkeit / Confidentiality",
    body: "Beide Parteien behandeln vertrauliche Informationen der anderen Partei vertraulich und verwenden sie nur zur Vertragserfüllung.",
  },
  {
    id: "clause_liability",
    title: "§5 Haftung / Liability",
    body: "WIDE haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei Verletzung von Leben, Körper oder Gesundheit. Im Übrigen ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt und der Höhe nach auf die Nettovergütung dieses Vertrags beschränkt, soweit gesetzlich zulässig.",
  },
  {
    id: "clause_term",
    title: "§6 Laufzeit / Term",
    body: "Der Vertrag beginnt mit Unterzeichnung bzw. Annahme und endet mit Abnahme der Leistungen bzw. zum vereinbarten Enddatum. Ordentliche Kündigung richtet sich nach den projektbezogenen Meilensteinen.",
  },
  {
    id: "clause_law",
    title: "§7 Anwendbares Recht / Governing law",
    body: "Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Gerichtsstand ist, soweit zulässig, München.",
  },
];

export function emptyContract(): BdContractPayload {
  return {
    status: "draft",
    title: "Dienstleistungsvertrag / Service Agreement",
    parties: {
      agency_name: "WIDE Communication",
      agency_address: "München, Deutschland",
      client_name: "",
      client_contact: "",
      client_email: null,
    },
    preamble:
      "Dieser Vertrag regelt die Zusammenarbeit zwischen WIDE und dem Auftraggeber über die nachfolgend beschriebenen Leistungen.",
    line_items: [],
    clauses: DEFAULT_GERMAN_CLAUSES.map((c) => ({ ...c, id: uid() })),
    currency: "EUR",
    notes: null,
    updated_at: null,
    finalized_at: null,
  };
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
  return {
    ...base,
    ...raw,
    status:
      typeof raw.status === "string"
        ? (raw.status as BdContractPayload["status"])
        : "draft",
    parties: {
      ...base.parties,
      agency_name:
        typeof parties.agency_name === "string"
          ? parties.agency_name
          : base.parties.agency_name,
      agency_address:
        typeof parties.agency_address === "string"
          ? parties.agency_address
          : base.parties.agency_address,
      client_name:
        typeof parties.client_name === "string"
          ? parties.client_name
          : base.parties.client_name,
      client_contact:
        typeof parties.client_contact === "string"
          ? parties.client_contact
          : base.parties.client_contact,
      client_email:
        typeof parties.client_email === "string"
          ? parties.client_email
          : null,
    },
    line_items: Array.isArray(raw.line_items)
      ? (raw.line_items as BdContractLineItem[])
      : [],
    clauses: Array.isArray(raw.clauses)
      ? (raw.clauses as BdContractClause[])
      : base.clauses,
    currency: "EUR",
  };
}

export function generateContractDraft(input: {
  companyName: string;
  contactName: string;
  email: string | null;
  discoveryNeeds?: string | null;
  discoveryBudget?: string | null;
  proposalTitle?: string | null;
  serviceNames?: string[];
}): BdContractPayload {
  const draft = emptyContract();
  draft.title = `Dienstleistungsvertrag — ${input.companyName}`;
  draft.parties.client_name = input.companyName;
  draft.parties.client_contact = input.contactName;
  draft.parties.client_email = input.email;
  draft.preamble = `Zwischen WIDE Communication und ${input.companyName} (vertreten durch ${input.contactName}) wird Folgendes vereinbart. Bezug: ${input.proposalTitle || "angenommenes Angebot"}.`;

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

  if (input.discoveryBudget) {
    draft.notes = `Budget signal from discovery: ${input.discoveryBudget}`;
  }

  draft.updated_at = new Date().toISOString();
  return draft;
}

export function contractTotal(items: BdContractLineItem[]): number {
  return items.reduce((sum, i) => sum + (typeof i.price === "number" ? i.price : 0), 0);
}
