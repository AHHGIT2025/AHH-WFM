"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";

interface ActivityFeedItem {
  id: string;
  feedType: "ACTIVITY" | "TASK" | "WORKFLOW";
  activityType: string;
  title: string;
  description: string | null;
  timestamp: string;
  actorName: string;
  metadata?: any;
}

interface CommercialActivityFeedPanelProps {
  prospectClientId?: string;
  preContractCaseId?: string;
  contractId?: string;
  addendumId?: string;
  renewalCaseId?: string;
  operationType?: string;
  title?: string;
}

export default function CommercialActivityFeedPanel({
  prospectClientId,
  preContractCaseId,
  contractId,
  addendumId,
  renewalCaseId,
  operationType,
  title = "Chronological Activity Feed"
}: CommercialActivityFeedPanelProps) {
  const [feed, setFeed] = useState<ActivityFeedItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("ALL");

  // Log Activity Modal
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logType, setLogType] = useState<string>("NOTE");
  const [subject, setSubject] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [direction, setDirection] = useState<string>("OUTBOUND");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [meetingLocation, setMeetingLocation] = useState<string>("");
  const [externalWebLink, setExternalWebLink] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ feedMode: "true" });
      if (activityTypeFilter !== "ALL") params.set("activityType", activityTypeFilter);
      if (prospectClientId) params.set("prospectClientId", prospectClientId);
      if (preContractCaseId) params.set("preContractCaseId", preContractCaseId);
      if (contractId) params.set("contractId", contractId);
      if (addendumId) params.set("addendumId", addendumId);
      if (renewalCaseId) params.set("renewalCaseId", renewalCaseId);
      if (operationType && operationType !== "ALL") params.set("operationType", operationType);

      const res = await fetch(`/api/v1/commercial/activities?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load activity feed.");
      const data = await res.json();
      setFeed(data.feed || []);
    } catch (e: any) {
      setError(e.message || "Failed to load feed.");
    } finally {
      setLoading(false);
    }
  }, [activityTypeFilter, prospectClientId, preContractCaseId, contractId, addendumId, renewalCaseId, operationType]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/commercial/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityType: logType,
          subject: subject.trim(),
          notes: notes.trim(),
          direction: logType === "CALL" || logType === "EMAIL" ? direction : undefined,
          phoneNumber: logType === "CALL" ? phoneNumber : undefined,
          meetingLocation: logType === "MEETING" ? meetingLocation : undefined,
          externalWebLink: externalWebLink.trim() || undefined,
          externalProvider: externalWebLink.trim() ? "OUTLOOK" : undefined,
          prospectClientId,
          preContractCaseId,
          contractId,
          addendumId,
          renewalCaseId,
          operationType: operationType || "SECURITY_GUARDING"
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to log activity.");
      }

      setSubject("");
      setNotes("");
      setShowLogModal(false);
      fetchFeed();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getActivityBadgeVariant = (type: string) => {
    switch (type) {
      case "EMAIL":
        return "info";
      case "CALL":
        return "secondary";
      case "MEETING":
        return "warning";
      case "NOTE":
        return "neutral";
      default:
        return "default";
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "EMAIL":
        return "mail";
      case "CALL":
        return "call";
      case "MEETING":
        return "groups";
      case "NOTE":
        return "description";
      case "TASK":
        return "task_alt";
      default:
        return "history";
    }
  };

  return (
    <Card className="p-6 bg-surface-container-lowest border border-border-subtle shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-subtle">
        <div>
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            {title}
          </h3>
          <p className="text-xs text-on-surface-variant">
            Track client emails, calls, meetings, notes, and task progress.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={activityTypeFilter}
            onChange={(e) => setActivityTypeFilter(e.target.value)}
            className="text-xs rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-on-surface font-medium"
          >
            <option value="ALL">All Activity Types</option>
            <option value="EMAIL">Emails</option>
            <option value="CALL">Calls</option>
            <option value="MEETING">Meetings</option>
            <option value="NOTE">Notes</option>
          </select>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Log Activity
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <span className="material-symbols-outlined animate-spin text-2xl text-primary">sync</span>
          <p className="mt-2 text-xs font-semibold text-on-surface-variant">Loading activity timeline...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-error-container text-on-error-container rounded-lg text-xs font-medium">
          {error}
        </div>
      ) : feed.length === 0 ? (
        <div className="text-center py-8 bg-surface-container-low rounded-lg border border-dashed border-border-subtle">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant">history_toggle_off</span>
          <p className="mt-2 text-xs font-semibold text-on-surface">No activities logged yet.</p>
          <p className="text-[11px] text-on-surface-variant">Log an email, call, meeting, or note to initiate history.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
          {feed.map((item) => (
            <div key={item.id} className="relative group">
              <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-surface border-2 border-primary flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[12px]">{getActivityIcon(item.activityType)}</span>
              </div>

              <div className="bg-surface p-4 rounded-xl border border-border-subtle hover:border-primary transition-colors">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={getActivityBadgeVariant(item.activityType) as any}>
                      {item.activityType}
                    </Badge>
                    <h4 className="text-sm font-bold text-on-surface">{item.title}</h4>
                  </div>
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>

                {item.description && (
                  <p className="text-xs text-on-surface-variant mb-2 whitespace-pre-wrap">
                    {item.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-border-subtle">
                  <span>Logged by: <strong className="text-on-surface">{item.actorName}</strong></span>
                  {item.metadata?.externalWebLink && (
                    <a
                      href={item.metadata.externalWebLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary font-bold hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                      Outlook Link
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Log Activity Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-6 shadow-xl border border-border-subtle">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_notes</span>
                Log Commercial Activity
              </h3>
              <button onClick={() => setShowLogModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleLogActivity} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-on-surface mb-1 font-bold">Activity Type</label>
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle bg-surface p-2 text-on-surface"
                >
                  <option value="NOTE font-bold">Note / Remark</option>
                  <option value="EMAIL">Email Communication</option>
                  <option value="CALL">Phone Call</option>
                  <option value="MEETING">Client Meeting</option>
                </select>
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-bold">Subject / Title *</label>
                <Input
                  value={subject}
                  onChange={(e: any) => setSubject(e.target.value)}
                  placeholder="e.g. Discussed 1-year contract extension terms"
                  required
                />
              </div>

              {logType === "CALL" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-on-surface mb-1 font-bold">Direction</label>
                    <select
                      value={direction}
                      onChange={(e) => setDirection(e.target.value)}
                      className="w-full rounded-lg border border-border-subtle bg-surface p-2 text-on-surface"
                    >
                      <option value="OUTBOUND font-bold">Outbound Call</option>
                      <option value="INBOUND font-bold">Inbound Call</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-on-surface mb-1 font-bold">Phone Number</label>
                    <Input
                      value={phoneNumber}
                      onChange={(e: any) => setPhoneNumber(e.target.value)}
                      placeholder="+974 4400 0000"
                    />
                  </div>
                </div>
              )}

              {logType === "MEETING" && (
                <div>
                  <label className="block text-on-surface mb-1 font-bold">Location / Online Link</label>
                  <Input
                    value={meetingLocation}
                    onChange={(e: any) => setMeetingLocation(e.target.value)}
                    placeholder="Client HQ / Teams Meeting link"
                  />
                </div>
              )}

              <div>
                <label className="block text-on-surface mb-1 font-bold">Notes / Summary</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border-subtle bg-surface p-2 text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Enter detailed interaction notes or meeting minutes..."
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-bold">Optional Outlook Web Link</label>
                <Input
                  value={externalWebLink}
                  onChange={(e: any) => setExternalWebLink(e.target.value)}
                  placeholder="https://outlook.office365.com/owa/..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button variant="secondary" onClick={() => setShowLogModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submitting || !subject.trim()}>
                  {submitting ? "Saving..." : "Save Activity"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
