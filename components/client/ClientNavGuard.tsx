"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ClientNavKey, ClientNavState } from "@/lib/client/nav";
import { firstEnabledClientHref } from "@/lib/client/nav";

/** Client-component pages: bounce if this tab is switched off for the company. */
export function ClientNavGuard({ navKey }: { navKey: ClientNavKey }) {
  const router = useRouter();

  useEffect(() => {
    void fetch("/api/client/nav-availability", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ClientNavState) => {
        if (data?.enabled && !data.enabled[navKey]) {
          const dest = firstEnabledClientHref(data.enabled);
          if (dest !== window.location.pathname) {
            router.replace(dest);
          }
        }
      })
      .catch(() => {
        /* keep the page; sidebar/proxy still gate */
      });
  }, [navKey, router]);

  return null;
}
