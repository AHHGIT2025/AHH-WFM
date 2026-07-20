"use client";

import React from "react";
import { SecFacAlertConsole } from "@/components/secfac-alert-console";

export default function FacilityManagementAlertsPage() {
  return (
    <SecFacAlertConsole
      operationType="FACILITY_MANAGEMENT"
      title="Facility Management Alerts & Escalations"
      subtitle="Operational exception tracking, supervisor assignment, and escalation hierarchy for Facility Management"
      icon="business"
    />
  );
}
