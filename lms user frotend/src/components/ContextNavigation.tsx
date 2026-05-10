import React from 'react';
import { useLocation } from 'react-router-dom';
import { useContextNavigation, isRouteActive } from '@/utils/routeContext';
import { cn } from '@/lib/utils';

/**
 * 🔗 Context-Aware Navigation Link
 * 
 * Automatically includes institute/class/subject context in navigation
 * Highlights active routes correctly regardless of context in URL
 */

interface ContextNavLinkProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  onClick?: () => void;
}

export const ContextNavLink: React.FC<ContextNavLinkProps> = ({
  to,
  children,
  className = '',
  activeClassName = 'bg-accent text-accent-foreground',
  onClick
}) => {
  const location = useLocation();
  const navigateWithContext = useContextNavigation();
  
  const isActive = isRouteActive(location.pathname, to);
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateWithContext(to);
    onClick?.();
  };
  
  return (
    <a
      href={to}
      onClick={handleClick}
      className={cn(
        className,
        isActive && activeClassName
      )}
    >
      {children}
    </a>
  );
};

/**
 * 🔗 Context-Aware Navigation Button
 */

interface ContextNavButtonProps {
  to: string;
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  onClick?: () => void;
}

export const ContextNavButton: React.FC<ContextNavButtonProps> = ({
  to,
  children,
  className = '',
  variant = 'default',
  onClick
}) => {
  const navigateWithContext = useContextNavigation();
  
  const handleClick = () => {
    navigateWithContext(to);
    onClick?.();
  };
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
        {
          'bg-primary text-primary-foreground shadow hover:bg-primary/90': variant === 'default',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80': variant === 'secondary',
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground': variant === 'outline',
          'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
        },
        'h-9 px-4 py-2',
        className
      )}
    >
      {children}
    </button>
  );
};

/**
 * 🔗 Sidebar Navigation Item
 */

interface SidebarNavItemProps {
  to: string;
  icon?: React.ReactNode;
  label: string;
  badge?: string | number;
  onClick?: () => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  to,
  icon,
  label,
  badge,
  onClick
}) => {
  const location = useLocation();
  const navigateWithContext = useContextNavigation();
  
  const isActive = isRouteActive(location.pathname, to);
  
  const handleClick = () => {
    console.log('📍 Sidebar navigation clicked:', { to, currentPath: location.pathname });
    navigateWithContext(to);
    onClick?.();
  };
  
  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 w-full text-left transition-all hover:bg-accent hover:text-accent-foreground',
        isActive && 'bg-accent text-accent-foreground font-semibold'
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
};

/**
 * 🔗 Breadcrumb with Context
 */

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface ContextBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const ContextBreadcrumb: React.FC<ContextBreadcrumbProps> = ({
  items,
  className = ''
}) => {
  const navigateWithContext = useContextNavigation();
  
  return (
    <nav className={cn('flex items-center space-x-2 text-sm', className)} aria-label="Breadcrumb">
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-muted-foreground">/</span>}
          {item.path ? (
            <button
              onClick={() => navigateWithContext(item.path!)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-foreground font-semibold">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

/**
 * 🔗 Tab Navigation with Context
 */

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface ContextTabsProps {
  tabs: TabItem[];
  className?: string;
}

export const ContextTabs: React.FC<ContextTabsProps> = ({
  tabs,
  className = ''
}) => {
  const location = useLocation();
  const navigateWithContext = useContextNavigation();
  
  return (
    <div className={cn('border-b border-border', className)}>
      <div className="flex space-x-1">
        {tabs.map((tab) => {
          const isActive = isRouteActive(location.pathname, tab.path);
          
          return (
            <button
              key={tab.id}
              onClick={() => navigateWithContext(tab.path)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-all',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default {
  ContextNavLink,
  ContextNavButton,
  SidebarNavItem,
  ContextBreadcrumb,
  ContextTabs
};
