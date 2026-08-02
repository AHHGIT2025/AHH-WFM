"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function ActivitiesPage() {
  return (
    <MilestonePlaceholder
      title="Activities & Follow-Ups"
      milestone="Milestone CL-1"
      description="Track client follow-up appointments, emails, calls, and internal meeting logs."
      icon="history"
      features={[
        "Client Interaction Logs (Emails, Calls, and Meeting Notes)",
        "Assigned Tasks & Follow-Up Reminders Scheduler",
        "Chronological Activity Feed on Commercial Workspaces",
        "Integration with Outlook & System Notification Channels"
      ]}
    />
  );
}
