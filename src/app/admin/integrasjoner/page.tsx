"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function IntegrationsPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to Tripletex integration page
    router.replace("/admin/integrasjoner/tripletex");
  }, [router]);
  
  return null;
}

