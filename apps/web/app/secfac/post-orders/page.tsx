"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SecfacPageGuard } from "@/components/secfac-guard";

export default function PostOrdersPage() {
  const { data: session } = useSession();
  const [postOrders, setPostOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState("GENERAL_POST_ORDER");
  const [familyId, setFamilyId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchPostOrders();
  }, []);

  async function fetchPostOrders() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/secfac/post-orders");
      const json = await res.json();
      if (json.success) {
        setPostOrders(json.data || []);
      } else {
        setError(json.error || "Failed to load Post Orders");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to fetch Post Orders");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreatePostOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !content || !siteId) return;

    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/post-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title,
          content,
          siteId,
          category,
          familyId: familyId || undefined
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowCreateModal(false);
        setTitle("");
        setContent("");
        setSiteId("");
        setFamilyId("");
        fetchPostOrders();
      } else {
        alert(json.error || "Failed to create Post Order");
      }
    } catch (e: any) {
      alert(e?.message || "Error creating Post Order");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePublish(id: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/post-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", id })
      });
      const json = await res.json();
      if (json.success) {
        fetchPostOrders();
      } else {
        alert(json.error || "Failed to publish Post Order");
      }
    } catch (e: any) {
      alert(e?.message || "Error publishing Post Order");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRetire(id: string) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/secfac/post-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retire", id })
      });
      const json = await res.json();
      if (json.success) {
        fetchPostOrders();
      } else {
        alert(json.error || "Failed to retire Post Order");
      }
    } catch (e: any) {
      alert(e?.message || "Error retiring Post Order");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <SecfacPageGuard>
      <div className="flex-1 bg-[#F9F9FF] p-8 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-[#E7EEFF] pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-[#002D72] text-3xl">assignment_late</span>
              <h1 className="text-2xl font-bold text-[#001A48] tracking-tight">Digital Security Post Orders</h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wide bg-[#002D72] text-white uppercase">
                Version Lineage Active
              </span>
            </div>
            <p className="text-sm text-[#444651] max-w-xl">
              Publish instruction procedures per site/post family with atomic superseding and guard digital acknowledgements.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#002D72] hover:bg-[#001A48] text-white text-xs font-bold rounded-lg shadow transition flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">post_add</span>
            CREATE POST ORDER DRAFT
          </button>
        </div>

        {error && (
          <div className="bg-[#FFDAD6] border border-[#BA1A1A] text-[#410002] p-4 rounded-lg mb-6 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined">error</span>
            {error}
          </div>
        )}

        {/* Post Orders List */}
        <div className="bg-white border border-[#C4C6D2] rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-bold text-[#001A48] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#002D72]">menu_book</span>
            Post Orders Master Directory ({postOrders.length})
          </h2>

          {loading ? (
            <div className="p-8 text-center text-xs font-bold text-[#747782]">
              <span className="material-symbols-outlined animate-spin text-3xl text-[#002D72] mb-2">sync</span>
              <p>Loading post orders...</p>
            </div>
          ) : postOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#747782] bg-[#F9F9FF] border border-dashed border-[#C4C6D2] rounded-lg">
              No Post Orders registered yet. Click "CREATE POST ORDER DRAFT" to define site procedures.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E7EEFF] bg-[#F9F9FF] text-[#002D72] font-bold">
                    <th className="py-3 px-3">Family & Code</th>
                    <th className="py-3 px-3">Title & Category</th>
                    <th className="py-3 px-3">Version</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Acknowledgements</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {postOrders.map((order) => (
                    <tr key={order.id} className="border-b border-[#F0F4FF] hover:bg-[#F0F4FF]/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-[#001A48]">
                        <div>{order.postOrderCode || order.id.slice(0, 10)}</div>
                        <div className="text-[10px] text-[#747782]">Fam: {order.familyId}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#001A48]">{order.title}</div>
                        <div className="text-[10px] text-[#747782]">{order.category}</div>
                      </td>
                      <td className="py-3 px-3 font-bold font-mono">v{order.version}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${order.status === "PUBLISHED" ? "bg-[#006E1C] text-white" : order.status === "SUPERSEDED" ? "bg-[#E2E2E9] text-[#747782]" : order.status === "RETIRED" ? "bg-[#FFDAD6] text-[#410002]" : "bg-[#DAE2FF] text-[#002D72]"}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold font-mono text-[#002D72]">
                        {order.acknowledgements?.length || 0} Guard(s)
                      </td>
                      <td className="py-3 px-3 flex items-center gap-2">
                        {order.status === "DRAFT" && (
                          <button
                            disabled={actionLoading}
                            onClick={() => handlePublish(order.id)}
                            className="px-2.5 py-1 bg-[#006E1C] text-white rounded text-[10px] font-bold hover:bg-[#005313]"
                          >
                            PUBLISH
                          </button>
                        )}
                        {order.status === "PUBLISHED" && (
                          <button
                            disabled={actionLoading}
                            onClick={() => handleRetire(order.id)}
                            className="px-2.5 py-1 bg-[#BA1A1A] text-white rounded text-[10px] font-bold hover:bg-[#93000A]"
                          >
                            RETIRE
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl">
              <h2 className="text-lg font-bold text-[#001A48] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#002D72]">post_add</span>
                Create Post Order Draft
              </h2>
              <form onSubmit={handleCreatePostOrder} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Site ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter Site ID (e.g. SITE01)"
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Family ID (Optional - for new version of existing procedure)</label>
                  <input
                    type="text"
                    placeholder="Leave blank for new procedure family"
                    value={familyId}
                    onChange={(e) => setFamilyId(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Title</label>
                  <input
                    type="text"
                    required
                    placeholder="Procedure title (e.g. Main Gate Access Procedure)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                  />
                </div>
                <div>
                  <label className="font-bold text-[#001A48] block mb-1">Post Order Content / Directives</label>
                  <textarea
                    required
                    placeholder="Full instructions and standing post orders..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full p-2 border border-[#C4C6D2] rounded"
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-[#E2E2E9] text-[#444651] font-bold rounded"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#002D72] text-white font-bold rounded"
                  >
                    SAVE DRAFT
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </SecfacPageGuard>
  );
}
