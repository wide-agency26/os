import { ClientSettingsReadView } from "@/modules/client/views/ClientSettingsReadView";
import { resolveClientReadAccess } from "@/lib/wide-os/resolve-access";

export default async function Page({ params }: { params: Promise<{ client_id: string }> }) {
  const { client_id } = await params;
  const access = await resolveClientReadAccess(client_id);
  return <ClientSettingsReadView access={access} />;
}
