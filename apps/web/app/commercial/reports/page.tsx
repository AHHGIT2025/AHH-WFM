"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function ReportsPage() {
  return (
    <MilestonePlaceholder
      title="Reports & Analytics"
      milestone="Milestone CL-6"
      description="Access commercial performance dashboards, margin audits, and win/loss statistics."
      icon="analytics"
      features={[
        "Commercial Deal Pipeline Funnel Visualizer",
        "Margin Heatmaps & Gross Profit Audits",
        "SLA Compliance & Action Speed Trackers",
        "Custom Filtered Excel & PDF Exports Builder"
      ]}
    />
  );
}
