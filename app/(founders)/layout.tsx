import { ExecutiveAuthProvider } from "@/components/wide-os/providers/ExecutiveAuthProvider";
import { FounderShell } from "@/components/founders/FounderShell";
import { DatabaseSetupBanner } from "@/app/components/admin/DatabaseSetupBanner";
import { resolveFounderLayoutAccess } from "@/lib/founders/resolve-founder-layout-access";

export default async function FoundersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await resolveFounderLayoutAccess();

  return (
    <ExecutiveAuthProvider access={access}>
      <FounderShell banner={<DatabaseSetupBanner />}>{children}</FounderShell>
    </ExecutiveAuthProvider>
  );
}
