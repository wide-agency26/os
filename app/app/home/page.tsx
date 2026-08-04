"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";
import { Workspace, Section, ShortcutCard } from "@/components/frappe-ui/Workspace";
import { FileText, Users, Briefcase, BookOpen } from "lucide-react";

export default function HomeWorkspace() {
  const router = useRouter();

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && !isFounder(profile.role)) {
        // Redirect client role users directly to their company brand guidelines dashboard
        router.push("/app/client-guidelines");
      }
    }
    checkRole();
  }, [router]);

  return (
    <Workspace>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Welcome to WIDE OS</h2>
        <p className="text-gray-500 mt-1">Your central operating system.</p>
      </div>

      <Section title="Your Shortcuts">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          <ShortcutCard title="Brand Guidelines" icon={BookOpen} href="/app/projects/ci-builder" />
          <ShortcutCard title="Client Access Requests" icon={Users} href="/app/client-access" />
          <ShortcutCard title="Accounting" icon={FileText} href="/app/accounting" />
          <ShortcutCard title="Projects" icon={Briefcase} href="/app/projects" />
        </div>
      </Section>
    </Workspace>
  );
}
