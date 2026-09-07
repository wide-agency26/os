/** LinkedIn social kit helpers for content_settings.social_assets */

import type {
  ContentSocialAssets,
  LinkedInEmployeeCopy,
  SocialCoverKind,
  SocialCoverOption,
} from "./types";

export const SIGN2X_LI_COMPANY = "https://www.linkedin.com/company/sign2x/";

export function emptyLinkedInEmployeeCopy(): LinkedInEmployeeCopy {
  return {
    about_de: "",
    about_en: "",
    experience_bullets_de: [],
    experience_bullets_en: [],
    company_url: SIGN2X_LI_COMPANY,
  };
}

/** Default seed copy for Sign2x employee LinkedIn visibility. */
export function defaultSign2xLinkedInEmployeeCopy(): LinkedInEmployeeCopy {
  return {
    company_url: SIGN2X_LI_COMPANY,
    about_de: `Ich arbeite mit Sign2x — der souveränen E-Signatur-API für Softwarehersteller und ISVs.

Datensouveränität ohne US-Portal-Umweg: Hosting bei Deutsche Telekom · Open Telekom Cloud (OTC), native White-label-Schicht, eIDAS SES · AES · QES.

Mehr: https://www.sign2x.com · LinkedIn: ${SIGN2X_LI_COMPANY}`,
    about_en: `I work with Sign2x — the sovereign e-signature API for software manufacturers and ISVs.

Data sovereignty without a US portal detour: hosting on Deutsche Telekom · Open Telekom Cloud (OTC), native white-label layer, eIDAS SES · AES · QES.

More: https://www.sign2x.com · LinkedIn: ${SIGN2X_LI_COMPANY}`,
    experience_bullets_de: [
      "Sign2x als native White-label-Signatur-Schicht in B2B-Software eingebunden (kein Extra-Portal-Tab).",
      "Datensouveränität: Hosting Deutsche Telekom · Open Telekom Cloud (OTC), optional on-prem.",
      "eIDAS-Stufen SES · AES · QES nach Haftung gewählt — GwG-fähige Strecken ohne Ausweis-Export ins Ausland.",
      "Sichtbarkeit für das Produkt: Firmenseite folgen und teilen → https://www.linkedin.com/company/sign2x/",
    ],
    experience_bullets_en: [
      "Embedded Sign2x as a native white-label signature layer in B2B software (no extra portal tab).",
      "Data sovereignty: Deutsche Telekom · Open Telekom Cloud (OTC) hosting, on-prem when needed.",
      "eIDAS SES · AES · QES chosen by liability — AML-ready flows without shipping IDs abroad.",
      "Amplify the product: follow and share the company page → https://www.linkedin.com/company/sign2x/",
    ],
  };
}

function asCover(row: unknown): SocialCoverOption | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const url = String(r.url || "").trim();
  if (!url) return null;
  const kind: SocialCoverKind = r.kind === "company" ? "company" : "employee";
  return {
    id: String(r.id || cryptoRandomId()),
    label: String(r.label || (kind === "company" ? "Company cover" : "Employee cover")),
    url,
    kind,
    preferred: Boolean(r.preferred),
  };
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `cover-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newCoverId() {
  return cryptoRandomId();
}

export function parseSocialAssets(raw: unknown): ContentSocialAssets {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  let company = Array.isArray(o.company_covers)
    ? (o.company_covers.map(asCover).filter(Boolean) as SocialCoverOption[])
    : [];
  let employee = Array.isArray(o.employee_covers)
    ? (o.employee_covers.map(asCover).filter(Boolean) as SocialCoverOption[])
    : [];

  // Legacy single employee URL → one cover option
  const legacy = String(o.linkedin_employee_cover_url || "").trim();
  if (legacy && !employee.some((c) => c.url === legacy)) {
    employee = [
      {
        id: cryptoRandomId(),
        label: "Employee cover",
        url: legacy,
        kind: "employee",
        preferred: true,
      },
      ...employee,
    ];
  }

  const copyRaw =
    o.linkedin_employee_copy && typeof o.linkedin_employee_copy === "object"
      ? (o.linkedin_employee_copy as Record<string, unknown>)
      : {};
  const copy: LinkedInEmployeeCopy = {
    about_de: String(copyRaw.about_de || ""),
    about_en: String(copyRaw.about_en || ""),
    experience_bullets_de: Array.isArray(copyRaw.experience_bullets_de)
      ? copyRaw.experience_bullets_de.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    experience_bullets_en: Array.isArray(copyRaw.experience_bullets_en)
      ? copyRaw.experience_bullets_en.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    company_url: String(copyRaw.company_url || SIGN2X_LI_COMPANY).trim() || SIGN2X_LI_COMPANY,
  };

  const preferredEmployee =
    employee.find((c) => c.preferred)?.url || employee[0]?.url || legacy || null;

  return {
    linkedin_employee_cover_url: preferredEmployee,
    company_covers: company,
    employee_covers: employee,
    linkedin_employee_copy: copy,
  };
}

export function emptySocialAssets(): ContentSocialAssets {
  return {
    linkedin_employee_cover_url: null,
    company_covers: [],
    employee_covers: [],
    linkedin_employee_copy: emptyLinkedInEmployeeCopy(),
  };
}

export function hasClientLinkedInKit(assets: ContentSocialAssets | null | undefined): boolean {
  if (!assets) return false;
  if (assets.company_covers?.length) return true;
  if (assets.employee_covers?.length) return true;
  const c = assets.linkedin_employee_copy;
  if (!c) return false;
  if (c.about_de.trim() || c.about_en.trim()) return true;
  if (c.experience_bullets_de.length || c.experience_bullets_en.length) return true;
  return false;
}

export function markPreferred(
  list: SocialCoverOption[],
  id: string
): SocialCoverOption[] {
  return list.map((c) => ({ ...c, preferred: c.id === id }));
}
