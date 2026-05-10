import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl' | 'full';
  className?: string;
}

const PageContainer = ({ 
  children, 
  maxWidth = '7xl', 
  className = '' 
}: PageContainerProps) => {
  const maxWidthClass = {
    'sm': 'max-w-sm',
    'md': 'max-w-md', 
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '7xl': 'max-w-7xl',
    'full': 'max-w-full'
  }[maxWidth];

  return (
    <div className={`h-full overflow-auto ${className}`}>
      <div className={`container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 ${maxWidthClass}`}>
        <div className="space-y-4 sm:space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default PageContainer;