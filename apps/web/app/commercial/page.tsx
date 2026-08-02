"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CommercialRootPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/commercial/dashboard");
  }, [router]);

  return null;
}
