"use client";

import React from "react";
import { ClientNavGuard } from "@/components/client/ClientNavGuard";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import {
  ClientEmptyState,
  ClientPortalFrame,
} from "@/components/client/ClientPortalFrame";

export default function ClientFilesPage() {
  return (
    <ClientAccessFlowGate>
      <ClientNavGuard navKey="files" />
      <ClientPortalFrame
        eyebrow="Files"
        title="Brand assets"
        subtitle="Logos, fonts, and campaign files — shared here when ready."
      >
        <ClientEmptyState
          title="Asset library coming soon"
          message="Direct downloads of master logos, type packages, and media kits will appear here. Until then, published guidelines remain the source for brand files."
        />
      </ClientPortalFrame>
    </ClientAccessFlowGate>
  );
}
