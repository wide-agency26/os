"use client";

import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Download, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);

  const handleDownloadTemplate = () => {
    // Basic CSV Template for Projects
    const csvContent = "Project Name,Customer (Email or ID),Status,Priority,Department,Expected Start Date (YYYY-MM-DD),Expected End Date (YYYY-MM-DD),Estimated Cost,Scope\n" +
                       "Website Redesign,client@example.com,running,High,IT,2025-01-01,2025-06-01,5000,Redesigning the corporate website";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "Project_Import_Template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/projects/project" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bulk Import Projects</h2>
              <p className="text-sm text-gray-500 mt-1">Upload a CSV file to create multiple projects at once.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Section title="1. Download Template">
            <div className="p-6 border border-gray-200 rounded-lg bg-white col-span-full">
              <p className="text-[13px] text-gray-600 mb-4">Start by downloading our standard CSV template. Fill out your project data exactly as formatted in the headers.</p>
              <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[13px] font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
                <Download size={16} />
                Download CSV Template
              </button>
            </div>
          </Section>

          <Section title="2. Upload Data">
            <div className="p-6 border border-gray-200 rounded-lg bg-white col-span-full">
              <label className="block text-[12px] font-medium text-gray-700 mb-2">Select CSV File</label>
              <input 
                type="file" 
                accept=".csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-[13px] text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[13px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
              />
              
              <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                <button 
                  disabled={!file}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Upload size={16} />
                  Start Import
                </button>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </Workspace>
  );
}
