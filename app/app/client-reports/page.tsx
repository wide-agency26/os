"use client";

import React from "react";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { ClientAccessFlowGate } from "@/components/client/ClientAccessFlowGate";
import { BarChart3, Sparkles } from "lucide-react";

export default function ClientReportsPage() {
  return (
    <ClientAccessFlowGate>
      <Workspace>
        <div className="space-y-8 pb-12">
          <div className="border-b border-gray-200 pb-5">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
              <BarChart3 className="w-6 h-6 text-blue-600" />
              Client Performance Reports
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Real-time campaign performance analytics and ROI tracking for your organization.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 shadow-sm max-w-xl mx-auto my-12">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
              <Sparkles className="w-7 h-7 animate-pulse" />
            </div>
            <span className="inline-block px-3 py-1 bg-blue-100/70 text-blue-800 text-[10px] font-bold uppercase tracking-wider rounded-full">
              Feature Roadmap
            </span>
            <h2 className="text-xl font-bold text-gray-900">Performance Reports Coming Soon</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              We are building interactive campaign dashboards and monthly performance metrics for your brand. This feature will be enabled automatically for your account upon release.
            </p>
          </div>
        </div>
      </Workspace>
    </ClientAccessFlowGate>
  );
}
