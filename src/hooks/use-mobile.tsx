import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // Safety check for iOS Safari
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      const onChange = () => {
        try {
          setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        } catch (error) {
          console.warn('useIsMobile: Error in onChange handler:', error);
          // Fallback to false on error
          setIsMobile(false);
        }
      };
      
      mql.addEventListener("change", onChange);
      
      // Initial check with error handling
      try {
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
      } catch (error) {
        console.warn('useIsMobile: Error in initial check:', error);
        setIsMobile(false);
      }
      
      return () => {
        try {
          mql.removeEventListener("change", onChange);
        } catch (error) {
          console.warn('useIsMobile: Error removing listener:', error);
        }
      };
    } catch (error) {
      console.warn('useIsMobile: Error setting up media query:', error);
      setIsMobile(false);
    }
  }, []);

  // Return false as fallback to prevent hydration issues
  return isMobile ?? false;
}

