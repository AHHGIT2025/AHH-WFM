"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { enqueueOfflineItem, generateUuid } from "@/lib/secfac-secure-offline-storage";


export default function MobilePostOrdersPage() {
  const { data: session } = useSession();
  const [postOrders, setPostOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteId, setSiteId] = useState("SITE01");
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchActivePostOrders();
  }, [siteId]);

  async function fetchActivePostOrders() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/secfac/post-orders?guardMode=true&siteId=${siteId}`);
      const json = await res.json();
      if (json.success) {
        setPostOrders(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(postOrderId: string) {
    setActionLoading(true);
    setStatusMessage(null);
    const idempotencyKey = `MOB-ACK-${generateUuid()}`;

    const payload = {
      postOrderId,
      acknowledgementMethod: "MOBILE_APP",
      idempotencyKey
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        enqueueOfflineItem("POST_ORDER_ACK", payload);
        setStatusMessage("Offline mode: Acknowledgement queued for sync.");
        setActionLoading(false);
        return;
      }

      const res = await fetch("/api/v1/secfac/post-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acknowledge",
          ...payload
        })
      });
      const json = await res.json();

      if (json.success) {
        setStatusMessage("Post Order acknowledged successfully!");
        fetchActivePostOrders();
      } else {
        enqueueOfflineItem("POST_ORDER_ACK", payload);
        setStatusMessage("Network issue. Saved acknowledgement to offline queue.");
      }
    } catch {
      enqueueOfflineItem("POST_ORDER_ACK", payload);
      setStatusMessage("Saved acknowledgement to offline queue.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-4">
        <Link href="/" className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center text-on-surface">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </Link>
        <div>
          <h2 className="text-lg font-bold text-on-surface">Digital Post Orders</h2>
          <p className="text-[10px] text-on-surface-variant font-mono uppercase">
            Guard Standing Orders & Acknowledgements
          </p>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-on-surface-variant uppercase mb-1">Active Duty Site ID</label>
        <input
          type="text"
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-2.5 text-xs font-bold"
        />
      </div>

      {statusMessage && (
        <div className="p-3 bg-primary-container text-on-primary-container rounded-xl text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">info</span>
          {statusMessage}
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-on-surface uppercase font-mono tracking-wide text-primary">
          Site Post Orders ({postOrders.length})
        </h3>

        {loading ? (
          <div className="p-8 text-center text-xs font-bold text-on-surface-variant">
            <span className="material-symbols-outlined animate-spin text-2xl text-primary mb-1">sync</span>
            <p>Loading post orders...</p>
          </div>
        ) : postOrders.length === 0 ? (
          <div className="p-6 bg-surface border border-outline-variant/30 rounded-2xl text-center text-xs text-on-surface-variant">
            No published post orders found for site '{siteId}'.
          </div>
        ) : (
          postOrders.map((order) => (
            <div key={order.id} className="bg-surface border border-[#C4C6D2] rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-primary-container text-on-primary-container">
                  v{order.version} • {order.category}
                </span>
                {order.isAcknowledged ? (
                  <span className="text-[10px] font-bold text-[#006E1C] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    ACKNOWLEDGED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-[#A83800]">PENDING ACK</span>
                )}
              </div>

              <h4 className="text-sm font-bold text-on-surface">{order.title}</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">{order.content}</p>

              {!order.isAcknowledged && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleAcknowledge(order.id)}
                  className="w-full py-2.5 bg-primary text-on-primary font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow"
                >
                  <span className="material-symbols-outlined text-sm">draw</span>
                  DIGITALLY ACKNOWLEDGE
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
