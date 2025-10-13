"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
  variant?: "light" | "dark" | "auto";
}

export default function Logo({ 
  className = "", 
  size = 48, 
  showText = true, 
  textClassName = "",
  variant = "auto"
}: LogoProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
    
    // Check for dark mode preference
    if (variant === "auto") {
      const checkDarkMode = () => {
        setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
      };
      
      checkDarkMode();
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", checkDarkMode);
      
      return () => mediaQuery.removeEventListener("change", checkDarkMode);
    }
  }, [variant]);

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

  // Determine logo source based on variant
  let logoSrc: string;
  switch (variant) {
    case "light":
      logoSrc = "/logo-fieldnote-main-transparent.png";
      break;
    case "dark":
      logoSrc = "/logo-fieldnote-white.png";
      break;
    case "auto":
    default:
      logoSrc = isDark ? "/logo-fieldnote-white.png" : "/logo-fieldnote-main-transparent.png";
      break;
  }

  // Calculate aspect ratio (1024x256 = 4:1)
  const logoHeight = size;
  const logoWidth = size * 4; // Maintain 4:1 aspect ratio

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <Image
        src={logoSrc}
        alt="FieldNote"
        width={logoWidth}
        height={logoHeight}
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
