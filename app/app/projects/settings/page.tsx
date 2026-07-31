"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { Save, Settings, ExternalLink, CheckCircle } from "lucide-react";

export default function ProjectSettingsPage() {
  const [projectTypes, setProjectTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    default_completion_method: "Task Completion",
    default_project_type_id: "",
    ignore_weekends: true,
    ignore_employee_time_overlap: false,
  });
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const [
        { data: settings }, 
        { data: ptData },
        { data: integrations }
      ] = await Promise.all([
        (supabase as any).from("erp_project_settings").select("*").limit(1).single(),
        (supabase as any).from("project_types").select("id, name").order("name"),
        (supabase as any).from("admin_integrations").select("provider")
      ]);
      if (settings) {
        setSettingsId(settings.id);
        setFormData({
          default_completion_method: settings.default_completion_method || "Task Completion",
          default_project_type_id: settings.default_project_type_id || "",
          ignore_weekends: settings.ignore_weekends ?? true,
          ignore_employee_time_overlap: settings.ignore_employee_time_overlap ?? false,
        });
      }
      if (integrations) {
        setGoogleConnected(integrations.some((i: any) => i.provider === "google_workspace"));
      }
      setProjectTypes(ptData || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const value = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
    setFormData({ ...formData, [target.name]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const payload = {
      default_completion_method: formData.default_completion_method,
      default_project_type_id: formData.default_project_type_id || null,
      ignore_weekends: formData.ignore_weekends,
      ignore_employee_time_overlap: formData.ignore_employee_time_overlap,
    };
    if (settingsId) {
      const { error } = await (supabase as any).from("erp_project_settings").update(payload).eq("id", settingsId);
      if (error) alert("Error: " + error.message);
      else alert("Settings saved.");
    } else {
      const { data, error } = await (supabase as any).from("erp_project_settings").insert(payload).select().single();
      if (error) alert("Error: " + error.message);
      else { setSettingsId(data.id); alert("Settings saved."); }
    }
    setSaving(false);
  };

  if (loading) return <Workspace><div className="animate-pulse h-40 bg-gray-100 rounded" /></Workspace>;

  return (
    <Workspace>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-600">
          <Settings size={20} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projects Settings</h2>
          <p className="text-gray-500 text-[13px]">Default configuration for all projects.</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <Section title="Defaults">
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">% Complete Method</label>
                <select name="default_completion_method" value={formData.default_completion_method} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="Manual">Manual</option>
                  <option value="Task Completion">Task Completion</option>
                  <option value="Task Progress">Task Progress</option>
                  <option value="Task Weight">Task Weight</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Default Project Type</label>
                <select name="default_project_type_id" value={formData.default_project_type_id} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="">None</option>
                  {projectTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Time Tracking">
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="ignore_weekends" checked={formData.ignore_weekends} onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <div>
                <span className="text-[13px] font-medium text-gray-900">Ignore Weekends</span>
                <p className="text-[12px] text-gray-500">Skip weekends when calculating task start/end dates from templates.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" name="ignore_employee_time_overlap" checked={formData.ignore_employee_time_overlap} onChange={handleChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <div>
                <span className="text-[13px] font-medium text-gray-900">Ignore Employee Time Overlap</span>
                <p className="text-[12px] text-gray-500">Allow overlapping timesheet entries for the same employee.</p>
              </div>
            </label>
          </div>
        </Section>

        <Section title="Integrations">
          <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between shadow-sm">
            <div>
              <h4 className="text-[14px] font-bold text-gray-900 flex items-center gap-2">
                Google Workspace
                {googleConnected && <CheckCircle size={16} className="text-green-500" />}
              </h4>
              <p className="text-[12px] text-gray-500 mt-1 max-w-sm">
                Connect your Google account to view relevant emails, calendar events, and tasks directly inside Project Dashboards.
              </p>
            </div>
            <div>
              {googleConnected ? (
                <button className="px-4 py-2 bg-gray-100 text-gray-700 font-medium text-[13px] rounded hover:bg-gray-200 transition-colors">
                  Manage Connection
                </button>
              ) : (
                <a href="/api/integrations/google/connect" className="px-4 py-2 bg-blue-50 text-blue-600 font-medium text-[13px] rounded hover:bg-blue-100 transition-colors flex items-center gap-2">
                  <ExternalLink size={14} /> Connect Google
                </a>
              )}
            </div>
          </div>
        </Section>

        <div className="flex justify-end mt-6">
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </Workspace>
  );
}
