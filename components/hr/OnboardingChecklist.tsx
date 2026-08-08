"use client";

import { CheckCircle2, Circle } from "lucide-react";
import type { EngagementType, HrDocType } from "@/lib/hr/types";

type DocLike = { doc_type: HrDocType | string };

type Props = {
  engagementType: EngagementType | null | undefined;
  documents: DocLike[];
};

type ChecklistItem = {
  key: HrDocType;
  label: string;
};

export function OnboardingChecklist({ engagementType, documents }: Props) {
  if (!engagementType?.requires_contract_doc) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-[13px] text-gray-600">
          No contract documents required for{" "}
          <span className="font-medium text-gray-800">
            {engagementType?.label || "this engagement"}
          </span>
          .
        </p>
      </div>
    );
  }

  const items: ChecklistItem[] = [
    { key: "contract", label: "Contract" },
    { key: "nda", label: "NDA" },
  ];

  if (engagementType.key === "mini_job") {
    items.push({ key: "mini_job_agreement", label: "Mini-job agreement" });
  }

  const present = new Set(documents.map((d) => d.doc_type));
  const done = items.filter((i) => present.has(i.key)).length;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-gray-900">
          Onboarding checklist
        </h3>
        <span className="text-[12px] text-gray-500 tabular-nums">
          {done}/{items.length}
        </span>
      </div>
      <ul className="divide-y divide-gray-50">
        {items.map((item) => {
          const ok = present.has(item.key);
          return (
            <li
              key={item.key}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[13px]"
            >
              {ok ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <Circle size={16} className="text-gray-300 shrink-0" />
              )}
              <span className={ok ? "text-gray-800" : "text-gray-500"}>
                {item.label}
              </span>
              <span
                className={`ml-auto text-[11px] font-medium ${
                  ok ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {ok ? "Uploaded" : "Missing"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
