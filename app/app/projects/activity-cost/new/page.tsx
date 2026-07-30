"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Workspace, Section } from "@/components/frappe-ui/Workspace";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

export default function NewActivityCostPage() {
  const router = useRouter();
  const [people, setPeople] = useState<any[]>([]);
  const [activityTypes, setActivityTypes] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    person_id: "",
    activity_type_id: "",
    costing_rate: "",
    billing_rate: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: pData } = await (supabase as any).from("people").select("id, full_name").order("full_name");
      setPeople(pData || []);
      const { data: atData } = await (supabase as any).from("activity_types").select("id, name").order("name");
      setActivityTypes(atData || []);
    }
    fetchData();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.person_id || !formData.activity_type_id) { alert("Please select an employee and activity type."); return; }
    setLoading(true);
    const supabase = createClient();
    const { error } = await (supabase as any).from("erp_activity_costs").insert({
      person_id: formData.person_id,
      activity_type_id: formData.activity_type_id,
      costing_rate: parseFloat(formData.costing_rate) || 0,
      billing_rate: parseFloat(formData.billing_rate) || 0,
    });
    if (error) alert("Error: " + error.message);
    else router.push("/app/projects/activity-cost");
    setLoading(false);
  };

  return (
    <Workspace>
      <div className="flex items-center gap-4 mb-6">
        <Link href="/app/projects/activity-cost" className="p-2 hover:bg-gray-100 rounded transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </Link>
        <h2 className="text-2xl font-bold text-gray-900">New Activity Cost</h2>
      </div>

      <div className="max-w-2xl">
        <Section title="Activity Cost Details">
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Employee <span className="text-red-500">*</span></label>
                <select name="person_id" value={formData.person_id} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="">Select Employee</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Activity Type <span className="text-red-500">*</span></label>
                <select name="activity_type_id" value={formData.activity_type_id} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="">Select Activity Type</option>
                  {activityTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Costing Rate</label>
                <input type="number" step="0.01" name="costing_rate" value={formData.costing_rate} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">Billing Rate</label>
                <input type="number" step="0.01" name="billing_rate" value={formData.billing_rate} onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="0.00" />
              </div>
            </div>
          </div>
        </Section>

        <div className="flex justify-end gap-3 mt-6">
          <Link href="/app/projects/activity-cost" className="px-4 py-2 bg-white border border-gray-300 rounded text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors">Cancel</Link>
          <button onClick={handleSave} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-[13px] font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50">
            <Save size={16} /> {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Workspace>
  );
}
