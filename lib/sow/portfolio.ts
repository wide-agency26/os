import type { SowPortfolioSlide } from "@/lib/sow/types";

export function isUploadedFilename(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (/\.(png|jpe?g|webp|gif|heic|pdf)$/i.test(t)) return true;
  if (/^screenshot[\s._-]/i.test(t)) return true;
  if (/^(img|image)[\s._-]?\d/i.test(t)) return true;
  return false;
}

export function sanitizePortfolioTitle(raw: string): string {
  const t = raw.trim();
  if (!t || isUploadedFilename(t)) return "Untitled";
  return t;
}

/** Title shown on the SOW document — never a raw upload filename. */
export function portfolioCaseTitle(slide: Pick<SowPortfolioSlide, "title">): string {
  return sanitizePortfolioTitle(slide.title || "");
}

/** Assigned URL wins; empty string means hide; null falls back to scrape source. */
export function portfolioUrlRaw(
  slide: Pick<SowPortfolioSlide, "link_url" | "source_url">
): string {
  if (slide.link_url != null) return slide.link_url.trim();
  return (slide.source_url || "").trim();
}

export function portfolioHref(
  slide: Pick<SowPortfolioSlide, "link_url" | "source_url">
): string | undefined {
  const raw = portfolioUrlRaw(slide);
  if (!raw) return undefined;
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** Host + path, no protocol, no www — e.g. wide-communication.com/work/sign2x */
export function portfolioUrlLabel(slide: Pick<SowPortfolioSlide, "link_url" | "source_url">): string | null {
  const href = portfolioHref(slide);
  if (!href) return null;
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    const search = u.search || "";
    return `${host}${path}${search}`;
  } catch {
    return href.replace(/^https?:\/\//i, "").replace(/^www\./, "").replace(/\/$/, "");
  }
}

export function normalizePortfolioUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export function orderedPortfolioSlides<T extends { sort_order: number }>(slides: T[]): T[] {
  return [...slides].sort((a, b) => a.sort_order - b.sort_order);
}

export function withFeaturedSlide<T extends { id: string; sort_order: number }>(
  slides: T[],
  slideId: string
): T[] {
  const featured = slides.find((s) => s.id === slideId);
  if (!featured) return slides;
  const rest = slides.filter((s) => s.id !== slideId);
  return [featured, ...rest].map((s, i) => ({ ...s, sort_order: i + 1 }));
}
