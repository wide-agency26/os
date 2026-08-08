"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Workspace } from "@/components/frappe-ui/Workspace";
import { isFounder } from "@/lib/rbac";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Trash2, 
  UserPlus, 
  Building2, 
  Loader2,
  Clock,
  ShieldCheck,
  Search
} from "lucide-react";

interface PendingRequest {
  id: string;
  user_id: string;
  company_id: string;
  status: string;
  source: string;
  requested_at: string;
  user_email?: string;
  user_name?: string;
  company_name?: string;
}

interface ActiveMember {
  id: string;
  user_id: string;
  company_id: string;
  status: string;
  source: string;
  requested_at: string;
  user_email?: string;
  user_name?: string;
  company_name?: string;
}

export default function ClientAccessPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; email: string; full_name: string }[]>([]);
  
  // Direct Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [adding, setAdding] = useState(false);

  const supabase = createClient();

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || !isFounder(profile.role)) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);

      const { data: crmData } = await (supabase as any)
        .from("crm_customers")
        .select("id, company, name")
        .eq("record_kind", "company")
        .order("company");

      const compList: { id: string; name: string }[] = [];
      if (crmData) {
        crmData.forEach((c: any) => {
          const name = c.company || c.name || "Untitled Org";
          compList.push({ id: c.id, name });
        });
      }
      setCompanies(compList);
      const compMap = new Map(compList.map((c) => [c.id, c.name]));

      // Fetch all user profiles
      const { data: profData } = await (supabase as any)
        .from("profiles")
        .select("id, email, full_name, role");

      const userMap = new Map<string, { email: string; full_name: string }>();
      const userList: { id: string; email: string; full_name: string }[] = [];
      if (profData) {
        profData.forEach((p: any) => {
          userMap.set(p.id, { email: p.email || p.id, full_name: p.full_name || "Client User" });
          userList.push({ id: p.id, email: p.email || p.id, full_name: p.full_name || "Client User" });
        });
      }
      setAllUsers(userList);

      // Fetch company_members
      const { data: membersData, error: memErr } = await (supabase as any)
        .from("company_members")
        .select("*")
        .order("requested_at", { ascending: false });

      if (memErr) {
        console.error("Error fetching company members:", memErr);
      } else if (membersData) {
        const pending: PendingRequest[] = [];
        const active: ActiveMember[] = [];

        membersData.forEach((m: any) => {
          const uInfo = userMap.get(m.user_id) || { email: m.user_id, full_name: "Client User" };
          const cName = compMap.get(m.company_id) || "Unknown Company";

          const item = {
            id: m.id,
            user_id: m.user_id,
            company_id: m.company_id,
            status: m.status,
            source: m.source,
            requested_at: m.requested_at,
            user_email: uInfo.email,
            user_name: uInfo.full_name,
            company_name: cName
          };

          if (m.status === "pending") {
            pending.push(item);
          } else if (m.status === "active") {
            active.push(item);
          }
        });

        setPendingRequests(pending);
        setActiveMembers(active);
      }
    } catch (e) {
      console.error("Error in loadData:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApprove = async (requestId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fetch request details to get user_id & company_id
    const { data: req } = await (supabase as any)
      .from("company_members")
      .select("user_id, company_id")
      .eq("id", requestId)
      .single();

    await (supabase as any)
      .from("company_members")
      .update({
        status: "active",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);

    if (req?.company_id && req?.user_id) {
      const { data: cData } = await (supabase as any)
        .from("crm_customers")
        .select("company, name")
        .eq("id", req.company_id)
        .single();

      if (cData) {
        const cName = cData.company || cData.name || "Client Org";
        await supabase
          .from("profiles")
          .update({ company_name: cName })
          .eq("id", req.user_id);
      }
    }

    loadData();
  };

  const handleReject = async (requestId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await (supabase as any)
      .from("company_members")
      .update({
        status: "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      })
      .eq("id", requestId);

    loadData();
  };

  const handleRevoke = async (memberId: string) => {
    if (!confirm("Are you sure you want to revoke access for this client?")) return;
    await (supabase as any)
      .from("company_members")
      .delete()
      .eq("id", memberId);

    loadData();
  };

  const handleDirectAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !selectedCompanyId) return;

    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error: insertErr } = await (supabase as any)
      .from("company_members")
      .upsert({
        user_id: selectedUserId,
        company_id: selectedCompanyId,
        status: "active",
        source: "admin_added",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString()
      }, { onConflict: "user_id, company_id" });

    if (insertErr) {
      alert(`Failed to grant access: ${insertErr.message}`);
    } else {
      const { data: cData } = await (supabase as any)
        .from("crm_customers")
        .select("company, name")
        .eq("id", selectedCompanyId)
        .single();

      if (cData) {
        const cName = cData.company || cData.name || "Client Org";
        await supabase
          .from("profiles")
          .update({ company_name: cName })
          .eq("id", selectedUserId);
      }

      setShowAddModal(false);
      setSelectedUserId("");
      setSelectedCompanyId("");
      loadData();
    }
    setAdding(false);
  };

  if (loading) {
    return (
      <Workspace>
        <div className="flex items-center justify-center h-[calc(100vh-120px)]">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </Workspace>
    );
  }

  if (!isAdmin) {
    return (
      <Workspace>
        <div className="p-8 text-center text-red-500 font-medium">
          Access Denied. Only founders and admins can manage client access.
        </div>
      </Workspace>
    );
  }

  return (
    <Workspace>
      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              Client Company Access Management
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Review pending client registration requests and manage company-scoped brand guideline access.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Direct Add Client Access</span>
          </button>
        </div>

        {/* 1. Pending Access Requests */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 bg-amber-50/50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Pending Review Requests ({pendingRequests.length})</span>
            </div>
            {pendingRequests.length > 0 && (
              <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">
                Action Required
              </span>
            )}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No pending client access requests at this time.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {pendingRequests.map((req) => (
                <div key={req.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-gray-900">{req.user_name}</span>
                      <span className="text-xs text-gray-400">({req.user_email})</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {req.company_name}
                      </span>
                      <span>•</span>
                      <span>Requested {new Date(req.requested_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span className="capitalize px-2 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600 font-medium">
                        {req.source.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Access</span>
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-red-600 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Active Approved Memberships */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Active Approved Client Members ({activeMembers.length})</span>
            </div>
          </div>

          {activeMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No active client company memberships found.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {activeMembers.map((mem) => (
                <div key={mem.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-gray-900">{mem.user_name}</span>
                      <span className="text-xs text-gray-400">({mem.user_email})</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-wider">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 font-medium text-gray-700">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        {mem.company_name}
                      </span>
                      <span>•</span>
                      <span className="capitalize text-gray-500 text-[11px]">
                        Granted via {mem.source.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevoke(mem.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Revoke Access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Direct Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Directly Assign Client Access</h3>
            <p className="text-xs text-gray-500">
              Select a client user and company to grant instant access without self-service request approval.
            </p>

            <form onSubmit={handleDirectAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">User Account</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select User...</option>
                  {allUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Organization (Company)</label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select Company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !selectedUserId || !selectedCompanyId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  {adding ? "Granting Access..." : "Grant Access"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Workspace>
  );
}
