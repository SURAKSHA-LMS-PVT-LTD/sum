import { useEffect, useState, useRef } from 'react';

interface ScrollState {
  isScrollingDown: boolean;
  isVisible: boolean;
  scrollPosition: number;
}

export const useScrollDirection = (threshold: number = 50): ScrollState => {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollPosition = useRef(0);
  const rafId = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleScroll = () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }

      rafId.current = requestAnimationFrame(() => {
        const currentScroll = window.scrollY;
        
        setScrollPosition(currentScroll);

        // Show on scroll near top
        if (currentScroll < threshold) {
          setIsVisible(true);
          return;
        }

        // Scroll down
        if (currentScroll > lastScrollPosition.current) {
          setIsScrollingDown(true);
          setIsVisible(false);
        }
        // Scroll up
        else {
          setIsScrollingDown(false);
          setIsVisible(true);
        }

        lastScrollPosition.current = currentScroll;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [threshold]);

  return { isScrollingDown, isVisible, scrollPosition };
};
