"use client";

import { WideLogo } from "@/components/brand/WideLogo";
import {
  CATEGORY_LABELS,
  formatSowDate,
  renderConservativeBody,
  renderTermsText,
  renderVatLine,
  renderVatSubline,
  resolveSowTheme,
  resolveSowVat,
  revisionLabel,
  sowFontStack,
  sowGoogleFontHref,
  sowVatAmounts,
} from "@/lib/sow/constants";
import type {
  SowDocument,
  SowLineItem,
  SowSection,
} from "@/lib/sow/types";

function money(amount: number | null | undefined, currency: string) {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function companyLabel(sow: SowDocument) {
  return sow.company?.company || sow.company?.name || "Your company";
}

function itemDescription(item: SowLineItem, revisionRounds: number): string | null {
  const parts: string[] = [];
  if (item.description) parts.push(item.description);
  if (item.uses_revision_rounds) parts.push(revisionLabel(revisionRounds));
  if (item.is_gate_note) {
    parts.push("Decision gate — nothing downstream starts until this is signed off.");
  }
  if (item.requires_quantity && item.quantity_label) parts.push(item.quantity_label);
  return parts.length ? parts.join(" · ") : null;
}

function themeVars(sow: SowDocument): React.CSSProperties {
  const t = resolveSowTheme(sow.theme);
  return {
    ["--sow-bg" as string]: t.background,
    ["--sow-text" as string]: t.text,
    ["--sow-muted" as string]: t.mutedText,
    ["--sow-accent" as string]: t.accent,
    ["--sow-card" as string]: t.cardBg,
    ["--sow-border" as string]: t.border,
    fontFamily: sowFontStack(t.fontFamily),
    background: t.background,
    color: t.text,
  };
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  if (children == null || children === "") return null;
  return (
    <p
      className="text-[11px] font-bold uppercase tracking-[0.2em]"
      style={{ color: "var(--sow-muted)" }}
    >
      {children}
    </p>
  );
}

function categoryEyebrow(section: SowSection): string | null {
  const label = CATEGORY_LABELS[section.category];
  if (label.toLowerCase() === section.title.trim().toLowerCase()) return null;
  return label;
}

function sectionDescription(section: SowSection): string | null {
  const text =
    section.service_description_snapshot?.trim() ||
    section.intro?.trim() ||
    "";
  return text || null;
}

function LinePrice({ item, currency }: { item: SowLineItem; currency: string }) {
  if (item.cost_group_id) return null;
  const label = money(item.price, currency);
  if (!label) return null;
  return (
    <span
      className="text-sm font-semibold tracking-tight tabular-nums whitespace-nowrap"
      style={{ color: "var(--sow-text)", opacity: 0.9 }}
    >
      {label}
    </span>
  );
}

function NarrativeSection({ section, sow }: { section: SowSection; sow: SowDocument }) {
  return (
    <section className="sow-section grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      <header className="space-y-4 lg:sticky lg:top-8 lg:self-start">
        <SectionEyebrow>{categoryEyebrow(section)}</SectionEyebrow>
        <h2
          className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.05]"
          style={{ color: "var(--sow-text)" }}
        >
          {section.title}
        </h2>
        {sectionDescription(section) && (
          <p className="text-base sm:text-lg leading-relaxed" style={{ color: "var(--sow-muted)" }}>
            {sectionDescription(section)}
          </p>
        )}
      </header>
      <ol className="space-y-0" style={{ borderTop: "1px solid var(--sow-border)" }}>
        {section.line_items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-6 py-5"
            style={{ borderBottom: "1px solid var(--sow-border)" }}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-medium tracking-tight" style={{ color: "var(--sow-text)" }}>
                  {item.title}
                </p>
                {item.is_recurring && (
                  <span
                    className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full"
                    style={{ background: "var(--sow-accent)", color: "var(--sow-bg)" }}
                  >
                    {item.cadence || "monthly"}
                  </span>
                )}
              </div>
              {itemDescription(item, sow.revision_rounds) && (
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--sow-muted)" }}>
                  {itemDescription(item, sow.revision_rounds)}
                </p>
              )}
            </div>
            <LinePrice item={item} currency={sow.currency} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function ChannelCardsSection({
  section,
  sow,
}: {
  section: SowSection;
  sow: SowDocument;
}) {
  return (
    <section className="sow-section space-y-8">
      <header className="max-w-3xl space-y-4">
        <SectionEyebrow>{categoryEyebrow(section)}</SectionEyebrow>
        <h2
          className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.05]"
          style={{ color: "var(--sow-text)" }}
        >
          {section.title}
        </h2>
        {sectionDescription(section) && (
          <p className="text-lg leading-relaxed" style={{ color: "var(--sow-muted)" }}>
            {sectionDescription(section)}
          </p>
        )}
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.line_items.map((item) => (
          <article
            key={item.id}
            className="group relative overflow-hidden rounded-2xl p-5"
            style={{
              border: "1px solid var(--sow-border)",
              background: "var(--sow-card)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3
                className="text-lg font-semibold tracking-tight leading-snug"
                style={{ color: "var(--sow-text)" }}
              >
                {item.title}
              </h3>
              {item.is_recurring && (
                <span
                  className="shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full"
                  style={{ background: "var(--sow-accent)", color: "var(--sow-bg)" }}
                >
                  {item.cadence || "monthly"}
                </span>
              )}
            </div>
            {itemDescription(item, sow.revision_rounds) && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--sow-muted)" }}>
                {itemDescription(item, sow.revision_rounds)}
              </p>
            )}
            <div className="mt-6">
              <LinePrice item={item} currency={sow.currency} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function QuantitySection({ section, sow }: { section: SowSection; sow: SowDocument }) {
  return (
    <section className="sow-section space-y-8">
      <header className="max-w-3xl space-y-4">
        <SectionEyebrow>{categoryEyebrow(section)}</SectionEyebrow>
        <h2
          className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.05]"
          style={{ color: "var(--sow-text)" }}
        >
          {section.title}
        </h2>
        {sectionDescription(section) && (
          <p className="text-lg leading-relaxed" style={{ color: "var(--sow-muted)" }}>
            {sectionDescription(section)}
          </p>
        )}
      </header>
      <div
        className="overflow-hidden rounded-2xl"
        style={{ border: "1px solid var(--sow-border)" }}
      >
        {section.line_items.map((item, idx) => (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4"
            style={idx > 0 ? { borderTop: "1px solid var(--sow-border)" } : undefined}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-medium" style={{ color: "var(--sow-text)" }}>
                  {item.title}
                </p>
                {item.is_recurring && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded-full"
                    style={{ background: "var(--sow-accent)", color: "var(--sow-bg)" }}
                  >
                    {item.cadence || "monthly"}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-sm mt-1" style={{ color: "var(--sow-muted)" }}>
                  {item.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {item.requires_quantity && (
                <span
                  className="text-sm font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: "var(--sow-accent)", color: "var(--sow-bg)" }}
                >
                  {item.quantity_label || "Quantity TBD"}
                </span>
              )}
              <LinePrice item={item} currency={sow.currency} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PhasedSection({ section, sow }: { section: SowSection; sow: SowDocument }) {
  return (
    <section className="sow-section space-y-8">
      <header className="max-w-3xl space-y-4">
        <SectionEyebrow>{categoryEyebrow(section)}</SectionEyebrow>
        <h2
          className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.05]"
          style={{ color: "var(--sow-text)" }}
        >
          {section.title}
        </h2>
        {sectionDescription(section) && (
          <p className="text-lg leading-relaxed" style={{ color: "var(--sow-muted)" }}>
            {sectionDescription(section)}
          </p>
        )}
        <p
          className="inline-flex items-center rounded-full px-4 py-2 text-sm"
          style={{ border: "1px solid var(--sow-border)", color: "var(--sow-muted)" }}
        >
          {revisionLabel(sow.revision_rounds)}
        </p>
      </header>
      <ol className="grid gap-3">
        {section.line_items.map((item, idx) => (
          <li
            key={item.id}
            className="flex gap-5 rounded-2xl p-5"
            style={{
              border: "1px solid var(--sow-border)",
              background: "var(--sow-card)",
            }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: "var(--sow-accent)", color: "var(--sow-bg)" }}
            >
              {String(idx + 1).padStart(2, "0")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-medium tracking-tight" style={{ color: "var(--sow-text)" }}>
                  {item.title}
                </p>
                <LinePrice item={item} currency={sow.currency} />
              </div>
              {itemDescription(item, sow.revision_rounds) && (
                <p className="mt-1.5 text-sm" style={{ color: "var(--sow-muted)" }}>
                  {itemDescription(item, sow.revision_rounds)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CostGroupsBlock({ sow }: { sow: SowDocument }) {
  if (!sow.cost_groups.length) return null;
  const sectionsById = new Map(sow.sections.map((s) => [s.id, s]));
  const byGroup = new Map<string, SowLineItem[]>();
  for (const section of sow.sections) {
    for (const item of section.line_items) {
      if (!item.cost_group_id) continue;
      const list = byGroup.get(item.cost_group_id) ?? [];
      list.push(item);
      byGroup.set(item.cost_group_id, list);
    }
  }

  const vat = resolveSowVat(sow.vat);
  const amounts = sowVatAmounts(sow);
  const singleGroup = sow.cost_groups.length === 1;

  return (
    <section className="sow-section space-y-6">
      <SectionEyebrow>Investment groups</SectionEyebrow>
      <div className="grid gap-4">
        {sow.cost_groups.map((group) => {
          const items = byGroup.get(group.id) ?? [];
          const bySection = new Map<string, SowLineItem[]>();
          for (const item of items) {
            const list = bySection.get(item.section_id) ?? [];
            list.push(item);
            bySection.set(item.section_id, list);
          }

          return (
            <div
              key={group.id}
              className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-start justify-between gap-6"
              style={{ background: "var(--sow-accent)", color: "var(--sow-bg)" }}
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-2xl font-semibold tracking-tight">{group.title}</h3>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] opacity-45">
                  What&apos;s included
                </p>
                <div className="mt-3 space-y-5">
                  {[...bySection.entries()]
                    .sort(([a], [b]) => {
                      const sa = sectionsById.get(a)?.sort_order ?? 0;
                      const sb = sectionsById.get(b)?.sort_order ?? 0;
                      return sa - sb;
                    })
                    .map(([sectionId, sectionItems]) => {
                    const section = sectionsById.get(sectionId);
                    return (
                      <div key={sectionId}>
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-45">
                          {section?.title || "Included"}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {sectionItems.map((item) => (
                            <li key={item.id} className="text-sm opacity-75">
                              {item.title}
                              {item.quantity_label ? ` — ${item.quantity_label}` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="shrink-0 sm:text-right space-y-1.5 sm:max-w-[14rem]">
                <p className="text-3xl font-semibold tracking-tight tabular-nums leading-none">
                  {money(
                    singleGroup && amounts ? amounts.subtotal : group.price,
                    sow.currency
                  )}
                </p>
                {amounts && singleGroup && (
                  <p className="text-sm font-medium tabular-nums leading-snug opacity-70">
                    {renderVatSubline(vat.wording, {
                      subtotal: amounts.subtotal,
                      rate: vat.rate,
                      vatAmount: amounts.vatAmount,
                      total: amounts.total,
                      currency: sow.currency,
                    })}
                  </p>
                )}
              </div>
            </div>
          );
        })}
        {amounts && !singleGroup && (
          <div className="flex justify-end pt-1">
            <div className="shrink-0 sm:text-right space-y-1.5 sm:max-w-[14rem]">
              <p
                className="text-3xl font-semibold tracking-tight tabular-nums leading-none"
                style={{ color: "var(--sow-text)" }}
              >
                {money(amounts.subtotal, sow.currency)}
              </p>
              <p
                className="text-sm font-medium tabular-nums leading-snug"
                style={{ color: "var(--sow-muted)" }}
              >
                {renderVatSubline(vat.wording, {
                  subtotal: amounts.subtotal,
                  rate: vat.rate,
                  vatAmount: amounts.vatAmount,
                  total: amounts.total,
                  currency: sow.currency,
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PortfolioBlock({ sow }: { sow: SowDocument }) {
  if (!sow.portfolio_slides.length) return null;
  return (
    <section className="sow-section space-y-8">
      <header className="max-w-3xl space-y-4">
        <SectionEyebrow>Selected work</SectionEyebrow>
        <h2
          className="text-3xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.05]"
          style={{ color: "var(--sow-text)" }}
        >
          Fresh out of the studio
        </h2>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {sow.portfolio_slides.map((slide, idx) => {
          const href = slide.link_url || slide.source_url || undefined;
          const Wrapper = href ? "a" : "div";
          return (
            <Wrapper
              key={slide.id}
              {...(href ? { href, target: "_blank", rel: "noreferrer" } : {})}
              className={`group relative block overflow-hidden rounded-2xl ${
                idx === 0 ? "sm:col-span-2 aspect-[16/9]" : "aspect-[4/3]"
              }`}
              style={{ background: "var(--sow-card)" }}
            >
              {slide.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.image_url}
                  alt={slide.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <p className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
                  {slide.title}
                </p>
                {(slide.caption || slide.slide_kind === "screenshot") && (
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                    {slide.caption ||
                      (slide.slide_kind === "screenshot"
                        ? "Case screenshot"
                        : "View the project")}
                  </p>
                )}
              </div>
            </Wrapper>
          );
        })}
      </div>
    </section>
  );
}

function VatSummaryBlock({ sow }: { sow: SowDocument }) {
  if (sow.cost_groups.length > 0) return null;

  const vat = resolveSowVat(sow.vat);
  const amounts = sowVatAmounts(sow);
  if (!amounts) return null;

  const line = renderVatLine(vat.wording, {
    subtotal: amounts.subtotal,
    rate: vat.rate,
    vatAmount: amounts.vatAmount,
    total: amounts.total,
    currency: sow.currency,
  });

  return (
    <section
      className="sow-section pt-8"
      style={{ borderTop: "1px solid var(--sow-border)" }}
    >
      <p
        className="text-xl sm:text-2xl font-semibold tracking-tight tabular-nums"
        style={{ color: "var(--sow-text)" }}
      >
        {line}
      </p>
    </section>
  );
}

export function SowDocumentView({
  sow,
}: {
  sow: SowDocument;
  mode?: "client" | "admin-preview" | "print";
}) {
  const theme = resolveSowTheme(sow.theme);
  const fontHref = sowGoogleFontHref(theme.fontFamily);
  const company = companyLabel(sow);

  return (
    <article className="sow-document w-full overflow-hidden" style={themeVars(sow)}>
      {fontHref && <link rel="stylesheet" href={fontHref} />}

      <header className="relative px-6 sm:px-10 lg:px-16 pt-14 pb-16 sm:pt-20 sm:pb-24 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 100% 0%, rgba(255,255,255,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(255,255,255,0.06), transparent 50%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto space-y-8">
          <div className="flex items-center justify-between gap-4">
            <WideLogo variant="onDark" height={36} boxed priority />
            {sow.package?.name && (
              <span
                className="hidden sm:inline text-xs font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--sow-muted)" }}
              >
                {sow.package.name}
              </span>
            )}
          </div>

          <div className="space-y-4 max-w-4xl">
            <div className="space-y-1 text-sm font-semibold tracking-wide" style={{ color: "var(--sow-muted)" }}>
              <p>Prepared for {company}</p>
              <p>{formatSowDate(sow.document_date)}</p>
            </div>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.04em] leading-[0.98]"
              style={{ color: "var(--sow-text)" }}
            >
              {sow.title}
            </h1>
            {sow.intro_narrative && (
              <p
                className="text-lg sm:text-xl leading-relaxed max-w-2xl"
                style={{ color: "var(--sow-muted)" }}
              >
                {sow.intro_narrative}
              </p>
            )}
          </div>

          {sow.show_conservative_block && (
            <div
              className="mt-4 max-w-2xl rounded-2xl px-5 py-4 sm:px-6 sm:py-5"
              style={{
                border: "1px solid var(--sow-border)",
                background: "var(--sow-card)",
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--sow-muted)" }}
              >
                {sow.conservative_eyebrow}
              </p>
              <p
                className="mt-2 text-base sm:text-lg font-medium leading-snug"
                style={{ color: "var(--sow-text)" }}
              >
                {renderConservativeBody(sow.conservative_body, sow.revision_rounds)}
              </p>
            </div>
          )}
        </div>
      </header>

      <div className="px-6 sm:px-10 lg:px-16 py-16 sm:py-20 space-y-24">
        <div className="max-w-5xl mx-auto space-y-24">
          {sow.sections.map((section) => {
            switch (section.portrayal) {
              case "channel_cards":
                return (
                  <ChannelCardsSection key={section.id} section={section} sow={sow} />
                );
              case "quantity_cadence":
                return <QuantitySection key={section.id} section={section} sow={sow} />;
              case "phased":
                return <PhasedSection key={section.id} section={section} sow={sow} />;
              case "narrative":
              default:
                return (
                  <NarrativeSection key={section.id} section={section} sow={sow} />
                );
            }
          })}

          <CostGroupsBlock sow={sow} />
          <VatSummaryBlock sow={sow} />
          <PortfolioBlock sow={sow} />

          <section
            className="sow-section pt-12 space-y-4 max-w-3xl"
            style={{ borderTop: "1px solid var(--sow-border)" }}
          >
            <SectionEyebrow>Terms</SectionEyebrow>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--sow-text)" }}>
              How we operate when we partner up
            </h2>
            <pre
              className="whitespace-pre-wrap font-sans text-sm leading-relaxed"
              style={{ color: "var(--sow-muted)" }}
            >
              {renderTermsText(sow.terms_text, sow.revision_rounds)}
            </pre>
          </section>

          <footer
            className="pt-8 flex flex-wrap items-end justify-between gap-4 text-xs"
            style={{ borderTop: "1px solid var(--sow-border)", color: "var(--sow-muted)" }}
          >
            <p>WIDE · Munich · Digital branding & growth for European startups</p>
            <p>wide-communication.com</p>
          </footer>
        </div>
      </div>
    </article>
  );
}
