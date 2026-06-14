"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SapMappingPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sap?tab=mappings");
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
      Redirecting to ERP Field Mapping console...
    </div>
  );
}
