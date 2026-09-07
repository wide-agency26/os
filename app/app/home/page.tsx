import { cache, Suspense } from "react";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { FounderHome } from "@/components/home/FounderHome";
import { HomeBooks, HomeDeals } from "@/components/home/HomeBooks";
import { loadFounderHomeBooks, loadFounderHomeShell } from "@/lib/home/load-founder";
import { requireStaffPage } from "@/lib/auth/staff-session";

const getHomeBooks = cache(async () => {
  const session = await requireStaffPage();
  return loadFounderHomeBooks(session.supabase);
});

function SlotFallback({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-raised ${className}`} />;
}

async function HomeDealsSlot() {
  const books = await getHomeBooks();
  return <HomeDeals deals={books.pendingDeals} />;
}

async function HomeBooksSlot() {
  const books = await getHomeBooks();
  return <HomeBooks data={books} />;
}

export default async function HomeWorkspace() {
  const session = await requireStaffPage();
  if (!session.isStaff) redirect("/app/client-guidelines");

  const data = await loadFounderHomeShell(session.supabase, session.user!.id);

  return (
    <Workspace>
      <FounderHome
        data={data}
        userId={session.user!.id}
        deals={
          <Suspense fallback={<SlotFallback className="h-16 mb-3" />}>
            <HomeDealsSlot />
          </Suspense>
        }
        books={
          <Suspense fallback={<SlotFallback className="h-32" />}>
            <HomeBooksSlot />
          </Suspense>
        }
      />
    </Workspace>
  );
}
