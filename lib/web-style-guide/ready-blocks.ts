import type { WebStyleGuideSection, WebStyleGuideNavGroup } from "./document";

/**
 * One-click ready blocks for the web style guide ("Playbook") builder.
 * Each block is self-contained, inline-styled HTML so it renders correctly in
 * the client preview even before any exported stylesheet is attached. Managers
 * can assemble a full style guide from these without importing HTML.
 */

export type WsgReadyBlock = {
  key: string;
  label: string;
  group: WebStyleGuideNavGroup;
  navLabel: string;
  title: string;
  subtitle: string;
  bodyInner: string;
};

const WRAP =
  "padding:32px;border-radius:16px;background:#ffffff;border:1px solid #e5e7eb;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#111827;";
const H = "margin:0 0 4px;font-size:20px;font-weight:600;letter-spacing:-0.01em;";
const SUB = "margin:0 0 20px;font-size:13px;color:#6b7280;";

export const WSG_READY_BLOCKS: WsgReadyBlock[] = [
  {
    key: "colors",
    label: "Colour palette",
    group: "Foundations",
    navLabel: "Colours",
    title: "Colour palette",
    subtitle: "Core brand and UI colours with hex values.",
    bodyInner: `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;">
        ${[
          ["Primary", "#4F46E5"],
          ["Accent", "#00C853"],
          ["Ink", "#111827"],
          ["Muted", "#6B7280"],
          ["Surface", "#F3F4F6"],
          ["Border", "#E5E7EB"],
        ]
          .map(
            ([name, hex]) => `
        <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <div style="height:64px;background:${hex};"></div>
          <div style="padding:8px 10px;">
            <div style="font-size:13px;font-weight:600;">${name}</div>
            <div style="font-size:12px;color:#6b7280;font-family:ui-monospace,monospace;">${hex}</div>
          </div>
        </div>`
          )
          .join("")}
      </div>`,
  },
  {
    key: "typography",
    label: "Typography scale",
    group: "Foundations",
    navLabel: "Typography",
    title: "Typography",
    subtitle: "Type ramp from display to caption.",
    bodyInner: `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div><span style="font-size:11px;color:#6b7280;">Display / 48</span><div style="font-size:48px;font-weight:700;letter-spacing:-0.02em;line-height:1.1;">The quick brown fox</div></div>
        <div><span style="font-size:11px;color:#6b7280;">Heading / 28</span><div style="font-size:28px;font-weight:600;">The quick brown fox</div></div>
        <div><span style="font-size:11px;color:#6b7280;">Subheading / 20</span><div style="font-size:20px;font-weight:500;">The quick brown fox</div></div>
        <div><span style="font-size:11px;color:#6b7280;">Body / 16</span><div style="font-size:16px;line-height:1.6;">The quick brown fox jumps over the lazy dog.</div></div>
        <div><span style="font-size:11px;color:#6b7280;">Caption / 13</span><div style="font-size:13px;color:#6b7280;">The quick brown fox jumps over the lazy dog.</div></div>
      </div>`,
  },
  {
    key: "spacing",
    label: "Spacing scale",
    group: "Foundations",
    navLabel: "Spacing",
    title: "Spacing scale",
    subtitle: "Consistent spacing tokens (4px base).",
    bodyInner: `
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${[4, 8, 12, 16, 24, 32, 48, 64]
          .map(
            (n) => `
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="width:48px;font-size:12px;font-family:ui-monospace,monospace;color:#6b7280;">${n}px</span>
          <span style="height:16px;width:${n}px;background:#4F46E5;border-radius:4px;display:inline-block;"></span>
        </div>`
          )
          .join("")}
      </div>`,
  },
  {
    key: "buttons",
    label: "Buttons",
    group: "Components",
    navLabel: "Buttons",
    title: "Buttons",
    subtitle: "Primary, secondary, and ghost variants.",
    bodyInner: `
      <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
        <button style="padding:10px 18px;border-radius:10px;background:#4F46E5;color:#fff;border:none;font-size:14px;font-weight:600;cursor:pointer;">Primary</button>
        <button style="padding:10px 18px;border-radius:10px;background:#fff;color:#111827;border:1px solid #d1d5db;font-size:14px;font-weight:600;cursor:pointer;">Secondary</button>
        <button style="padding:10px 18px;border-radius:10px;background:transparent;color:#4F46E5;border:none;font-size:14px;font-weight:600;cursor:pointer;">Ghost</button>
        <button style="padding:10px 18px;border-radius:10px;background:#e5e7eb;color:#9ca3af;border:none;font-size:14px;font-weight:600;">Disabled</button>
      </div>`,
  },
  {
    key: "forms",
    label: "Form inputs",
    group: "Components",
    navLabel: "Forms",
    title: "Form elements",
    subtitle: "Inputs, selects, and labels.",
    bodyInner: `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;max-width:640px;">
        <label style="display:block;font-size:13px;font-weight:500;">Text input
          <input placeholder="Jane Doe" style="margin-top:6px;width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;box-sizing:border-box;" />
        </label>
        <label style="display:block;font-size:13px;font-weight:500;">Select
          <select style="margin-top:6px;width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fff;">
            <option>Option one</option><option>Option two</option>
          </select>
        </label>
      </div>`,
  },
  {
    key: "cards",
    label: "Cards",
    group: "Components",
    navLabel: "Cards",
    title: "Cards",
    subtitle: "Content container pattern.",
    bodyInner: `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
        ${[1, 2]
          .map(
            (n) => `
        <div style="border:1px solid #e5e7eb;border-radius:14px;padding:20px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
          <div style="height:8px;width:40px;background:#4F46E5;border-radius:4px;margin-bottom:12px;"></div>
          <h4 style="margin:0 0 6px;font-size:16px;font-weight:600;">Card title ${n}</h4>
          <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5;">Supporting copy that explains the card's content and purpose.</p>
        </div>`
          )
          .join("")}
      </div>`,
  },
  {
    key: "alerts",
    label: "Alerts & badges",
    group: "Components",
    navLabel: "Alerts",
    title: "Alerts & badges",
    subtitle: "Status messaging styles.",
    bodyInner: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span style="padding:3px 10px;border-radius:999px;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;">Success</span>
          <span style="padding:3px 10px;border-radius:999px;background:#fef9c3;color:#854d0e;font-size:12px;font-weight:600;">Warning</span>
          <span style="padding:3px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-size:12px;font-weight:600;">Error</span>
          <span style="padding:3px 10px;border-radius:999px;background:#e0e7ff;color:#3730a3;font-size:12px;font-weight:600;">Info</span>
        </div>
        <div style="border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:12px;padding:14px 16px;font-size:13px;">Changes saved successfully.</div>
        <div style="border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:12px;padding:14px 16px;font-size:13px;">Something went wrong — please retry.</div>
      </div>`,
  },
];

export function buildWsgSection(block: WsgReadyBlock, sortOrder: number): WebStyleGuideSection {
  const id = `block-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id,
    navLabel: block.navLabel,
    navGroup: block.group,
    title: block.title,
    subtitle: block.subtitle,
    bodyHtml: `<section id="${id}" style="${WRAP}"><h3 style="${H}">${block.title}</h3><p style="${SUB}">${block.subtitle}</p>${block.bodyInner}</section>`,
    sortOrder,
    visible: true,
  };
}
