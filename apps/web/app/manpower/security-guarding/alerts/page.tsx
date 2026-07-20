"use client";

import React from "react";
import { SecFacAlertConsole } from "@/components/secfac-alert-console";

export default function SecurityGuardingAlertsPage() {
  return (
    <SecFacAlertConsole
      operationType="SECURITY_GUARDING"
      title="Security Guarding Alerts & Escalations"
      subtitle="Operational exception tracking, supervisor assignment, and escalation hierarchy for Security Guarding"
      icon="security"
    />
  );
}
