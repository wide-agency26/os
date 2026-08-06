"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { isFounder } from "@/lib/rbac";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { MyWeekClient } from "@/components/pm/MyWeekClient";

export default function HomeWorkspace() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function checkRole() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && !isFounder(profile.role)) {
        router.push("/app/client-guidelines");
        return;
      }

      setUserId(user.id);
      setReady(true);
    }
    void checkRole();
  }, [router]);

  if (!ready || !userId) {
    return (
      <Workspace>
        <p className="text-sm text-gray-500">Loading…</p>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <MyWeekClient userId={userId} />
    </Workspace>
  );
}
