"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStyleGuideItem } from "@/app/actions/style-guide";

export function StyleGuideDeleteButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await deleteStyleGuideItem(id);
          router.refresh();
        })
      }
      className="text-[11px] text-danger hover:underline disabled:opacity-50"
    >
      Remove
    </button>
  );
}
