"use client";

import React, { useState } from "react";
import { Button, Badge } from "@ahh-wfm/ui/src";
import { AlertTriangle, ShieldAlert, CheckCircle, XCircle } from "lucide-react";

interface CancelResolveModalProps {
  isOpen: boolean;
  mode: "cancel" | "resolve";
  onClose: () => void;
  exception: any; // exception object
  onSuccess: () => void;
  periodLocked: boolean;
}

export const CancelResolveModal: React.FC<CancelResolveModalProps> = ({
  isOpen,
  mode,
  onClose,
  exception,
  onSuccess,
  periodLocked
}) => {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !exception) return null;

  const isCancel = mode === "cancel";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCancel && !reason.trim()) {
      setError("Cancellation reason is required.");
      return;
    }
    if (periodLocked) {
      setError("Period is locked. Action not allowed.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const url = isCancel
      ? `/api/v1/manpower/scheduling/exceptions/${exception.id}/cancel`
      : `/api/v1/manpower/scheduling/exceptions/${exception.id}/resolve`;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isCancel ? { reason: reason.trim() } : {})
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setReason("");
        onSuccess();
        onClose();
      } else {
        setError(json.error || `Failed to ${mode} exception.`);
      }
    } catch (err: any) {
      setError(err.message || `Network error during exception ${mode}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-outline-variant rounded-xl shadow-2xl max-w-md w-full z-10 overflow-hidden flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-outline-variant bg-surface-container-low">
          <div className="flex items-center gap-2">
            {isCancel ? <XCircle className="h-5 w-5 text-destructive" /> : <CheckCircle className="h-5 w-5 text-success" />}
            <h3 className="text-lg font-bold text-foreground">
              {isCancel ? "Cancel Exception" : "Resolve Exception"}
            </h3>
          </div>
          <button onClick={onClose} className="text-secondary hover:text-foreground">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm text-foreground">
          {periodLocked && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <span>This period is locked. Write actions are prohibited.</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-status-error/10 border border-status-error/20 text-status-error rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-background border border-outline p-3 rounded-lg space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-secondary font-medium">Exception Type:</span>
              <Badge variant="warning">{exception.exceptionType}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-secondary font-medium">Status:</span>
              <span className="font-semibold">{exception.status}</span>
            </div>
            <div className="text-xs text-secondary mt-2">
              {exception.message}
            </div>
          </div>

          {isCancel && (
            <div>
              <label className="block text-xs font-semibold text-secondary mb-1">
                Reason for Cancellation <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="State why this exception is being cancelled..."
                className="w-full bg-background border border-outline rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={submitting || periodLocked}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              variant={isCancel ? "error" : "success"}
              type="submit"
              disabled={submitting || periodLocked}
            >
              {submitting ? "Processing..." : isCancel ? "Confirm Cancellation" : "Confirm Resolve"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
