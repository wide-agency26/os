import SettingsForm from "@/app/components/SettingsForm";
import { NotificationPreferencesForm } from "@/app/components/NotificationPreferencesForm";
import { TeamInviteForm } from "@/app/components/TeamInviteForm";
import { createClient } from "@/utils/supabase/server";
import type { WideAccess } from "@/lib/wide-os/types";
import { ModuleScaffold } from "@/modules/_shared/ModuleScaffold";

export async function ClientSettingsReadView({ access }: { access: WideAccess }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = { full_name: "", company_name: "" };
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, company_name")
      .eq("id", user.id)
      .single();
    if (data) profile = { full_name: data.full_name || "", company_name: data.company_name || "" };
  }

  const { data: prefs } = user
    ? await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const isEndClient = access.role === "client" && access.privilege === "read";

  return (
    <ModuleScaffold access={access} title="Settings" description="Profile, teammates, and notifications.">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-5xl">
        <SettingsForm initialFullName={profile.full_name} initialCompanyName={profile.company_name} />
        {isEndClient ? (
          <div className="space-y-8">
            <NotificationPreferencesForm
              notifyEmail={prefs?.notify_email ?? true}
              notifySms={prefs?.notify_sms ?? false}
              notifyInApp={prefs?.notify_in_app ?? true}
            />
            <TeamInviteForm />
          </div>
        ) : null}
      </div>
    </ModuleScaffold>
  );
}

function motion({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={className}>{children}</div>;
}
