import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  /**
   * Max width for the page content. Defaults to 'full' so every page uses the
   * full available width — keeps the system visually consistent. Pass a smaller
   * value only when a specific page must stay narrow (e.g. a focused form).
   */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  className?: string;
}

const MAX_WIDTH_CLASSES: Record<NonNullable<PageContainerProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full',
};

const PageContainer = ({
  children,
  maxWidth = 'full',
  className = '',
}: PageContainerProps) => {
  const maxWidthClass = MAX_WIDTH_CLASSES[maxWidth];
  const centerClass = maxWidth === 'full' ? '' : 'mx-auto';

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <div className={`w-full ${centerClass} px-3 sm:px-4 lg:px-6 py-4 sm:py-6 ${maxWidthClass}`}>
        <div className="space-y-4 sm:space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageContainer;
