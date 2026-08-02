"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function OpportunitiesPage() {
  return (
    <MilestonePlaceholder
      title="Opportunities"
      milestone="Milestone CL-1"
      description="Track active commercial deals, pipelines, and prospective revenues."
      icon="lightbulb"
      features={[
        "Commercial Deal Stage & Pipeline Kanban Boards",
        "Probability Calibration & Estimated Annual Values",
        "Assigned Account Owner & Sales Assignments",
        "Win/Loss Outcomes & Post-Mortem Analysis"
      ]}
    />
  );
}
