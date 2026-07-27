"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deactivateAnnouncement } from "@/app/actions/announcements";

export function DeactivateAnnouncementButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deactivateAnnouncement(id);
          router.refresh();
        })
      }
      className="text-[11px] text-danger hover:underline disabled:opacity-50"
    >
      Deactivate
    </button>
  );
}
