"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function QuotationsPage() {
  return (
    <MilestonePlaceholder
      title="Quotations"
      milestone="Milestone CL-4"
      description="Build, revise, and verify client proposals and commercial quotes."
      icon="request_quote"
      features={[
        "Client Quotation Document Compiler & Format Setup",
        "Version Logs & Side-by-Side Proposal Revision Comparer",
        "Legal Clause Deviation Warnings & Approvals",
        "Quotation-to-Contract Transition Engine"
      ]}
    />
  );
}
