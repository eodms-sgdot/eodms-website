import { useState, useEffect } from "react";

/**
 * Determines whether the device viewing the SPA is a mobile phone
 * It's based on whether the width of the screen is larger than the breakpoint
 *  * 
 * @param breakpoint the max width to be considered 'mobile'; default is 768
 * @returns whether the device is a mobile phone
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Define the media query
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    
    // Set initial value
    setIsMobile(mediaQuery.matches);

    // Define listener callback
    const handleResize = (e: { matches: boolean | ((prevState: boolean) => boolean); }) => setIsMobile(e.matches);

    // Listen for changes
    mediaQuery.addEventListener("change", handleResize);
    
    // Clean up listener on unmount
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, [breakpoint]);

  return isMobile;
}