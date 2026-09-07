import { redirect } from "next/navigation";

export default async function SeoAuditRedirect({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.url ? `?url=${encodeURIComponent(sp.url)}` : "";
  redirect(`/app/seo${q}`);
}
