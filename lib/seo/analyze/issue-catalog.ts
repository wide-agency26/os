import type { SeoIssueCategory, SeoSeverity } from "../types";

/**
 * Every finding the auditor can produce, with the copy a non-specialist needs.
 *
 * `whatItMeans` explains the finding in plain English, `whyItMatters` connects
 * it to rankings or revenue, and `howToFix` is a concrete instruction. Impact
 * and effort are 1-5 and drive the priority ordering (impact / effort).
 */
export type IssueDefinition = {
  category: SeoIssueCategory;
  severity: SeoSeverity;
  title: string;
  whatItMeans: string;
  whyItMatters: string;
  howToFix: string;
  impact: number;
  effort: number;
};

export const ISSUE_CATALOG: Record<string, IssueDefinition> = {
  // ---------------------------------------------------------------- indexability
  noindex_pages: {
    category: "indexability",
    severity: "critical",
    title: "Pages are telling Google not to index them",
    whatItMeans:
      "These pages carry a 'noindex' instruction, which asks search engines to leave them out of search results entirely.",
    whyItMatters:
      "A noindexed page can never rank, no matter how good it is. When this is set by accident — a common leftover from a staging site — it silently removes pages from Google.",
    howToFix:
      "Check each page listed. If it should be findable in search, remove the noindex meta tag or the X-Robots-Tag header, then request re-indexing in Search Console.",
    impact: 5,
    effort: 2,
  },
  robots_blocked_pages: {
    category: "indexability",
    severity: "high",
    title: "Pages are blocked by robots.txt",
    whatItMeans:
      "Your robots.txt file tells search engine crawlers not to visit these URLs, so their content is never read.",
    whyItMatters:
      "Blocked pages cannot be understood or ranked properly. Blocking is useful for admin areas, but blocking real content costs you traffic.",
    howToFix:
      "Open your robots.txt file and review the Disallow rules that match these URLs. Remove or narrow any rule that catches pages you want found.",
    impact: 4,
    effort: 2,
  },
  broken_pages: {
    category: "indexability",
    severity: "critical",
    title: "Broken pages returning 'not found' errors",
    whatItMeans:
      "These URLs are linked from your own site but return a 404 or similar error instead of a real page.",
    whyItMatters:
      "Visitors hit a dead end and leave, and search engines drop the page from their index. Any ranking value the page had is lost.",
    howToFix:
      "Either restore the missing page, or set up a 301 redirect to the closest equivalent page. Then update the internal links that still point at the dead URL.",
    impact: 5,
    effort: 2,
  },
  server_errors: {
    category: "indexability",
    severity: "critical",
    title: "Pages returning server errors",
    whatItMeans:
      "These URLs failed with a 5xx server error when we requested them.",
    whyItMatters:
      "Server errors block both visitors and search engines. If they persist, Google will remove the affected pages from its index.",
    howToFix:
      "Send this list to whoever maintains the site or hosting. Check the server error logs for the same timestamps to find the cause.",
    impact: 5,
    effort: 3,
  },
  redirect_chains: {
    category: "indexability",
    severity: "medium",
    title: "Redirect chains slowing pages down",
    whatItMeans:
      "Reaching these pages takes two or more redirect hops instead of going straight to the destination.",
    whyItMatters:
      "Every hop adds delay for the visitor and dilutes the ranking signal passed along the chain.",
    howToFix:
      "Update each redirect so it points directly at the final URL, and fix the internal links that trigger the first hop.",
    impact: 3,
    effort: 2,
  },
  orphan_pages: {
    category: "links",
    severity: "high",
    title: "Orphan pages with no internal links",
    whatItMeans:
      "These pages exist but nothing else on the site links to them, so they can only be reached by knowing the exact URL.",
    whyItMatters:
      "Search engines discover and value pages through links. An unlinked page looks unimportant and is often never crawled at all.",
    howToFix:
      "Add links to these pages from relevant navigation, category pages, or related articles — anywhere a reader would naturally expect to find them.",
    impact: 4,
    effort: 2,
  },
  sitemap_missing: {
    category: "indexability",
    severity: "medium",
    title: "No XML sitemap found",
    whatItMeans:
      "We could not find a sitemap at the usual locations or referenced in robots.txt.",
    whyItMatters:
      "A sitemap is how you hand search engines a complete list of your pages. Without one, discovery relies entirely on links and slows down considerably.",
    howToFix:
      "Generate an XML sitemap (most CMS platforms do this automatically), publish it at /sitemap.xml, reference it in robots.txt, and submit it in Search Console.",
    impact: 3,
    effort: 2,
  },
  crawled_not_in_sitemap: {
    category: "indexability",
    severity: "low",
    title: "Live pages missing from the sitemap",
    whatItMeans:
      "These pages are reachable on the site but are not listed in the XML sitemap.",
    whyItMatters:
      "Pages left out of the sitemap take longer to be discovered and re-crawled after updates.",
    howToFix:
      "Regenerate the sitemap so it includes every page you want indexed, and make sure new pages are added automatically.",
    impact: 2,
    effort: 2,
  },
  canonical_missing: {
    category: "indexability",
    severity: "medium",
    title: "Pages without a canonical tag",
    whatItMeans:
      "These pages do not declare which URL is the definitive version of their content.",
    whyItMatters:
      "Without a canonical, slightly different URLs for the same page (with tracking parameters, for example) can compete against each other and split their ranking strength.",
    howToFix:
      "Add a self-referencing canonical link tag to each page's head section pointing at its clean, preferred URL.",
    impact: 3,
    effort: 2,
  },
  canonical_conflict: {
    category: "indexability",
    severity: "high",
    title: "Pages pointing their canonical at a different URL",
    whatItMeans:
      "These pages tell search engines that another URL is the real version of their content.",
    whyItMatters:
      "When this is intentional it consolidates duplicates correctly. When it is a mistake — often a template copying one canonical everywhere — it removes the page from search results.",
    howToFix:
      "Review each page. If it is genuinely unique content, change the canonical to point at itself.",
    impact: 4,
    effort: 2,
  },

  // ------------------------------------------------------------------- on-page
  title_missing: {
    category: "on_page",
    severity: "critical",
    title: "Pages with no title tag",
    whatItMeans:
      "These pages have no title, so search engines and browser tabs have nothing meaningful to show.",
    whyItMatters:
      "The title is the single strongest on-page ranking signal and the headline people click in search results. A missing title costs both rankings and clicks.",
    howToFix:
      "Write a unique title for each page, roughly 30-60 characters, leading with the main topic and including the brand where it fits.",
    impact: 5,
    effort: 2,
  },
  title_duplicate: {
    category: "on_page",
    severity: "high",
    title: "Duplicate titles across multiple pages",
    whatItMeans:
      "Several pages share exactly the same title tag.",
    whyItMatters:
      "Identical titles make pages look interchangeable to search engines, so they compete with each other instead of each ranking for its own topic.",
    howToFix:
      "Give every page a title that describes what makes that specific page different. Templated titles should include the page-specific value, not just the site name.",
    impact: 4,
    effort: 3,
  },
  title_length: {
    category: "on_page",
    severity: "medium",
    title: "Titles that are too short or too long",
    whatItMeans:
      "These titles fall outside the roughly 30-60 character range that displays fully in search results.",
    whyItMatters:
      "Long titles get cut off mid-sentence, and very short ones waste the most valuable space you have for describing the page.",
    howToFix:
      "Rewrite the listed titles to sit between 30 and 60 characters, putting the most important words first.",
    impact: 3,
    effort: 2,
  },
  meta_missing: {
    category: "on_page",
    severity: "medium",
    title: "Pages with no meta description",
    whatItMeans:
      "These pages have no description, so Google will pull an arbitrary snippet of text from the page instead.",
    whyItMatters:
      "The description is your sales pitch in the search results. Leaving it to chance usually means a less compelling snippet and fewer clicks.",
    howToFix:
      "Write a 70-160 character description for each page that summarises the content and gives a reason to click.",
    impact: 3,
    effort: 2,
  },
  meta_duplicate: {
    category: "on_page",
    severity: "low",
    title: "Duplicate meta descriptions",
    whatItMeans: "Several pages share the same meta description text.",
    whyItMatters:
      "Repeated descriptions make your search listings look generic and give no reason to pick one result over another.",
    howToFix: "Write a distinct description for each page that reflects its specific content.",
    impact: 2,
    effort: 3,
  },
  meta_length: {
    category: "on_page",
    severity: "low",
    title: "Meta descriptions outside the ideal length",
    whatItMeans:
      "These descriptions are shorter than 70 or longer than 160 characters.",
    whyItMatters:
      "Overly long descriptions get truncated, and very short ones leave valuable space unused.",
    howToFix: "Rewrite them to sit between 70 and 160 characters.",
    impact: 2,
    effort: 2,
  },
  h1_missing: {
    category: "on_page",
    severity: "high",
    title: "Pages missing a main heading",
    whatItMeans:
      "These pages have no H1, the top-level heading that states what the page is about.",
    whyItMatters:
      "The main heading helps both readers and search engines grasp the page topic immediately. Missing it weakens the page's relevance signal.",
    howToFix:
      "Add exactly one H1 to each page that clearly states the topic, closely matching the page title.",
    impact: 4,
    effort: 2,
  },
  h1_multiple: {
    category: "on_page",
    severity: "low",
    title: "Pages with more than one main heading",
    whatItMeans: "These pages use several H1 tags instead of a single main heading.",
    whyItMatters:
      "Multiple top-level headings blur the page's focus and make the content structure harder to interpret.",
    howToFix:
      "Keep one H1 as the page title and demote the others to H2 or H3 to form a clear hierarchy.",
    impact: 2,
    effort: 2,
  },
  images_missing_alt: {
    category: "on_page",
    severity: "medium",
    title: "Images without alt text",
    whatItMeans:
      "These pages contain images with no alternative text describing what the image shows.",
    whyItMatters:
      "Alt text is how screen-reader users experience images and how search engines understand them. It is both an accessibility requirement and a source of image search traffic.",
    howToFix:
      "Add a short, factual description to each meaningful image. Purely decorative images should have an empty alt attribute so they are skipped.",
    impact: 3,
    effort: 3,
  },

  // ------------------------------------------------------------------- content
  thin_content: {
    category: "content",
    severity: "medium",
    title: "Pages with very little content",
    whatItMeans:
      "These pages contain fewer than 250 words of body text.",
    whyItMatters:
      "Short pages rarely answer a question fully, so they struggle to rank against more complete competitors. Some legitimately short pages, like contact pages, are fine.",
    howToFix:
      "For pages meant to attract search traffic, expand them to genuinely answer the reader's question. Consider merging several thin pages into one strong one.",
    impact: 3,
    effort: 4,
  },
  duplicate_content: {
    category: "content",
    severity: "high",
    title: "Pages with identical content",
    whatItMeans:
      "These groups of pages contain effectively the same body text.",
    whyItMatters:
      "Duplicate pages compete with each other, and search engines pick just one to show — often not the one you would choose.",
    howToFix:
      "Merge the duplicates into a single page and redirect the others to it, or set canonical tags pointing to the version you want to rank.",
    impact: 4,
    effort: 3,
  },

  // ----------------------------------------------------------------- technical
  https_missing: {
    category: "technical",
    severity: "critical",
    title: "Site is not served over HTTPS",
    whatItMeans: "The site is available over plain, unencrypted HTTP.",
    whyItMatters:
      "Browsers label HTTP sites as 'Not secure', which destroys trust, and HTTPS has been a confirmed ranking signal for years.",
    howToFix:
      "Install an SSL certificate (free through Let's Encrypt or your host), then redirect all HTTP traffic to HTTPS permanently.",
    impact: 5,
    effort: 3,
  },
  viewport_missing: {
    category: "mobile",
    severity: "high",
    title: "Pages missing a mobile viewport setting",
    whatItMeans:
      "These pages do not tell mobile browsers how to scale the layout to the screen.",
    whyItMatters:
      "Without it, phones render the desktop layout zoomed out and unreadable. Google indexes the mobile version of your site first, so this affects all rankings.",
    howToFix:
      "Add the standard viewport meta tag to the head of every page.",
    impact: 4,
    effort: 1,
  },
  lang_missing: {
    category: "international",
    severity: "low",
    title: "Pages not declaring their language",
    whatItMeans: "The HTML tag on these pages has no lang attribute.",
    whyItMatters:
      "Declaring the language helps search engines serve your pages to the right audience and helps screen readers pronounce content correctly.",
    howToFix: "Set the appropriate language on the html element, for example lang=\"en\".",
    impact: 2,
    effort: 1,
  },
  hreflang_invalid: {
    category: "international",
    severity: "medium",
    title: "Invalid hreflang language codes",
    whatItMeans:
      "Some hreflang annotations use codes that are not valid language or region values.",
    whyItMatters:
      "Search engines ignore invalid hreflang entries, so visitors can be shown the wrong language version of a page.",
    howToFix:
      "Correct the codes to valid ISO formats such as en, en-GB, or de-AT, and make sure each version links back to the others.",
    impact: 3,
    effort: 3,
  },
  schema_missing: {
    category: "schema",
    severity: "medium",
    title: "Pages without structured data",
    whatItMeans:
      "These pages have no schema markup describing what kind of content they contain.",
    whyItMatters:
      "Structured data is what earns rich results — star ratings, FAQs, breadcrumbs, event details — which take up more space in search and attract more clicks.",
    howToFix:
      "Add JSON-LD structured data matching each page type (Organization, Article, Product, FAQPage, LocalBusiness) and validate it with Google's Rich Results Test.",
    impact: 3,
    effort: 3,
  },
  schema_invalid: {
    category: "schema",
    severity: "medium",
    title: "Structured data that fails to parse",
    whatItMeans: "These pages contain JSON-LD blocks that are not valid JSON.",
    whyItMatters:
      "Broken structured data is ignored completely, so the page loses any rich result it was meant to earn.",
    howToFix:
      "Fix the JSON syntax — usually a trailing comma or an unescaped quote — and re-test with the Rich Results Test.",
    impact: 3,
    effort: 2,
  },
  og_incomplete: {
    category: "on_page",
    severity: "low",
    title: "Incomplete social sharing previews",
    whatItMeans:
      "These pages are missing an Open Graph title, description, or image.",
    whyItMatters:
      "When someone shares the page on LinkedIn, Slack, or WhatsApp, it appears as a bare link with no image, which gets far fewer clicks.",
    howToFix:
      "Add og:title, og:description, and og:image tags to each page, using an image around 1200x630 pixels.",
    impact: 2,
    effort: 2,
  },
  slow_ttfb: {
    category: "performance",
    severity: "medium",
    title: "Slow server response time",
    whatItMeans:
      "These pages took more than 800ms to send their first byte of data.",
    whyItMatters:
      "Server delay happens before anything can render, so it slows down every other loading metric and directly worsens the visitor experience.",
    howToFix:
      "Enable server-side caching or a CDN, review slow database queries, and consider upgrading hosting if delays are consistent.",
    impact: 3,
    effort: 4,
  },
  heavy_pages: {
    category: "performance",
    severity: "low",
    title: "Unusually large pages",
    whatItMeans: "These pages ship more than 500KB of HTML alone, before images and scripts.",
    whyItMatters:
      "Large pages are slow on mobile connections, and slow pages lose visitors before they ever see the content.",
    howToFix:
      "Reduce inline scripts and styles, remove unused markup, and enable compression on the server.",
    impact: 2,
    effort: 3,
  },

  // --------------------------------------------------------------- performance
  cwv_lcp_poor: {
    category: "performance",
    severity: "high",
    title: "Slow loading of the main content",
    whatItMeans:
      "Largest Contentful Paint is above Google's 2.5 second threshold — the biggest visible element takes too long to appear.",
    whyItMatters:
      "This is one of Google's three Core Web Vitals and a confirmed ranking factor. It is also the metric visitors feel most directly as 'this site is slow'.",
    howToFix:
      "Optimise and properly size the largest image or hero element, preload it, serve modern formats like WebP, and remove render-blocking scripts above it.",
    impact: 4,
    effort: 4,
  },
  cwv_inp_poor: {
    category: "performance",
    severity: "high",
    title: "Slow response to user interaction",
    whatItMeans:
      "Interaction to Next Paint is above Google's 200ms threshold — the page is sluggish when people tap or click.",
    whyItMatters:
      "This is a Core Web Vital and a ranking factor. An unresponsive page feels broken, and visitors tap repeatedly then leave.",
    howToFix:
      "Break up long JavaScript tasks, defer non-essential scripts, and reduce third-party tags that block the main thread.",
    impact: 4,
    effort: 4,
  },
  cwv_cls_poor: {
    category: "performance",
    severity: "high",
    title: "Page content shifting while it loads",
    whatItMeans:
      "Cumulative Layout Shift is above Google's 0.1 threshold — elements move around as the page loads.",
    whyItMatters:
      "A Core Web Vital and a ranking factor. It also causes mis-clicks, which is especially damaging on checkout and contact forms.",
    howToFix:
      "Set explicit width and height on images and embeds, reserve space for ads and banners, and avoid inserting content above existing content.",
    impact: 4,
    effort: 3,
  },
  perf_score_low: {
    category: "performance",
    severity: "medium",
    title: "Low overall performance score",
    whatItMeans:
      "Google's Lighthouse performance score for the tested pages is below 50 out of 100.",
    whyItMatters:
      "A low score usually means several compounding problems. Speed affects rankings, and every extra second of load time measurably reduces conversions.",
    howToFix:
      "Work through the specific opportunities listed in the Performance tab, starting with the largest estimated time savings.",
    impact: 3,
    effort: 4,
  },

  // ----------------------------------------------------------- search presence
  striking_distance: {
    category: "search_presence",
    severity: "info",
    title: "Keywords ranking just below the first page",
    whatItMeans:
      "These search terms already rank in positions 4-15, close to the top results but not there yet.",
    whyItMatters:
      "These are the fastest wins available. Moving a term from position 11 to position 5 typically multiplies its clicks several times over, and the page already exists.",
    howToFix:
      "For each term, strengthen the page that already ranks: work the phrasing into the title and headings, expand the section that answers it, and add internal links using that wording.",
    impact: 5,
    effort: 2,
  },
  content_gap: {
    category: "search_presence",
    severity: "info",
    title: "Topics people search for that you have not covered",
    whatItMeans:
      "We found clusters of real questions people ask that have no matching page on the site.",
    whyItMatters:
      "Each uncovered cluster is search demand going to a competitor. Answering it well is how new organic traffic is earned.",
    howToFix:
      "Create one focused page per cluster that answers the grouped questions directly, using the exact phrasing people use.",
    impact: 4,
    effort: 4,
  },

  // ---------------------------------------------------------------- article (Blog Builder; site crawl does not emit these)
  keyword_missing_title: {
    category: "on_page",
    severity: "high",
    title: "Primary keyword is missing from the title",
    whatItMeans:
      "The working title does not contain the primary search phrase this page is meant to rank for.",
    whyItMatters:
      "Google and readers both use the title as the first relevance signal. A mismatch wastes the keyword the brief targeted.",
    howToFix:
      "Rewrite the title so the primary keyword appears naturally, ideally near the front, without stuffing.",
    impact: 4,
    effort: 1,
  },
  keyword_missing_h1: {
    category: "on_page",
    severity: "medium",
    title: "Primary keyword is missing from the H1",
    whatItMeans: "The main heading does not include the primary keyword.",
    whyItMatters: "The H1 confirms what the page is about. Search engines weigh it after the title.",
    howToFix: "Include the primary keyword in the H1 in natural language.",
    impact: 3,
    effort: 1,
  },
  headings_shallow: {
    category: "content",
    severity: "medium",
    title: "Article has too few section headings",
    whatItMeans: "There are fewer than three H2 sections, so the piece reads as a single block.",
    whyItMatters: "Scannable sections help both readers and search engines understand coverage of sub-topics.",
    howToFix: "Split the article into focused H2 sections that each answer a real question from the brief.",
    impact: 3,
    effort: 2,
  },
  internal_links_missing: {
    category: "links",
    severity: "medium",
    title: "No internal links in the article body",
    whatItMeans: "The draft does not point to any other page on the same site.",
    whyItMatters: "Internal links pass context to commercial and supporting pages and help crawlers.",
    howToFix: "Add 2–5 contextual links to existing articles or product pages, with descriptive anchors.",
    impact: 3,
    effort: 2,
  },
  cta_missing: {
    category: "content",
    severity: "medium",
    title: "No call to action",
    whatItMeans: "The article never invites the reader to a next step.",
    whyItMatters: "Blog traffic that does not convert is wasted. Every piece should have one intentional CTA.",
    howToFix: "Add one relevant CTA tied to the search intent — a product page, quiz, demo, or related guide.",
    impact: 3,
    effort: 1,
  },
  external_sources_missing: {
    category: "content",
    severity: "low",
    title: "No high-quality external sources cited",
    whatItMeans: "Claims are not backed by a primary or official source.",
    whyItMatters: "Unsupported claims hurt trust and are a common reason AI drafts get rewritten.",
    howToFix: "Cite 1–3 primary sources (official docs, regulation, research) where a fact is asserted.",
    impact: 2,
    effort: 2,
  },
};

export function getIssueDefinition(code: string): IssueDefinition | null {
  return ISSUE_CATALOG[code] ?? null;
}
