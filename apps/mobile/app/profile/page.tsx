"use client";

import React, { useState, useEffect } from "react";
import { Employee } from "@ahh-wfm/types";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export default function MobileProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const employeeId = "AA-1001";

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/v1/employees/${employeeId}`);
      if (res.ok) {
        const json = await res.json();
        setEmployee(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (!employee) {
    return <p className="text-xs text-on-surface-variant italic p-4 text-center">Loading profile...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="flex flex-col items-center text-center p-6 border border-outline-variant">
        <div className="w-20 h-20 rounded-full bg-primary-fixed flex items-center justify-center overflow-hidden border-2 border-primary/10 mb-4">
          <img
            alt={employee.name}
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBI8AYNQCuyz0kweSJSi7Y8gdzGADFnb0MEDP2qMp-OrNoV1hiCPa_QWDrDVFGtuI2RtnZsyx_cEOjbGdHP6Alde0Prd16qZLmfzZVmUK0ZodsQRiV_PbbPoIpP-npUgqEv_fdc0si7mYvAed0MgEhkY1-v0-k2hd18qvFspNuJDP9p1DQEtUes9llqyGSQo-zZeC2QHndBpvirj-HBM7hZu7k5ahS_yTFSZw-KhSIcDM8d2g6O9M7WhfMMoiNY-IaJX34D3KZ14AI"
          />
        </div>
        <h2 className="text-sm font-bold text-primary">{employee.name}</h2>
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-0.5">{employee.role}</p>
        <Badge variant={employee.status === "On Duty" ? "success" : "neutral"} className="mt-3">
          {employee.status}
        </Badge>
      </Card>

      {/* Details Card */}
      <Card className="p-4 border border-outline-variant space-y-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2">Employee Information</h3>
        <div className="space-y-3.5 text-xs text-primary font-semibold">
          <div className="flex justify-between">
            <span className="text-on-surface-variant opacity-60 font-medium">Employee ID</span>
            <span className="font-mono text-xs font-bold">{employee.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant opacity-60 font-medium">Department</span>
            <span>{employee.department}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant opacity-60 font-medium">Email</span>
            <span className="font-medium text-right break-all max-w-[200px]">{employee.email}</span>
          </div>
          {employee.phone && (
            <div className="flex justify-between">
              <span className="text-on-surface-variant opacity-60 font-medium">Phone</span>
              <span className="font-medium">{employee.phone}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Actions Card */}
      <Card className="p-4 border border-outline-variant space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2">Roster &amp; Schedules</h3>
        <Button 
          variant="secondary" 
          className="w-full font-bold text-xs py-2 flex items-center justify-center gap-1.5"
          onClick={() => window.location.href = "/shifts"}
        >
          <span className="material-symbols-outlined text-base">calendar_month</span> View Work Shift Calendar
        </Button>
      </Card>

      {/* Certifications Card */}
      <Card className="p-4 border border-outline-variant space-y-3.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-subtle pb-2">Credentials &amp; Certs</h3>
        <div className="space-y-3 divide-y divide-border-subtle/50 text-xs">
          <div className="flex justify-between items-center py-2 first:pt-0">
            <div>
              <p className="font-bold text-primary">Heavy Vehicle License</p>
              <p className="text-[9px] text-on-surface-variant font-medium">Exp: 12 Dec 2028</p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
          <div className="flex justify-between items-center py-2">
            <div>
              <p className="font-bold text-primary">Safety Field Supervisor Cert</p>
              <p className="text-[9px] text-on-surface-variant font-medium">Exp: 04 Mar 2027</p>
            </div>
            <Badge variant="success">Active</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
