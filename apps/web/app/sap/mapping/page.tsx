"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SapMappingPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sap");
  }, [router]);

  return (
    <div className="p-8 text-center text-xs text-on-surface-variant font-mono">
      Redirecting to SAP SuccessFactors Integration Hub mapping console...
    </div>
  );
}
