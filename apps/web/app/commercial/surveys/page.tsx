"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function SiteSurveysPage() {
  return (
    <MilestonePlaceholder
      title="Site Surveys"
      milestone="Milestone CL-2"
      description="Conduct pre-contract physical site audits, log risk conditions, and capture operational needs."
      icon="explore"
      features={[
        "Pre-Contract Site Surveyor Scheduling & Job Dispatch",
        "Survey Form Templates (Security Guarding vs. Facility Management)",
        "Risk Audit Logs, GPS Coordinates, and Image Attachment Evidence",
        "Costing Hand-off Readiness & Technical Approval Workflows"
      ]}
    />
  );
}
