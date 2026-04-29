import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-amber/30 bg-paper px-3 py-2 text-sm text-ink-1 transition-colors',
          'placeholder:text-ink-3 placeholder:italic',
          'focus-visible:outline-none focus-visible:border-terra focus-visible:ring-2 focus-visible:ring-amber/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
