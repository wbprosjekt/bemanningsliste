"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
}

export default function Logo({ 
  className = "", 
  size = 48, 
  showText = true, 
  textClassName = "" 
}: LogoProps) {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Fallback during SSR
    return (
      <div className={`flex items-center space-x-3 ${className}`}>
        <div 
          className="rounded bg-gray-200 animate-pulse" 
          style={{ width: size, height: size }}
        />
        {showText && (
          <span className={`font-heading font-bold ${textClassName}`}>
            FieldNote
          </span>
        )}
      </div>
    );
  }

  // For now, always use transparent logo (works best on dark navigation)
  // TODO: Implement proper theme detection when next-themes is added
  const logoSrc = "/logo-transparent.png";

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Image
        src={logoSrc}
        alt="FieldNote"
        width={size}
        height={size}
        className="flex-shrink-0"
        priority
      />
      {showText && (
        <span className={`font-heading font-bold ${textClassName}`}>
          FieldNote
        </span>
      )}
    </div>
  );
}
