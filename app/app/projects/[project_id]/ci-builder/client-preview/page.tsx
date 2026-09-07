"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { startCiClientPreview } from "@/app/actions/view-as-client";
import { Workspace } from "@/components/frappe-ui/Workspace";

export default function CiClientPreviewStartPage() {
  const params = useParams();
  const projectId = String(params.project_id || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void startCiClientPreview(projectId)
      .then((result) => {
        if (!cancelled && result?.error) setError(result.error);
      })
      .catch((err: { digest?: string; message?: string }) => {
        const digest = String(err?.digest || err?.message || "");
        if (!cancelled && !digest.includes("NEXT_REDIRECT")) {
          setError("Could not open client preview.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <Workspace>
      <div className="max-w-md mx-auto py-16 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-text-primary mb-2">
              Can’t open client preview
            </h1>
            <p className="text-[13px] text-text-secondary leading-relaxed mb-6">
              {error}
            </p>
            <Link
              href={`/app/projects/${projectId}/ci-builder`}
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 hover:bg-black"
            >
              Back to CI Builder
            </Link>
          </>
        ) : (
          <p className="text-[13px] text-text-secondary">Opening client view…</p>
        )}
      </div>
    </Workspace>
  );
}
