"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@ahh-wfm/ui";
import { X, CheckCircle, Clock, AlertTriangle, Shield, History, Ban } from "lucide-react";

interface Publication {
  id: string;
  operationType: string;
  contractId: string;
  siteId?: string | null;
  startDate: string;
  endDate: string;
  publicationVersion: number;
  status: "ACTIVE" | "SUPERSEDED" | "CANCELLED";
  revisionReason?: string | null;
  publishedAt: string;
  publishedBy?: { firstName: string; lastName: string; employeeId?: string };
  cancelledAt?: string | null;
  cancelledBy?: { firstName: string; lastName: string; employeeId?: string };
  cancellationReason?: string | null;
  supersedesPublication?: { id: string; publicationVersion: number } | null;
}

interface RosterPublicationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationType: string;
  contractId: string;
  siteId?: string | null;
  onCancelSuccess?: () => void;
}

export function RosterPublicationHistoryModal({
  isOpen,
  onClose,
  operationType,
  contractId,
  siteId,
  onCancelSuccess
}: RosterPublicationHistoryModalProps) {
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/v1/manpower/scheduling/publications?operationType=${operationType}&contractId=${contractId}${siteId ? `&siteId=${siteId}` : ""}`;
      const res = await fetch(url);
      const json = await res.json();
      if (res.ok && json.success) {
        setPublications(json.publications || []);
      } else {
        setError(json.error || "Failed to load publication history");
      }
    } catch (e: any) {
      setError("Network error fetching publication history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && contractId) {
      fetchHistory();
    }
  }, [isOpen, contractId, siteId, operationType]);

  const handleCancelPublication = async (pubId: string) => {
    if (!cancelReason || cancelReason.trim().length < 5) {
      alert("Please enter a valid cancellation reason (min 5 characters).");
      return;
    }

    try {
      const res = await fetch(`/api/v1/manpower/scheduling/publications/${pubId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancellationReason: cancelReason })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        alert("Publication cancelled successfully.");
        setCancellingId(null);
        setCancelReason("");
        fetchHistory();
        onCancelSuccess?.();
      } else {
        alert(json.error || "Failed to cancel publication.");
      }
    } catch (e: any) {
      alert("Error cancelling publication: " + e.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Publication Version History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Clock className="h-5 w-5 animate-spin mr-2" />
              Loading history...
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {!loading && !error && publications.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No publication records found for this contract.
            </div>
          )}

          {!loading &&
            publications.map((pub) => (
              <div
                key={pub.id}
                className={`p-4 rounded-lg border transition-all ${
                  pub.status === "ACTIVE"
                    ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"
                    : pub.status === "SUPERSEDED"
                    ? "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 opacity-75"
                    : "border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/20"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Version {pub.publicationVersion}
                    </span>

                    {pub.status === "ACTIVE" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                        <CheckCircle className="h-3 w-3" /> ACTIVE
                      </span>
                    )}

                    {pub.status === "SUPERSEDED" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <Clock className="h-3 w-3" /> SUPERSEDED
                      </span>
                    )}

                    {pub.status === "CANCELLED" && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300">
                        <Ban className="h-3 w-3" /> CANCELLED
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-500">
                    Published: {new Date(pub.publishedAt).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <div>
                    <strong className="font-medium text-slate-700 dark:text-slate-300">Period:</strong>{" "}
                    {new Date(pub.startDate).toLocaleDateString()} to {new Date(pub.endDate).toLocaleDateString()}
                  </div>
                  <div>
                    <strong className="font-medium text-slate-700 dark:text-slate-300">Published by:</strong>{" "}
                    {pub.publishedBy ? `${pub.publishedBy.firstName} ${pub.publishedBy.lastName}` : "System"}
                  </div>
                  {pub.revisionReason && (
                    <div>
                      <strong className="font-medium text-slate-700 dark:text-slate-300">Reason:</strong>{" "}
                      {pub.revisionReason}
                    </div>
                  )}
                  {pub.supersedesPublication && (
                    <div className="text-slate-500">
                      Lineage: Supersedes Version {pub.supersedesPublication.publicationVersion}
                    </div>
                  )}
                  {pub.status === "CANCELLED" && (
                    <div className="mt-2 p-2 bg-red-100/60 dark:bg-red-900/40 rounded text-red-800 dark:text-red-300">
                      <strong>Cancelled by:</strong> {pub.cancelledBy ? `${pub.cancelledBy.firstName} ${pub.cancelledBy.lastName}` : "User"}<br />
                      <strong>Reason:</strong> {pub.cancellationReason}
                    </div>
                  )}
                </div>

                {/* Cancel Action for Active Version */}
                {pub.status === "ACTIVE" && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    {cancellingId === pub.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Enter reason for cancelling publication..."
                          className="w-full text-xs p-2 border rounded-md dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-red-500"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="secondary"
                            onClick={() => setCancellingId(null)}
                            className="h-8 text-xs"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="error"
                            onClick={() => handleCancelPublication(pub.id)}
                            className="h-8 text-xs"
                          >
                            Confirm Cancel Publication
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Button
                          variant="secondary"
                          onClick={() => setCancellingId(pub.id)}
                          className="h-8 text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                        >
                          Cancel Publication
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
