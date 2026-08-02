"use client";

import React from "react";
import { Card } from "@ahh-wfm/ui";

interface MilestonePlaceholderProps {
  title: string;
  milestone: string;
  description: string;
  features: string[];
  icon: string;
}

export default function MilestonePlaceholder({
  title,
  milestone,
  description,
  features,
  icon
}: MilestonePlaceholderProps) {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
        <span className="material-symbols-outlined text-4xl text-secondary">{icon}</span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#091426]">{title}</h1>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>

      <Card className="p-8 border border-[#c5c6cd] bg-white flex flex-col items-center justify-center text-center py-12">
        <div className="h-16 w-16 rounded-full bg-[#0058be]/10 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-3xl text-[#0058be]">{icon}</span>
        </div>
        <span className="px-3 py-1 text-xs font-extrabold bg-[#091426]/10 text-[#091426] rounded-full mb-3 uppercase tracking-wider">
          Planned for {milestone}
        </span>
        <h2 className="text-xl font-bold text-[#091426] mb-2">Module Under Construction</h2>
        <p className="text-sm text-gray-500 max-w-md mb-6">
          This operational module will be implemented and integrated during the {milestone} consolidation phase.
        </p>

        <div className="w-full max-w-md text-left border-t border-[#c5c6cd] pt-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#091426] mb-4">Planned Key Capabilities</h3>
          <ul className="space-y-3">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-xs text-gray-500">
                <span className="material-symbols-outlined text-[#1E8E3E] text-sm shrink-0">check_circle</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
