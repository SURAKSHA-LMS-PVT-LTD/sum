import React from 'react';
import { cn } from '@/lib/utils';

interface SelectorCardProps {
  title: string;
  description?: string;
  buttonText?: string;
  icon?: React.ReactNode;
  imageUrl?: string;
  onSelect: () => void;
  onImageError?: () => void;
  badges?: React.ReactNode;
  extraContent?: React.ReactNode;
  className?: string;
}

const SelectorCard: React.FC<SelectorCardProps> = ({
  title,
  description,
  buttonText = "Select",
  icon,
  imageUrl,
  onSelect,
  onImageError,
  badges,
  extraContent,
  className
}) => {
  return (
    <div
      className={cn(
        "relative flex w-80 flex-col rounded-xl bg-card bg-clip-border text-card-foreground shadow-md hover:shadow-lg transition-all duration-300",
        className
      )}
    >
      {/* Header with gradient and image */}
      <div className="relative mx-4 -mt-6 h-40 overflow-hidden rounded-xl bg-clip-border text-white shadow-lg shadow-primary/40 bg-gradient-to-r from-primary to-primary/80">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            onError={onImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-primary to-primary/80">
            {icon}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        <h5 className="mb-2 block font-sans text-xl font-semibold leading-snug tracking-normal text-foreground antialiased line-clamp-2">
          {title}
        </h5>
        
        {badges && (
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {badges}
          </div>
        )}
        
        {description && (
          <p className="block font-sans text-base font-light leading-relaxed text-muted-foreground antialiased line-clamp-2">
            {description}
          </p>
        )}
        
        {extraContent}
      </div>

      {/* Button */}
      <div className="p-6 pt-0">
        <button
          data-ripple-light="true"
          type="button"
          onClick={onSelect}
          className="w-full select-none rounded-lg bg-primary py-3 px-6 text-center align-middle font-sans text-xs font-bold uppercase text-primary-foreground shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:shadow-primary/40 focus:opacity-85 focus:shadow-none active:opacity-85 active:shadow-none disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default SelectorCard;
