"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function CrmEnquiriesPage() {
  return (
    <MilestonePlaceholder
      title="CRM & Enquiries"
      milestone="Milestone CL-1"
      description="Manage client prospect profiles and initial incoming service enquiries."
      icon="chat"
      features={[
        "Prospective Client Registration & Duplicate Validation",
        "Enquiry Intake Form & Category Allocation",
        "Assigned Owner & Response SLA Trackers",
        "Conversion to Opportunity Workflow"
      ]}
    />
  );
}
