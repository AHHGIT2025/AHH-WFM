"use client";

import React, { useEffect, useState } from "react";

export default function NewsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/announcements")
      .then(res => res.json())
      .then(d => {
        setAnnouncements(d.announcements || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-primary">Notice Board</h2>
        <p className="text-[11px] text-on-surface-variant">Company and Project announcements</p>
      </div>

      <div className="space-y-3">
        {announcements.map(a => (
          <div key={a.id} className={`bg-surface border rounded-xl p-4 shadow-sm relative overflow-hidden ${a.urgent ? 'border-status-error/30' : 'border-outline-variant/30'}`}>
            {a.urgent && (
              <div className="absolute top-0 right-0 bg-status-error text-white text-[8px] font-bold px-2 py-0.5 rounded-bl-lg">
                URGENT
              </div>
            )}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                a.category === 'Holiday' ? 'bg-[#b89d7e]/20 text-[#715a40]' : 
                a.category === 'Policy' ? 'bg-primary/10 text-primary' : 
                'bg-slate-100 text-slate-600'
              }`}>
                {a.category}
              </span>
              <span className="text-[10px] text-on-surface-variant">{a.date}</span>
            </div>
            <h3 className={`text-sm font-bold ${a.urgent ? 'text-status-error' : 'text-on-surface'}`}>{a.title}</h3>
            <p className="text-[11px] text-on-surface-variant mt-1">Please read the full memo on the desktop portal for details.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
