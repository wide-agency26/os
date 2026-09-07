import * as cheerio from "cheerio";
import { fetchPage } from "@/lib/seo/fetcher";

const BODY_BUDGET = 12000;

export type SiteFetch = {
  ok: boolean;
  url: string;
  finalUrl?: string;
  title?: string;
  metaDescription?: string;
  text: string;
  error?: string;
};

/** Reuses the SEO Audit HTML fetcher rather than a second HTTP client. */
export async function fetchCompetitorSite(rawUrl: string): Promise<SiteFetch> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, url: rawUrl, text: "", error: "URL must be http(s)" };
    }
  } catch {
    return { ok: false, url: rawUrl, text: "", error: "Invalid URL" };
  }

  const result = await fetchPage(parsed.toString(), { timeoutMs: 15000 });
  if (!result.ok || !result.body) {
    return {
      ok: false,
      url: rawUrl,
      finalUrl: result.finalUrl,
      text: "",
      error: result.error || `HTTP ${result.status ?? "error"}`,
    };
  }

  const $ = cheerio.load(result.body);
  $("script, style, noscript, svg, template, iframe, nav, header, footer, aside").remove();
  const title = $("title").first().text().trim();
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || "";
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, BODY_BUDGET);
  if (!text) {
    return {
      ok: false,
      url: rawUrl,
      finalUrl: result.finalUrl,
      title,
      metaDescription,
      text: "",
      error: "No usable page text",
    };
  }
  return {
    ok: true,
    url: rawUrl,
    finalUrl: result.finalUrl,
    title,
    metaDescription,
    text,
  };
}
