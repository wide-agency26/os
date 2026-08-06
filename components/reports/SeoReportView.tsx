"use client";

import { useMemo } from "react";
import { SeoGscDashboard } from "@/components/reports/SeoGscDashboard";
import {
  type LoadedDataset,
  pickGscPayloads,
  buildFilteredGscBundle,
} from "@/lib/reports/aggregation";
import type { DatasetMeta } from "@/lib/reports/gsc";

interface SeoReportViewProps {
  datasets: LoadedDataset[];
  datasetMeta?: DatasetMeta;
  isAdmin?: boolean;
}

export function SeoReportView({ datasets, datasetMeta, isAdmin }: SeoReportViewProps) {
  const bundle = useMemo(
    () =>
      buildFilteredGscBundle(datasets, {
        mode: "all",
        months: [],
        customStart: "",
        customEnd: "",
      }),
    [datasets]
  );

  const meta = useMemo<DatasetMeta | undefined>(() => {
    if (datasetMeta?.name) return datasetMeta;
    const payloads = pickGscPayloads(datasets);
    if (!payloads.length) return undefined;
    return {
      name:
        payloads.length > 1
          ? payloads.map((p) => p.name).join(" / ")
          : payloads[0].name,
      createdAt: datasets.find((d) => d.name === payloads[0].name)?.createdAt,
      rowCount: payloads.reduce((s, p) => s + p.rows.length, 0),
    };
  }, [datasets, datasetMeta]);

  return <SeoGscDashboard bundle={bundle} datasetMeta={meta} isAdmin={isAdmin} />;
}
