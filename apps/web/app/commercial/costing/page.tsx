"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function CostingPage() {
  return (
    <MilestonePlaceholder
      title="Transactional Costing"
      milestone="Milestone CL-3"
      description="Verify commercial estimates, model margins, and verify rate applications."
      icon="payments"
      features={[
        "Interactive Manpower, Reliever, and Material Cost Calculator",
        "Rate Card Resolutions & Dynamic Formula Evaluations",
        "Margin Calibration & Selling Price Visualizations",
        "Finance Auditing & Cost Structure Approval Workflow"
      ]}
    />
  );
}
