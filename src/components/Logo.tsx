"use client";

import { useTheme } from "next-themes";
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
  size = 32, 
  showText = true, 
  textClassName = "" 
}: LogoProps) {
  const { theme, systemTheme } = useTheme();
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

  // Determine if we're in dark mode
  const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark");
  
  // Use transparent logo for dark backgrounds (navigation, etc.)
  // Use regular logo for light backgrounds
  const logoSrc = isDark ? "/logo-transparent.png" : "/logo.png";

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
