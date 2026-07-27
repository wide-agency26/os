import { createClient } from "@/utils/supabase/server";
import { checkBrandPortalAuth } from "@/app/actions/brand-auth";
import BrandLockScreen from "./BrandLockScreen";
import BrandPortal from "./BrandPortal";
import { notFound } from "next/navigation";

export default async function BrandBookPage({
  params,
}: {
  params: Promise<{ client_slug: string }>;
}) {
  const { client_slug } = await params;
  const supabase = (await createClient()) as any;

  const { data: book, error } = await supabase
    .from("brand_books")
    .select("*")
    .eq("client_slug", client_slug)
    .single();

  if (error || !book) {
    notFound();
  }

  const isAuthenticated = await checkBrandPortalAuth(client_slug);

  if (!isAuthenticated) {
    return <BrandLockScreen client_slug={client_slug} client_name={book.client_name} />;
  }

  return <BrandPortal book={book} />;
}
