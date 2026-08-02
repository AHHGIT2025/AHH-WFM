"use client";

import React from "react";
import MilestonePlaceholder from "../components/MilestonePlaceholder";

export default function HandoverPage() {
  return (
    <MilestonePlaceholder
      title="Commercial-to-Operations Handover"
      milestone="Milestone CL-6"
      description="Transition approved contract requirements into active deployment operations."
      icon="assignment_turned_in"
      features={[
        "Mobilisation Progress Checklists & Team Tasks Assignment",
        "Operations Readiness & Resource Allocation Verification",
        "Equipment and Uniform Allocation Checklists",
        "Client Handover Acceptance Sign-off Logs"
      ]}
    />
  );
}
