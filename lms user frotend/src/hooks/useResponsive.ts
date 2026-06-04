import { useEffect, useState } from 'react';

/**
 * Custom hook to detect responsive breakpoints
 * Usage: const { isMobile, isTablet, isDesktop } = useResponsive();
 */
export function useResponsive() {
  const [screenSize, setScreenSize] = useState<{
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    width: number;
  }>({
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 640 : false,
    isTablet: typeof window !== 'undefined' ? window.innerWidth >= 640 && window.innerWidth < 1024 : false,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setScreenSize({
        isMobile: width < 640,
        isTablet: width >= 640 && width < 1024,
        isDesktop: width >= 1024,
        width,
      });
    };

    window.addEventListener('resize', handleResize);
    // Set initial size
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screenSize;
}

/**
 * Hook to get responsive class names based on current breakpoint
 * Usage: const classes = useResponsiveClasses('sm:text-lg', 'lg:text-xl');
 */
export function useResponsiveClasses(...classNames: string[]): string {
  const { width } = useResponsive();

  return classNames.join(' ');
}

/**
 * Hook to detect if device supports hover (desktop) or uses touch (mobile)
 * Usage: const { isHoverDevice } = usePointerType();
 */
export function usePointerType() {
  const [pointerType, setPointerType] = useState<{
    isHoverDevice: boolean;
    isTouchDevice: boolean;
  }>({
    isHoverDevice: typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches,
    isTouchDevice: typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  });

  useEffect(() => {
    const hoverQuery = window.matchMedia('(hover: hover)');
    const touchQuery = window.matchMedia('(pointer: coarse)');

    const handleChange = () => {
      setPointerType({
        isHoverDevice: hoverQuery.matches,
        isTouchDevice: touchQuery.matches,
      });
    };

    hoverQuery.addEventListener('change', handleChange);
    touchQuery.addEventListener('change', handleChange);

    return () => {
      hoverQuery.removeEventListener('change', handleChange);
      touchQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return pointerType;
}

/**
 * Hook to get responsive padding values
 * Usage: const padding = useResponsivePadding('mobile', 'tablet', 'desktop');
 */
export function useResponsivePadding(mobile: number, tablet?: number, desktop?: number) {
  const { width } = useResponsive();

  if (width < 640) return mobile;
  if (width < 1024) return tablet ?? mobile;
  return desktop ?? tablet ?? mobile;
}

/**
 * Hook to get responsive spacing scale
 * Usage: const { spacingSm, spacingMd, spacingLg } = useResponsiveSpacing();
 */
export function useResponsiveSpacing() {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  return {
    spacingXs: 8,
    spacingSm: isMobile ? 12 : 12,
    spacingMd: isMobile ? 16 : 16,
    spacingLg: isMobile ? 24 : 24,
    spacingXl: isMobile ? 32 : 32,
    spacing2xl: isMobile ? 48 : 48,
    gap: isMobile ? 8 : 16,
    padding: isMobile ? 12 : 16,
  };
}

/**
 * Hook to check if virtual keyboard is visible
 * Useful for hiding bottom navigation when keyboard is open
 * Usage: const { isKeyboardOpen } = useVirtualKeyboard();
 */
export function useVirtualKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const threshold = window.innerHeight * 0.75;
      const vv = window.visualViewport;
      if (vv) {
        setIsKeyboardOpen(vv.height < threshold);
      }
    };

    const vv = window.visualViewport;
    if (!vv) return;

    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, []);

  return { isKeyboardOpen };
}

/**
 * Hook to get responsive columns for grid
 * Usage: const cols = useResponsiveColumns(1, 2, 3);
 * Returns 1 on mobile, 2 on tablet, 3 on desktop
 */
export function useResponsiveColumns(mobile: number, tablet?: number, desktop?: number): number {
  const { width } = useResponsive();

  if (width < 640) return mobile;
  if (width < 1024) return tablet ?? mobile;
  return desktop ?? tablet ?? mobile;
}

/**
 * Hook to get responsive button size
 * Usage: const buttonSize = useResponsiveButtonSize();
 * Returns 'sm' on mobile, 'md' on tablet, 'lg' on desktop
 */
export function useResponsiveButtonSize(): 'sm' | 'md' | 'lg' {
  const { isMobile, isTablet } = useResponsive();

  if (isMobile) return 'sm';
  if (isTablet) return 'md';
  return 'lg';
}

/**
 * Hook to check if screen is small (mobile)
 * Convenient shortcut for mobile-specific logic
 * Usage: const isSmallScreen = useIsSmallScreen();
 */
export function useIsSmallScreen(threshold: number = 640): boolean {
  const [isSmall, setIsSmall] = useState(typeof window !== 'undefined' ? window.innerWidth < threshold : false);

  useEffect(() => {
    const handleResize = () => {
      setIsSmall(window.innerWidth < threshold);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [threshold]);

  return isSmall;
}

/**
 * Hook to measure element dimensions responsively
 * Usage: const { width, height } = useElementDimensions(ref);
 */
export function useElementDimensions(ref: React.RefObject<HTMLElement>) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) return;

    const updateDimensions = () => {
      setDimensions({
        width: ref.current?.clientWidth ?? 0,
        height: ref.current?.clientHeight ?? 0,
      });
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(ref.current);

    updateDimensions();

    return () => resizeObserver.disconnect();
  }, [ref]);

  return dimensions;
}

/**
 * Hook to detect orientation changes
 * Usage: const { isPortrait, isLandscape } = useOrientation();
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<{
    isPortrait: boolean;
    isLandscape: boolean;
  }>({
    isPortrait: typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false,
    isLandscape: typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false,
  });

  useEffect(() => {
    const handleOrientationChange = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setOrientation({
        isPortrait,
        isLandscape: !isPortrait,
      });
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    handleOrientationChange();

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleOrientationChange);
    };
  }, []);

  return orientation;
}

/**
 * Hook to check safe area insets (for notched devices)
 * Usage: const { top, bottom, left, right } = useSafeArea();
 */
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const root = document.documentElement;
    const updateSafeArea = () => {
      setSafeArea({
        top: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-top') || '0'),
        bottom: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-left') || '0'),
        right: parseInt(getComputedStyle(root).getPropertyValue('--safe-area-inset-right') || '0'),
      });
    };

    const resizeObserver = new ResizeObserver(updateSafeArea);
    resizeObserver.observe(root);
    updateSafeArea();

    return () => resizeObserver.disconnect();
  }, []);

  return safeArea;
}
