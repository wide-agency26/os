import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { SentimentLauncher } from "@/components/sentiment/SentimentUI";
import { listSentimentReports } from "@/app/actions/sentiment";

export default async function SentimentPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; url?: string; bd?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !isFounder(profile.role)) {
    return (
      <Workspace>
        <p className="text-sm text-gray-600">Founders only.</p>
      </Workspace>
    );
  }
  const recent = await listSentimentReports();
  return (
    <Workspace>
      <SentimentLauncher
        initialBrand={sp.brand || ""}
        initialUrl={sp.url || ""}
        bdRecordId={sp.bd || null}
        recent={recent.reports}
      />
    </Workspace>
  );
}
