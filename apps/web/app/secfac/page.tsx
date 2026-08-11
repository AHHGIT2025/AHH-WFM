"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { SecfacPageGuard } from "@/components/secfac-guard";

export default function SecfacLandingPage() {
  const { data: session } = useSession();

  const secfacModules = [
    { title: "Control Room", path: "/secfac/control-room", icon: "dashboard", desc: "Live com feeds, real-time NFC scan log alerts, dispatcher response console." },
    { title: "Checkpoints Registry", path: "/secfac/checkpoints", icon: "location_on", desc: "Register physical NFC tags and bind location coordinates." },
    { title: "Checklist Builder", path: "/secfac/checklist-builder", icon: "rule", desc: "Design inspection forms and guard tour compliance rules." },
    { title: "Post Orders", path: "/secfac/post-orders", icon: "assignment_late", desc: "Manage digital security post orders, version lineage, and guard acknowledgements." },
    { title: "Shift Briefings", path: "/secfac/shift-briefings", icon: "groups", desc: "Manage pre-shift briefing notes, participant attendance, and carried incidents." },
    { title: "Incident Review", path: "/secfac/incidents", icon: "warning", desc: "Review occurrences, security incidents, evidence, and workflow closure." },
    { title: "Supervisor Inspections", path: "/secfac/supervisor-inspections", icon: "fact_check", desc: "Audit supervisor field inspections, compliance scores, and corrective actions." },
    { title: "Live Tour Monitoring", path: "/secfac/live-monitoring", icon: "visibility", desc: "Track guard timeline completions and coordinates on map." },
    { title: "SOS Alerts Center", path: "/secfac/sos-alerts", icon: "emergency", desc: "High-intensity center for reviewing mobile panic calls." },
    { title: "Compliance Reports", path: "/secfac/reports", icon: "description", desc: "Verify inspection compliance statistics and scan completion rates." },
    { title: "Audit Trail", path: "/secfac/audit-trail", icon: "history", desc: "Trace dispatcher session modifications and checklist logs." }
  ];


  return (
    <SecfacPageGuard>
      <div className="flex-1 bg-[#F9F9FF] p-8 font-['IBM_Plex_Sans',_sans-serif] min-h-[85vh]">
        <div className="max-w-5xl mx-auto mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-[#001A48] mb-2 tracking-tight">
            SECFAC Command Center
          </h1>
          <p className="text-sm text-[#444651] max-w-xl mx-auto">
            Unified administration suite for Security Guarding rounds, NFC checkin validations, and Facility Management inspections.
          </p>
        </div>

        {/* Grid of Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-10">
          {secfacModules.map((mod) => (
            <Link 
              key={mod.path}
              href={mod.path}
              className="bg-white border border-[#C4C6D2] hover:border-[#002D72]/40 rounded-lg p-6 shadow-sm hover:shadow transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded bg-[#DAE2FF] flex items-center justify-center text-[#002D72] mb-4">
                  <span className="material-symbols-outlined text-2xl">{mod.icon}</span>
                </div>
                <h3 className="text-sm font-bold text-[#001A48] mb-1">{mod.title}</h3>
                <p className="text-xs text-[#747782] leading-relaxed mb-4">{mod.desc}</p>
              </div>
              <span className="text-[10px] font-bold text-[#002D72] flex items-center gap-1 hover:underline">
                OPEN MODULE <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="bg-[#E7EEFF] border border-[#B1C5FF] text-[#002D72] p-4 rounded-lg max-w-5xl mx-auto flex items-center gap-3">
          <span className="material-symbols-outlined text-[#002D72]">info</span>
          <span className="text-xs font-bold font-mono">
            Foundation placeholder — no operational records created yet
          </span>
        </div>
      </div>
    </SecfacPageGuard>
  );
}
