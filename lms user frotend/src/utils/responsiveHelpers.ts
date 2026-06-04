/**
 * Responsive Design Utility Helper
 * Provides consistent responsive Tailwind classes for mobile-first design
 */

import React from 'react';

export const responsiveClasses = {
  // Container & Spacing
  container: 'w-full px-4 sm:px-6 md:px-8 lg:px-10',
  containerPadding: 'p-4 sm:p-6 md:p-8',
  containerPaddingY: 'py-4 sm:py-6 md:py-8',
  
  // Typography
  headingLg: 'text-2xl sm:text-3xl md:text-4xl font-bold',
  headingMd: 'text-xl sm:text-2xl md:text-3xl font-bold',
  headingSm: 'text-lg sm:text-xl font-semibold',
  textBase: 'text-sm sm:text-base',
  
  // Grids
  gridAuto2Col: 'grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4',
  gridAuto3Col: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4',
  gridAuto4Col: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4',
  gridAuto6Col: 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3',
  
  // Flexbox
  flexBetween: 'flex items-center justify-between',
  flexBetweenResponsive: 'flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3',
  flexCenter: 'flex items-center justify-center',
  flexCenterResponsive: 'flex flex-col sm:flex-row items-center justify-center gap-3',
  
  // Button sizes
  buttonSmall: 'px-2 py-1.5 text-xs sm:text-sm h-8 sm:h-9',
  buttonBase: 'px-4 py-2 text-sm sm:text-base h-9 sm:h-10',
  buttonLarge: 'px-6 py-3 text-base sm:text-lg h-10 sm:h-11',
  
  // Card styling
  card: 'rounded-lg border border-border p-3 sm:p-4 md:p-5',
  cardHover: 'rounded-lg border border-border p-3 sm:p-4 md:p-5 hover:border-primary/30 hover:shadow-md transition-all',
  
  // Modals/Dialogs
  dialogPadding: 'p-4 sm:p-6',
  
  // Lists
  listGap: 'space-y-2 sm:space-y-3',
  
  // Responsive padding utilities
  paddingMobile: 'p-3 sm:p-4 md:p-5',
  paddingMobileX: 'px-3 sm:px-4 md:px-6',
  paddingMobileY: 'py-2 sm:py-3 md:py-4',
  
  // Gaps
  gapSmall: 'gap-2 sm:gap-3',
  gapBase: 'gap-3 sm:gap-4',
  gapLarge: 'gap-4 sm:gap-6',
};

/**
 * Get responsive font size class
 * Usage: responsiveFontSize('sm', 'base', 'lg')
 */
export function responsiveFontSize(mobile: string, tablet: string, desktop: string): string {
  return `text-${mobile} sm:text-${tablet} md:text-${desktop}`;
}

/**
 * Get responsive width class
 * Usage: responsiveWidth('full', '3/4', 'max-w-4xl')
 */
export function responsiveWidth(mobile: string, tablet?: string, desktop?: string): string {
  let classes = `w-${mobile}`;
  if (tablet) classes += ` sm:w-${tablet}`;
  if (desktop) classes += ` md:w-${desktop}`;
  return classes;
}

/**
 * Get responsive grid class
 * Usage: responsiveGrid(1, 2, 3) -> grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3
 */
export function responsiveGrid(mobile: number, tablet?: number, desktop?: number): string {
  let classes = `grid grid-cols-${mobile}`;
  if (tablet) classes += ` sm:grid-cols-${tablet}`;
  if (desktop) classes += ` md:grid-cols-${desktop}`;
  return classes;
}

/**
 * Check if device is mobile based on viewport size
 * Use sparingly - prefer CSS-based responsive classes
 */
export function useIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 640; // sm breakpoint is 640px
}

/**
 * Check if device is tablet
 */
export function useIsTablet(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 640 && window.innerWidth < 1024; // sm to lg
}

/**
 * Check if device is desktop
 */
export function useIsDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}

/**
 * Media query hook for responsive behavior
 * Usage: const isMobile = useMediaQuery('(max-width: 640px)')
 */
export function useMediaQuery(query: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const [matches, setMatches] = React.useState(false);
  
  React.useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);
  
  return matches;
}

// For standalone responsive utilities without React imports
export const mobileResponsiveCSS = `
  /* Mobile-first responsive utilities */
  @media (max-width: 640px) {
    .mobile-hidden { display: none !important; }
  }
  
  @media (min-width: 641px) {
    .mobile-only { display: none !important; }
  }
`;
