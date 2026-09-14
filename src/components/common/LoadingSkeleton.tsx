import React from 'react';
import { cn } from '../../lib/utils';

export const LoadingSkeleton: React.FC<{
  className?: string;
  count?: number;
}> = ({ className, count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'animate-pulse bg-slate-200 dark:bg-slate-800 rounded-xl',
            className || 'h-12 w-full'
          )}
        />
      ))}
    </>
  );
};
