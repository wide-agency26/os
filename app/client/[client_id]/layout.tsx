import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";
import { ClientPortalShell } from "@/components/wide-os/shells/ClientPortalShell";

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ client_id: string }>;
}) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);

  return (
    <ClientPortalShell access={access}>
      {children}
    </ClientPortalShell>
  );
}
