"use server";

import { createClient } from "@/utils/supabase/server";

export type ClientBlogArticleBody = {
  id: string;
  title: string;
  slug: string | null;
  language: string;
  body_md: string;
  meta_description: string | null;
  translations: Record<string, { title?: string; body_md?: string; meta_description?: string }>;
  scheduled_for: string | null;
  published_at: string | null;
  published_url: string | null;
  published_urls: Record<string, string>;
  status: string;
};

export async function loadClientBlogArticle(
  articleId: string
): Promise<{ article?: ClientBlogArticleBody; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required." };

  const { data, error } = await (supabase as any)
    .from("blog_articles")
    .select(
      "id, title, slug, language, body_md, meta_description, translations, scheduled_for, published_at, published_url, published_urls, status, client_visible"
    )
    .eq("id", articleId)
    .eq("client_visible", true)
    .maybeSingle();

  if (error) return { error: error.message as string };
  if (!data || data.client_visible === false) return { error: "Article not found." };

  const trans = data.translations && typeof data.translations === "object" ? data.translations : {};
  const urls =
    data.published_urls && typeof data.published_urls === "object" ? data.published_urls : {};

  return {
    article: {
      id: data.id as string,
      title: (data.title as string) || "",
      slug: (data.slug as string | null) ?? null,
      language: (data.language as string) || "de",
      body_md: (data.body_md as string) || "",
      meta_description: (data.meta_description as string | null) ?? null,
      translations: trans as ClientBlogArticleBody["translations"],
      scheduled_for: (data.scheduled_for as string | null) ?? null,
      published_at: (data.published_at as string | null) ?? null,
      published_url: (data.published_url as string | null) ?? null,
      published_urls: urls as Record<string, string>,
      status: data.status as string,
    },
  };
}
