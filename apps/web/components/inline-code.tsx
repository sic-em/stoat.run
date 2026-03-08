import { cn } from '@/lib/utils';

export function InlineCode({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <code
      className={cn(
        'rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground',
        className,
      )}
    >
      {children}
    </code>
  );
}
