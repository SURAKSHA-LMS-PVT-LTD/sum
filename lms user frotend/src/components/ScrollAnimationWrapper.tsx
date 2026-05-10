import React, { ReactNode } from 'react';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { cn } from '@/lib/utils';

interface ScrollAnimationWrapperProps {
  children: ReactNode;
  animationType?: 'slide-up' | 'fade' | 'scale';
  threshold?: number;
  className?: string;
}

export const ScrollAnimationWrapper: React.FC<ScrollAnimationWrapperProps> = ({
  children,
  animationType = 'slide-up',
  threshold = 50,
  className,
}) => {
  const { isVisible } = useScrollDirection(threshold);

  const getAnimationClasses = () => {
    switch (animationType) {
      case 'fade':
        return isVisible
          ? 'opacity-100 transition-opacity duration-300'
          : 'opacity-0 transition-opacity duration-300 pointer-events-none';
      case 'scale':
        return isVisible
          ? 'scale-100 transition-transform duration-300 origin-top'
          : 'scale-95 transition-transform duration-300 origin-top pointer-events-none';
      case 'slide-up':
      default:
        return isVisible
          ? 'translate-y-0 transition-transform duration-300'
          : '-translate-y-full transition-transform duration-300 pointer-events-none';
    }
  };

  return (
    <div className={cn(getAnimationClasses(), className)}>
      {children}
    </div>
  );
};

export default ScrollAnimationWrapper;
