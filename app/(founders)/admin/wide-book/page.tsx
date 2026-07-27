import { createClient } from "@/utils/supabase/server";
import { ContextExplainer } from "@/components/wide-os/ContextExplainer";
import WideBookClient from "./WideBookClient";

export default async function WideBookAdminPage() {
  const supabase = (await createClient()) as any;
  const { data: brandBooks, error: booksError } = await supabase.from("brand_books").select("*").order("created_at", { ascending: false });
  const { data: workspaces, error: wsError } = await supabase.from("workspaces").select("id, company_name").order("company_name", { ascending: true });

  if (booksError) {
    console.error("Error fetching brand books:", booksError);
  }
  
  if (wsError) {
     console.error("Error fetching workspaces:", wsError);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ContextExplainer
        title="WIDE BOOK COMPILER"
        description="Build, refine, and lock down secure web-based brand guidelines from Figma. Retrieve design tokens and control what information is displayed publicly on the client portal."
        storageKey="wide-book-admin"
      />
      
      <WideBookClient initialBooks={brandBooks || []} workspaces={workspaces || []} />
    </div>
  );
}
