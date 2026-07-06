"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ReportsAuditRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/audit");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="text-center">
        <span className="material-symbols-outlined animate-spin text-5xl text-primary font-bold">sync</span>
        <p className="mt-2 text-xs font-bold text-on-surface-variant">Redirecting to Settings → User Action Audits...</p>
      </div>
    </div>
  );
}
