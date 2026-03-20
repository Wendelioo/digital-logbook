import React from 'react';

interface LoadingDotsProps {
  className?: string;
  dotClassName?: string;
  label?: string;
}

const LoadingDots: React.FC<LoadingDotsProps> = ({
  className = '',
  dotClassName = '',
  label = 'Loading',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`} role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      <span className={`h-2.5 w-2.5 rounded-full bg-primary-600 animate-loading-dot ${dotClassName}`} />
      <span className={`h-2.5 w-2.5 rounded-full bg-primary-600 animate-loading-dot ${dotClassName}`} style={{ animationDelay: '0.16s' }} />
      <span className={`h-2.5 w-2.5 rounded-full bg-primary-600 animate-loading-dot ${dotClassName}`} style={{ animationDelay: '0.32s' }} />
    </div>
  );
};

export default LoadingDots;
