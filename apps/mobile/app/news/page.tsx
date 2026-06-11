"use client";

import React, { useState, useEffect } from "react";
import { Announcement } from "@ahh-wfm/types";
import { Card, Badge } from "@ahh-wfm/ui/src";

export default function MobileNewsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const fetchNews = async () => {
    try {
      const res = await fetch("/api/db");
      if (res.ok) {
        const json = await res.json();
        setAnnouncements(json.announcements);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-primary">Company Announcements</h2>
        <p className="text-xs text-on-surface-variant">Stay updated with the latest news, notices, and updates from HR and IT</p>
      </div>

      <div className="space-y-4">
        {announcements.map((news) => (
          <Card key={news.id} className="p-4 border border-outline-variant relative overflow-hidden flex flex-col gap-2">
            {/* Visual category border */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
              news.category === "Urgent" ? "bg-status-error" :
              news.category === "System Update" ? "bg-status-pending" : "bg-primary"
            }`} />
            
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                {news.author} · {new Date(news.timestamp).toLocaleDateString()}
              </span>
              <Badge variant={news.category === "Urgent" ? "error" : news.category === "System Update" ? "pending" : "neutral"}>
                {news.category}
              </Badge>
            </div>
            
            <h3 className="text-xs font-bold text-primary">{news.title}</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed font-medium">
              {news.content}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
