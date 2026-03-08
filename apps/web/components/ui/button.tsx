import type * as React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'default' | 'outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = 'default', type = 'button', ...props }: ButtonProps) {
  const variantClasses =
    variant === 'outline'
      ? 'border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800'
      : 'bg-primary text-primary-foreground hover:bg-primary/90';

  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 font-medium text-sm transition-colors disabled:pointer-events-none disabled:opacity-50',
        variantClasses,
        className,
      )}
      {...props}
    />
  );
}
