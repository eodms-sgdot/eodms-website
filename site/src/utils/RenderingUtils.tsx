import { useState, useEffect } from "react";

/** Up to two initials from a name or username, e.g. "jane.doe" or "Jane Doe" becomes "JD". */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/[\s._-]+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

/**
 * Determines whether the SPA should use its compact mobile layout.
 * Touch-first browsers can report a desktop-sized viewport when requesting desktop sites.
 * @param breakpoint the max width to be considered 'mobile'; default is 768
 * @returns whether the device is a mobile phone
 */
export function useIsMobile(breakpoint = 1024) {
  const query = `(max-width: ${breakpoint}px), (pointer: coarse) and (hover: none)`;
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);

    // Define listener callback
    const handleResize = (e: { matches: boolean | ((prevState: boolean) => boolean); }) => setIsMobile(e.matches);

    // Listen for changes
    mediaQuery.addEventListener("change", handleResize);
    
    // Clean up listener on unmount
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, [query]);

  return isMobile;
}