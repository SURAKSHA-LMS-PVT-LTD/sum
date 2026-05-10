import React from 'react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: React.ReactNode;
}

/**
 * A safe image component that handles errors via React state
 * instead of direct DOM manipulation, preventing "removeChild" errors
 */
export const SafeImage = ({ fallback, src, alt, ...props }: SafeImageProps) => {
  const [hasError, setHasError] = React.useState(false);

  // Reset error state when src changes
  React.useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError || !src) {
    return <>{fallback}</> || null;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setHasError(true)}
      {...props}
    />
  );
};

export default SafeImage;
