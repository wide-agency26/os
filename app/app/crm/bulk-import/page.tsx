"use client";

import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Download, Upload, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Papa from "papaparse";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function BulkImportCustomersPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{success: number, errors: string[]}>({ success: 0, errors: [] });

  const handleDownloadTemplate = () => {
    const csvContent = 
      "Status,Source,Source Category,Name,Email,Company,Position,Role,Linkedin,Industry,Start Date,Project Type,Contract Value,Contract Type,Notes,Lead Status,Services/Package,Subscriber Status\n" +
      "Client,John Doe,Referral,Jane Smith,jane@example.com,Acme Corp,CEO,Decision Maker,linkedin.com/in/jane,Tech,2025-01-01,Web Build,50000,One-off,Great prospect,Won,\"SEO, Website Design\",Active";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "CRM_Customers_Import_Template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResults({ success: 0, errors: [] });

    const supabase = createClient();

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (resultsParse) => {
        const rows = resultsParse.data as any[];
        let successCount = 0;
        let errorMessages: string[] = [];

        for (const [index, row] of rows.entries()) {
          try {
            // Validate required fields
            if (!row["Name"]) {
              errorMessages.push(`Row ${index + 2}: Missing required field 'Name'`);
              continue;
            }

            // Clean up services package
            let servicesPackage = [];
            if (row["Services/Package"]) {
              servicesPackage = row["Services/Package"].split(",").map((s: string) => s.trim()).filter(Boolean);
            }

            const payload = {
              name: row["Name"],
              email: row["Email"] || null,
              company: row["Company"] || null,
              position: row["Position"] || null,
              linkedin: row["Linkedin"] || null,
              industry: row["Industry"] || null,
              start_date: row["Start Date"] || null,
              project_type: row["Project Type"] || null,
              contract_value: row["Contract Value"] ? Number(row["Contract Value"]) : null,
              notes: row["Notes"] || null,
              status: row["Status"] || "Prospect",
              source: row["Source"] || null,
              source_category: row["Source Category"] || null,
              role: row["Role"] || null,
              lead_status: row["Lead Status"] || null,
              contract_type: row["Contract Type"] || null,
              subscriber_status: row["Subscriber Status"] || "Active",
              services_package: servicesPackage
            };

            const { error } = await (supabase as any).from("crm_customers").insert([payload]);
            if (error) {
              errorMessages.push(`Row ${index + 2} (${row["Name"]}): ${error.message}`);
            } else {
              successCount++;
            }
          } catch (err: any) {
            errorMessages.push(`Row ${index + 2}: Unexpected error - ${err.message}`);
          }
        }

        setResults({ success: successCount, errors: errorMessages });
        setLoading(false);
      },
      error: (error) => {
        setResults(prev => ({ ...prev, errors: [...prev.errors, "Failed to parse CSV file: " + error.message] }));
        setLoading(false);
      }
    });
  };

  return (
    <Workspace>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <Link href="/app/crm" className="text-gray-400 hover:text-gray-900 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Bulk Import CRM Records</h2>
              <p className="text-sm text-gray-500 mt-1">Upload a CSV file to create multiple prospects, leads, or clients.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Section title="1. Download Template">
            <div className="p-6 border border-gray-200 rounded-lg bg-white col-span-full">
              <p className="text-[13px] text-gray-600 mb-4">Start by downloading our standard CSV template. Fill out your CRM data exactly as formatted in the headers. Ensure Dropdowns (like Status, Role) match exactly.</p>
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
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  setResults({ success: 0, errors: [] }); // Reset results on new file selection
                }}
                className="block w-full text-[13px] text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[13px] file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
              />
              
              <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                <button 
                  disabled={!file || loading}
                  onClick={handleImport}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Upload size={16} />
                  {loading ? "Importing..." : "Start Import"}
                </button>
              </div>
            </div>
          </Section>

          {/* Results Section */}
          {(results.success > 0 || results.errors.length > 0) && (
            <Section title="Import Results">
              <div className="p-6 border border-gray-200 rounded-lg bg-white col-span-full space-y-4">
                {results.success > 0 && (
                  <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-3 rounded text-[13px] font-medium border border-green-200">
                    <CheckCircle2 size={16} />
                    Successfully imported {results.success} record(s).
                  </div>
                )}
                
                {results.errors.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 px-4 py-3 rounded text-[13px] font-medium border border-red-200">
                      <AlertCircle size={16} />
                      Failed to import {results.errors.length} record(s). Check the errors below:
                    </div>
                    <ul className="list-disc list-inside text-[12px] text-red-600 pl-2 max-h-40 overflow-y-auto">
                      {results.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </Workspace>
  );
}
