'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UkeV2RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Get current week and year
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const year = now.getFullYear();

    // Redirect to current week
    router.replace(`/min/uke-v2/${year}/${weekNumber}`);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-gray-400">Laster...</div>
    </div>
  );
}

