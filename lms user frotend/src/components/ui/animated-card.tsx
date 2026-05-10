import React from 'react';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedCardProps {
  title?: string;
  description?: string;
  buttonText?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: 'default' | 'warning' | 'success' | 'info';
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  title = "Tailwind Card",
  description = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nunc felis ligula.",
  buttonText = "Read More",
  icon,
  onClick,
  className,
  variant = 'default'
}) => {
  const getVariantClasses = () => {
    switch (variant) {
      case 'warning':
        return {
          gradient: 'from-amber-600 via-amber-500 to-orange-600',
          shadow: 'shadow-amber-500/30 hover:shadow-amber-500/40',
          buttonGradient: 'from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600'
        };
      case 'success':
        return {
          gradient: 'from-emerald-600 via-emerald-500 to-green-600',
          shadow: 'shadow-emerald-500/30 hover:shadow-emerald-500/40',
          buttonGradient: 'from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600'
        };
      case 'info':
        return {
          gradient: 'from-cyan-600 via-cyan-500 to-blue-600',
          shadow: 'shadow-cyan-500/30 hover:shadow-cyan-500/40',
          buttonGradient: 'from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600'
        };
      default:
        return {
          gradient: 'from-blue-600 via-blue-500 to-indigo-600',
          shadow: 'shadow-blue-500/30 hover:shadow-blue-500/40',
          buttonGradient: 'from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600'
        };
    }
  };

  const variantClasses = getVariantClasses();

  return (
    <div
      className={cn(
        "relative flex w-full max-w-sm flex-col rounded-xl bg-gradient-to-br from-background to-muted bg-clip-border text-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {/* Header with gradient and animated background */}
      <div className="relative mx-4 -mt-6 h-40 overflow-hidden rounded-xl bg-clip-border shadow-lg group">
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-r opacity-90",
            variantClasses.gradient
          )}
        ></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px] animate-pulse"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          {icon || (
            <AlertTriangle className="w-20 h-20 text-white/90 transform transition-transform group-hover:scale-110 duration-300" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <h5 className="mb-2 block font-sans text-xl font-semibold leading-snug tracking-normal text-foreground antialiased group-hover:text-primary transition-colors duration-300">
          {title}
        </h5>
        <p className="block font-sans text-base font-light leading-relaxed text-muted-foreground antialiased">
          {description}
        </p>
      </div>

      {/* Button */}
      <div className="p-6 pt-0">
        <button
          className={cn(
            "group relative w-full inline-flex items-center justify-center px-6 py-3 font-bold text-white rounded-lg bg-gradient-to-r shadow-lg transition-all duration-300 hover:-translate-y-0.5",
            variantClasses.buttonGradient,
            variantClasses.shadow
          )}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          <span className="relative flex items-center gap-2">
            {buttonText}
            <ArrowRight className="w-5 h-5 transform transition-transform group-hover:translate-x-1" />
          </span>
        </button>
      </div>
    </div>
  );
};

export default AnimatedCard;